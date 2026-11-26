from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class SuKienTruyCap(BaseModel):
    # một lượt truy cập do trình duyệt ghi lại (có thể ghi lúc offline rồi gửi bù)
    ma_su_kien: str = Field(min_length=8, max_length=36)
    ma_phien: str = Field(min_length=8, max_length=64)
    ma_ngon_ngu: str | None = Field(default=None, max_length=10)
    thoi_gian: datetime | None = None


class SuKienNghe(BaseModel):
    # một lần khách nghe thuyết minh một điểm
    ma_su_kien: str = Field(min_length=8, max_length=36)
    ma_su_kien_truy_cap: str = Field(min_length=8, max_length=36)
    diem_slug: str
    ma_ngon_ngu: str = Field(max_length=10)
    thoi_gian: datetime | None = None


class GoiDongBo(BaseModel):
    # gói sự kiện trình duyệt gửi lên khi có mạng
    truy_cap: list[SuKienTruyCap] = Field(default_factory=list, max_length=500)
    nghe: list[SuKienNghe] = Field(default_factory=list, max_length=500)


class DangNhap(BaseModel):
    ten_dang_nhap: str
    mat_khau: str


class DiemVao(BaseModel):
    # dữ liệu admin gửi khi tạo/sửa điểm và vùng
    slug: str = Field(pattern=r"^[a-z0-9]+(-[a-z0-9]+)*$", max_length=100)
    ten_diem: str = Field(min_length=1, max_length=150)
    vi_do: float = Field(ge=0, le=90)
    kinh_do: float = Field(ge=0, le=180)
    ban_kinh_m: int = Field(ge=20, le=2000)
    hinh_anh: str | None = None
    thu_tu: int = 0
    dang_dung: bool = True


class DiemRa(DiemVao):
    model_config = ConfigDict(from_attributes=True)
    id: int


class NoiDungVao(BaseModel):
    # nội dung thuyết minh một ngôn ngữ do admin soạn
    tieu_de: str = Field(min_length=1, max_length=200)
    mo_ta_ngan: str | None = Field(default=None, max_length=300)
    noi_dung: str = Field(min_length=1)
    trang_thai: str = Field(default="nhap", pattern="^(nhap|da_dang)$")
