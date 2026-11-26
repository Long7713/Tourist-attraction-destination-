import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNgonNgu } from '../ngon-ngu'

export type NoiDungGoi = { tieu_de: string; mo_ta_ngan: string | null; noi_dung: string; am_thanh: string | null }
export type DiemGoi = { slug: string; vi_do: number; kinh_do: number; ban_kinh_m: number; hinh_anh: string | null; noi_dung: Record<string, NoiDungGoi> }
export type GoiOffline = {
  phien_ban: number
  ban_do: { ban_do_vi_do_nam: number; ban_do_vi_do_bac: number; ban_do_kinh_do_tay: number; ban_do_kinh_do_dong: number; ban_kinh_mac_dinh_m?: number }
  diem: DiemGoi[]
}

// điểm đã chọn đúng ngôn ngữ của khách, thiếu bản dịch thì dùng tiếng Việt
export type Diem = {
  slug: string; ten: string; moTaNgan: string; noiDung: string; amThanh: string | null
  viDo: number; kinhDo: number; banKinh: number; anh: string; ngonNguHienThi: string
}

const KHOA_BO_NHO = 'busbuss-goi-offline'

// ảnh dự phòng khi admin chưa nhập ảnh cho điểm
const ANH_DU_PHONG: Record<string, string> = {
  'ben-thanh': 'https://images.unsplash.com/photo-1680783307371-749c26e0f5c3?auto=format&fit=crop&w=1000&q=85',
  'independence-palace': 'https://images.unsplash.com/photo-1714013582501-6c221164a2e8?auto=format&fit=crop&w=1000&q=85',
  'notre-dame': 'https://images.unsplash.com/photo-1586004551686-d9c4fab26471?auto=format&fit=crop&w=1000&q=85',
  'central-post': 'https://images.unsplash.com/photo-1636945829629-fbf393fcc3c2?auto=format&fit=crop&w=1000&q=85',
  'opera-house': 'https://images.unsplash.com/photo-1578768124932-e0cc82f7a37e?auto=format&fit=crop&w=1200&q=85',
  'nguyen-hue': 'https://images.unsplash.com/photo-1582217123195-3dcafc35a755?auto=format&fit=crop&w=1200&q=85',
}
export const ANH_MAC_DINH = 'https://images.unsplash.com/photo-1582217123195-3dcafc35a755?auto=format&fit=crop&w=1200&q=85'
export const ANH_BIA = 'https://images.unsplash.com/photo-1521019795854-14e15f600980?auto=format&fit=crop&w=1800&q=88'

type NguCanh = { goi: GoiOffline | null; trangThai: 'dang-tai' | 'ok' | 'loi'; taiLai: () => void }
const Ctx = createContext<NguCanh | null>(null)

function docBoNho(): GoiOffline | null {
  try { const v = localStorage.getItem(KHOA_BO_NHO); return v ? (JSON.parse(v) as GoiOffline) : null } catch { return null }
}

// chức năng tải gói dữ liệu thuyết minh: ưu tiên bản mới từ máy chủ, mất mạng thì dùng bản đã lưu trong máy
export function DuLieuProvider({ children }: { children: ReactNode }) {
  const [goi, setGoi] = useState<GoiOffline | null>(docBoNho)
  const [trangThai, setTrangThai] = useState<NguCanh['trangThai']>(goi ? 'ok' : 'dang-tai')

  const tai = useCallback(async () => {
    try {
      const res = await fetch('/api/goi-offline')
      if (!res.ok) throw new Error(String(res.status))
      const moi = (await res.json()) as GoiOffline
      setGoi(moi); setTrangThai('ok')
      try { localStorage.setItem(KHOA_BO_NHO, JSON.stringify(moi)) } catch { /* bộ nhớ đầy */ }
    } catch {
      // không tải được: nếu đã có bản lưu trong máy thì vẫn dùng bình thường
      setTrangThai(t => (docBoNho() ? 'ok' : t === 'dang-tai' ? 'loi' : t))
    }
  }, [])

  useEffect(() => {
    void tai()
    window.addEventListener('online', tai)
    return () => window.removeEventListener('online', tai)
  }, [tai])

  const gia_tri = useMemo(() => ({ goi, trangThai, taiLai: () => { setTrangThai(goi ? 'ok' : 'dang-tai'); void tai() } }), [goi, trangThai, tai])
  return <Ctx.Provider value={gia_tri}>{children}</Ctx.Provider>
}

export function useGoi() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useGoi cần nằm trong DuLieuProvider')
  return v
}

// danh sách điểm theo ngôn ngữ đang chọn
export function useDanhSachDiem(): Diem[] {
  const { goi } = useGoi()
  const { ma } = useNgonNgu()
  return useMemo(() => (goi?.diem ?? []).flatMap(d => {
    const nd = d.noi_dung[ma] ?? d.noi_dung.vi
    if (!nd) return []
    return [{
      slug: d.slug, ten: nd.tieu_de, moTaNgan: nd.mo_ta_ngan ?? '', noiDung: nd.noi_dung,
      // gắn số phiên bản vào địa chỉ audio để khi admin tạo lại audio thì bản cũ trong bộ nhớ đệm không bị dùng nhầm
      amThanh: nd.am_thanh ? `${nd.am_thanh}?v=${goi!.phien_ban}` : null,
      viDo: d.vi_do, kinhDo: d.kinh_do, banKinh: d.ban_kinh_m,
      anh: d.hinh_anh || ANH_DU_PHONG[d.slug] || ANH_MAC_DINH,
      ngonNguHienThi: d.noi_dung[ma] ? ma : 'vi',
    }]
  }), [goi, ma])
}

// tải trước file audio của ngôn ngữ đang chọn khi còn mạng, service worker sẽ lưu lại để nghe offline
export function useTaiTruocAmThanh(danhSach: Diem[]) {
  useEffect(() => {
    if (!navigator.onLine) return
    danhSach.forEach(d => { if (d.amThanh) fetch(d.amThanh).catch(() => undefined) })
  }, [danhSach])
}
