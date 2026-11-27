const KHOA_TOKEN = 'busbuss-admin-token'
const KHOA_TEN = 'busbuss-admin-ten'

export const layToken = () => localStorage.getItem(KHOA_TOKEN)
export const layTenAdmin = () => localStorage.getItem(KHOA_TEN) || 'Quản trị'
export function luuPhien(token: string, hoTen: string) {
  localStorage.setItem(KHOA_TOKEN, token)
  localStorage.setItem(KHOA_TEN, hoTen)
}
export function xoaPhien() {
  localStorage.removeItem(KHOA_TOKEN)
  localStorage.removeItem(KHOA_TEN)
}

export class LoiApi extends Error {
  constructor(public trangThai: number, message: string) {
    super(message)
  }
}

// đọc thông báo lỗi từ backend, lỗi kiểm tra dữ liệu của FastAPI là một danh sách
async function docThongBaoLoi(res: Response): Promise<string> {
  try {
    const j = await res.json()
    if (typeof j.detail === 'string') return j.detail
    if (Array.isArray(j.detail)) return j.detail.map((l: { loc: string[]; msg: string }) => `${l.loc.at(-1)}: ${l.msg}`).join('; ')
  } catch { /* không có nội dung JSON */ }
  return res.statusText || 'Có lỗi xảy ra'
}

// chức năng gọi API admin, tự gắn token và báo hết phiên khi bị từ chối
export async function goiApi<T>(duongDan: string, tuyChon: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = layToken()
  const res = await fetch(duongDan, {
    method: tuyChon.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: tuyChon.body !== undefined ? JSON.stringify(tuyChon.body) : undefined,
  })
  if (res.status === 401 && !duongDan.endsWith('/dang-nhap')) {
    xoaPhien()
    window.dispatchEvent(new Event('admin-het-phien'))
  }
  if (!res.ok) throw new LoiApi(res.status, await docThongBaoLoi(res))
  return res.status === 204 ? (undefined as T) : res.json()
}

// chức năng tải file (CSV) có kèm token xác thực
export async function taiFile(duongDan: string, tenFile: string) {
  const res = await fetch(duongDan, { headers: { Authorization: `Bearer ${layToken()}` } })
  if (!res.ok) throw new LoiApi(res.status, await docThongBaoLoi(res))
  const url = URL.createObjectURL(await res.blob())
  const a = document.createElement('a')
  a.href = url
  a.download = tenFile
  a.click()
  URL.revokeObjectURL(url)
}

export type Dashboard = {
  thang: string; tong_luot: number; tong_nguoi: number; hom_nay: number
  luot_trong_thang: number; nguoi_trong_thang: number
  theo_ngay: { ngay: number; luot: number }[]
  gio_cao_diem: { gio: number; luot: number } | null
  ngay_cao_diem: { ngay: number; luot: number } | null
  theo_gio: { gio: number; luot: number }[]
  ban_do_nhiet: number[][]
  ty_le_ngon_ngu: Record<string, number>
  ty_le_thiet_bi: Record<string, number>
  diem_nghe_nhieu_nhat: { ten_diem: string; so_lan: number }[]
}

export type LuotTruyCap = { id: number; ma_phien: string; ma_ngon_ngu: string | null; thoi_gian_truy_cap: string; loai_thiet_bi: string }

export type Diem = {
  id: number; slug: string; ten_diem: string; vi_do: number; kinh_do: number
  ban_kinh_m: number; hinh_anh: string | null; thu_tu: number; dang_dung: boolean
}
export type CapChongVung = { diem_a: string; diem_b: string; khoang_cach_m: number; tong_ban_kinh_m: number }

export type NoiDungNgonNgu = {
  ma_ngon_ngu: string; ten: string; thieu: boolean
  tieu_de: string | null; mo_ta_ngan: string | null; noi_dung: string | null
  trang_thai: 'nhap' | 'da_dang' | null; co_am_thanh: boolean; am_thanh_cu: boolean
}

export const TEN_NGON_NGU: Record<string, string> = {
  vi: 'Tiếng Việt', en: 'Tiếng Anh', es: 'Tiếng Tây Ban Nha', ko: 'Tiếng Hàn', zh: 'Tiếng Trung', ru: 'Tiếng Nga', khong_ro: 'Không rõ', ja: 'Tiếng Nhật'
}
export const TEN_THIET_BI: Record<string, string> = { mobile: 'Điện thoại', tablet: 'Máy tính bảng', desktop: 'Máy tính', khac: 'Khác' }
