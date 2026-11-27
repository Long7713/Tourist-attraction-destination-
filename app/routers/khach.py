from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.bao_mat import bam_ip
from app.config import KHUNG_BAN_DO, MA_NGON_NGU_MAC_DINH
from app.database import lay_phien_csdl
from app.models import DiemThamQuan, LichSuNghe, LuotTruyCap, NgonNgu, NoiDungDiem
from app.schemas import GoiDongBo
from app.services.phien_ban import tinh_phien_ban
from app.services.qr import lay_dia_chi_tunnel, lay_ip_lan, tao_qr_png
from app.services.thiet_bi import nhan_dien_loai_thiet_bi
from app.services.vung import diem_gan_nhat_trong_vung
from app.thoi_gian import chuan_hoa_gio_khach

router = APIRouter(prefix="/api", tags=["Khách"])


def _noi_dung_ra(nd: NoiDungDiem) -> dict:
    return {
        "tieu_de": nd.tieu_de,
        "mo_ta_ngan": nd.mo_ta_ngan,
        "noi_dung": nd.noi_dung,
        "am_thanh": f"/am-thanh/{nd.duong_dan_am_thanh}" if nd.duong_dan_am_thanh else None,
    }


def _noi_dung_da_dang(diem: DiemThamQuan) -> dict[str, NoiDungDiem]:
    # chỉ lấy các bản nội dung admin đã đăng, bản nháp không hiện cho khách
    return {nd.ma_ngon_ngu: nd for nd in diem.noi_dung if nd.trang_thai == "da_dang"}


def _diem_ra(diem: DiemThamQuan, ma_ngon_ngu: str) -> dict | None:
    # dữ liệu một điểm theo ngôn ngữ khách chọn, thiếu bản dịch thì dùng tiếng Việt
    theo_ngon_ngu = _noi_dung_da_dang(diem)
    nd = theo_ngon_ngu.get(ma_ngon_ngu) or theo_ngon_ngu.get(MA_NGON_NGU_MAC_DINH)
    if nd is None:
        return None
    return {
        "slug": diem.slug, "vi_do": diem.vi_do, "kinh_do": diem.kinh_do,
        "ban_kinh_m": diem.ban_kinh_m, "hinh_anh": diem.hinh_anh,
        "ngon_ngu_hien_thi": nd.ma_ngon_ngu, **_noi_dung_ra(nd),
    }


def _lay_diem_dang_dung(phien: Session) -> list[DiemThamQuan]:
    return list(phien.scalars(
        select(DiemThamQuan).where(DiemThamQuan.dang_dung.is_(True))
        .options(selectinload(DiemThamQuan.noi_dung)).order_by(DiemThamQuan.thu_tu, DiemThamQuan.id)
    ))


# chức năng danh sách ngôn ngữ cho màn hình chọn ngôn ngữ
@router.get("/ngon-ngu")
def danh_sach_ngon_ngu(phien: Session = Depends(lay_phien_csdl)):
    hang = phien.scalars(select(NgonNgu).where(NgonNgu.dang_dung.is_(True)).order_by(NgonNgu.thu_tu))
    return [
        {"ma": n.ma_ngon_ngu, "ten": n.ten_ban_ngu, "giong_doc": n.ma_giong_doc, "mac_dinh": n.la_mac_dinh}
        for n in hang
    ]


# chức năng danh sách điểm tham quan theo ngôn ngữ đã chọn
@router.get("/diem")
def danh_sach_diem(ngon_ngu: str = MA_NGON_NGU_MAC_DINH, phien: Session = Depends(lay_phien_csdl)):
    ket_qua = (_diem_ra(d, ngon_ngu) for d in _lay_diem_dang_dung(phien))
    return [d for d in ket_qua if d is not None]


# chức năng chi tiết một điểm tham quan
@router.get("/diem/{slug}")
def chi_tiet_diem(slug: str, ngon_ngu: str = MA_NGON_NGU_MAC_DINH, phien: Session = Depends(lay_phien_csdl)):
    diem = phien.scalar(
        select(DiemThamQuan).where(DiemThamQuan.slug == slug, DiemThamQuan.dang_dung.is_(True))
        .options(selectinload(DiemThamQuan.noi_dung))
    )
    du_lieu = _diem_ra(diem, ngon_ngu) if diem else None
    if du_lieu is None:
        raise HTTPException(404, "Không tìm thấy điểm tham quan")
    return du_lieu


# chức năng gói dữ liệu offline: toàn bộ điểm, mọi ngôn ngữ và giới hạn bản đồ trong một lần tải
@router.get("/goi-offline")
def goi_offline(phien: Session = Depends(lay_phien_csdl)):
    diem = [
        {
            "slug": d.slug, "vi_do": d.vi_do, "kinh_do": d.kinh_do, "ban_kinh_m": d.ban_kinh_m,
            "hinh_anh": d.hinh_anh,
            "noi_dung": {ma: _noi_dung_ra(nd) for ma, nd in _noi_dung_da_dang(d).items()},
        }
        for d in _lay_diem_dang_dung(phien)
    ]
    return {
        "phien_ban": tinh_phien_ban(phien),
        "ngon_ngu": danh_sach_ngon_ngu(phien),
        "ban_do": KHUNG_BAN_DO,
        "diem": diem,
    }


