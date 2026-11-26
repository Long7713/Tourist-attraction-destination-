# Backend BusBuss (FastAPI + SQLAlchemy + MySQL)

Cấu trúc
- `app/main.py` khởi tạo ứng dụng, gắn router, phục vụ audio, GeoJSON và giao diện đã build
- `app/routers/khach.py` API cho khách (không đăng nhập): ngôn ngữ, điểm, gói offline, đồng bộ truy cập, mã QR
- `app/routers/admin.py` API admin (cần đăng nhập): dashboard và mã QR, lượt truy cập, địa điểm, nội dung
- `app/services/` xử lý nghiệp vụ: vùng GPS, thống kê, QR, giọng đọc, dịch
- `app/models.py` các bảng CSDL, khớp với `../database/thuyetminh_v2.sql`
- `scripts/` nạp dữ liệu mẫu, tạo nội dung đủ 6 ngôn ngữ, xuất bản đồ GeoJSON
- `tests/` kiểm thử tự động
- Giao diện React nằm ngoài backend, trong thư mục `../BusBuss Smart City Tour`

Chạy lần đầu (trong thư mục `backend`)
```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # sửa DATABASE_URL và KHOA_BI_MAT
python -m scripts.nap_du_lieu_mau
uvicorn app.main:app --reload --port 8000
```
Tài liệu API tự sinh: http://localhost:8000/docs

Kiểm thử: `python -m pytest -q` (dùng SQLite tạm, không đụng MySQL).

Chạy cả hệ thống (khách + admin) từ một cổng
```bash
cd "../BusBuss Smart City Tour" && npm install && npx vite build   # tạo thư mục dist
cd ../backend && uvicorn app.main:app --host 0.0.0.0 --port 8000
```
- Khách: http://localhost:8000/ (quét mã QR), admin: http://localhost:8000/admin (tài khoản cố định trong code: `admin` / `123`, đổi mật khẩu bằng cách đặt `MAT_KHAU_ADMIN` trong `.env`)
- Dữ liệu bản đồ nền: `python -m scripts.xuat_geojson_hcm` (cần `pip install -r requirements-dulieu-bando.txt` và có mạng, chạy một lần)
- Phiên dịch giọng nói dùng Whisper chạy trên máy chủ, lần đầu tự tải mô hình. Đổi mô hình trong `.env`: `MO_HINH_GIONG_NOI=small` (chính xác hơn với tiếng Việt, chậm hơn `base`)
- Demo không cần đi thực địa: mở `/explore?vitri=10.7726,106.6981` để đặt vị trí giả trong vùng Chợ Bến Thành
- GPS, micro và service worker (offline) chỉ hoạt động trên HTTPS hoặc localhost

Xuất bản đồ nền ổn định bằng file dữ liệu tải về máy (khuyên dùng, chạy khoảng 30 giây)
```bash
mkdir -p du_lieu/nguon
curl -L -o du_lieu/nguon/vietnam-latest.osm.pbf https://download.geofabrik.de/asia/vietnam-latest.osm.pbf
pip install -r requirements-dulieu-bando.txt
python -m scripts.xuat_geojson_tu_pbf
```
File `.osm.pbf` (khoảng 330 MB) và các file GeoJSON không đưa lên git, mỗi máy mới cần xuất lại một lần.
Cách cũ qua Overpass vẫn còn (`python -m scripts.xuat_geojson_hcm`) nhưng hay lỗi vì máy chủ công cộng quá tải.
