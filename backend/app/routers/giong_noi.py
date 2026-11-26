import os
import tempfile

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.services import dich, nhan_dien

router = APIRouter(prefix="/api", tags=["Khách"])

KICH_THUOC_TOI_DA = 4 * 1024 * 1024
LOAI_AUDIO_CHO_PHEP = {"webm", "ogg", "mp4", "mpeg", "wav", "x-wav", "mp3", "x-m4a", "aac"}


def _doc_file_ghi_am(file: UploadFile) -> tuple[bytes, str]:
    loai = (file.content_type or "").split("/")[-1].split(";")[0]
    if not (file.content_type or "").startswith(("audio/", "video/webm")) or loai not in LOAI_AUDIO_CHO_PHEP:
        raise HTTPException(415, "Chỉ nhận file ghi âm")
    noi_dung = file.file.read(KICH_THUOC_TOI_DA + 1)
    if len(noi_dung) > KICH_THUOC_TOI_DA:
        raise HTTPException(413, "Đoạn ghi âm quá dài")
    return noi_dung, ("wav" if loai in ("wav", "x-wav") else loai)


# chức năng phiên dịch giọng nói: nhận văn bản đã nghe được (hoặc đoạn ghi âm), tự nhận diện ngôn ngữ và dịch sang ngôn ngữ khách chọn
@router.post("/dich-giong-noi")
def dich_giong_noi(
    ngon_ngu_dich: str = Form(...),
    file: UploadFile | None = File(default=None),
    van_ban_goc: str | None = Form(default=None),
    ngon_ngu_nguon: str | None = Form(default=None),
):
    if ngon_ngu_dich not in dich.MA_DICH:
        raise HTTPException(400, "Ngôn ngữ dịch không được hỗ trợ")
    van_ban_goc = (van_ban_goc or "").strip()
    goi_y = ngon_ngu_nguon if ngon_ngu_nguon in dich.MA_DICH else None

    if van_ban_goc:
        # nếu người dùng đã chọn sẵn ngôn ngữ đầu vào thì dùng trực tiếp, ngược lại tự phát hiện từ nội dung chữ
        ngon_ngu_phat_hien = goi_y or dich.nhan_dien_ngon_ngu_van_ban(van_ban_goc)
    elif file is not None:
        noi_dung, loai = _doc_file_ghi_am(file)
        # lưu tạm ra file vì bộ nhận diện đọc audio từ đường dẫn, xong việc thì xóa ngay, không giữ lại giọng nói của khách
        with tempfile.NamedTemporaryFile(suffix=f".{loai}", delete=False) as tep:
            tep.write(noi_dung)
        try:
            ngon_ngu_phat_hien, van_ban_goc = nhan_dien.nhan_dien_giong_noi(tep.name, goi_y)
        except Exception as loi:
            raise HTTPException(503, f"Chưa nhận diện được giọng nói: {loi}")
        finally:
            os.unlink(tep.name)
        van_ban_goc = (van_ban_goc or "").strip()
        if van_ban_goc:
            ngon_ngu_phat_hien = goi_y or dich.nhan_dien_ngon_ngu_van_ban(van_ban_goc)
    else:
        van_ban_goc, ngon_ngu_phat_hien = "", None

    if not van_ban_goc:
        return {"ngon_ngu_nguon": None, "van_ban_goc": "", "ban_dich": ""}
    if ngon_ngu_phat_hien == ngon_ngu_dich:
        return {"ngon_ngu_nguon": ngon_ngu_phat_hien, "van_ban_goc": van_ban_goc, "ban_dich": van_ban_goc}
    try:
        ban_dich = dich.dich_van_ban(van_ban_goc, ngon_ngu_dich, ngon_ngu_phat_hien)
    except Exception as loi:
        raise HTTPException(502, f"Không dịch được (cần có mạng): {loi}")
    return {"ngon_ngu_nguon": ngon_ngu_phat_hien, "van_ban_goc": van_ban_goc, "ban_dich": ban_dich}
