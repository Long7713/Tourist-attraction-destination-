from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import DiemThamQuan, NoiDungDiem

MOC_THOI_GIAN = datetime(2000, 1, 1)


def tinh_phien_ban(phien: Session) -> int:
    # số phiên bản dữ liệu = thời điểm gần nhất admin sửa điểm hoặc nội dung, đổi ra số giây tính từ năm 2000
    # nhờ vậy không phải lưu số phiên bản ở đâu: dữ liệu đổi thì thời điểm sửa đổi, số phiên bản tự đổi theo
    moc = [
        phien.scalar(select(func.max(DiemThamQuan.ngay_cap_nhat))),
        phien.scalar(select(func.max(NoiDungDiem.ngay_cap_nhat))),
    ]
    moc = [m for m in moc if m is not None]
    return int((max(moc) - MOC_THOI_GIAN).total_seconds()) if moc else 1
