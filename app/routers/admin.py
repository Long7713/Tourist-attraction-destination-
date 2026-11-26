import csv
import io
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.bao_mat import kiem_tra_dang_nhap, tao_token_admin, yeu_cau_admin
from app.config import MA_NGON_NGU_MAC_DINH
from app.database import lay_phien_csdl
from app.models import DiemThamQuan, LuotTruyCap, NgonNgu, NoiDungDiem
from app.schemas import DangNhap, DiemRa, DiemVao, NoiDungVao
from app.services import dich, giong_noi, thong_ke
from app.services.vung import cac_cap_chong_vung
from app.thoi_gian import gio_viet_nam

router = APIRouter(prefix="/api/admin", tags=["Admin"])
# mọi API bên dưới (trừ đăng nhập) đều yêu cầu admin đã đăng nhập
bao_ve = [Depends(yeu_cau_admin)]


def _lay_diem_hoac_404(phien: Session, diem_id: int) -> DiemThamQuan:
    diem = phien.get(DiemThamQuan, diem_id)
    if diem is None:
        raise HTTPException(404, "Không tìm thấy điểm")
    return diem


def _kiem_tra_ngon_ngu(phien: Session, ma_ngon_ngu: str) -> None:
    if phien.get(NgonNgu, ma_ngon_ngu) is None:
        raise HTTPException(404, "Ngôn ngữ không được hỗ trợ")


# chức năng đăng nhập admin bằng tài khoản cố định trong code
@router.post("/dang-nhap")
def dang_nhap(du_lieu: DangNhap):
    if not kiem_tra_dang_nhap(du_lieu.ten_dang_nhap, du_lieu.mat_khau):
        raise HTTPException(401, "Sai tên đăng nhập hoặc mật khẩu")
    return {"token": tao_token_admin(), "ho_ten": "Quản trị viên", "vai_tro": "admin"}


# chức năng dashboard thống kê lượt truy cập theo tháng
@router.get("/dashboard", dependencies=bao_ve)
def dashboard(thang: str | None = Query(default=None, pattern=r"^\d{4}-(0[1-9]|1[0-2])$"),
              phien: Session = Depends(lay_phien_csdl)):
    return thong_ke.thong_ke_dashboard(phien, thang)


def _loc_luot_truy_cap(tu: date | None, den: date | None, ngon_ngu: str | None):
    # dựng điều kiện lọc dùng chung cho danh sách và xuất CSV
    dieu_kien = []
    if tu:
        dieu_kien.append(LuotTruyCap.thoi_gian_truy_cap >= datetime.combine(tu, datetime.min.time()))
    if den:
        dieu_kien.append(LuotTruyCap.thoi_gian_truy_cap < datetime.combine(den + timedelta(days=1), datetime.min.time()))
    if ngon_ngu:
        dieu_kien.append(LuotTruyCap.ma_ngon_ngu == ngon_ngu)
    return dieu_kien


# chức năng quản lý lượt truy cập: danh sách có lọc và phân trang
@router.get("/luot-truy-cap", dependencies=bao_ve)
def danh_sach_luot_truy_cap(
    tu: date | None = None, den: date | None = None, ngon_ngu: str | None = None,
    trang: int = Query(default=1, ge=1), so_luong: int = Query(default=20, ge=1, le=200),
    phien: Session = Depends(lay_phien_csdl),
):
    dieu_kien = _loc_luot_truy_cap(tu, den, ngon_ngu)
    tong = phien.scalar(select(func.count(LuotTruyCap.id)).where(*dieu_kien)) or 0
    hang = phien.scalars(
        select(LuotTruyCap).where(*dieu_kien).order_by(LuotTruyCap.thoi_gian_truy_cap.desc())
        .offset((trang - 1) * so_luong).limit(so_luong)
    )
    return {
        "tong": tong, "trang": trang, "so_luong": so_luong,
        "du_lieu": [
            {"id": h.id, "ma_phien": h.ma_phien, "ma_ngon_ngu": h.ma_ngon_ngu,
             "thoi_gian_truy_cap": h.thoi_gian_truy_cap, "loai_thiet_bi": h.loai_thiet_bi}
            for h in hang
        ],
    }


