import time

from app.services.vung import cac_cap_chong_vung, diem_gan_nhat_trong_vung, khoang_cach_m
from app.thoi_gian import chuan_hoa_gio_khach, gio_viet_nam
from datetime import timedelta


def xoa_noi_dung(slug, cac_ngon_ngu):
    # dữ liệu mẫu đã đủ 6 ngôn ngữ, xóa bớt để test tình huống thiếu bản dịch
    from sqlalchemy import delete, select

    from app.database import PhienLamViec
    from app.models import DiemThamQuan, NoiDungDiem

    with PhienLamViec() as phien:
        diem_id = phien.scalar(select(DiemThamQuan.id).where(DiemThamQuan.slug == slug))
        phien.execute(delete(NoiDungDiem).where(NoiDungDiem.diem_id == diem_id, NoiDungDiem.ma_ngon_ngu.in_(cac_ngon_ngu)))
        phien.commit()


class Diem:
    def __init__(self, ten, vi_do, kinh_do, ban_kinh_m):
        self.ten_diem, self.vi_do, self.kinh_do, self.ban_kinh_m = ten, vi_do, kinh_do, ban_kinh_m


def test_khoang_cach_haversine():
    # Bến Thành - Dinh Độc Lập khoảng 0.6 km
    d = khoang_cach_m(10.7725, 106.6980, 10.7770, 106.6953)
    assert 500 < d < 650


def test_chon_diem_gan_tam_nhat_khi_chong_vung():
    a, b = Diem("A", 10.0, 106.0, 200), Diem("B", 10.0, 106.001, 200)
    diem, _ = diem_gan_nhat_trong_vung(10.0, 106.0008, [a, b])
    assert diem is b
    assert diem_gan_nhat_trong_vung(11.0, 107.0, [a, b])[0] is None
    assert len(cac_cap_chong_vung([a, b])) == 1


def test_gio_khach_khong_hop_le_duoc_thay_bang_gio_server():
    bay_gio = gio_viet_nam()
    assert chuan_hoa_gio_khach(bay_gio + timedelta(days=3)) >= bay_gio
    assert chuan_hoa_gio_khach(bay_gio - timedelta(days=400)) >= bay_gio
    hai_gio_truoc = bay_gio - timedelta(hours=2)
    assert chuan_hoa_gio_khach(hai_gio_truoc) == hai_gio_truoc


def test_danh_sach_ngon_ngu_du_6(may_khach):
    ma = [n["ma"] for n in may_khach.get("/api/ngon-ngu").json()]
    assert ma == ["vi", "en", "es", "ko", "zh", "ru"]


def test_diem_theo_ngon_ngu_va_du_phong_tieng_viet(may_khach):
    en = may_khach.get("/api/diem/ben-thanh?ngon_ngu=en").json()
    assert en["tieu_de"] == "Ben Thanh Market" and en["ngon_ngu_hien_thi"] == "en"
    assert may_khach.get("/api/diem/ben-thanh?ngon_ngu=ru").json()["ngon_ngu_hien_thi"] == "ru"
    # chưa có bản tiếng Nga nên dùng tiếng Việt
    xoa_noi_dung("ben-thanh", ["ru"])
    ru = may_khach.get("/api/diem/ben-thanh?ngon_ngu=ru").json()
    assert ru["ngon_ngu_hien_thi"] == "vi"
    assert may_khach.get("/api/diem/khong-co").status_code == 404


def test_vung_gan_nhat(may_khach):
    trong = may_khach.get("/api/vung/gan-nhat", params={"vi_do": 10.7726, "kinh_do": 106.6981, "ngon_ngu": "en"}).json()
    assert trong["trong_vung"] and trong["diem"]["slug"] == "ben-thanh"
    xa = may_khach.get("/api/vung/gan-nhat", params={"vi_do": 10.9, "kinh_do": 106.9}).json()
    assert xa == {"trong_vung": False}


