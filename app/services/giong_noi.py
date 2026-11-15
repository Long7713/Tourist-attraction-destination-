import asyncio
import hashlib
from pathlib import Path

from app.config import THU_MUC_AM_THANH

# giọng đọc thần kinh của từng ngôn ngữ trong edge-tts
GIONG_DOC = {
    "vi": "vi-VN-HoaiMyNeural",
    "en": "en-US-JennyNeural",
    "es": "es-ES-ElviraNeural",
    "ko": "ko-KR-SunHiNeural",
    "zh": "zh-CN-XiaoxiaoNeural",
    "ru": "ru-RU-SvetlanaNeural",
}


def tinh_hash_noi_dung(tieu_de: str, noi_dung: str) -> str:
    # dấu vân tay của nội dung, nếu sửa chữ mà hash đổi nghĩa là audio đã cũ
    return hashlib.sha256(f"{tieu_de}\n{noi_dung}".encode()).hexdigest()


async def tao_file_am_thanh(diem_id: int, ma_ngon_ngu: str, tieu_de: str, noi_dung: str) -> str:
    # tạo file mp3 đọc nội dung thuyết minh để khách nghe được cả khi offline
    # cần có mạng ở thời điểm admin bấm tạo, khách thì không cần
    import edge_tts

    if ma_ngon_ngu not in GIONG_DOC:
        raise ValueError(f"Ngôn ngữ chưa hỗ trợ giọng đọc: {ma_ngon_ngu}")
    ten_file = f"{diem_id}_{ma_ngon_ngu}.mp3"
    duong_dan: Path = THU_MUC_AM_THANH / ten_file
    # dịch vụ giọng đọc thỉnh thoảng không trả về âm thanh, thử lại vài lần với thời gian chờ tăng dần
    for lan in range(4):
        try:
            giao_tiep = edge_tts.Communicate(f"{tieu_de}. {noi_dung}", GIONG_DOC[ma_ngon_ngu])
            await giao_tiep.save(str(duong_dan))
            return ten_file
        except Exception:
            duong_dan.unlink(missing_ok=True)
            if lan == 3:
                raise
            await asyncio.sleep(2 * (lan + 1))
    return ten_file