# chức năng xuất lượt truy cập ra file CSV
@router.get("/luot-truy-cap/xuat-csv", dependencies=bao_ve)
def xuat_csv(tu: date | None = None, den: date | None = None, ngon_ngu: str | None = None,
             phien: Session = Depends(lay_phien_csdl)):
    dieu_kien = _loc_luot_truy_cap(tu, den, ngon_ngu)
    bo_dem = io.StringIO()
    # BOM giúp Excel đọc đúng tiếng Việt có dấu
    bo_dem.write("﻿")
    viet = csv.writer(bo_dem)
    viet.writerow(["Thời gian truy cập", "Mã phiên", "Ngôn ngữ", "Loại thiết bị"])
    for h in phien.scalars(select(LuotTruyCap).where(*dieu_kien).order_by(LuotTruyCap.thoi_gian_truy_cap)):
        viet.writerow([h.thoi_gian_truy_cap.isoformat(sep=" "), h.ma_phien, h.ma_ngon_ngu or "", h.loai_thiet_bi])
    bo_dem.seek(0)
    return StreamingResponse(
        iter([bo_dem.getvalue()]), media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="luot_truy_cap.csv"'},
    )


# chức năng quản lý địa điểm và phân vùng: danh sách
@router.get("/diem", dependencies=bao_ve)
def danh_sach_diem(phien: Session = Depends(lay_phien_csdl)):
    diem = list(phien.scalars(select(DiemThamQuan).order_by(DiemThamQuan.thu_tu, DiemThamQuan.id)))
    return {
        "du_lieu": [DiemRa.model_validate(d) for d in diem],
        "canh_bao_chong_vung": cac_cap_chong_vung([d for d in diem if d.dang_dung]),
    }


# chức năng quản lý địa điểm và phân vùng: thêm điểm
@router.post("/diem", dependencies=bao_ve, status_code=201)
def them_diem(du_lieu: DiemVao, phien: Session = Depends(lay_phien_csdl)):
    diem = DiemThamQuan(**du_lieu.model_dump())
    phien.add(diem)
    try:
        phien.commit()
    except IntegrityError:
        phien.rollback()
        raise HTTPException(409, "Slug đã tồn tại")
    return DiemRa.model_validate(diem)


# chức năng quản lý địa điểm và phân vùng: sửa điểm, đổi tâm hoặc bán kính vùng
@router.put("/diem/{diem_id}", dependencies=bao_ve)
def sua_diem(diem_id: int, du_lieu: DiemVao, phien: Session = Depends(lay_phien_csdl)):
    diem = _lay_diem_hoac_404(phien, diem_id)
    for khoa, gia_tri in du_lieu.model_dump().items():
        setattr(diem, khoa, gia_tri)
    try:
        phien.commit()
    except IntegrityError:
        phien.rollback()
        raise HTTPException(409, "Slug đã tồn tại")
    return DiemRa.model_validate(diem)


# chức năng quản lý địa điểm và phân vùng: ẩn điểm (xóa mềm để giữ lịch sử thống kê)
@router.delete("/diem/{diem_id}", dependencies=bao_ve, status_code=204)
def an_diem(diem_id: int, phien: Session = Depends(lay_phien_csdl)):
    diem = _lay_diem_hoac_404(phien, diem_id)
    diem.dang_dung = False
    phien.commit()


# chức năng quản lý nội dung thuyết minh: xem đủ 6 ngôn ngữ của một điểm và ngôn ngữ còn thiếu
@router.get("/diem/{diem_id}/noi-dung", dependencies=bao_ve)
def xem_noi_dung(diem_id: int, phien: Session = Depends(lay_phien_csdl)):
    diem = phien.scalar(
        select(DiemThamQuan).where(DiemThamQuan.id == diem_id).options(selectinload(DiemThamQuan.noi_dung))
    )
    if diem is None:
        raise HTTPException(404, "Không tìm thấy điểm")
    co_san = {nd.ma_ngon_ngu: nd for nd in diem.noi_dung}
    ket_qua = []
    for ngon_ngu in phien.scalars(select(NgonNgu).where(NgonNgu.dang_dung.is_(True)).order_by(NgonNgu.thu_tu)):
        nd = co_san.get(ngon_ngu.ma_ngon_ngu)
        ket_qua.append({
            "ma_ngon_ngu": ngon_ngu.ma_ngon_ngu, "ten": ngon_ngu.ten_tieng_viet,
            "thieu": nd is None,
            "tieu_de": nd.tieu_de if nd else None, "mo_ta_ngan": nd.mo_ta_ngan if nd else None,
            "noi_dung": nd.noi_dung if nd else None, "trang_thai": nd.trang_thai if nd else None,
            "co_am_thanh": bool(nd and nd.duong_dan_am_thanh),
            # audio cũ khi nội dung đã sửa sau lần tạo audio gần nhất
            "am_thanh_cu": bool(
                nd and nd.duong_dan_am_thanh
                and nd.am_thanh_hash != giong_noi.tinh_hash_noi_dung(nd.tieu_de, nd.noi_dung)
            ),
        })
    return {"diem_id": diem.id, "ten_diem": diem.ten_diem, "noi_dung": ket_qua}


