import re
import time

from app.config import MA_NGON_NGU_MAC_DINH

# mã ngôn ngữ của hệ thống sang mã của dịch vụ dịch
MA_DICH = {"vi": "vi", "en": "en", "es": "es", "ko": "ko", "zh": "zh-CN", "ru": "ru"}
# mã ngôn ngữ của dịch vụ dự phòng MyMemory
MA_DICH_DU_PHONG = {"vi": "vi-VN", "en": "en-GB", "es": "es-ES", "ko": "ko-KR", "zh": "zh-CN", "ru": "ru-RU"}
DO_DAI_TOI_DA_DU_PHONG = 450


def _chia_doan(van_ban: str) -> list[str]:
    # chia văn bản dài thành các đoạn ngắn theo câu vì dịch vụ dự phòng giới hạn độ dài mỗi lần
    doan, hien_tai = [], ""
    for cau in re.split(r"(?<=[.!?。！？])\s+", van_ban.strip()):
        if hien_tai and len(hien_tai) + len(cau) + 1 > DO_DAI_TOI_DA_DU_PHONG:
            doan.append(hien_tai)
            hien_tai = ""
        hien_tai = f"{hien_tai} {cau}".strip()
    if hien_tai:
        doan.append(hien_tai)
    return [d[:DO_DAI_TOI_DA_DU_PHONG] for d in doan]


def _dich_du_phong(van_ban: str, ma_dich_sang: str, ma_nguon: str) -> str:
    from deep_translator import MyMemoryTranslator

    dich_vien = MyMemoryTranslator(source=MA_DICH_DU_PHONG[ma_nguon], target=MA_DICH_DU_PHONG[ma_dich_sang])
    return " ".join(dich_vien.translate(d) for d in _chia_doan(van_ban))


def dich_van_ban(van_ban: str, ma_dich_sang: str, ma_nguon: str = MA_NGON_NGU_MAC_DINH) -> str:
    # dịch tự động văn bản bằng dịch vụ trực tuyến, chỉ dùng khi admin soạn nội dung
    # kết quả chỉ là bản nháp, admin phải xem lại rồi mới đăng cho khách
    from deep_translator import GoogleTranslator

    if not van_ban.strip():
        return ""
    # dịch vụ chính giới hạn số yêu cầu nên thử lại ngắn, nếu vẫn bị chặn thì chuyển sang dịch vụ dự phòng
    for lan in range(2):
        try:
            return GoogleTranslator(source=MA_DICH[ma_nguon], target=MA_DICH[ma_dich_sang]).translate(van_ban)
        except Exception:
            time.sleep(1.5 * (lan + 1))
    return _dich_du_phong(van_ban, ma_dich_sang, ma_nguon)
