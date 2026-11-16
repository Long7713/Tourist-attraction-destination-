"""Nạp dữ liệu mẫu: 6 ngôn ngữ, 6 điểm ở trung tâm TP.HCM, cài đặt hệ thống.

Chạy từ thư mục backend:  python -m scripts.nap_du_lieu_mau
Nếu dùng MySQL hãy tạo database bằng database/thuyetminh_v2.sql trước, hoặc để script tự tạo bảng.
"""
from sqlalchemy import select

from app import models
from app.database import Base, PhienLamViec, engine
from scripts.noi_dung_mau import NOI_DUNG_MAU as NOI_DUNG

NGON_NGU = [
    ("vi", "Tiếng Việt", "Tiếng Việt", "vi-VN", 1, True),
    ("en", "English", "Tiếng Anh", "en-US", 2, False),
    ("es", "Español", "Tiếng Tây Ban Nha", "es-ES", 3, False),
    ("ko", "한국어", "Tiếng Hàn", "ko-KR", 4, False),
    ("zh", "中文", "Tiếng Trung", "zh-CN", 5, False),
    ("ru", "Русский", "Tiếng Nga", "ru-RU", 6, False),
]

# slug, tên nội bộ, vĩ độ, kinh độ, bán kính, thứ tự
DIEM = [
    ("ben-thanh", "Chợ Bến Thành", 10.7725, 106.6980, 120, 1),
    ("independence-palace", "Dinh Độc Lập", 10.7770, 106.6953, 120, 2),
    ("notre-dame", "Nhà thờ Đức Bà", 10.7798, 106.6990, 55, 3),
    ("central-post", "Bưu điện Trung tâm", 10.7799, 106.7000, 45, 4),
    ("opera-house", "Nhà hát Thành phố", 10.7765, 106.7030, 100, 5),
    ("nguyen-hue", "Phố đi bộ Nguyễn Huệ", 10.7740, 106.7030, 150, 6),
]


def nap() -> None:
    Base.metadata.create_all(engine)
    with PhienLamViec() as phien:
        if phien.scalar(select(models.NgonNgu).limit(1)):
            print("Đã có dữ liệu, bỏ qua (xóa dữ liệu cũ nếu muốn nạp lại).")
            return
        for ma, ban_ngu, tieng_viet, giong, thu_tu, mac_dinh in NGON_NGU:
            phien.add(models.NgonNgu(
                ma_ngon_ngu=ma, ten_ban_ngu=ban_ngu, ten_tieng_viet=tieng_viet,
                ma_giong_doc=giong, thu_tu=thu_tu, la_mac_dinh=mac_dinh,
            ))
        phien.flush()
        for slug, ten, vi_do, kinh_do, ban_kinh, thu_tu in DIEM:
            diem = models.DiemThamQuan(
                slug=slug, ten_diem=ten, vi_do=vi_do, kinh_do=kinh_do, ban_kinh_m=ban_kinh, thu_tu=thu_tu,
            )
            for ma, (tieu_de, mo_ta, noi_dung) in NOI_DUNG[slug].items():
                diem.noi_dung.append(models.NoiDungDiem(
                    ma_ngon_ngu=ma, tieu_de=tieu_de, mo_ta_ngan=mo_ta, noi_dung=noi_dung, trang_thai="da_dang",
                ))
            phien.add(diem)
        phien.commit()
    print("Đã nạp dữ liệu mẫu.")


if __name__ == "__main__":
    nap()
