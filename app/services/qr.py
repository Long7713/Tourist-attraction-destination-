import io

import qrcode
from qrcode.constants import ERROR_CORRECT_M


def tao_qr_png(duong_dan: str) -> bytes:
    # sinh ảnh PNG của mã QR chung từ địa chỉ truy cập hệ thống
    qr = qrcode.QRCode(error_correction=ERROR_CORRECT_M, box_size=12, border=4)
    qr.add_data(duong_dan)
    qr.make(fit=True)
    anh = qr.make_image(fill_color="black", back_color="white")
    bo_dem = io.BytesIO()
    anh.save(bo_dem, format="PNG")
    return bo_dem.getvalue()
