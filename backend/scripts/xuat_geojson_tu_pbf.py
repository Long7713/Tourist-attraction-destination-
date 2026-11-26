"""Xuất dữ liệu bản đồ nền ra GeoJSON từ file OpenStreetMap đã tải về máy (.osm.pbf), không phụ thuộc máy chủ Overpass.

Tải file một lần (khoảng 350 MB) rồi chạy, từ thư mục backend:
    mkdir -p du_lieu/nguon
    curl -L -o du_lieu/nguon/vietnam-latest.osm.pbf https://download.geofabrik.de/asia/vietnam-latest.osm.pbf
    pip install -r requirements-dulieu-bando.txt
    python -m scripts.xuat_geojson_tu_pbf [duong_dan_pbf] [nam bac tay dong]
Các tầng chi tiết giống scripts.xuat_geojson_hcm: đường lớn phủ cả khung, đường vừa phủ vùng quanh trung tâm,
đường nhỏ và công viên phủ nội thành, tòa nhà chỉ khu trung tâm. Kết quả nằm trong du_lieu/ban_do/.
"""
import os
import sys
import tempfile
import time
from pathlib import Path

from app.config import THU_MUC_BAN_DO, THU_MUC_DU_LIEU
from scripts.xuat_geojson_hcm import BIEN_PHAM_VI, KHUNG_MAC_DINH, TAM

DUONG_DAN_PBF_MAC_DINH = THU_MUC_DU_LIEU / "nguon" / "vietnam-latest.osm.pbf"

# cấp đường -> lớp, mỗi lớp là một file GeoJSON, kèm vùng phủ và dung sai đơn giản hóa (độ)
CAP_DUONG = {
    "motorway": "duong_chinh", "trunk": "duong_chinh", "primary": "duong_chinh",
    "secondary": "duong_phu", "tertiary": "duong_phu",
    "residential": "duong", "unclassified": "duong", "living_street": "duong", "pedestrian": "duong",
}
LOP = {
    "duong_chinh": ("rong", 0.00003), "duong_phu": ("trung", 0.00002), "duong": ("vua", 0.00001),
    "nuoc": ("trung", 0.00002), "cong_vien": ("vua", 0.00001), "toa_nha": ("hep", 0.000005),
}
KHOA_CAN_LAY = ("highway", "waterway", "building", "leisure", "landuse", "natural", "water")


def _tao_vung(khung):
    # đổi vùng phủ của mỗi lớp thành hình chữ nhật (tây, nam, đông, bắc)
    nam, bac, tay, dong = khung
    vung = {"rong": (tay, nam, dong, bac)}
    for ten, bien in BIEN_PHAM_VI.items():
        vung[ten] = (max(tay, TAM[1] - bien), max(nam, TAM[0] - bien), min(dong, TAM[1] + bien), min(bac, TAM[0] + bien))
    return vung


def _trong(vung, kinh_do, vi_do):
    return vung[0] <= kinh_do <= vung[2] and vung[1] <= vi_do <= vung[3]


class GhiLop:
    # ghi từng đối tượng vào file tạm của một lớp, xong thì đổi tên thành file chính thức
    def __init__(self, ten):
        self.ten = ten
        self.dich = THU_MUC_BAN_DO / f"{ten}.geojson"
        self.tam = THU_MUC_BAN_DO / f"{ten}.geojson.tam"
        self.file = open(self.tam, "w", encoding="utf-8")
        self.file.write('{"type":"FeatureCollection","features":[')
        self.so_luong = 0

    def them(self, hinh_hoc_json, thuoc_tinh):
        import json

        self.file.write(("," if self.so_luong else "") + '{"type":"Feature","properties":' + json.dumps(thuoc_tinh) + ',"geometry":' + hinh_hoc_json + "}")
        self.so_luong += 1

    def dong(self):
        self.file.write("]}")
        self.file.close()
        os.replace(self.tam, self.dich)
        print(f"  {self.dich.name}: {self.so_luong} đối tượng, {self.dich.stat().st_size // 1024} KB", flush=True)


