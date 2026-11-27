import { createContext, useCallback, useContext, useEffect, useMemo, useState, type AnchorHTMLAttributes, type ReactNode } from 'react'

type NguCanh = { duongDan: string; tim: string; dieuHuong: (url: string) => void }
const Ctx = createContext<NguCanh | null>(null)

// chức năng chuyển trang không tải lại ứng dụng, giữ nguyên dữ liệu và trạng thái đã tải
export function DieuHuongProvider({ children }: { children: ReactNode }) {
  const [vi_tri, setViTri] = useState({ duongDan: window.location.pathname, tim: window.location.search })

  useEffect(() => {
    const khiLui = () => setViTri({ duongDan: window.location.pathname, tim: window.location.search })
    window.addEventListener('popstate', khiLui)
    return () => window.removeEventListener('popstate', khiLui)
  }, [])

  const dieuHuong = useCallback((url: string) => {
    window.history.pushState({}, '', url)
    const u = new URL(url, window.location.origin)
    setViTri({ duongDan: u.pathname, tim: u.search })
    window.scrollTo(0, 0)
  }, [])

  const gia_tri = useMemo(() => ({ ...vi_tri, dieuHuong }), [vi_tri, dieuHuong])
  return <Ctx.Provider value={gia_tri}>{children}</Ctx.Provider>
}

export function useDieuHuong() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useDieuHuong cần nằm trong DieuHuongProvider')
  return v
}

export function Lien({ to, onClick, ...rest }: { to: string } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  const { dieuHuong } = useDieuHuong()
  return <a {...rest} href={to} onClick={e => {
    onClick?.(e)
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    dieuHuong(to)
  }} />
}
