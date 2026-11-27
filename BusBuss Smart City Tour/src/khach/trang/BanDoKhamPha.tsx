import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import BanDo from '../ban-do/BanDo'
import { useDieuHuong, Lien } from '../dieu-huong'
import { diemTrongVung, khoangCachM, useViTri, type ViTri } from '../dinh-vi'
import { useDanhSachDiem, useGoi, useTaiTruocAmThanh, type Diem } from '../du-lieu'
import { useNgonNgu } from '../ngon-ngu'
import { Icon } from '../thanh-phan/Icon'
import { Button } from '../thanh-phan/chung'
import { useThuyetMinh } from '../thuyet-minh'

type BoLoc = 'tat-ca' | 'gan' | 'dang-o-gan'
const KHOA_DA_NGHE = 'busbuss-da-nghe'
const BAN_DO_MAC_DINH = { ban_do_vi_do_nam: 10.74, ban_do_vi_do_bac: 10.81, ban_do_kinh_do_tay: 106.66, ban_do_kinh_do_dong: 106.73 }

const dinhDangKhoangCach = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`)

// chức năng bản đồ khám phá: bản đồ local, định vị GPS, tự phát thuyết minh khi bước vào vùng của một điểm
export default function BanDoKhamPha() {
  const { t } = useNgonNgu()
  const { tim } = useDieuHuong()
  const { goi, trangThai, taiLai } = useGoi()
  const diem = useDanhSachDiem()
  useTaiTruocAmThanh(diem)
  const { viTri, trangThai: gps, hienPopupCaiDat, dongPopupCaiDat, bat, datViTriGia, tatViTriGia } = useViTri()
  const { dangPhat, slugDangPhat, phat, dung } = useThuyetMinh()

  const [slugChon, setSlugChon] = useState<string | null>(() => new URLSearchParams(tim).get('landmark'))
  const [tuDong, setTuDong] = useState(false)
  const [hienThe, setHienThe] = useState(true)
  const [timKiem, setTimKiem] = useState('')
  const [boLoc, setBoLoc] = useState<BoLoc>('tat-ca')
  const [chedoGia, setChedoGia] = useState(false)
  const [tieuDiem, setTieuDiem] = useState<{ lat: number; lng: number; khoa: string } | null>(null)
  const daNghe = useRef<Set<string>>(new Set(JSON.parse(sessionStorage.getItem(KHOA_DA_NGHE) || '[]')))
  const daCoViTri = useRef(false)

  // đường dẫn dạng /explore?vitri=10.7726,106.6981 đặt sẵn vị trí giả, tiện để demo mà không cần đi tới thực địa
  useEffect(() => {
    const [lat, lng] = (new URLSearchParams(tim).get('vitri') || '').split(',').map(Number)
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat && lng) { setChedoGia(true); datViTriGia({ lat, lng }) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const chon = diem.find(d => d.slug === slugChon) ?? diem[0] ?? null
  const khungBanDo = goi?.ban_do ?? BAN_DO_MAC_DINH

  const dichChuyenToi = useCallback((d: Diem) => setTieuDiem({ lat: d.viDo, lng: d.kinhDo, khoa: `${d.slug}-${Date.now()}` }), [])

  // khi bắt đầu từ liên kết ?landmark= thì đưa bản đồ tới điểm đó
  useEffect(() => { if (slugChon && chon && !tieuDiem) dichChuyenToi(chon) }, [chon]) // eslint-disable-line react-hooks/exhaustive-deps

  // chức năng phân vùng: mỗi lần vị trí đổi, kiểm tra có đang trong vùng điểm nào chưa nghe thì tự phát
  useEffect(() => {
    if (!viTri) {
      daCoViTri.current = false
      return
    }
    if (!daCoViTri.current) {
      daCoViTri.current = true
      setTieuDiem({ lat: viTri.lat, lng: viTri.lng, khoa: `vitri-${Date.now()}` })
    }
    const trong = diemTrongVung(viTri, diem)
    if (trong && !daNghe.current.has(trong.slug)) {
      daNghe.current.add(trong.slug)
      sessionStorage.setItem(KHOA_DA_NGHE, JSON.stringify([...daNghe.current]))
      setSlugChon(trong.slug); setTuDong(true); setHienThe(true)
      dichChuyenToi(trong)
      void phat(trong)
    }
  // chạy lại cả khi danh sách điểm vừa tải xong, để khách đã đứng sẵn trong vùng vẫn được thuyết minh
  }, [viTri, diem]) // eslint-disable-line react-hooks/exhaustive-deps

  const chonDiem = (slug: string) => {
    setSlugChon(slug); setTuDong(false); setHienThe(true)
    const d = diem.find(x => x.slug === slug)
    if (d) dichChuyenToi(d)
  }

  const batTatViTriGia = () => {
    tatViTriGia(); daCoViTri.current = false
    setChedoGia(v => !v)
  }
  const khiChamBanDo = (v: ViTri) => datViTriGia(v)
  const khiDinhVi = () => {
    if (viTri && gps === 'active' && !chedoGia) {
      setTieuDiem({ lat: viTri.lat, lng: viTri.lng, khoa: `vitri-${Date.now()}` })
    } else {
      if (chedoGia) setChedoGia(false)
      daCoViTri.current = false
      bat()
    }
  }

  const khoangCach = useMemo(() => new Map(diem.map(d => [d.slug, viTri ? khoangCachM(viTri, { lat: d.viDo, lng: d.kinhDo }) : null])), [diem, viTri])
  const danhSach = useMemo(() => {
    let ds = diem.filter(d => d.ten.toLowerCase().includes(timKiem.trim().toLowerCase()))
    if (boLoc === 'dang-o-gan') ds = ds.filter(d => (khoangCach.get(d.slug) ?? Infinity) <= 500)
    if (boLoc === 'gan' || boLoc === 'dang-o-gan') ds = [...ds].sort((a, b) => (khoangCach.get(a.slug) ?? Infinity) - (khoangCach.get(b.slug) ?? Infinity))
    return ds
  }, [diem, timKiem, boLoc, khoangCach])

  const dangPhatDiemChon = dangPhat && chon && slugDangPhat === chon.slug
  const nhanGps = gps === 'active' ? (chedoGia ? t('gps.simulated') : t('gps.on')) : gps === 'loading' ? t('gps.loading') : t('gps.off')

  if (trangThai === 'dang-tai') return <main className="explore-page"><p className="trang-thai-rong">{t('common.loading')}</p></main>
  if (trangThai === 'loi' || !chon) return <main className="explore-page"><div className="trang-thai-rong"><p>{trangThai === 'loi' ? t('common.loadError') : t('common.noPlaces')}</p><Button onClick={taiLai}>{t('common.retry')}</Button></div></main>

  return <main className="explore-page">
    <div className="explore-toolbar">
      <div><div className="eyebrow">{t('explore.eyebrow')}</div><h1>{t('explore.title')}</h1></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Button variant={gps === 'active' && !chedoGia ? 'secondary' : 'primary'} icon="location" onClick={khiDinhVi} disabled={gps === 'loading'}>
          {gps === 'loading' ? t('gps.connecting') : 'Bật vị trí của bạn'}
        </Button>
        <div className={`gps-pill ${gps === 'error' ? 'error' : gps}`}><span className="live-dot" />{nhanGps}</div>
      </div>
    </div>
    <div className="map-layout">
      <aside className="landmark-sidebar">
        <div className="search-box"><Icon name="search" /><input value={timKiem} onChange={e => setTimKiem(e.target.value)} placeholder={t('search.placeholder')} /></div>
        <div className="filter-row">
          <button className={boLoc === 'tat-ca' ? 'active' : ''} onClick={() => setBoLoc('tat-ca')}>{t('filter.all')}</button>
          <button className={boLoc === 'gan' ? 'active' : ''} onClick={() => setBoLoc('gan')}>{t('filter.near')}</button>
          <button className={boLoc === 'dang-o-gan' ? 'active' : ''} onClick={() => setBoLoc('dang-o-gan')}>{t('filter.here')}</button>
        </div>
        <button className={`che-do-gia ${chedoGia ? 'bat' : ''}`} onClick={batTatViTriGia}><Icon name="location" size={15} /> {t('sim.toggle')}</button>
        <div className="landmark-list">{danhSach.map((d, i) => {
          const k = khoangCach.get(d.slug)
          return <button key={d.slug} className={`landmark-item ${chon.slug === d.slug ? 'active' : ''}`} onClick={() => chonDiem(d.slug)}>
            <img src={d.anh} alt="" /><span><strong>{d.ten}</strong><small>{k != null ? t('dist.fromYou', { d: dinhDangKhoangCach(k) }) : t('stop.n', { n: String(i + 1).padStart(2, '0') })}</small></span><Icon name="chevron" size={18} />
          </button>
        })}</div>
      </aside>
      <section className="map-demo map-local">
        <BanDo diem={diem} chon={chon.slug} khung={{ viDoNam: khungBanDo.ban_do_vi_do_nam, viDoBac: khungBanDo.ban_do_vi_do_bac, kinhDoTay: khungBanDo.ban_do_kinh_do_tay, kinhDoDong: khungBanDo.ban_do_kinh_do_dong }}
          viTri={viTri} doChinhXac={chedoGia ? undefined : viTri?.doChinhXac} chedoGia={chedoGia} tieuDiem={tieuDiem}
          khiChonDiem={chonDiem} khiChamBanDo={khiChamBanDo} khiDinhVi={khiDinhVi} />

        {gps !== 'active' && !chedoGia && <div className="gps-card"><span><Icon name="location" /></span><div><strong>{gps === 'error' ? t('gps.errTitle') : t('gps.cardTitle')}</strong><p>{gps === 'error' ? t('gps.errText') : t('gps.cardText')}</p><Button onClick={bat} disabled={gps === 'loading'}>{gps === 'loading' ? t('gps.connecting') : 'Bật vị trí của bạn'}</Button></div></div>}

        {hienThe && <div className="narration-card"><img src={chon.anh} alt={chon.ten} /><div className="narration-body"><div className="nearby-badge"><span /> {tuDong ? t('narration.autoBadge') : t('narration.badge')}</div><button className="narration-close" aria-label={t('narration.close')} onClick={() => setHienThe(false)}><Icon name="close" size={18} /></button><h2>{chon.ten}</h2><p>{chon.moTaNgan}</p>
          <div className="audio-row"><button className="play-btn" aria-label={dangPhatDiemChon ? t('detail.pause') : t('detail.play')} onClick={dangPhatDiemChon ? dung : () => void phat(chon)}><Icon name={dangPhatDiemChon ? 'pause' : 'play'} /></button><div className="audio-info"><strong>{dangPhatDiemChon ? t('narration.playing') : t('narration.auto')}</strong><div className={`wave ${dangPhatDiemChon ? 'animated' : ''}`}>{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => <i key={i} />)}</div></div><Lien to={`/landmark/${chon.slug}`}>{t('narration.detail')} <Icon name="arrow" size={16} /></Lien></div></div></div>}
      </section>
    </div>

    {hienPopupCaiDat && (
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: 'rgba(11, 25, 44, 0.55)',
          display: 'grid',
          placeItems: 'center',
          padding: 20,
        }}
      >
        <div
          style={{
            background: '#ffffff',
            borderRadius: 20,
            padding: '28px 24px',
            maxWidth: 420,
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 20px 50px rgba(11, 25, 44, 0.25)',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: '#fff3e6',
              color: '#ff6b00',
              display: 'inline-grid',
              placeItems: 'center',
              marginBottom: 16,
            }}
          >
            <Icon name="location" size={28} />
          </div>
          <p style={{ fontSize: 18, fontWeight: 700, color: '#0b192c', lineHeight: 1.45, margin: '0 0 20px' }}>
            Bạn vui lòng hãy vào cài đặt và bật chia sẻ vị trí của tôi
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button variant="primary" onClick={bat}>Thử lại ngay</Button>
            <Button variant="secondary" onClick={dongPopupCaiDat}>Đóng</Button>
          </div>
        </div>
      </div>
    )}
  </main>
}
