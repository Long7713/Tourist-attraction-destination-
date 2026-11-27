from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import THU_MUC_AM_THANH, THU_MUC_BAN_DO, THU_MUC_GIAO_DIEN_BUILD, cau_hinh
from app.routers import admin, giong_noi, khach

THU_MUC_AM_THANH.mkdir(parents=True, exist_ok=True)
THU_MUC_BAN_DO.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="BusBuss - Hệ thống thuyết minh đa ngôn ngữ")

# nén các file lớn như GeoJSON bản đồ để điện thoại tải nhanh hơn
app.add_middleware(GZipMiddleware, minimum_size=1024)
app.add_middleware(
    CORSMiddleware, allow_origins=cau_hinh.cors_origins, allow_methods=["*"], allow_headers=["*"],
)

app.include_router(khach.router)
app.include_router(giong_noi.router)
app.include_router(admin.router)

# file audio thuyết minh và dữ liệu bản đồ GeoJSON phục vụ trực tiếp, trình duyệt sẽ cache cho offline
app.mount("/am-thanh", StaticFiles(directory=THU_MUC_AM_THANH), name="am_thanh")
app.mount("/du-lieu-ban-do", StaticFiles(directory=THU_MUC_BAN_DO), name="du_lieu_ban_do")


@app.get("/api/suc-khoe")
def suc_khoe():
    # kiểm tra nhanh backend còn sống
    return {"trang_thai": "ok"}


if THU_MUC_GIAO_DIEN_BUILD.exists():
    # phục vụ giao diện React đã build, mọi đường dẫn không phải API đều trả về index.html
    app.mount("/assets", StaticFiles(directory=THU_MUC_GIAO_DIEN_BUILD / "assets"), name="assets")

    @app.get("/{duong_dan:path}", include_in_schema=False)
    def giao_dien(duong_dan: str):
        if duong_dan.startswith(("api/", "am-thanh/", "du-lieu-ban-do/")):
            raise HTTPException(404)
        # trang chính và service worker luôn kiểm tra lại với máy chủ để khách nhận được bản build mới ngay sau khi triển khai
        khong_cache = {"Cache-Control": "no-cache"}
        tep = THU_MUC_GIAO_DIEN_BUILD / duong_dan
        if duong_dan and tep.is_file() and THU_MUC_GIAO_DIEN_BUILD in tep.resolve().parents:
            return FileResponse(tep, headers=khong_cache)
        return FileResponse(THU_MUC_GIAO_DIEN_BUILD / "index.html", headers=khong_cache)


if __name__ == "__main__":
    # chạy: python -m app.main (chỉ máy này) hoặc python -m app.main lan (cho điện thoại cùng wifi vào)
    # mặc định 127.0.0.1 vì link 0.0.0.0 uvicorn in ra không mở được trên trình duyệt
    import sys

    import uvicorn

    from app.services.qr import lay_ip_lan

    sys.stdout.reconfigure(encoding="utf-8")  # console Windows mặc định cp1252, in tiếng Việt sẽ lỗi
    mo_lan = "lan" in sys.argv[1:]
    if mo_lan:
        print(f"Mở trên máy này: http://localhost:8000  |  điện thoại cùng wifi: http://{lay_ip_lan()}:8000", flush=True)
    uvicorn.run("app.main:app", host="0.0.0.0" if mo_lan else "127.0.0.1", port=8000)
