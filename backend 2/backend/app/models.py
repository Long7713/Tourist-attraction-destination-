from datetime import datetime

from sqlalchemy import (
    BigInteger, Boolean, CheckConstraint, DateTime, Enum, ForeignKey, Index, Integer,
    Numeric, String, Text, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.thoi_gian import gio_viet_nam

# SQLite chỉ tự tăng khóa chính kiểu Integer, MySQL dùng BigInteger
KhoaLon = BigInteger().with_variant(Integer, "sqlite")


class NgonNgu(Base):
    # danh sách 6 ngôn ngữ cố định của hệ thống
    __tablename__ = "ngon_ngu"

    ma_ngon_ngu: Mapped[str] = mapped_column(String(10), primary_key=True)
    ten_ban_ngu: Mapped[str] = mapped_column(String(50))
    ten_tieng_viet: Mapped[str] = mapped_column(String(50))
    ma_giong_doc: Mapped[str | None] = mapped_column(String(20))
    thu_tu: Mapped[int] = mapped_column(Integer, default=0)
    la_mac_dinh: Mapped[bool] = mapped_column(Boolean, default=False)
    dang_dung: Mapped[bool] = mapped_column(Boolean, default=True)


class DiemThamQuan(Base):
    # điểm tham quan kèm vùng kích hoạt (tâm + bán kính, đơn vị mét)
    __tablename__ = "diem_tham_quan"
    __table_args__ = (CheckConstraint("ban_kinh_m BETWEEN 20 AND 2000", name="chk_ban_kinh"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    slug: Mapped[str] = mapped_column(String(100), unique=True)
    ten_diem: Mapped[str] = mapped_column(String(150))
    vi_do: Mapped[float] = mapped_column(Numeric(10, 7, asdecimal=False))
    kinh_do: Mapped[float] = mapped_column(Numeric(10, 7, asdecimal=False))
    ban_kinh_m: Mapped[int] = mapped_column(Integer, default=100)
    hinh_anh: Mapped[str | None] = mapped_column(String(255))
    thu_tu: Mapped[int] = mapped_column(Integer, default=0)
    dang_dung: Mapped[bool] = mapped_column(Boolean, default=True)
    ngay_tao: Mapped[datetime] = mapped_column(DateTime, default=gio_viet_nam)
    ngay_cap_nhat: Mapped[datetime] = mapped_column(DateTime, default=gio_viet_nam, onupdate=gio_viet_nam)

    noi_dung: Mapped[list["NoiDungDiem"]] = relationship(back_populates="diem", cascade="all, delete-orphan")


class NoiDungDiem(Base):
    # nội dung thuyết minh của một điểm theo từng ngôn ngữ
    __tablename__ = "noi_dung_diem"
    __table_args__ = (UniqueConstraint("diem_id", "ma_ngon_ngu", name="uq_diem_ngonngu"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    diem_id: Mapped[int] = mapped_column(ForeignKey("diem_tham_quan.id", ondelete="CASCADE"))
    ma_ngon_ngu: Mapped[str] = mapped_column(ForeignKey("ngon_ngu.ma_ngon_ngu"))
    tieu_de: Mapped[str] = mapped_column(String(200))
    mo_ta_ngan: Mapped[str | None] = mapped_column(String(300))
    noi_dung: Mapped[str] = mapped_column(Text)
    duong_dan_am_thanh: Mapped[str | None] = mapped_column(String(255))
    am_thanh_hash: Mapped[str | None] = mapped_column(String(64))
    trang_thai: Mapped[str] = mapped_column(Enum("nhap", "da_dang", name="trang_thai_noi_dung"), default="nhap")
    ngay_cap_nhat: Mapped[datetime] = mapped_column(DateTime, default=gio_viet_nam, onupdate=gio_viet_nam)

    diem: Mapped[DiemThamQuan] = relationship(back_populates="noi_dung")


class LuotTruyCap(Base):
    # mỗi lần khách quét QR và vào hệ thống
    __tablename__ = "luot_truy_cap"
    __table_args__ = (Index("idx_thoi_gian", "thoi_gian_truy_cap"),)

    id: Mapped[int] = mapped_column(KhoaLon, primary_key=True, autoincrement=True)
    ma_su_kien: Mapped[str] = mapped_column(String(36), unique=True)
    ma_phien: Mapped[str] = mapped_column(String(64), index=True)
    ma_ngon_ngu: Mapped[str | None] = mapped_column(ForeignKey("ngon_ngu.ma_ngon_ngu", ondelete="SET NULL"))
    thoi_gian_truy_cap: Mapped[datetime] = mapped_column(DateTime)
    thoi_gian_dong_bo: Mapped[datetime] = mapped_column(DateTime, default=gio_viet_nam)
    loai_thiet_bi: Mapped[str] = mapped_column(
        Enum("mobile", "tablet", "desktop", "khac", name="loai_thiet_bi"), default="khac"
    )
    thiet_bi: Mapped[str | None] = mapped_column(String(255))
    ip_ma_hoa: Mapped[str | None] = mapped_column(String(64))


class LichSuNghe(Base):
    # khách đã nghe thuyết minh điểm nào, dùng cho thống kê điểm được nghe nhiều nhất
    __tablename__ = "lich_su_nghe"
    __table_args__ = (Index("idx_lsn_diem", "diem_id", "thoi_gian_nghe"),)

    id: Mapped[int] = mapped_column(KhoaLon, primary_key=True, autoincrement=True)
    ma_su_kien: Mapped[str] = mapped_column(String(36), unique=True)
    luot_truy_cap_id: Mapped[int] = mapped_column(ForeignKey("luot_truy_cap.id", ondelete="CASCADE"))
    diem_id: Mapped[int] = mapped_column(ForeignKey("diem_tham_quan.id"))
    ma_ngon_ngu: Mapped[str] = mapped_column(ForeignKey("ngon_ngu.ma_ngon_ngu"))
    thoi_gian_nghe: Mapped[datetime] = mapped_column(DateTime)
