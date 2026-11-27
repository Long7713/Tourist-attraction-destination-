import { useEffect, useState, type ReactNode } from 'react'
import { Lien } from '../dieu-huong'
import { DANH_SACH_NGON_NGU, useNgonNgu, type MaNgonNgu } from '../ngon-ngu'
import { Icon, type IconName } from './Icon'

type KieuNut = 'primary' | 'secondary' | 'ghost' | 'light' | 'dark'

export function Button({ children, onClick, variant = 'primary', icon, disabled, className = '' }: { children: ReactNode; onClick?: () => void; variant?: KieuNut; icon?: IconName; disabled?: boolean; className?: string }) {
  return <button className={`btn btn-${variant} ${className}`} onClick={onClick} disabled={disabled}>{children}{icon && <Icon name={icon} size={18} />}</button>
}

export function LinkButton({ to, children, variant = 'primary', icon, className = '' }: { to: string; children: ReactNode; variant?: KieuNut; icon?: IconName; className?: string }) {
  return <Lien className={`btn btn-${variant} ${className}`} to={to}>{children}{icon && <Icon name={icon} size={18} />}</Lien>
}

export function Logo({ light = false }: { light?: boolean }) {
  return <Lien to="/" className={`logo ${light ? 'logo-light' : ''}`}><span className="logo-mark"><Icon name="bus" size={24} /></span><span>Bus<span>Buss</span></span></Lien>
}

export function SectionTitle({ eyebrow, title, text, align = 'left' }: { eyebrow?: string; title: string; text?: string; align?: 'left' | 'center' }) {
  return <div className={`section-title ${align === 'center' ? 'center' : ''}`}>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h2>{title}</h2>{text && <p>{text}</p>}</div>
}

// chức năng báo khi mất mạng: bản đồ, GPS và thuyết minh vẫn dùng được
export function BangOffline() {
  const { t } = useNgonNgu()
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const bat = () => setOnline(true), tat = () => setOnline(false)
    window.addEventListener('online', bat); window.addEventListener('offline', tat)
    return () => { window.removeEventListener('online', bat); window.removeEventListener('offline', tat) }
  }, [])
  return online ? null : <div className="bang-offline" role="status">{t('offline.banner')}</div>
}

// chức năng chọn ngôn ngữ ở lần đầu vào ứng dụng, sau đó mọi nội dung dùng ngôn ngữ này
export function ChonNgonNgu() {
  const { t, ma, datNgonNgu } = useNgonNgu()
  return <div className="chon-ngon-ngu">
    <div className="chon-ngon-ngu-hop">
      <span className="logo-mark large"><Icon name="globe" size={34} /></span>
      <h1>{t('lang.chooseTitle')}</h1>
      <p>{t('lang.chooseText')}</p>
      <div className="chon-ngon-ngu-luoi">
        {DANH_SACH_NGON_NGU.map(n => <button key={n.ma} lang={n.ma} className={n.ma === ma ? 'goi-y' : ''} onClick={() => datNgonNgu(n.ma as MaNgonNgu)}>
          <strong>{n.ten}</strong><small>{n.ma.toUpperCase()}</small>
        </button>)}
      </div>
    </div>
  </div>
}
