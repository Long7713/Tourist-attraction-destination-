import { ANH_BIA, useDanhSachDiem, useGoi } from '../du-lieu'
import { Lien } from '../dieu-huong'
import { useNgonNgu } from '../ngon-ngu'
import { Icon, type IconName } from '../thanh-phan/Icon'
import { Button, LinkButton, SectionTitle } from '../thanh-phan/chung'

const ANH_PHU = {
  street: 'https://images.unsplash.com/photo-1714013582501-6c221164a2e8?auto=format&fit=crop&w=1000&q=85',
  market: 'https://images.unsplash.com/photo-1680783307371-749c26e0f5c3?auto=format&fit=crop&w=1000&q=85',
  post: 'https://images.unsplash.com/photo-1636945829629-fbf393fcc3c2?auto=format&fit=crop&w=1000&q=85',
}

export default function TrangChu() {
  const { t } = useNgonNgu()
  const { trangThai, taiLai } = useGoi()
  const diem = useDanhSachDiem()
  const dauTien = diem[0]
  const dichDen = diem[1] ?? dauTien

  return <main>
    <section className="hero">
      <img src={ANH_BIA} alt="" />
      <div className="hero-overlay" />
      <div className="container hero-content">
        <div className="hero-badge"><span className="live-dot" /> {t('hero.badge')}</div>
        <h1>{t('hero.title1')}<br /><em>{t('hero.title2')}</em></h1>
        <p>{t('hero.text')}</p>
        <div className="hero-actions"><LinkButton to="/explore" icon="arrow">{t('hero.btnMap')}</LinkButton><LinkButton to="/live-translation" variant="secondary"><Icon name="mic" size={18} /> {t('hero.btnVoice')}</LinkButton></div>
        <div className="hero-stats"><div><strong>{String(diem.length).padStart(2, '0')}</strong><span>{t('hero.statPlaces')}</span></div><div><strong>06</strong><span>{t('hero.statLangs')}</span></div><div><strong>24/7</strong><span>{t('hero.statCompanion')}</span></div></div>
      </div>
      {dauTien && <Lien to={`/landmark/${dauTien.slug}`} className="route-card"><span className="route-icon"><Icon name="route" /></span><div><small>{t('route.next')}</small><strong>{dauTien.ten}</strong><span>{t('route.count', { n: diem.length })}</span></div><span className="route-arrow"><Icon name="chevron" /></span></Lien>}
    </section>

    <section className="section intro-section"><div className="container intro-grid">
      <div><SectionTitle eyebrow={t('intro.eyebrow')} title={t('intro.title')} text={t('intro.sub')} /><p className="body-copy">{t('intro.body')}</p><LinkButton to="/explore" variant="dark" icon="arrow">{t('intro.btn')}</LinkButton></div>
      <div className="image-collage"><img className="collage-main" src={ANH_PHU.market} alt="" /><img className="collage-small" src={ANH_PHU.post} alt="" /><div className="city-tag"><Icon name="location" /><div><strong>Ho Chi Minh City</strong><span>10.8231° N, 106.6297° E</span></div></div></div>
    </div></section>

    <section className="section destinations"><div className="container">
      <div className="section-heading-row"><SectionTitle eyebrow={t('dest.eyebrow')} title={t('dest.title')} text={t('dest.text')} /><LinkButton to="/explore" variant="ghost" icon="arrow">{t('dest.all')}</LinkButton></div>
      {trangThai === 'loi' ? <div className="trang-thai-rong"><p>{t('common.loadError')}</p><Button onClick={taiLai}>{t('common.retry')}</Button></div>
        : trangThai === 'dang-tai' ? <p className="trang-thai-rong">{t('common.loading')}</p>
        : diem.length === 0 ? <p className="trang-thai-rong">{t('common.noPlaces')}</p>
        : <div className="destination-grid">{diem.slice(0, 3).map((d, i) => <article className="destination-card" key={d.slug}><div className="destination-image"><img src={d.anh} alt={d.ten} /><span>0{i + 1}</span></div><div className="destination-info"><div><small><Icon name="location" size={14} /> {t('dest.district')}</small><h3>{d.ten}</h3><p>{d.moTaNgan}</p></div><Lien className="circle-link" to={`/landmark/${d.slug}`} aria-label={t('dest.view', { name: d.ten })}><Icon name="arrow" /></Lien></div></article>)}</div>}
    </div></section>

    <section className="section smart-section"><div className="container">
      <SectionTitle eyebrow={t('smart.eyebrow')} title={t('smart.title')} text={t('smart.text')} align="center" />
      <div className="feature-layout"><div className="bus-visual"><img src={ANH_PHU.street} alt="" />{dichDen && <div className="bus-float"><Icon name="bus" /><div><small>BUS 01 · ON TOUR</small><strong>{t('bus.heading', { name: dichDen.ten })}</strong></div></div>}</div>
      <div className="feature-stack">{([
        ['compass', 'Smart GPS Tour', t('feature1.desc')],
        ['headphones', 'Audio Tour Guide', t('feature2.desc')],
        ['translate', 'Live Voice Translation', t('feature3.desc')],
      ] as [IconName, string, string][]).map(([icon, title, desc], i) => <div className="feature-card" key={title}><span className="feature-num">0{i + 1}</span><span className="feature-icon"><Icon name={icon} /></span><div><h3>{title}</h3><p>{desc}</p></div></div>)}</div></div>
    </div></section>

    <section className="section how-section"><div className="container"><SectionTitle eyebrow={t('how.eyebrow')} title={t('how.title')} align="center" />
      <div className="steps">{([
        ['globe', t('step1.title'), t('step1.desc')],
        ['location', t('step2.title'), t('step2.desc')],
        ['map', t('step3.title'), t('step3.desc')],
        ['translate', t('step4.title'), t('step4.desc')],
      ] as [IconName, string, string][]).map(([icon, title, desc], i) => <div className="step" key={i}><div className="step-top"><span>0{i + 1}</span><div><Icon name={icon} /></div></div><h3>{title}</h3><p>{desc}</p></div>)}</div>
    </div></section>
    <section className="cta-section"><div className="container cta-inner"><div><div className="eyebrow light">{t('cta.eyebrow')}</div><h2>{t('cta.title1')}<br />{t('cta.title2')}</h2></div><LinkButton to="/explore" variant="light" icon="arrow">{t('cta.btn')}</LinkButton></div></section>
  </main>
}