def test_goi_offline_co_du_lieu(may_khach):
    goi = may_khach.get("/api/goi-offline").json()
    assert goi["phien_ban"] > 1 and len(goi["diem"]) == 6 and "ban_do_vi_do_nam" in goi["ban_do"]


def test_dong_bo_chong_trung_va_cap_nhat_ngon_ngu(may_khach):
    goi = {
        "truy_cap": [{"ma_su_kien": "tc-0000001", "ma_phien": "phien-000001", "ma_ngon_ngu": "vi"}],
        "nghe": [{"ma_su_kien": "ng-0000001", "ma_su_kien_truy_cap": "tc-0000001",
                  "diem_slug": "ben-thanh", "ma_ngon_ngu": "vi"}],
    }
    dau = may_khach.post("/api/dong-bo", json=goi, headers={"user-agent": "Mozilla/5.0 (iPhone) Mobile"}).json()
    assert dau == {"truy_cap_moi": 1, "nghe_moi": 1, "bo_qua": 0}
    # gửi lại cùng gói (mất mạng giữa chừng) không được ghi trùng, đổi ngôn ngữ thì cập nhật
    goi["truy_cap"][0]["ma_ngon_ngu"] = "ko"
    lan_hai = may_khach.post("/api/dong-bo", json=goi).json()
    assert lan_hai == {"truy_cap_moi": 0, "nghe_moi": 0, "bo_qua": 2}


def test_qr_chung_la_anh_png_theo_dia_chi_truyen_vao(may_khach):
    kq = may_khach.get("/api/qr.png", params={"dia_chi": "https://busbuss.example.com"})
    assert kq.status_code == 200 and kq.content[:8] == b"\x89PNG\r\n\x1a\n"
    # thiếu địa chỉ hoặc địa chỉ không phải http/https thì từ chối
    assert may_khach.get("/api/qr.png").status_code == 422
    for sai in ("khong-phai-dia-chi", "ftp://may-chu", "https://co khoang trang"):
        assert may_khach.get("/api/qr.png", params={"dia_chi": sai}).status_code == 422


def test_api_admin_can_dang_nhap(may_khach):
    assert may_khach.get("/api/admin/dashboard").status_code == 401
    assert may_khach.get("/api/admin/dashboard", headers={"Authorization": "Bearer gia-mao"}).status_code == 401
    sai = may_khach.post("/api/admin/dang-nhap", json={"ten_dang_nhap": "admin", "mat_khau": "sai-sai-sai"})
    assert sai.status_code == 401
    # đúng mật khẩu nhưng sai tên đăng nhập cũng bị từ chối, đúng cả hai thì vào được
    assert may_khach.post("/api/admin/dang-nhap", json={"ten_dang_nhap": "khac", "mat_khau": "123"}).status_code == 401
    assert may_khach.post("/api/admin/dang-nhap", json={"ten_dang_nhap": "admin", "mat_khau": "123"}).status_code == 200


def test_dashboard_dem_dung(may_khach, tieu_de_admin):
    goi = {"truy_cap": [
        {"ma_su_kien": f"tc-{i:07d}", "ma_phien": f"phien-{i % 2:06d}", "ma_ngon_ngu": "en"} for i in range(3)
    ], "nghe": [{"ma_su_kien": "ng-0000001", "ma_su_kien_truy_cap": "tc-0000000",
                 "diem_slug": "notre-dame", "ma_ngon_ngu": "en"}]}
    may_khach.post("/api/dong-bo", json=goi)
    d = may_khach.get("/api/admin/dashboard", headers=tieu_de_admin).json()
    assert d["tong_luot"] == 3 and d["tong_nguoi"] == 2 and d["luot_trong_thang"] == 3
    assert d["ty_le_ngon_ngu"] == {"en": 3}
    assert d["gio_cao_diem"]["luot"] == 3
    assert d["diem_nghe_nhieu_nhat"] == [{"ten_diem": "Nhà thờ Đức Bà", "so_lan": 1}]
    assert sum(x["luot"] for x in d["theo_ngay"]) == 3
    csv = may_khach.get("/api/admin/luot-truy-cap/xuat-csv", headers=tieu_de_admin)
    assert csv.status_code == 200 and csv.text.count("\n") == 4


