import { useEffect, type ReactNode } from 'react'

type MauNut = 'xanh' | 'cam' | 'do' | 'xam' | 'luc'

export function Nut({ mau = 'xanh', nho = false, children, ...rest }: { mau?: MauNut; nho?: boolean; children: ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...rest} className={`adm-nut adm-nut-${mau} ${nho ? 'adm-nut-nho' : ''} ${rest.className || ''}`}>{children}</button>
}

export function Nhan({ mau, children }: { mau: 'luc' | 'cam' | 'xanh' | 'xam' | 'do'; children: ReactNode }) {
  return <span className={`adm-nhan adm-nhan-${mau}`}>{children}</span>
}

// khung thẻ trắng có viền xanh phía trên, có thể kèm hàng tab như thiết kế mẫu
export function TheTrang({ tabs, tabHienTai, doiTab, children }: { tabs?: { ma: string; nhan: string }[]; tabHienTai?: string; doiTab?: (ma: string) => void; children: ReactNode }) {
  return <section className="adm-the">
    {tabs && <div className="adm-tabs">{tabs.map(t => <button key={t.ma} className={t.ma === tabHienTai ? 'dang-chon' : ''} onClick={() => doiTab?.(t.ma)}>{t.nhan}</button>)}</div>}
    <div className="adm-the-noi-dung">{children}</div>
  </section>
}

export function ThongBao({ loai, children }: { loai: 'loi' | 'ok' | 'canh-bao'; children: ReactNode }) {
  return <div className={`adm-thong-bao adm-thong-bao-${loai}`} role={loai === 'loi' ? 'alert' : 'status'}>{children}</div>
}

export function HopThoai({ tieuDe, dong, children }: { tieuDe: string; dong: () => void; children: ReactNode }) {
  useEffect(() => {
    const khiBamPhim = (e: KeyboardEvent) => e.key === 'Escape' && dong()
    window.addEventListener('keydown', khiBamPhim)
    return () => window.removeEventListener('keydown', khiBamPhim)
  }, [dong])
  return <div className="adm-nen-mo" onMouseDown={e => e.target === e.currentTarget && dong()}>
    <div className="adm-hop-thoai" role="dialog" aria-modal="true" aria-label={tieuDe}>
      <div className="adm-hop-thoai-dau"><h3>{tieuDe}</h3><button onClick={dong} aria-label="Đóng">×</button></div>
      {children}
    </div>
  </div>
}

export const dinhDangSo = (n: number) => n.toLocaleString('vi-VN')
export const dinhDangGio = (iso: string) => new Date(iso).toLocaleString('vi-VN', { hour12: false })
