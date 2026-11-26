from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

THU_MUC_BACKEND = Path(__file__).resolve().parent.parent
THU_MUC_DU_LIEU = THU_MUC_BACKEND / "du_lieu"
THU_MUC_AM_THANH = THU_MUC_DU_LIEU / "am_thanh"
THU_MUC_BAN_DO = THU_MUC_DU_LIEU / "ban_do"
# thư mục giao diện sau khi build (pnpm build) để backend phục vụ luôn khi triển khai
THU_MUC_GIAO_DIEN_BUILD = THU_MUC_BACKEND.parent / "BusBuss Smart City Tour" / "dist"

# khung giới hạn bản đồ (nam, bắc, tây, đông), cố định trong code vì dữ liệu nền chỉ được xuất cho vùng này
KHUNG_BAN_DO = {
    "ban_do_vi_do_nam": 10.30, "ban_do_vi_do_bac": 11.20, "ban_do_kinh_do_tay": 106.30, "ban_do_kinh_do_dong": 107.10,
}

# tài khoản admin cố định trong code, không dùng bảng trong database
TEN_DANG_NHAP_ADMIN = "admin"

# ngôn ngữ mặc định, dùng làm bản gốc để dịch và làm phương án dự phòng khi thiếu bản dịch
MA_NGON_NGU_MAC_DINH = "vi"


class CauHinh(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "mysql+pymysql://root:@localhost:3306/thuyet_minh?charset=utf8mb4"
    khoa_bi_mat: str = "doi-khoa-nay-khi-trien-khai"
    thoi_han_token_gio: int = 12
    # mật khẩu admin cố định là 123, muốn đổi thì đặt MAT_KHAU_ADMIN trong file .env
    mat_khau_admin: str = "123"
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:8443"]
    # mô hình Whisper nhận diện giọng nói: tiny/base nhanh, small chính xác hơn với tiếng Việt
    mo_hinh_giong_noi: str = "base"
    # khóa tùy chọn để nhận diện giọng nói từ file .wav khi máy chủ không cài faster-whisper
    khoa_google_giong_noi: str | None = None
    gemini_api_key: str | None = None


cau_hinh = CauHinh()
