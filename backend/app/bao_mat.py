import hashlib
import hmac

from fastapi import Header, HTTPException, status
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from app.config import TEN_DANG_NHAP_ADMIN, cau_hinh

_bo_ky_token = URLSafeTimedSerializer(cau_hinh.khoa_bi_mat, salt="admin-token")


def kiem_tra_dang_nhap(ten_dang_nhap: str, mat_khau: str) -> bool:
    # so sánh với tài khoản admin cố định trong code, dùng so sánh thời gian hằng số và kiểm tra cả hai trường
    dung_ten = hmac.compare_digest(ten_dang_nhap.encode(), TEN_DANG_NHAP_ADMIN.encode())
    dung_mat_khau = hmac.compare_digest(mat_khau.encode(), cau_hinh.mat_khau_admin.encode())
    return dung_ten and dung_mat_khau


def bam_ip(ip: str | None) -> str | None:
    # băm địa chỉ IP kèm khóa bí mật để thống kê mà không lưu IP thật của khách
    if not ip:
        return None
    return hashlib.sha256(f"{cau_hinh.khoa_bi_mat}:{ip}".encode()).hexdigest()


def tao_token_admin() -> str:
    # tạo token đăng nhập có chữ ký và thời hạn cho admin
    return _bo_ky_token.dumps({"admin": True})


def yeu_cau_admin(authorization: str | None = Header(default=None)) -> None:
    # chặn các API admin nếu chưa đăng nhập hoặc token sai/hết hạn
    loi = HTTPException(status.HTTP_401_UNAUTHORIZED, "Chưa đăng nhập hoặc phiên đã hết hạn")
    if not authorization or not authorization.startswith("Bearer "):
        raise loi
    try:
        du_lieu = _bo_ky_token.loads(authorization[7:], max_age=cau_hinh.thoi_han_token_gio * 3600)
    except (BadSignature, SignatureExpired):
        raise loi
    if du_lieu.get("admin") is not True:
        raise loi
