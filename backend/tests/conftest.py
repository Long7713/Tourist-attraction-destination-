import os
import tempfile

# phải đặt trước khi import app để backend dùng CSDL SQLite tạm thay vì MySQL
_tep_tam = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ["DATABASE_URL"] = f"sqlite:///{_tep_tam.name}"
os.environ["KHOA_BI_MAT"] = "khoa-chi-dung-khi-test"

import pytest
from fastapi.testclient import TestClient

from app.database import Base, PhienLamViec, engine
from app.main import app
from scripts import nap_du_lieu_mau


@pytest.fixture()
def may_khach():
    # CSDL sạch với dữ liệu mẫu cho mỗi bài test, admin là tài khoản cố định admin / 123
    Base.metadata.drop_all(engine)
    nap_du_lieu_mau.nap()
    with TestClient(app) as may:
        yield may


@pytest.fixture()
def tieu_de_admin(may_khach):
    # đăng nhập admin và trả về header xác thực
    kq = may_khach.post("/api/admin/dang-nhap", json={"ten_dang_nhap": "admin", "mat_khau": "123"})
    return {"Authorization": f"Bearer {kq.json()['token']}"}