def test_admin_sua_diem_tang_phien_ban_va_canh_bao_chong_vung(may_khach, tieu_de_admin):
    ds = may_khach.get("/api/admin/diem", headers=tieu_de_admin).json()
    assert ds["canh_bao_chong_vung"] == []
    diem = next(d for d in ds["du_lieu"] if d["slug"] == "central-post")
    phien_ban_truoc = may_khach.get("/api/phien-ban").json()["phien_ban"]
    time.sleep(1.1)
    diem["ban_kinh_m"] = 300
    assert may_khach.put(f"/api/admin/diem/{diem['id']}", json=diem, headers=tieu_de_admin).status_code == 200
    # số phiên bản tính theo thời điểm sửa gần nhất nên phải đổi sau khi sửa (chờ qua giây kế tiếp vì cột lưu theo giây)
    assert may_khach.get("/api/phien-ban").json()["phien_ban"] > phien_ban_truoc
    ds = may_khach.get("/api/admin/diem", headers=tieu_de_admin).json()
    assert ds["canh_bao_chong_vung"]


def test_admin_noi_dung_thieu_ban_dich_va_ban_nhap_khong_hien_cho_khach(may_khach, tieu_de_admin):
    xoa_noi_dung("ben-thanh", ["es", "ko", "zh", "ru"])
    diem_id = next(d["id"] for d in may_khach.get("/api/admin/diem", headers=tieu_de_admin).json()["du_lieu"]
                   if d["slug"] == "ben-thanh")
    xem = may_khach.get(f"/api/admin/diem/{diem_id}/noi-dung", headers=tieu_de_admin).json()
    assert {n["ma_ngon_ngu"] for n in xem["noi_dung"] if n["thieu"]} == {"es", "ko", "zh", "ru"}
    luu = may_khach.put(f"/api/admin/diem/{diem_id}/noi-dung/es", headers=tieu_de_admin, json={
        "tieu_de": "Mercado Ben Thanh", "noi_dung": "Un símbolo de la ciudad.", "trang_thai": "nhap"})
    assert luu.status_code == 200
    # bản nháp chưa đăng nên khách vẫn thấy tiếng Việt
    assert may_khach.get("/api/diem/ben-thanh?ngon_ngu=es").json()["ngon_ngu_hien_thi"] == "vi"
    may_khach.put(f"/api/admin/diem/{diem_id}/noi-dung/es", headers=tieu_de_admin, json={
        "tieu_de": "Mercado Ben Thanh", "noi_dung": "Un símbolo de la ciudad.", "trang_thai": "da_dang"})
    assert may_khach.get("/api/diem/ben-thanh?ngon_ngu=es").json()["tieu_de"] == "Mercado Ben Thanh"
    assert may_khach.put(f"/api/admin/diem/{diem_id}/noi-dung/xx", headers=tieu_de_admin, json={
        "tieu_de": "a", "noi_dung": "b"}).status_code == 404


def test_khong_con_api_cai_dat_hay_luu_dia_chi_qr(may_khach, tieu_de_admin):
    assert may_khach.get("/api/admin/cai-dat", headers=tieu_de_admin).status_code == 404
    assert may_khach.get("/api/admin/qr", headers=tieu_de_admin).status_code == 404


