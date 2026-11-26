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
