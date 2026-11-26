"""Xuất dữ liệu bản đồ nền từ OpenStreetMap ra GeoJSON để bản đồ chạy hoàn toàn local, không cần dịch vụ bản đồ ngoài.

Chạy khi có mạng, từ thư mục backend:
    pip install -r requirements-dulieu-bando.txt
    python -m scripts.xuat_geojson_hcm [nam bac tay dong]
Mặc định lấy đúng khung giới hạn bản đồ trong cài đặt. Kết quả nằm trong du_lieu/ban_do/ và được backend phục vụ ở /du-lieu-ban-do/.

Dữ liệu chia nhiều tầng chi tiết, vì lấy mọi con đường của cả khung rộng sẽ rất nặng cho điện thoại và cho việc dùng offline:
  đường lớn phủ cả khung, đường vừa phủ vùng quanh trung tâm, đường nhỏ và công viên phủ nội thành, tòa nhà chỉ khu trung tâm.
Máy chủ Overpass công cộng hay quá tải: script chia khung thành nhiều ô nhỏ và thử lại, kết quả được lưu đệm,
nên nếu một lớp lỗi cứ chạy lại lệnh, những ô đã tải xong sẽ không phải tải lại.
"""
import sys
import time

from app.config import THU_MUC_BAN_DO

# khung mặc định khớp với cài đặt giới hạn bản đồ: nam, bắc, tây, đông
KHUNG_MAC_DINH = (10.30, 11.20, 106.30, 107.10)
# tâm vùng trung tâm, các tầng chi tiết thu hẹp dần quanh điểm này
TAM = (10.7769, 106.7009)
# nửa cạnh của từng vùng, đơn vị độ (0.01 độ khoảng 1.1 km)
BIEN_PHAM_VI = {"trung": 0.22, "vua": 0.09, "hep": 0.014}
# dung sai làm đơn giản hình học theo vùng: vùng càng rộng càng thô để file nhẹ
DUNG_SAI = {"rong": 0.00003, "trung": 0.00002, "vua": 0.00001, "hep": 0.00001}

# tên lớp -> (bộ lọc thẻ OpenStreetMap, vùng phủ, số ô chia mỗi chiều khi tải)
CAC_LOP = {
    "duong_chinh": ({"highway": ["motorway", "trunk", "primary"]}, "rong", 4),
    "duong_phu": ({"highway": ["secondary", "tertiary"]}, "trung", 3),
    "duong": ({"highway": ["residential", "unclassified", "living_street", "pedestrian"]}, "vua", 3),
    "nuoc": ({"natural": "water", "waterway": ["river", "canal"]}, "trung", 3),
    "cong_vien": ({"leisure": ["park", "garden"], "landuse": "grass"}, "vua", 2),
    "toa_nha": ({"building": True}, "hep", 1),
}


def _vung(pham_vi, khung):
    nam, bac, tay, dong = khung
    bien = BIEN_PHAM_VI.get(pham_vi)
    if not bien:
        return nam, bac, tay, dong
    return max(nam, TAM[0] - bien), min(bac, TAM[0] + bien), max(tay, TAM[1] - bien), min(dong, TAM[1] + bien)


def _tai_mot_o(ox, bbox, the):
    # tải một ô, thử lại với thời gian chờ tăng dần
    for lan in range(1, 6):
        try:
            return ox.features_from_bbox(bbox=bbox, tags=the)
        except Exception as loi:
            if "InsufficientResponseError" in type(loi).__name__ or "No matching features" in str(loi):
                return None
            print(f"    lần {lan} lỗi: {str(loi)[:90]}", flush=True)
            time.sleep(15 * lan)
    raise RuntimeError("không tải được ô này")


def _tai_lop(ox, the, vung, chia):
    import pandas as pd

    nam, bac, tay, dong = vung
    cac_o = []
    for i in range(chia):
        for j in range(chia):
            o = (tay + (dong - tay) * j / chia, nam + (bac - nam) * i / chia, tay + (dong - tay) * (j + 1) / chia, nam + (bac - nam) * (i + 1) / chia)
            ket_qua = _tai_mot_o(ox, o, the)
            print(f"    ô {i * chia + j + 1}/{chia * chia}: {0 if ket_qua is None else len(ket_qua)} đối tượng", flush=True)
            if ket_qua is not None:
                cac_o.append(ket_qua)
    if not cac_o:
        return None
    gop = pd.concat(cac_o)
    # một con đường nằm vắt qua nhiều ô sẽ xuất hiện nhiều lần, giữ một bản
    return gop[~gop.index.duplicated()]


def xuat(nam: float, bac: float, tay: float, dong: float) -> None:
    import osmnx as ox

    ox.settings.requests_timeout = 300
    THU_MUC_BAN_DO.mkdir(parents=True, exist_ok=True)
    for ten, (the, pham_vi, chia) in CAC_LOP.items():
        vung = _vung(pham_vi, (nam, bac, tay, dong))
        print(f"Đang tải lớp '{ten}' (vùng {vung[0]:.3f}-{vung[1]:.3f}, {vung[2]:.3f}-{vung[3]:.3f})...", flush=True)
        try:
            doi_tuong = _tai_lop(ox, the, vung, chia)
        except RuntimeError as loi:
            print(f"  Bỏ qua lớp '{ten}': {loi}. Chạy lại lệnh để tải tiếp phần còn thiếu, giữ nguyên file cũ.", flush=True)
            continue
        if doi_tuong is None:
            continue
        # chỉ giữ hình học và vài thuộc tính cần thiết, đơn giản hóa để file nhẹ cho điện thoại
        cot_giu = [c for c in ("name", "highway", "geometry") if c in doi_tuong.columns]
        doi_tuong = doi_tuong[cot_giu].reset_index(drop=True)
        doi_tuong["geometry"] = doi_tuong.geometry.simplify(DUNG_SAI[pham_vi])
        doi_tuong = doi_tuong[~doi_tuong.geometry.is_empty]
        if "highway" in doi_tuong.columns:
            doi_tuong["highway"] = doi_tuong["highway"].astype(str)
        duong_dan = THU_MUC_BAN_DO / f"{ten}.geojson"
        doi_tuong.to_file(duong_dan, driver="GeoJSON")
        print(f"  Đã ghi {duong_dan.name}: {len(doi_tuong)} đối tượng, {duong_dan.stat().st_size // 1024} KB", flush=True)


if __name__ == "__main__":
    khung = tuple(float(x) for x in sys.argv[1:5]) if len(sys.argv) == 5 else KHUNG_MAC_DINH
    xuat(*khung)
