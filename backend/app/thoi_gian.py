from datetime import datetime, timedelta, timezone

MUI_GIO_VIET_NAM = timezone(timedelta(hours=7))


def gio_viet_nam() -> datetime:
    # giờ hiện tại theo múi giờ Việt Nam, bỏ thông tin múi giờ để lưu vào cột DATETIME
    return datetime.now(MUI_GIO_VIET_NAM).replace(tzinfo=None, microsecond=0)


def chuan_hoa_gio_khach(thoi_gian: datetime | None) -> datetime:
    # chuẩn hóa giờ do trình duyệt gửi lên (có thể gửi bù khi offline) về giờ Việt Nam
    # giờ không hợp lệ (rỗng, ở tương lai xa, quá cũ) được thay bằng giờ server
    bay_gio = gio_viet_nam()
    if thoi_gian is None:
        return bay_gio
    if thoi_gian.tzinfo is not None:
        thoi_gian = thoi_gian.astimezone(MUI_GIO_VIET_NAM).replace(tzinfo=None)
    if thoi_gian > bay_gio + timedelta(minutes=5) or thoi_gian < bay_gio - timedelta(days=90):
        return bay_gio
    return thoi_gian.replace(microsecond=0)
