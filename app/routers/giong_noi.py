import os
import tempfile

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.services import dich, nhan_dien

router = APIRouter(prefix="/api", tags=["Khách"])

KICH_THUOC_TOI_DA = 4 * 1024 * 1024
LOAI_AUDIO_CHO_PHEP = {"webm", "ogg", "mp4", "mpeg", "wav", "x-wav", "mp3", "x-m4a", "aac"}


# chức năng phiên dịch giọng nói: nhận đoạn ghi âm, nhận diện ngôn ngữ, chuyển thành chữ và dịch sang ngôn ngữ khách chọn
# hai cách gửi: chữ trình duyệt đã nhận diện sẵn (Web Speech API) kèm ngôn ngữ nguồn, hoặc file ghi âm để Whisper nhận diện
@router.post("/dich-giong-noi")
def dich_giong_noi(
    ngon_ngu_dich: str = Form(...),
    file: UploadFile | None = File(None),
    van_ban_goc: str | None = Form(None, max_length=2000),
    ngon_ngu_nguon: str | None = Form(None),
):
    if ngon_ngu_dich not in dich.MA_DICH:
        raise HTTPException(400, "Ngôn ngữ dịch không được hỗ trợ")
    if van_ban_goc is not None:
        if ngon_ngu_nguon not in dich.MA_DICH:
            raise HTTPException(400, "Thiếu hoặc sai ngôn ngữ nguồn")
        return _dich_ket_qua(ngon_ngu_nguon, van_ban_goc.strip(), ngon_ngu_dich)
    if file is None:
        raise HTTPException(400, "Cần gửi file ghi âm hoặc văn bản")

    loai = (file.content_type or "").split("/")[-1].split(";")[0]
    if not (file.content_type or "").startswith(("audio/", "video/webm")) or loai not in LOAI_AUDIO_CHO_PHEP:
        raise HTTPException(415, "Chỉ nhận file ghi âm")
    noi_dung = file.file.read(KICH_THUOC_TOI_DA + 1)
    if len(noi_dung) > KICH_THUOC_TOI_DA:
        raise HTTPException(413, "Đoạn ghi âm quá dài")

    # lưu tạm ra file vì Whisper đọc audio từ đường dẫn, xong việc thì xóa ngay, không giữ lại giọng nói của khách
    with tempfile.NamedTemporaryFile(suffix=f".{loai}", delete=False) as tep:
        tep.write(noi_dung)
    try:
        ngon_ngu_nguon, van_ban_goc = nhan_dien.nhan_dien_giong_noi(tep.name)
    except Exception as loi:
        raise HTTPException(503, f"Chưa nhận diện được giọng nói: {loi}")
    finally:
        os.unlink(tep.name)
    return _dich_ket_qua(ngon_ngu_nguon, van_ban_goc, ngon_ngu_dich)


def _dich_ket_qua(ngon_ngu_nguon: str, van_ban_goc: str, ngon_ngu_dich: str) -> dict:
    if not van_ban_goc:
        return {"ngon_ngu_nguon": None, "van_ban_goc": "", "ban_dich": ""}
    if ngon_ngu_nguon == ngon_ngu_dich:
        return {"ngon_ngu_nguon": ngon_ngu_nguon, "van_ban_goc": van_ban_goc, "ban_dich": van_ban_goc}
    try:
        ban_dich = dich.dich_van_ban(van_ban_goc, ngon_ngu_dich, ngon_ngu_nguon)
    except Exception as loi:
        raise HTTPException(502, f"Không dịch được (cần có mạng): {loi}")
    return {"ngon_ngu_nguon": ngon_ngu_nguon, "van_ban_goc": van_ban_goc, "ban_dich": ban_dich}
