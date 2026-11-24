import { Lien } from '../dieu-huong'
import { useDanhSachDiem, useGoi, useTaiTruocAmThanh } from '../du-lieu'
import { useNgonNgu } from '../ngon-ngu'
import { Icon } from '../thanh-phan/Icon'
import { Button, LinkButton } from '../thanh-phan/chung'
import { useThuyetMinh } from '../thuyet-minh'

// chức năng chi tiết địa điểm: hiển thị nội dung theo ngôn ngữ đã chọn và phát thuyết minh
export default function ChiTietDiem({ slug }: { slug: string }) {
  const { t, tenNgonNgu, ma } = useNgonNgu()
  const { trangThai, taiLai } = useGoi()
  const diem = useDanhSachDiem()
  useTaiTruocAmThanh(diem)
  const { dangPhat, slugDangPhat, phat, dung } = useThuyetMinh()
  const muc = diem.find(d => d.slug === slug)

  if (trangThai === 'dang-tai') return <main className="detail-page"><p className="trang-thai-rong">{t('common.loading')}</p></main>
  if (!muc) return <main className="detail-page"><div className="trang-thai-rong"><p>{trangThai === 'loi' ? t('common.loadError') : t('detail.notFound')}</p>{trangThai === 'loi' ? <Button onClick={taiLai}>{t('common.retry')}</Button> : <LinkButton to="/explore" icon="map">{t('detail.viewMap')}</LinkButton>}</div></main>

  const dangPhatMuc = dangPhat && slugDangPhat === muc.slug
  const doanVan = muc.noiDung.split(/\n+/).filter(Boolean)

  return <main className="detail-page"><section className="detail-hero"><img src={muc.anh} alt={muc.ten} /><div className="detail-overlay" /><div className="container detail-title"><Lien to="/explore">{t('detail.back')}</Lien><div className="eyebrow light">{t('detail.eyebrow')}</div><h1>{muc.ten}</h1><p><Icon name="location" /> {t('detail.where')}</p></div></section>
    <section className="section"><div className="container detail-layout"><article className="detail-copy"><div className="eyebrow">{t('detail.story')}</div><h2>{muc.moTaNgan || muc.ten}</h2>
      {muc.ngonNguHienThi !== ma && <p className="ghi-chu-ngon-ngu">{t('detail.fallbackNote')}</p>}
      {doanVan.map((p, i) => <p key={i}>{p}</p>)}</article>
      <aside className="audio-player"><div className="audio-cover"><img src={muc.anh} alt="" /><span><Icon name="headphones" /></span></div><div className="eyebrow">{t('detail.audioTag', { lang: tenNgonNgu(muc.ngonNguHienThi).toUpperCase() })}</div><h3>{t('detail.audioTitle', { name: muc.ten })}</h3><div className={`big-wave ${dangPhatMuc ? 'animated' : ''}`}>{Array.from({ length: 30 }, (_, i) => <i key={i} />)}</div><Button onClick={dangPhatMuc ? dung : () => void phat(muc)} icon={dangPhatMuc ? 'pause' : 'play'}>{dangPhatMuc ? t('detail.pause') : t('detail.play')}</Button><LinkButton to={`/explore?landmark=${muc.slug}`} variant="ghost" icon="map">{t('detail.viewMap')}</LinkButton></aside>
    </div></section></main>
}
