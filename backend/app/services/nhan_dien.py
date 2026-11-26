import array
import base64
import json
import os
import threading
import urllib.request
import wave
from concurrent.futures import ThreadPoolExecutor

from app.config import cau_hinh

# 6 ngôn ngữ của hệ thống, giọng nói nhận diện được ngoài danh sách này sẽ bị ép về ngôn ngữ gần nhất trong danh sách
NGON_NGU_HO_TRO = {"vi", "en", "es", "ko", "zh", "ru"}
# mã vùng giọng nói của Google Speech API cho từng ngôn ngữ
MA_GIONG_GOOGLE = {"vi": "vi-VN", "en": "en-US", "es": "es-ES", "ko": "ko-KR", "zh": "zh-CN", "ru": "ru-RU"}
URL_GOOGLE_GIONG_NOI = "http://www.google.com/speech-api/v2/recognize"

_mo_hinh = None
_khoa = threading.Lock()


def _khoa_google() -> str | None:
    return cau_hinh.khoa_google_giong_noi or os.environ.get("KHOA_GOOGLE_GIONG_NOI") or None


def _khoa_gemini() -> str | None:
    return cau_hinh.gemini_api_key or os.environ.get("GEMINI_API_KEY") or None


def _doc_wav_mono_16bit(duong_dan_file: str) -> tuple[int, bytes]:
    # đọc file .wav bằng thư viện chuẩn, chỉ lấy kênh đầu tiên nếu ghi âm nhiều kênh
    with wave.open(duong_dan_file, "rb") as wf:
        if wf.getsampwidth() != 2:
            raise ValueError("Chỉ hỗ trợ file wav PCM 16-bit")
        so_kenh, tan_so = wf.getnchannels(), wf.getframerate()
        pcm = wf.readframes(wf.getnframes())
    if so_kenh > 1:
        mau = array.array("h")
        mau.frombytes(pcm[: len(pcm) - len(pcm) % 2])
        pcm = mau[::so_kenh].tobytes()
    return tan_so, pcm


def _hoi_google(ma_ngon_ngu: str, tan_so: int, pcm: bytes, khoa: str) -> tuple[str, float]:
    # gửi âm thanh tới Google Speech API v2 với một ngôn ngữ, trả về (văn bản, độ tin cậy)
    duong_dan = f"{URL_GOOGLE_GIONG_NOI}?output=json&lang={MA_GIONG_GOOGLE[ma_ngon_ngu]}&key={khoa}"
    yeu_cau = urllib.request.Request(
        duong_dan, data=pcm, headers={"Content-Type": f"audio/l16; rate={tan_so}", "User-Agent": "Mozilla/5.0"},
    )
    with urllib.request.urlopen(yeu_cau, timeout=12) as phan_hoi:
        noi_dung = phan_hoi.read().decode("utf-8", errors="ignore")
    tot_nhat = ("", 0.0)
    for dong in noi_dung.splitlines():
        try:
            ket_qua = json.loads(dong).get("result") or []
        except ValueError:
            continue
        for muc in ket_qua:
            for phuong_an in muc.get("alternative", [])[:1]:
                van_ban = (phuong_an.get("transcript") or "").strip()
                do_tin_cay = float(phuong_an.get("confidence", 0.5))
                if van_ban and do_tin_cay >= tot_nhat[1]:
                    tot_nhat = (van_ban, do_tin_cay)
    return tot_nhat