def _luu_noi_dung(phien: Session, diem_id: int, ma_ngon_ngu: str, du_lieu: NoiDungVao) -> NoiDungDiem:
    # thêm mới hoặc cập nhật nội dung một ngôn ngữ
    nd = phien.scalar(select(NoiDungDiem).where(NoiDungDiem.diem_id == diem_id, NoiDungDiem.ma_ngon_ngu == ma_ngon_ngu))
    if nd is None:
        nd = NoiDungDiem(diem_id=diem_id, ma_ngon_ngu=ma_ngon_ngu, **du_lieu.model_dump())
        phien.add(nd)
    else:
        for khoa, gia_tri in du_lieu.model_dump().items():
            setattr(nd, khoa, gia_tri)
    return nd


# chức năng quản lý nội dung thuyết minh: lưu nội dung một ngôn ngữ
@router.put("/diem/{diem_id}/noi-dung/{ma_ngon_ngu}", dependencies=bao_ve)
def luu_noi_dung(diem_id: int, ma_ngon_ngu: str, du_lieu: NoiDungVao, phien: Session = Depends(lay_phien_csdl)):
    _lay_diem_hoac_404(phien, diem_id)
    _kiem_tra_ngon_ngu(phien, ma_ngon_ngu)
    _luu_noi_dung(phien, diem_id, ma_ngon_ngu, du_lieu)
    phien.commit()
    return {"da_luu": True}


# chức năng dịch tự động từ tiếng Việt sang ngôn ngữ khác, kết quả lưu thành bản nháp
@router.post("/diem/{diem_id}/noi-dung/{ma_ngon_ngu}/dich-tu-dong", dependencies=bao_ve)
def dich_tu_dong(diem_id: int, ma_ngon_ngu: str, phien: Session = Depends(lay_phien_csdl)):
    _lay_diem_hoac_404(phien, diem_id)
    _kiem_tra_ngon_ngu(phien, ma_ngon_ngu)
    if ma_ngon_ngu == MA_NGON_NGU_MAC_DINH:
        raise HTTPException(400, "Tiếng Việt là bản gốc, không cần dịch")
    goc = phien.scalar(select(NoiDungDiem).where(
        NoiDungDiem.diem_id == diem_id, NoiDungDiem.ma_ngon_ngu == MA_NGON_NGU_MAC_DINH))
    if goc is None:
        raise HTTPException(400, "Cần soạn nội dung tiếng Việt trước khi dịch")
    try:
        ban_dich = NoiDungVao(
            tieu_de=dich.dich_van_ban(goc.tieu_de, ma_ngon_ngu)[:200],
            mo_ta_ngan=(dich.dich_van_ban(goc.mo_ta_ngan or "", ma_ngon_ngu) or None),
            noi_dung=dich.dich_van_ban(goc.noi_dung, ma_ngon_ngu),
            trang_thai="nhap",
        )
    except Exception as loi:
        raise HTTPException(502, f"Không dịch được (cần có mạng): {loi}")
    _luu_noi_dung(phien, diem_id, ma_ngon_ngu, ban_dich)
    phien.commit()
    return {"da_luu_ban_nhap": True, "tieu_de": ban_dich.tieu_de}


# chức năng tạo file audio thuyết minh để khách nghe offline
@router.post("/diem/{diem_id}/noi-dung/{ma_ngon_ngu}/tao-am-thanh", dependencies=bao_ve)
async def tao_am_thanh(diem_id: int, ma_ngon_ngu: str, phien: Session = Depends(lay_phien_csdl)):
    nd = phien.scalar(select(NoiDungDiem).where(NoiDungDiem.diem_id == diem_id, NoiDungDiem.ma_ngon_ngu == ma_ngon_ngu))
    if nd is None:
        raise HTTPException(404, "Chưa có nội dung ở ngôn ngữ này")
    try:
        ten_file = await giong_noi.tao_file_am_thanh(diem_id, ma_ngon_ngu, nd.tieu_de, nd.noi_dung)
    except Exception as loi:
        raise HTTPException(502, f"Không tạo được audio (cần có mạng): {loi}")
    nd.duong_dan_am_thanh = ten_file
    nd.am_thanh_hash = giong_noi.tinh_hash_noi_dung(nd.tieu_de, nd.noi_dung)
    phien.commit()
    return {"am_thanh": f"/am-thanh/{ten_file}"}
