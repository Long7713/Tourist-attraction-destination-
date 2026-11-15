import threading

from app.config import cau_hinh

# 6 ngôn ngữ của hệ thống, giọng nói nhận diện được ngoài danh sách này sẽ bị ép về ngôn ngữ gần nhất trong danh sách
NGON_NGU_HO_TRO = {"vi", "en", "es", "ko", "zh", "ru"}

_mo_hinh = None
_khoa = threading.Lock()


def _lay_mo_hinh():
    # nạp mô hình Whisper lần đầu khi có người dùng phiên dịch, các lần sau dùng lại
    # lần đầu sẽ tự tải mô hình về máy (cần mạng), sau đó chạy hoàn toàn trên máy chủ
    global _mo_hinh
    if _mo_hinh is None:
        from faster_whisper import WhisperModel

        _mo_hinh = WhisperModel(cau_hinh.mo_hinh_giong_noi, device="cpu", compute_type="int8")
    return _mo_hinh


def nhan_dien_giong_noi(duong_dan_file: str) -> tuple[str, str]:
    # nhận diện ngôn ngữ và chuyển giọng nói trong file audio thành chữ
    # trả về (mã ngôn ngữ, văn bản), văn bản rỗng nếu chỉ có tiếng ồn hoặc im lặng
    with _khoa:
        mo_hinh = _lay_mo_hinh()
        doan, thong_tin = chay_mo_hinh(mo_hinh, duong_dan_file, None)
        ngon_ngu = thong_tin.language
        if ngon_ngu not in NGON_NGU_HO_TRO:
            # ngôn ngữ nhận diện ra không nằm trong 6 ngôn ngữ, chọn ngôn ngữ có xác suất cao nhất trong 6 ngôn ngữ đó
            xac_suat = [(ma, p) for ma, p in (thong_tin.all_language_probs or []) if ma in NGON_NGU_HO_TRO]
            ngon_ngu = max(xac_suat, key=lambda x: x[1])[0] if xac_suat else "en"
            doan, thong_tin = chay_mo_hinh(mo_hinh, duong_dan_file, ngon_ngu)
        van_ban = " ".join(d.text.strip() for d in doan).strip()
        return ngon_ngu, van_ban


def chay_mo_hinh(mo_hinh, duong_dan_file: str, ngon_ngu: str | None):
    # chạy mô hình với bộ lọc khoảng lặng để tránh Whisper tự bịa chữ khi không có tiếng nói
    doan, thong_tin = mo_hinh.transcribe(
        duong_dan_file, language=ngon_ngu, vad_filter=True, beam_size=1, condition_on_previous_text=False,
    )
    return list(doan), thong_tin
