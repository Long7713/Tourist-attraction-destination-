import atexit
import io
import os
import re
import secrets
import shutil
import socket
import subprocess
import threading
import time
from urllib.parse import urlsplit, urlunsplit
import urllib.request

import qrcode
from qrcode.constants import ERROR_CORRECT_M

from app.config import THU_MUC_DU_LIEU

# kho mã QR đang hiển thị (mọi thiết bị quét mã này đều vào được hệ thống; đóng tab mở tab mới không có ?qr= sẽ phải quét lại)
_MA_QR_CHO: dict[str, float] = {}
_THOI_HAN_MA_QR_GIAY = 3600

# địa chỉ HTTPS công khai tự động tạo ngầm (Cloudflare Tunnel / localhost.run) để điện thoại 4G/5G/Wi-Fi khác mạng quét được
_DIA_CHI_CONG_KHAI: str | None = None
_DANG_KHOI_DONG_TUNNEL = False
_KHOA_TUNNEL = threading.Lock()
_URL_TAI_CLOUDFLARED_WIN = (
    "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
)


def _don_ma_qr_het_han() -> None:
    han = time.time() - _THOI_HAN_MA_QR_GIAY
    for ma in [k for k, t in _MA_QR_CHO.items() if t < han]:
        _MA_QR_CHO.pop(ma, None)


def tao_ma_qr_moi() -> str:
    _don_ma_qr_het_han()
    ma_qr = secrets.token_urlsafe(12)
    _MA_QR_CHO[ma_qr] = time.time()
    return ma_qr


def xac_thuc_ma_qr(ma_qr: str | None) -> bool:
    _don_ma_qr_het_han()
    if not ma_qr or not isinstance(ma_qr, str):
        return False
    return bool(ma_qr and (ma_qr == "1" or ma_qr in _MA_QR_CHO))


def lay_ip_lan() -> str:
    # tìm địa chỉ IPv4 trong mạng LAN để điện thoại cùng Wi-Fi quét mã QR truy cập được
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            if ip and not ip.startswith("127."):
                return ip
    except OSError:
        pass
    try:
        ip = socket.gethostbyname(socket.gethostname())
        if ip:
            return ip
    except OSError:
        pass
    return "127.0.0.1"


def _tim_hoac_tai_cloudflared() -> str | None:
    co_san = shutil.which("cloudflared")
    if co_san:
        return co_san
    dich = THU_MUC_DU_LIEU / ("cloudflared.exe" if os.name == "nt" else "cloudflared")
    if dich.is_file() and dich.stat().st_size > 1_000_000:
        return str(dich)
    if os.name != "nt":
        return None
    try:
        THU_MUC_DU_LIEU.mkdir(parents=True, exist_ok=True)
        tam = THU_MUC_DU_LIEU / "cloudflared.exe.tmp"
        with urllib.request.urlopen(_URL_TAI_CLOUDFLARED_WIN, timeout=45) as phan_hoi, open(tam, "wb") as tep:
            shutil.copyfileobj(phan_hoi, tep)
        if tam.stat().st_size > 1_000_000:
            os.replace(tam, dich)
            return str(dich)
    except Exception:
        pass
    return None