def _nhan_dien_bang_google(duong_dan_file: str, khoa: str, ngon_ngu_goi_y: str | None = None) -> tuple[str, str]:
    tan_so, pcm = _doc_wav_mono_16bit(duong_dan_file)
    danh_sach = [ngon_ngu_goi_y] if ngon_ngu_goi_y in MA_GIONG_GOOGLE else list(MA_GIONG_GOOGLE)
    with ThreadPoolExecutor(max_workers=len(danh_sach)) as nhom:
        viec = {ma: nhom.submit(_hoi_google, ma, tan_so, pcm, khoa) for ma in danh_sach}
        ket_qua = {}
        for ma, v in viec.items():
            try:
                ket_qua[ma] = v.result()
            except Exception:
                continue
    co_chu = {ma: kq for ma, kq in ket_qua.items() if kq[0]}
    if not co_chu:
        return ngon_ngu_goi_y or "vi", ""
    ma_tot_nhat = max(co_chu, key=lambda m: co_chu[m][1])
    return ma_tot_nhat, co_chu[ma_tot_nhat][0]


def _nhan_dien_bang_gemini(duong_dan_file: str, khoa: str) -> tuple[str, str]:
    with open(duong_dan_file, "rb") as f:
        du_lieu_b64 = base64.b64encode(f.read()).decode("ascii")
    mime = "audio/wav" if duong_dan_file.lower().endswith(".wav") else "audio/webm"
    noi_dung_yeu_cau = {
        "contents": [{
            "parts": [
                {
                    "text": (
                        "Transcribe the spoken audio accurately in its original language and detect its language code "
                        "among: vi, en, es, ko, zh, ru. If the audio is silent or noise, return empty text. "
                        'Reply ONLY valid JSON: {"ngon_ngu": "<code>", "van_ban": "<transcript>"}'
                    ),
                },
                {"inline_data": {"mime_type": mime, "data": du_lieu_b64}},
            ]
        }],
        "generationConfig": {"response_mime_type": "application/json", "temperature": 0},
    }
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={khoa}"
    req = urllib.request.Request(
        url, data=json.dumps(noi_dung_yeu_cau).encode("utf-8"), headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        raw = json.loads(resp.read().decode("utf-8"))
    chu_json = raw["candidates"][0]["content"]["parts"][0]["text"]
    kq = json.loads(chu_json)
    ma = str(kq.get("ngon_ngu") or "vi").split("-")[0].lower()
    if ma not in NGON_NGU_HO_TRO:
        ma = "en"
    return ma, str(kq.get("van_ban") or "").strip()


def _nhan_dien_bang_sr(duong_dan_file: str, ngon_ngu_goi_y: str | None = None) -> tuple[str, str]:
    import speech_recognition as sr

    tan_so, pcm = _doc_wav_mono_16bit(duong_dan_file)
    am_thanh = sr.AudioData(pcm, tan_so, 2)
    bo = sr.Recognizer()
    if ngon_ngu_goi_y in MA_GIONG_GOOGLE:
        # khi người dùng đã chọn rõ ngôn ngữ đầu vào, nhận diện thẳng ngôn ngữ đó để đạt độ chính xác cao nhất
        try:
            chu = bo.recognize_google(am_thanh, language=MA_GIONG_GOOGLE[ngon_ngu_goi_y])
            return ngon_ngu_goi_y, (chu or "").strip()
        except sr.UnknownValueError:
            return ngon_ngu_goi_y, ""

    danh_sach = list(MA_GIONG_GOOGLE)

    def hoi_mot(ma: str) -> tuple[str, float]:
        try:
            kq = bo.recognize_google(am_thanh, language=MA_GIONG_GOOGLE[ma], show_all=True)
        except sr.UnknownValueError:
            return "", 0.0
        if not isinstance(kq, dict):
            return "", 0.0
        tot = ("", 0.0)
        for nhom in kq.get("alternative", [])[:1]:
            chu = (nhom.get("transcript") or "").strip()
            tin_cay = float(nhom.get("confidence", 0.6))
            if chu and tin_cay >= tot[1]:
                tot = (chu, tin_cay)
        return tot

    with ThreadPoolExecutor(max_workers=len(danh_sach)) as nhom:
        viec = {ma: nhom.submit(hoi_mot, ma) for ma in danh_sach}
        co_chu = {}
        for ma, v in viec.items():
            try:
                chu, tin_cay = v.result()
                if chu:
                    co_chu[ma] = (chu, tin_cay)
            except Exception:
                continue
    if not co_chu:
        return ngon_ngu_goi_y or "vi", ""
    ma_tot_nhat = max(co_chu, key=lambda m: co_chu[m][1])
    return ma_tot_nhat, co_chu[ma_tot_nhat][0]


def _lay_mo_hinh():
    # nạp mô hình Whisper lần đầu khi có người dùng phiên dịch, các lần sau dùng lại
    # lần đầu sẽ tự tải mô hình về máy (cần mạng), sau đó chạy hoàn toàn trên máy chủ
    global _mo_hinh
    if _mo_hinh is None:
        from faster_whisper import WhisperModel

        _mo_hinh = WhisperModel(cau_hinh.mo_hinh_giong_noi, device="cpu", compute_type="int8")
    return _mo_hinh


def _nhan_dien_bang_whisper(duong_dan_file: str, ngon_ngu_goi_y: str | None = None) -> tuple[str, str]:
    with _khoa:
        mo_hinh = _lay_mo_hinh()
        goi_y = ngon_ngu_goi_y if ngon_ngu_goi_y in NGON_NGU_HO_TRO else None
        doan, thong_tin = chay_mo_hinh(mo_hinh, duong_dan_file, goi_y)
        ngon_ngu = goi_y or thong_tin.language
        if ngon_ngu not in NGON_NGU_HO_TRO:
            # ngôn ngữ nhận diện ra không nằm trong 6 ngôn ngữ, chọn ngôn ngữ có xác suất cao nhất trong 6 ngôn ngữ đó
            xac_suat = [(ma, p) for ma, p in (thong_tin.all_language_probs or []) if ma in NGON_NGU_HO_TRO]
            ngon_ngu = max(xac_suat, key=lambda x: x[1])[0] if xac_suat else "en"
            doan, thong_tin = chay_mo_hinh(mo_hinh, duong_dan_file, ngon_ngu)
        van_ban = " ".join(d.text.strip() for d in doan).strip()
        return ngon_ngu, van_ban


def nhan_dien_giong_noi(duong_dan_file: str, ngon_ngu_goi_y: str | None = None) -> tuple[str, str]:
    # nhận diện ngôn ngữ và chuyển giọng nói trong file audio thành chữ
    # trả về (mã ngôn ngữ, văn bản), văn bản rỗng nếu chỉ có tiếng ồn hoặc im lặng
    la_wav = duong_dan_file.lower().endswith(".wav")
    khoa_gemini = _khoa_gemini()
    if khoa_gemini:
        try:
            return _nhan_dien_bang_gemini(duong_dan_file, khoa_gemini)
        except Exception:
            pass

    khoa_google = _khoa_google()
    if khoa_google and la_wav:
        try:
            return _nhan_dien_bang_google(duong_dan_file, khoa_google, ngon_ngu_goi_y)
        except (wave.Error, ValueError, OSError):
            pass

    if la_wav:
        try:
            return _nhan_dien_bang_sr(duong_dan_file, ngon_ngu_goi_y)
        except ImportError:
            pass

    try:
        return _nhan_dien_bang_whisper(duong_dan_file, ngon_ngu_goi_y)
    except ImportError as loi:
        raise RuntimeError(
            "Máy chủ chưa có bộ nhận diện giọng nói cho file audio: hãy cài SpeechRecognition "
            "(pip install SpeechRecognition) hoặc đặt GEMINI_API_KEY trong file .env"
        ) from loi


def chay_mo_hinh(mo_hinh, duong_dan_file: str, ngon_ngu: str | None):
    # chạy mô hình với bộ lọc khoảng lặng để tránh Whisper tự bịa chữ khi không có tiếng nói
    doan, thong_tin = mo_hinh.transcribe(
        duong_dan_file, language=ngon_ngu, vad_filter=True, beam_size=1, condition_on_previous_text=False,
    )
    return list(doan), thong_tin
