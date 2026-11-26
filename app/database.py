from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import cau_hinh


class Base(DeclarativeBase):
    pass


_tham_so = {"connect_args": {"check_same_thread": False}} if cau_hinh.database_url.startswith("sqlite") else {}
engine = create_engine(cau_hinh.database_url, pool_pre_ping=True, **_tham_so)

if cau_hinh.database_url.startswith("sqlite"):
    # SQLite mặc định không kiểm tra khóa ngoại, bật lên để hành vi giống MySQL khi chạy thử
    @event.listens_for(engine, "connect")
    def _bat_khoa_ngoai(ket_noi, _):
        ket_noi.execute("PRAGMA foreign_keys=ON")

PhienLamViec = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def lay_phien_csdl():
    # cấp một phiên làm việc với CSDL cho mỗi request và đóng lại khi xong
    phien = PhienLamViec()
    try:
        yield phien
    finally:
        phien.close()
