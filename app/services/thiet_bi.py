def nhan_dien_loai_thiet_bi(user_agent: str | None) -> str:
    # đoán loại thiết bị của khách từ chuỗi User-Agent của trình duyệt
    if not user_agent:
        return "khac"
    ua = user_agent.lower()
    if "ipad" in ua or "tablet" in ua or ("android" in ua and "mobile" not in ua):
        return "tablet"
    if "mobile" in ua or "iphone" in ua or "android" in ua:
        return "mobile"
    if any(h in ua for h in ("windows", "macintosh", "linux", "x11")):
        return "desktop"
    return "khac"