def test_toa_do_va_ban_kinh_khong_duoc_am(may_khach, tieu_de_admin):
    # lớp API: số âm bị từ chối trước khi chạm tới database
    hop_le = {"slug": "diem-thu", "ten_diem": "Điểm thử", "vi_do": 10.77, "kinh_do": 106.7, "ban_kinh_m": 100}
    for truong, gia_tri in (("vi_do", -10.77), ("kinh_do", -106.7), ("ban_kinh_m", -100), ("ban_kinh_m", 0)):
        sai = {**hop_le, truong: gia_tri}
        assert may_khach.post("/api/admin/diem", headers=tieu_de_admin, json=sai).status_code == 422
    assert may_khach.post("/api/admin/diem", headers=tieu_de_admin, json=hop_le).status_code == 201

    # lớp database: dù có ghi thẳng vào bảng, ràng buộc CHECK vẫn chặn số âm
    import pytest
    from sqlalchemy.exc import IntegrityError

    from app.database import PhienLamViec
    from app.models import DiemThamQuan

    for truong, gia_tri in (("vi_do", -1.0), ("kinh_do", -1.0), ("ban_kinh_m", -5)):
        with PhienLamViec() as phien:
            diem = DiemThamQuan(slug=f"am-{truong}", ten_diem="x", vi_do=10.0, kinh_do=106.0, ban_kinh_m=100)
            setattr(diem, truong, gia_tri)
            phien.add(diem)
            with pytest.raises(IntegrityError):
                phien.commit()


def test_khong_xoa_duoc_diem_con_noi_dung(may_khach):
    import pytest
    from sqlalchemy import delete, func, select
    from sqlalchemy.exc import IntegrityError

    from app.database import PhienLamViec
    from app.models import DiemThamQuan, NoiDungDiem

    with PhienLamViec() as phien:
        diem = phien.scalar(select(DiemThamQuan).where(DiemThamQuan.slug == "ben-thanh"))
        so_noi_dung = phien.scalar(select(func.count(NoiDungDiem.id)).where(NoiDungDiem.diem_id == diem.id))
        assert so_noi_dung == 6
        # xóa điểm khi còn nội dung phải bị chặn, kể cả khi xóa bằng lệnh DELETE thẳng vào bảng
        with pytest.raises(IntegrityError):
            phien.execute(delete(DiemThamQuan).where(DiemThamQuan.id == diem.id))
        phien.rollback()
        # đổi mã của điểm khi còn nội dung cũng bị chặn
        with pytest.raises(IntegrityError):
            phien.execute(DiemThamQuan.__table__.update().where(DiemThamQuan.id == diem.id).values(id=999))
        phien.rollback()
        # xóa nội dung trước thì mới xóa được điểm
        phien.execute(delete(NoiDungDiem).where(NoiDungDiem.diem_id == diem.id))
        phien.execute(delete(DiemThamQuan).where(DiemThamQuan.id == diem.id))
        phien.commit()
        assert phien.scalar(select(DiemThamQuan).where(DiemThamQuan.slug == "ben-thanh")) is None


def test_khong_xoa_duoc_luot_truy_cap_con_lich_su_nghe(may_khach):
    import pytest
    from sqlalchemy import delete, select
    from sqlalchemy.exc import IntegrityError

    from app.database import PhienLamViec
    from app.models import LichSuNghe, LuotTruyCap

    may_khach.post("/api/dong-bo", json={
        "truy_cap": [{"ma_su_kien": "tc-0000009", "ma_phien": "phien-000009", "ma_ngon_ngu": "vi"}],
        "nghe": [{"ma_su_kien": "ng-0000009", "ma_su_kien_truy_cap": "tc-0000009", "diem_slug": "ben-thanh", "ma_ngon_ngu": "vi"}],
    })
    with PhienLamViec() as phien:
        luot = phien.scalar(select(LuotTruyCap).where(LuotTruyCap.ma_su_kien == "tc-0000009"))
        with pytest.raises(IntegrityError):
            phien.execute(delete(LuotTruyCap).where(LuotTruyCap.id == luot.id))
        phien.rollback()
        # xóa lịch sử nghe trước thì mới xóa được lượt truy cập
        phien.execute(delete(LichSuNghe).where(LichSuNghe.luot_truy_cap_id == luot.id))
        phien.execute(delete(LuotTruyCap).where(LuotTruyCap.id == luot.id))
        phien.commit()
