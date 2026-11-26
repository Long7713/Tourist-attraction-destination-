import { useState } from 'react'
import { Lien, useDieuHuong } from '../dieu-huong'
import { DANH_SACH_NGON_NGU, useNgonNgu, type MaNgonNgu } from '../ngon-ngu'
import { Icon } from './Icon'
import { LinkButton, Logo } from './chung'

// chức năng thanh điều hướng, có ô đổi ngôn ngữ để khách đổi lại bất cứ lúc nào
export function Header() {
  const [open, setOpen] = useState(false)
  const { duongDan } = useDieuHuong()
  const { t, ma, datNgonNgu } = useNgonNgu()
  const links: [string, string][] = [['/', t('nav.home')], ['/explore', t('nav.explore')], ['/live-translation', t('nav.voice')], ['/about', t('nav.about')]]
  return <header className="header">
    <div className="container header-inner">
      <Logo />
      <nav className={`nav ${open ? 'nav-open' : ''}`}>
        {links.map(([to, nhan]) => <Lien key={to} className={duongDan === to ? 'active' : ''} to={to} onClick={() => setOpen(false)}>{nhan}</Lien>)}
        <label className="language-select"><Icon name="globe" size={17} />
          <select aria-label={t('lang.label')} value={ma} onChange={e => datNgonNgu(e.target.value as MaNgonNgu)}>
            {DANH_SACH_NGON_NGU.map(n => <option key={n.ma} value={n.ma}>{n.ten}</option>)}
          </select>
        </label>
      </nav>
      <button className="menu-btn" aria-label={t('nav.openMenu')} onClick={() => setOpen(!open)}><Icon name={open ? 'close' : 'menu'} /></button>
    </div>
  </header>
}

export function Footer() {
  const { t } = useNgonNgu()
  return <footer className="footer">
    <div className="container footer-grid">
      <div className="footer-brand"><Logo light /><p>{t('footer.tagline')}</p><div className="socials"><span>f</span><span>ig</span><span>yt</span><span>tt</span></div></div>
      <div><div className="footer-title">{t('footer.explore')}</div><Lien to="/">{t('nav.home')}</Lien><Lien to="/explore">{t('nav.explore')}</Lien><Lien to="/live-translation">{t('nav.voice')}</Lien><Lien to="/about">{t('nav.about')}</Lien></div>
      <div><div className="footer-title">{t('footer.contact')}</div><p>contact@busbuss.example</p><p>+84 900 000 000</p><p>Ho Chi Minh City, Vietnam</p></div>
      <div><div className="footer-title">{t('footer.ready')}</div><p>{t('footer.readyText')}</p><LinkButton to="/explore" variant="light" icon="arrow">{t('footer.cta')}</LinkButton></div>
    </div>
    <div className="container copyright"><span>{t('footer.rights')}</span><span>{t('footer.made')}</span></div>
  </footer>
}