# chức năng kiểm tra phiên bản dữ liệu để biết có cần tải lại gói offline
@router.get("/phien-ban")
def phien_ban(phien: Session = Depends(lay_phien_csdl)):
    return {"phien_ban": tinh_phien_ban(phien)}


# chức năng xác định điểm theo vị trí khách (khi online, khi offline thì trình duyệt tự tính)
@router.get("/vung/gan-nhat")
def vung_gan_nhat(
    vi_do: float = Query(ge=-90, le=90),
    kinh_do: float = Query(ge=-180, le=180),
    ngon_ngu: str = MA_NGON_NGU_MAC_DINH,
    phien: Session = Depends(lay_phien_csdl),
):
    diem, khoang_cach = diem_gan_nhat_trong_vung(vi_do, kinh_do, _lay_diem_dang_dung(phien))
    du_lieu = _diem_ra(diem, ngon_ngu) if diem else None
    if du_lieu is None:
        return {"trong_vung": False}
    return {"trong_vung": True, "khoang_cach_m": round(khoang_cach), "diem": du_lieu}


# chức năng đồng bộ lượt truy cập và lịch sử nghe, an toàn khi gửi lặp lại
@router.post("/dong-bo")
def dong_bo(goi: GoiDongBo, request: Request, phien: Session = Depends(lay_phien_csdl)):
    ngon_ngu_hop_le = set(phien.scalars(select(NgonNgu.ma_ngon_ngu)))
    user_agent = request.headers.get("user-agent")
    loai_thiet_bi = nhan_dien_loai_thiet_bi(user_agent)
    ip_ma_hoa = bam_ip(request.client.host if request.client else None)
    diem_theo_slug = {d.slug: d.id for d in phien.scalars(select(DiemThamQuan))}
    dem = {"truy_cap_moi": 0, "nghe_moi": 0, "bo_qua": 0}

    for sk in goi.truy_cap:
        ngon_ngu = sk.ma_ngon_ngu if sk.ma_ngon_ngu in ngon_ngu_hop_le else None
        da_co = phien.scalar(select(LuotTruyCap).where(LuotTruyCap.ma_su_kien == sk.ma_su_kien))
        if da_co:
            # khách đổi ngôn ngữ sau khi vào: cập nhật ngôn ngữ mới nhất
            if ngon_ngu:
                da_co.ma_ngon_ngu = ngon_ngu
            dem["bo_qua"] += 1
            continue
        phien.add(LuotTruyCap(
            ma_su_kien=sk.ma_su_kien, ma_phien=sk.ma_phien, ma_ngon_ngu=ngon_ngu,
            thoi_gian_truy_cap=chuan_hoa_gio_khach(sk.thoi_gian),
            loai_thiet_bi=loai_thiet_bi, thiet_bi=(user_agent or "")[:255] or None, ip_ma_hoa=ip_ma_hoa,
        ))
        dem["truy_cap_moi"] += 1
    phien.flush()

    for sk in goi.nghe:
        luot = phien.scalar(select(LuotTruyCap).where(LuotTruyCap.ma_su_kien == sk.ma_su_kien_truy_cap))
        diem_id = diem_theo_slug.get(sk.diem_slug)
        if luot is None or diem_id is None or sk.ma_ngon_ngu not in ngon_ngu_hop_le:
            dem["bo_qua"] += 1
            continue
        if phien.scalar(select(LichSuNghe.id).where(LichSuNghe.ma_su_kien == sk.ma_su_kien)):
            dem["bo_qua"] += 1
            continue
        phien.add(LichSuNghe(
            ma_su_kien=sk.ma_su_kien, luot_truy_cap_id=luot.id, diem_id=diem_id,
            ma_ngon_ngu=sk.ma_ngon_ngu, thoi_gian_nghe=chuan_hoa_gio_khach(sk.thoi_gian),
        ))
        dem["nghe_moi"] += 1

    try:
        phien.commit()
    except IntegrityError:
        # hai yêu cầu đồng bộ cùng lúc ghi trùng một sự kiện: coi như đã nhận
        phien.rollback()
        raise HTTPException(409, "Sự kiện đã được ghi, hãy gửi lại")
    return dem


# chức năng mã QR chung: sinh ảnh QR cho địa chỉ được truyền vào, hệ thống không lưu địa chỉ này
@router.get("/qr.png")
def ma_qr_chung(dia_chi: str = Query(min_length=8, max_length=255, pattern=r"^https?://\S+$")):
    return Response(tao_qr_png(dia_chi), media_type="image/png", headers={"Cache-Control": "no-store"})


# địa chỉ đưa vào mã QR chung: mở bằng localhost thì ưu tiên tunnel cloudflared, không có thì IP LAN,
# vì điện thoại không vào được localhost của máy chủ
@router.get("/qr/thong-tin")
def thong_tin_qr(request: Request):
    url = request.url
    if url.hostname not in ("localhost", "127.0.0.1"):
        return {"dia_chi_qr": f"{request.base_url}?qr=1", "dia_chi_cong_khai": None, "dang_tao_tunnel": False}
    tunnel = lay_dia_chi_tunnel()
    if tunnel:
        return {"dia_chi_qr": f"{tunnel}/?qr=1", "dia_chi_cong_khai": tunnel, "dang_tao_tunnel": False}
    cong = f":{url.port}" if url.port else ""
    return {"dia_chi_qr": f"{url.scheme}://{lay_ip_lan()}{cong}/?qr=1", "dia_chi_cong_khai": None, "dang_tao_tunnel": False}