def _chay_cloudflared(port: int) -> None:
    global _DIA_CHI_CONG_KHAI
    duong_dan_cf = _tim_hoac_tai_cloudflared()
    if not duong_dan_cf:
        return
    try:
        proc = subprocess.Popen(
            [str(duong_dan_cf), "tunnel", "--url", f"http://127.0.0.1:{port}", "--no-autoupdate"],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="ignore",
        )
        atexit.register(proc.terminate)
        if not proc.stdout:
            return
        mau = re.compile(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com")
        for dong in proc.stdout:
            khop = mau.search(dong)
            if khop:
                _DIA_CHI_CONG_KHAI = khop.group(0)
    except Exception:
        pass


def _chay_ssh_tunnel(port: int) -> None:
    global _DIA_CHI_CONG_KHAI
    if not shutil.which("ssh"):
        return
    try:
        tep_known_hosts = "NUL" if os.name == "nt" else "/dev/null"
        proc = subprocess.Popen(
            [
                "ssh",
                "-o", "StrictHostKeyChecking=no",
                "-o", f"UserKnownHostsFile={tep_known_hosts}",
                "-o", "ServerAliveInterval=30",
                "-R", f"80:127.0.0.1:{port}",
                "nokey@localhost.run",
            ],
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="ignore",
        )
        atexit.register(proc.terminate)
        if not proc.stdout:
            return
        mau = re.compile(r"https://[a-zA-Z0-9-]+\.lhr\.life")
        for dong in proc.stdout:
            khop = mau.search(dong)
            if khop and (_DIA_CHI_CONG_KHAI is None or "trycloudflare.com" not in _DIA_CHI_CONG_KHAI):
                _DIA_CHI_CONG_KHAI = khop.group(0)
    except Exception:
        pass


def _dam_bao_tunnel_ngam(port: int) -> None:
    global _DANG_KHOI_DONG_TUNNEL
    with _KHOA_TUNNEL:
        if _DIA_CHI_CONG_KHAI is not None or _DANG_KHOI_DONG_TUNNEL:
            return
        _DANG_KHOI_DONG_TUNNEL = True
    threading.Thread(target=_chay_cloudflared, args=(port,), daemon=True).start()
    threading.Thread(target=_chay_ssh_tunnel, args=(port,), daemon=True).start()


def tao_dia_chi_qr(base_url: str) -> dict:
    # ưu tiên địa chỉ HTTPS tunnel công khai để mọi thiết bị (4G/5G/Wi-Fi khác) đều quét và vào được hệ thống
    global _DIA_CHI_CONG_KHAI
    ip = lay_ip_lan()
    goc = base_url.rstrip("/")
    tach = urlsplit(goc)
    port = tach.port or 8000

    ten_mien = tach.hostname or ""
    la_ten_mien_cong_khai = bool(
        ten_mien
        and ten_mien not in ("localhost", "127.0.0.1", "0.0.0.0", "testserver")
        and not ten_mien.startswith(("192.168.", "10.", "172."))
    )
    if la_ten_mien_cong_khai:
        giao_thuc = "https" if ten_mien.endswith((".trycloudflare.com", ".lhr.life")) else (tach.scheme or "https")
        _DIA_CHI_CONG_KHAI = urlunsplit((giao_thuc, tach.netloc, tach.path.rstrip("/"), "", ""))

    if "PYTEST_CURRENT_TEST" not in os.environ and ten_mien != "testserver" and not la_ten_mien_cong_khai:
        _dam_bao_tunnel_ngam(port)

    dia_chi_cong_khai = _DIA_CHI_CONG_KHAI.rstrip("/") if _DIA_CHI_CONG_KHAI else None
    if dia_chi_cong_khai:
        dia_chi_goc = dia_chi_cong_khai
    elif ten_mien in ("localhost", "127.0.0.1", "0.0.0.0"):
        netloc = f"{ip}:{tach.port}" if tach.port else ip
        dia_chi_goc = urlunsplit((tach.scheme or "http", netloc, tach.path.rstrip("/"), "", ""))
    else:
        dia_chi_goc = goc

    ma_qr = tao_ma_qr_moi()
    return {
        "ip_lan": ip,
        "ma_qr": ma_qr,
        "dia_chi_cong_khai": dia_chi_cong_khai,
        "dang_tao_tunnel": dia_chi_cong_khai is None,
        "dia_chi_goc": dia_chi_goc,
        "dia_chi_qr": f"{dia_chi_goc}/?qr={ma_qr}",
    }


def tao_qr_png(duong_dan: str) -> bytes:
    # sinh ảnh PNG của mã QR chung từ địa chỉ truy cập hệ thống
    qr = qrcode.QRCode(error_correction=ERROR_CORRECT_M, box_size=12, border=4)
    qr.add_data(duong_dan)
    qr.make(fit=True)
    anh = qr.make_image(fill_color="black", back_color="white")
    bo_dem = io.BytesIO()
    anh.save(bo_dem, format="PNG")
    return bo_dem.getvalue()
