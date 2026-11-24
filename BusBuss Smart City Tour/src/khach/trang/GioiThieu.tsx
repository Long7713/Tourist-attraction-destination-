import { useNgonNgu } from '../ngon-ngu'
import { Icon, type IconName } from '../thanh-phan/Icon'
import { LinkButton, SectionTitle } from '../thanh-phan/chung'

const ANH = {
  skyline: 'https://images.unsplash.com/photo-1582217123195-3dcafc35a755?auto=format&fit=crop&w=1200&q=85',
  city: 'https://images.unsplash.com/photo-1578768124932-e0cc82f7a37e?auto=format&fit=crop&w=1200&q=85',
}

export default function GioiThieu() {
  const { t } = useNgonNgu()
  return <main><section className="about-hero"><img src={ANH.skyline} alt="" /><div className="about-overlay" /><div className="container"><div className="eyebrow light">{t('about.eyebrow')}</div><h1>{t('about.title1')}<br />{t('about.title2')}</h1><p>{t('about.text')}</p><div><LinkButton to="/explore" icon="arrow">{t('about.btnStart')}</LinkButton><LinkButton to="/live-translation" variant="secondary"><Icon name="mic" /> {t('about.btnVoice')}</LinkButton></div></div></section>
    <section className="section about-story"><div className="container about-grid"><div><SectionTitle eyebrow={t('story.eyebrow')} title={t('story.title')} /><p className="body-copy">{t('story.p1')}</p><p className="body-copy">{t('story.p2')}</p></div><div className="about-image"><img src={ANH.city} alt="" /><span><strong>01</strong><small>{t('story.tag').split('\n').map((dong, i) => <span key={i} style={{ display: 'block' }}>{dong}</span>)}</small></span></div></div></section>
    <section className="section values"><div className="container"><SectionTitle eyebrow={t('values.eyebrow')} title={t('values.title')} align="center" /><div className="value-grid">{([
      ['compass', 'Our Mission', t('value1.desc')],
      ['spark', 'Smart Tourism', t('value2.desc')],
      ['translate', 'Breaking Barriers', t('value3.desc')],
    ] as [IconName, string, string][]).map(([icon, title, desc], i) => <div className="value-card" key={title}><span>0{i + 1}</span><div><Icon name={icon} /></div><h3>{title}</h3><p>{desc}</p></div>)}</div></div></section>
    <section className="about-cta"><div className="container"><span className="logo-mark large"><Icon name="bus" size={34} /></span><div><div className="eyebrow light">{t('aboutCta.eyebrow')}</div><h2>{t('aboutCta.title')}</h2></div><LinkButton to="/explore" variant="light" icon="arrow">{t('aboutCta.btn')}</LinkButton></div></section>
  </main>
}
