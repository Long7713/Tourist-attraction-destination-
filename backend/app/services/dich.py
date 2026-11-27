import json
import re
import time
import urllib.parse
import urllib.request

from app.config import MA_NGON_NGU_MAC_DINH

# mã ngôn ngữ của hệ thống sang mã của dịch vụ dịch
MA_DICH = {"vi": "vi", "en": "en", "es": "es", "ko": "ko", "zh": "zh-CN", "ru": "ru","ja": "ja"}
# mã ngôn ngữ của dịch vụ dự phòng MyMemory
MA_DICH_DU_PHONG = {"vi": "vi-VN", "en": "en-GB", "es": "es-ES", "ko": "ko-KR", "zh": "zh-CN", "ru": "ru-RU", "ja": "ja-JP"}
DO_DAI_TOI_DA_DU_PHONG = 450

# dải ký tự đặc trưng giúp nhận ra ngôn ngữ ngay lập tức, không cần gọi dịch vụ ngoài
_KANA = re.compile(r"[\u3040-\u309f\u30a0-\u30ff]")
_HANGUL = re.compile(r"[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]")
_HAN = re.compile(r"[\u4e00-\u9fff]")
_CYRILLIC = re.compile(r"[\u0400-\u04ff]")
_KY_TU_TIENG_VIET = re.compile(
    "[ăâđêôơưĂÂĐÊÔƠƯảãạắằẳẵặấầẩẫậẻẽẹếềểễệỉĩịỏõọốồổỗộớờởỡợủũụứừửữựỳỷỹỵ"
    "ẢÃẠẮẰẲẴẶẤẦẨẪẬẺẼẸẾỀỂỄỆỈĨỊỎÕỌỐỒỔỖỘỚỜỞỠỢỦŨỤỨỪỬỮỰỲỶỸỴ]"
)
_KY_TU_TIENG_TAY_BAN_NHA = re.compile(r"[ñÑ¿¡]")


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


def phat_hien_va_dich_gtx(van_ban: str, ma_dich_sang: str, ma_nguon: str = "auto") -> tuple[str | None, str]:
    # gọi dịch vụ Google Translate công khai: vừa dịch vừa cho biết ngôn ngữ nguồn (ma_nguon="auto" để tự nhận diện)
    # trả về (mã ngôn ngữ phát hiện được trong 6 ngôn ngữ hệ thống hoặc None, bản dịch)
    duong_dan = (
        "https://translate.googleapis.com/translate_a/single?client=gtx"
        f"&sl={ma_nguon}&tl={MA_DICH.get(ma_dich_sang, ma_dich_sang)}&dt=t&q={urllib.parse.quote(van_ban)}"
    )
    yeu_cau = urllib.request.Request(duong_dan, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(yeu_cau, timeout=8) as phan_hoi:
        du_lieu = json.loads(phan_hoi.read().decode("utf-8"))
    ban_dich = "".join(phan[0] for phan in (du_lieu[0] or []) if phan and phan[0]).strip()
    ma_phat_hien = ((du_lieu[2] if len(du_lieu) > 2 else "") or "").split("-")[0].lower()
    return (ma_phat_hien if ma_phat_hien in MA_DICH else None), ban_dich


def nhan_dien_ngon_ngu_van_ban(van_ban: str) -> str:
    # xác định văn bản thuộc ngôn ngữ nào trong 6 ngôn ngữ của hệ thống
    # ký tự đặc trưng (Hàn, Hán, Cyrillic, dấu tiếng Việt) cho kết quả chắc chắn nên kiểm tra trước
    if _KANA.search(van_ban):
        return "ja"
    if _HANGUL.search(van_ban):
        return "ko"
    if _HAN.search(van_ban):
        return "zh"
    if _CYRILLIC.search(van_ban):
        return "ru"
    if _KY_TU_TIENG_VIET.search(van_ban):
        return "vi"
    # chữ Latin không dấu (tiếng Anh, Tây Ban Nha hoặc tiếng Việt không dấu) nhờ dịch vụ nhận diện
    try:
        ma_phat_hien = phat_hien_va_dich_gtx(van_ban, "en", "auto")[0]
        if ma_phat_hien in MA_DICH:
            return ma_phat_hien
    except Exception:
        pass
    return "es" if _KY_TU_TIENG_TAY_BAN_NHA.search(van_ban) else "en"


def dich_van_ban(van_ban: str, ma_dich_sang: str, ma_nguon: str = MA_NGON_NGU_MAC_DINH) -> str:
    # dịch tự động văn bản bằng dịch vụ trực tuyến, dùng khi admin soạn nội dung và khi phiên dịch giọng nói
    # với nội dung admin, kết quả chỉ là bản nháp, admin phải xem lại rồi mới đăng cho khách
    if not van_ban.strip():
        return ""
    # thử gọi trực tiếp dịch vụ Google trước, nhanh và không phụ thuộc thư viện bên thứ ba
    try:
        ban_dich = phat_hien_va_dich_gtx(van_ban, ma_dich_sang, MA_DICH.get(ma_nguon, "auto"))[1]
        if ban_dich:
            return ban_dich
    except Exception:
        pass
    from deep_translator import GoogleTranslator

    # dịch vụ chính giới hạn số yêu cầu nên thử lại ngắn, nếu vẫn bị chặn thì chuyển sang dịch vụ dự phòng
    for lan in range(2):
        try:
            return GoogleTranslator(source=MA_DICH[ma_nguon], target=MA_DICH[ma_dich_sang]).translate(van_ban)
        except Exception:
            time.sleep(1.5 * (lan + 1))
    return _dich_du_phong(van_ban, ma_dich_sang, ma_nguon)
