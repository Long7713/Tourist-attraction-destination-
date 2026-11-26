"""Bổ sung nội dung đủ 6 ngôn ngữ cho các điểm mẫu và tạo audio mp3 cho từng bản.

Chạy từ thư mục backend:  python -m scripts.tao_noi_dung_day_du
- Thêm bản còn thiếu và đăng luôn (bản đã có thì giữ nguyên, không ghi đè nội dung admin đã sửa)
- Tạo audio cho bản chưa có hoặc đã cũ, cần có mạng
- Chạy lại nhiều lần an toàn
"""
import asyncio

from sqlalchemy import select

from app.database import PhienLamViec
from app.models import DiemThamQuan, NoiDungDiem
from app.services.giong_noi import tao_file_am_thanh, tinh_hash_noi_dung
from scripts.noi_dung_mau import NOI_DUNG_MAU


async def chay() -> None:
    with PhienLamViec() as phien:
        for slug, theo_ngon_ngu in NOI_DUNG_MAU.items():
            diem = phien.scalar(select(DiemThamQuan).where(DiemThamQuan.slug == slug))
            if diem is None:
                print(f"Bỏ qua {slug}: chưa có điểm này trong CSDL")
                continue
            co_san = {nd.ma_ngon_ngu: nd for nd in phien.scalars(select(NoiDungDiem).where(NoiDungDiem.diem_id == diem.id))}
            for ma, (tieu_de, mo_ta, noi_dung) in theo_ngon_ngu.items():
                nd = co_san.get(ma)
                if nd is None:
                    nd = NoiDungDiem(diem_id=diem.id, ma_ngon_ngu=ma, tieu_de=tieu_de, mo_ta_ngan=mo_ta, noi_dung=noi_dung, trang_thai="da_dang")
                    phien.add(nd)
                    print(f"+ nội dung {slug}/{ma}")
                hash_hien_tai = tinh_hash_noi_dung(nd.tieu_de, nd.noi_dung)
                if nd.duong_dan_am_thanh is None or nd.am_thanh_hash != hash_hien_tai:
                    nd.duong_dan_am_thanh = await tao_file_am_thanh(diem.id, ma, nd.tieu_de, nd.noi_dung)
                    nd.am_thanh_hash = hash_hien_tai
                    print(f"+ audio {slug}/{ma}")
                    phien.commit()
        phien.commit()
    print("Xong.")


if __name__ == "__main__":
    asyncio.run(chay())
