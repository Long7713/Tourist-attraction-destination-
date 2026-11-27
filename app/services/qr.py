import io
import json
import socket
import urllib.request

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


def lay_ip_lan() -> str:
    # IP của máy trong mạng wifi, để điện thoại cùng mạng quét QR vào được
    try:
        return socket.gethostbyname(socket.gethostname())
    except OSError:
        return "127.0.0.1"


def lay_dia_chi_tunnel() -> str | None:
    # địa chỉ HTTPS công khai nếu đang chạy `cloudflared tunnel --url http://localhost:8000` trên máy này;
    # cloudflared báo tên miền trycloudflare qua cổng metrics 20241-20245
    for cong in range(20241, 20246):
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{cong}/quicktunnel", timeout=0.5) as tl:
                ten_mien = json.load(tl).get("hostname")
            if ten_mien:
                return f"https://{ten_mien}"
        except (OSError, ValueError):
            continue
    return None
