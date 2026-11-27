// ghi nhận lượt truy cập và lịch sử nghe của khách, lưu hàng đợi trong máy để gửi bù khi có mạng trở lại

const KHOA_PHIEN = 'busbuss-phien'
const KHOA_LUOT = 'busbuss-luot'
const KHOA_HANG_DOI = 'busbuss-hang-doi'
const KHOA_DA_QUET_QR = 'busbuss-da-quet-qr'

type LuotTruyCap = { ma_su_kien: string; ma_phien: string; ma_ngon_ngu: string | null; thoi_gian: string }
type LuotNghe = { ma_su_kien: string; ma_su_kien_truy_cap: string; diem_slug: string; ma_ngon_ngu: string; thoi_gian: string }
type HangDoi = { truy_cap: LuotTruyCap[]; nghe: LuotNghe[] }

// trình duyệt không bảo mật (http trong mạng LAN) không có crypto.randomUUID nên cần phương án dự phòng
function taoUuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

function doc<T>(kho: Storage, khoa: string, macDinh: T): T {
  try { const v = kho.getItem(khoa); return v ? (JSON.parse(v) as T) : macDinh } catch { return macDinh }
}
function ghi(kho: Storage, khoa: string, v: unknown) {
  try { kho.setItem(khoa, JSON.stringify(v)) } catch { /* bộ nhớ đầy hoặc bị chặn, bỏ qua */ }
}

// mã ẩn danh của thiết bị, dùng để đếm số người, không chứa thông tin cá nhân
function maPhien(): string {
  let ma = ''
  try { ma = localStorage.getItem(KHOA_PHIEN) || '' } catch { /* bỏ qua */ }
  if (!ma) {
    ma = taoUuid()
    try { localStorage.setItem(KHOA_PHIEN, ma) } catch { /* bỏ qua */ }
  }
  return ma
}

const docHangDoi = () => doc<HangDoi>(localStorage, KHOA_HANG_DOI, { truy_cap: [], nghe: [] })
const ghiHangDoi = (h: HangDoi) => ghi(localStorage, KHOA_HANG_DOI, h)

// kiểm tra tab hiện tại đã quét mã QR hợp lệ hay chưa (gắn chặt với cả window.name và sessionStorage của riêng tab này)
export function daQuetQr(): boolean {
  try {
    return Boolean(
      window.name &&
      window.name.startsWith('busbuss-tab-') &&
      sessionStorage.getItem(KHOA_DA_QUET_QR) === window.name
    )
  } catch {
    return false
  }
}

// mở khóa duy nhất cho tab vừa quét mã QR, xóa lượt cũ để ghi nhận đúng một lượt truy cập mới
export function moKhoaTabSauKhiQuetQr(maNgonNgu: string | null) {
  const idTab = 'busbuss-tab-' + taoUuid()
  try {
    window.name = idTab
    sessionStorage.setItem(KHOA_DA_QUET_QR, idTab)
    sessionStorage.removeItem(KHOA_LUOT)
  } catch { /* bỏ qua */ }
  khoiDongLuotTruyCap(maNgonNgu)
}

// đọc mã QR dùng một lần từ thanh địa chỉ và xóa ngay ?qr=... khỏi URL/lịch sử để tab sau không tái sử dụng được
export function layMaQrTuUrl(): string | null {
  try {
    const thamSo = new URLSearchParams(window.location.search)
    const maQr = thamSo.get('qr')
    if (maQr) {
      thamSo.delete('qr')
      const con = thamSo.toString()
      window.history.replaceState(null, '', window.location.pathname + (con ? '?' + con : '') + window.location.hash)
    }
    return maQr
  } catch {
    return null
  }
}

// chức năng mở lượt truy cập mới, chỉ ghi nhận khi tab hiện tại đã quét mã QR hợp lệ
export function khoiDongLuotTruyCap(maNgonNgu: string | null) {
  if (!daQuetQr()) return
  if (doc<LuotTruyCap | null>(sessionStorage, KHOA_LUOT, null)) return
  const luot: LuotTruyCap = { ma_su_kien: taoUuid(), ma_phien: maPhien(), ma_ngon_ngu: maNgonNgu, thoi_gian: new Date().toISOString() }
  ghi(sessionStorage, KHOA_LUOT, luot)
  const h = docHangDoi()
  h.truy_cap.push(luot)
  ghiHangDoi(h)
  void dongBo()
}

// chức năng cập nhật ngôn ngữ khi khách chọn hoặc đổi ngôn ngữ giữa chừng
export function capNhatNgonNguLuot(maNgonNgu: string) {
  if (!daQuetQr()) return
  const luot = doc<LuotTruyCap | null>(sessionStorage, KHOA_LUOT, null)
  if (!luot) return khoiDongLuotTruyCap(maNgonNgu)
  if (luot.ma_ngon_ngu === maNgonNgu) return
  luot.ma_ngon_ngu = maNgonNgu
  ghi(sessionStorage, KHOA_LUOT, luot)
  const h = docHangDoi()
  // lượt này có thể còn trong hàng đợi chưa gửi, khi đó chỉ cần sửa tại chỗ
  const cho = h.truy_cap.find(l => l.ma_su_kien === luot.ma_su_kien)
  if (cho) cho.ma_ngon_ngu = maNgonNgu
  else h.truy_cap.push(luot)
  ghiHangDoi(h)
  void dongBo()
}

// chức năng ghi lại việc khách nghe thuyết minh một điểm
export function ghiLuotNghe(diemSlug: string, maNgonNgu: string) {
  const luot = doc<LuotTruyCap | null>(sessionStorage, KHOA_LUOT, null)
  if (!luot) return
  const h = docHangDoi()
  h.nghe.push({ ma_su_kien: taoUuid(), ma_su_kien_truy_cap: luot.ma_su_kien, diem_slug: diemSlug, ma_ngon_ngu: maNgonNgu, thoi_gian: new Date().toISOString() })
  ghiHangDoi(h)
  void dongBo()
}

let dangGui = false

// chức năng đồng bộ hàng đợi lên máy chủ, thất bại thì giữ lại để gửi ở lần sau
export async function dongBo() {
  if (dangGui || !navigator.onLine) return
  const h = docHangDoi()
  if (!h.truy_cap.length && !h.nghe.length) return
  dangGui = true
  try {
    const res = await fetch('/api/dong-bo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(h) })
    if (res.ok) {
      // chỉ xóa phần đã gửi, phần mới được thêm trong lúc gửi vẫn giữ lại
      const con = docHangDoi()
      ghiHangDoi({
        truy_cap: con.truy_cap.filter(x => !h.truy_cap.some(y => y.ma_su_kien === x.ma_su_kien && y.ma_ngon_ngu === x.ma_ngon_ngu)),
        nghe: con.nghe.filter(x => !h.nghe.some(y => y.ma_su_kien === x.ma_su_kien)),
      })
    }
  } catch { /* mất mạng giữa chừng, để lần sau */ }
  finally { dangGui = false }
}

window.addEventListener('online', () => void dongBo())