def xuat(duong_dan_pbf: Path, khung) -> None:
    import osmium
    import shapely

    if not duong_dan_pbf.exists():
        sys.exit(f"Chưa có file {duong_dan_pbf}. Xem hướng dẫn tải ở đầu file này.")
    THU_MUC_BAN_DO.mkdir(parents=True, exist_ok=True)
    vung = _tao_vung(khung)
    ghi = {ten: GhiLop(ten) for ten in LOP}
    wkb = osmium.geom.WKBFactory()
    dem = {"duyet": 0}
    bat_dau = time.time()

    def trong_vung_lop(ten, diem_dau, diem_cuoi, diem_giua=None):
        v = vung[LOP[ten][0]]
        return any(_trong(v, d.lon, d.lat) for d in (diem_dau, diem_cuoi, diem_giua) if d is not None and d.valid())

    def ghi_hinh_hoc(ten, hinh_hoc, thuoc_tinh):
        # đơn giản hóa và làm tròn tọa độ để file nhẹ cho điện thoại
        dung_sai = LOP[ten][1]
        hinh_hoc = shapely.simplify(hinh_hoc, dung_sai, preserve_topology=False)
        if hinh_hoc.is_empty:
            return
        hinh_hoc = shapely.set_precision(hinh_hoc, 0.000005 if ten == "toa_nha" else 0.00001)
        if not hinh_hoc.is_empty:
            ghi[ten].them(shapely.to_geojson(hinh_hoc), thuoc_tinh)

    with tempfile.TemporaryDirectory() as thu_muc_tam:
        # chỉ mục vị trí nút lưu trên đĩa để không tốn nhiều RAM khi đọc cả nước
        xu_ly = (
            osmium.FileProcessor(str(duong_dan_pbf), osmium.osm.NODE | osmium.osm.WAY | osmium.osm.AREA)
            .with_locations(f"sparse_file_array,{thu_muc_tam}/nut.idx")
            .with_areas()
            .with_filter(osmium.filter.KeyFilter(*KHOA_CAN_LAY))
        )
        print("Đang đọc file bản đồ (vài phút)...", flush=True)
        for o in xu_ly:
            dem["duyet"] += 1
            if dem["duyet"] % 400000 == 0:
                print(f"  đã duyệt {dem['duyet']} đối tượng, {int(time.time() - bat_dau)} giây", flush=True)
            the = o.tags
            try:
                if o.is_way():
                    nut = o.nodes
                    if len(nut) < 2:
                        continue
                    cap = the.get("highway")
                    ten = CAP_DUONG.get(cap.removesuffix("_link")) if cap else None
                    thuoc_tinh = {"highway": cap.removesuffix("_link")} if ten else None
                    if ten is None and the.get("waterway") in ("river", "canal"):
                        ten, thuoc_tinh = "nuoc", {}
                    if ten is None or not trong_vung_lop(ten, nut[0].location, nut[-1].location, nut[len(nut) // 2].location):
                        continue
                    ghi_hinh_hoc(ten, shapely.from_wkb(wkb.create_linestring(o)), thuoc_tinh)
                elif o.is_area():
                    if "building" in the:
                        ten = "toa_nha"
                    elif the.get("leisure") in ("park", "garden") or the.get("landuse") == "grass":
                        ten = "cong_vien"
                    elif the.get("natural") == "water" or the.get("waterway") == "riverbank" or the.get("landuse") == "reservoir":
                        ten = "nuoc"
                    else:
                        continue
                    vong_ngoai = next(iter(o.outer_rings()), None)
                    if vong_ngoai is None or not trong_vung_lop(ten, vong_ngoai[0].location, vong_ngoai[len(vong_ngoai) // 2].location):
                        continue
                    ghi_hinh_hoc(ten, shapely.from_wkb(wkb.create_multipolygon(o)), {})
            except (RuntimeError, ValueError, osmium.InvalidLocationError):
                # đối tượng hỏng hoặc thiếu nút trong file, bỏ qua
                continue

    print("Đang ghi file:", flush=True)
    for lop in ghi.values():
        lop.dong()
    print(f"Xong sau {int(time.time() - bat_dau)} giây.")


if __name__ == "__main__":
    tham_so = sys.argv[1:]
    duong_dan = Path(tham_so[0]) if tham_so and not tham_so[0].replace(".", "").replace("-", "").isdigit() else DUONG_DAN_PBF_MAC_DINH
    so = [float(x) for x in tham_so if x.replace(".", "").replace("-", "").isdigit()]
    xuat(duong_dan, tuple(so) if len(so) == 4 else KHUNG_MAC_DINH)
