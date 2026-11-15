import math

BAN_KINH_TRAI_DAT_M = 6_371_000


def khoang_cach_m(vi_do_1: float, kinh_do_1: float, vi_do_2: float, kinh_do_2: float) -> float:
    # khoảng cách giữa hai tọa độ theo công thức haversine, đơn vị mét
    p1, p2 = math.radians(vi_do_1), math.radians(vi_do_2)
    dp = p2 - p1
    dl = math.radians(kinh_do_2 - kinh_do_1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * BAN_KINH_TRAI_DAT_M * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def diem_gan_nhat_trong_vung(vi_do: float, kinh_do: float, danh_sach_diem):
    # tìm điểm mà vị trí khách đang nằm trong vùng bán kính
    # nếu nằm trong nhiều vùng chồng nhau thì chọn điểm có tâm gần nhất
    tot_nhat, khoang_cach_tot_nhat = None, None
    for diem in danh_sach_diem:
        d = khoang_cach_m(vi_do, kinh_do, diem.vi_do, diem.kinh_do)
        if d <= diem.ban_kinh_m and (khoang_cach_tot_nhat is None or d < khoang_cach_tot_nhat):
            tot_nhat, khoang_cach_tot_nhat = diem, d
    return tot_nhat, khoang_cach_tot_nhat


def cac_cap_chong_vung(danh_sach_diem) -> list[dict]:
    # liệt kê các cặp điểm có vùng bán kính đè lên nhau để admin điều chỉnh
    ket_qua = []
    for i, a in enumerate(danh_sach_diem):
        for b in danh_sach_diem[i + 1:]:
            d = khoang_cach_m(a.vi_do, a.kinh_do, b.vi_do, b.kinh_do)
            if d < a.ban_kinh_m + b.ban_kinh_m:
                ket_qua.append({
                    "diem_a": a.ten_diem, "diem_b": b.ten_diem,
                    "khoang_cach_m": round(d), "tong_ban_kinh_m": a.ban_kinh_m + b.ban_kinh_m,
                })
    return ket_qua
