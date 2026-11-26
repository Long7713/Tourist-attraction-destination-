import calendar
from collections import Counter
from datetime import date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import DiemThamQuan, LichSuNghe, LuotTruyCap
from app.thoi_gian import gio_viet_nam


def _khoang_thang(thang: str | None) -> tuple[datetime, datetime, str]:
    # đổi chuỗi "2026-10" thành khoảng [đầu tháng, đầu tháng sau), mặc định là tháng hiện tại
    if thang:
        nam, th = (int(x) for x in thang.split("-"))
    else:
        bay_gio = gio_viet_nam()
        nam, th = bay_gio.year, bay_gio.month
    dau = datetime(nam, th, 1)
    cuoi = datetime(nam + (th == 12), th % 12 + 1, 1)
    return dau, cuoi, f"{nam:04d}-{th:02d}"


def _so_nguoi(phien: Session, dau: datetime | None = None, cuoi: datetime | None = None) -> int:
    # số người = số thiết bị khác nhau (mã phiên khác nhau)
    truy_van = select(func.count(func.distinct(LuotTruyCap.ma_phien)))
    if dau is not None:
        truy_van = truy_van.where(LuotTruyCap.thoi_gian_truy_cap >= dau, LuotTruyCap.thoi_gian_truy_cap < cuoi)
    return phien.scalar(truy_van) or 0


def _so_luot(phien: Session, dau: datetime | None = None, cuoi: datetime | None = None) -> int:
    truy_van = select(func.count(LuotTruyCap.id))
    if dau is not None:
        truy_van = truy_van.where(LuotTruyCap.thoi_gian_truy_cap >= dau, LuotTruyCap.thoi_gian_truy_cap < cuoi)
    return phien.scalar(truy_van) or 0


def thong_ke_dashboard(phien: Session, thang: str | None = None) -> dict:
    # số liệu cho trang Dashboard của admin theo một tháng
    # gom nhóm theo ngày/giờ bằng Python để chạy giống nhau trên MySQL và SQLite,
    # với quy mô một tháng truy cập thì đủ nhanh
    dau, cuoi, ma_thang = _khoang_thang(thang)
    hang = phien.execute(
        select(
            LuotTruyCap.thoi_gian_truy_cap, LuotTruyCap.ma_ngon_ngu, LuotTruyCap.loai_thiet_bi
        ).where(LuotTruyCap.thoi_gian_truy_cap >= dau, LuotTruyCap.thoi_gian_truy_cap < cuoi)
    ).all()

    so_ngay = calendar.monthrange(dau.year, dau.month)[1]
    theo_ngay = Counter(h.thoi_gian_truy_cap.day for h in hang)
    theo_gio = Counter(h.thoi_gian_truy_cap.hour for h in hang)
    # bản đồ nhiệt: dòng 0..6 là thứ Hai..Chủ nhật, cột 0..23 là giờ
    nhiet = [[0] * 24 for _ in range(7)]
    for h in hang:
        nhiet[h.thoi_gian_truy_cap.weekday()][h.thoi_gian_truy_cap.hour] += 1

    gio_cao_diem = max(theo_gio.items(), key=lambda x: x[1]) if theo_gio else None
    ngay_cao_diem = max(theo_ngay.items(), key=lambda x: x[1]) if theo_ngay else None

    hom_nay = gio_viet_nam().date()
    dau_hom_nay = datetime.combine(hom_nay, datetime.min.time())

    diem_nghe_nhieu = phien.execute(
        select(DiemThamQuan.ten_diem, func.count(LichSuNghe.id).label("so_lan"))
        .join(LichSuNghe, LichSuNghe.diem_id == DiemThamQuan.id)
        .where(LichSuNghe.thoi_gian_nghe >= dau, LichSuNghe.thoi_gian_nghe < cuoi)
        .group_by(DiemThamQuan.id).order_by(func.count(LichSuNghe.id).desc()).limit(5)
    ).all()

    return {
        "thang": ma_thang,
        "tong_luot": _so_luot(phien),
        "tong_nguoi": _so_nguoi(phien),
        "hom_nay": _so_luot(phien, dau_hom_nay, dau_hom_nay + timedelta(days=1)),
        "luot_trong_thang": len(hang),
        "nguoi_trong_thang": _so_nguoi(phien, dau, cuoi),
        "theo_ngay": [{"ngay": d, "luot": theo_ngay.get(d, 0)} for d in range(1, so_ngay + 1)],
        "gio_cao_diem": {"gio": gio_cao_diem[0], "luot": gio_cao_diem[1]} if gio_cao_diem else None,
        "ngay_cao_diem": {"ngay": ngay_cao_diem[0], "luot": ngay_cao_diem[1]} if ngay_cao_diem else None,
        "theo_gio": [{"gio": g, "luot": theo_gio.get(g, 0)} for g in range(24)],
        "ban_do_nhiet": nhiet,
        "ty_le_ngon_ngu": dict(Counter(h.ma_ngon_ngu or "khong_ro" for h in hang)),
        "ty_le_thiet_bi": dict(Counter(h.loai_thiet_bi for h in hang)),
        "diem_nghe_nhieu_nhat": [{"ten_diem": d.ten_diem, "so_lan": d.so_lan} for d in diem_nghe_nhieu],
    }
