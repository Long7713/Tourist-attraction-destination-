import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { capNhatNgonNguLuot, khoiDongLuotTruyCap } from '../theo-doi'
import { en } from './en'
import { es } from './es'
import { ko } from './ko'
import { ru } from './ru'
import { vi, type KhoaDich, type TuDien } from './vi'
import { zh } from './zh'

export type MaNgonNgu = 'vi' | 'en' | 'es' | 'ko' | 'zh' | 'ru'

// danh sách 6 ngôn ngữ cố định, ten là tên viết bằng chính ngôn ngữ đó, giongDoc dùng cho trình đọc của trình duyệt
export const DANH_SACH_NGON_NGU: { ma: MaNgonNgu; ten: string; giongDoc: string }[] = [
  { ma: 'vi', ten: 'Tiếng Việt', giongDoc: 'vi-VN' },
  { ma: 'en', ten: 'English', giongDoc: 'en-US' },
  { ma: 'es', ten: 'Español', giongDoc: 'es-ES' },
  { ma: 'ko', ten: '한국어', giongDoc: 'ko-KR' },
  { ma: 'zh', ten: '中文', giongDoc: 'zh-CN' },
  { ma: 'ru', ten: 'Русский', giongDoc: 'ru-RU' },
]

const TU_DIEN: Record<MaNgonNgu, TuDien> = { vi: vi as TuDien, en, es, ko, zh, ru }
const KHOA_LUU = 'busbuss-language'

const laMaHopLe = (v: string | null): v is MaNgonNgu => !!v && v in TU_DIEN

function docNgonNguDaLuu(): MaNgonNgu | null {
  try {
    const v = localStorage.getItem(KHOA_LUU)
    return laMaHopLe(v) ? v : null
  } catch { return null }
}

// đoán ngôn ngữ theo trình duyệt để gợi ý sẵn ở màn hình chọn ngôn ngữ
export function doanNgonNguTrinhDuyet(): MaNgonNgu {
  const ma = (navigator.language || 'vi').slice(0, 2).toLowerCase()
  return laMaHopLe(ma) ? ma : 'en'
}

type NguCanh = {
  ma: MaNgonNgu
  daChon: boolean
  datNgonNgu: (ma: MaNgonNgu) => void
  t: (khoa: KhoaDich, thamSo?: Record<string, string | number>) => string
  giongDoc: string
  tenNgonNgu: (ma: string) => string
}

const Ctx = createContext<NguCanh | null>(null)

// chức năng ngôn ngữ giao diện: mọi chữ trên giao diện khách đều lấy qua t()
export function NgonNguProvider({ children }: { children: ReactNode }) {
  const daLuu = docNgonNguDaLuu()
  const [ma, setMa] = useState<MaNgonNgu>(daLuu ?? doanNgonNguTrinhDuyet())
  const [daChon, setDaChon] = useState(!!daLuu)

  useEffect(() => {
    document.documentElement.lang = ma
    khoiDongLuotTruyCap(daLuu)
  // chỉ chạy một lần khi mở ứng dụng
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { document.documentElement.lang = ma }, [ma])

  const datNgonNgu = useCallback((moi: MaNgonNgu) => {
    setMa(moi); setDaChon(true)
    try { localStorage.setItem(KHOA_LUU, moi) } catch { /* bỏ qua */ }
    capNhatNgonNguLuot(moi)
  }, [])

  const gia_tri = useMemo<NguCanh>(() => ({
    ma, daChon, datNgonNgu,
    t: (khoa, thamSo) => {
      const goc = TU_DIEN[ma][khoa] ?? vi[khoa]
      return thamSo ? goc.replace(/\{(\w+)\}/g, (_, k) => String(thamSo[k] ?? '')) : goc
    },
    giongDoc: DANH_SACH_NGON_NGU.find(n => n.ma === ma)!.giongDoc,
    tenNgonNgu: m => DANH_SACH_NGON_NGU.find(n => n.ma === m)?.ten ?? m,
  }), [ma, daChon, datNgonNgu])

  return <Ctx.Provider value={gia_tri}>{children}</Ctx.Provider>
}

export function useNgonNgu() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useNgonNgu cần nằm trong NgonNguProvider')
  return v
}
