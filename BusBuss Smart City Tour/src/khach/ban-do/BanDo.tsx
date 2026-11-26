import { useCallback, useEffect, useRef, useState } from 'react'
import type { ViTri } from '../dinh-vi'
import { useNgonNgu } from '../ngon-ngu'
import { Icon } from '../thanh-phan/Icon'
import { dangKyDuLieuNen, kinhDoTuX, mercX, mercY, viDoTuY, type DuLieuNen, type HinhHoc } from './duLieuNen'

export type DiemBanDo = { slug: string; ten: string; viDo: number; kinhDo: number; banKinh: number }
type KhungBanDo = { viDoNam: number; viDoBac: number; kinhDoTay: number; kinhDoDong: number }
type Vu = { cx: number; cy: number; z: number }

const KICH_THUOC_O = 256
const Z_TOI_DA = 19
const MET_QUANH_TRAI_DAT = 40075016.686

// chức năng bản đồ local: vẽ GeoJSON bằng canvas, hỗ trợ kéo, chụm hai ngón và cuộn để phóng to
export default function BanDo({
  diem, chon, khung, viTri, doChinhXac, chedoGia, tieuDiem, khiChonDiem, khiChamBanDo, khiDinhVi,
}: {
  diem: DiemBanDo[]
  chon: string | null
  khung: KhungBanDo
  viTri: ViTri | null
  doChinhXac?: number
  chedoGia: boolean
  tieuDiem: { lat: number; lng: number; khoa: string } | null
  khiChonDiem: (slug: string) => void
  khiChamBanDo: (v: ViTri) => void
  khiDinhVi: () => void
}) {
  const { t } = useNgonNgu()
  const goc = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [kichThuoc, setKichThuoc] = useState({ w: 0, h: 0 })
  const [nen, setNen] = useState<DuLieuNen | null>(null)
  // ban đầu nhìn vào giữa các điểm thuyết minh, không phải giữa khung giới hạn vì khung có thể rộng và lệch so với nơi có điểm
  const [vu, setVu] = useState<Vu>(() => {
    const viDo = diem.length ? diem.reduce((t, d) => t + d.viDo, 0) / diem.length : (khung.viDoNam + khung.viDoBac) / 2
    const kinhDo = diem.length ? diem.reduce((t, d) => t + d.kinhDo, 0) / diem.length : (khung.kinhDoTay + khung.kinhDoDong) / 2
    return { cx: mercX(kinhDo), cy: mercY(viDo), z: 15 }
  })

  const kichThuocRef = useRef(kichThuoc)
  kichThuocRef.current = kichThuoc
  // giới hạn là phần giao giữa khung do máy chủ gửi về và khung dữ liệu thật, để không thu nhỏ ra vùng trống chưa có bản đồ
  const gioiHanMayChu = {
    minX: mercX(khung.kinhDoTay), maxX: mercX(khung.kinhDoDong), minY: mercY(khung.viDoBac), maxY: mercY(khung.viDoNam),
  }
  const kd = nen?.khungDuLieu
  const gioiHanGoc = kd && Math.max(gioiHanMayChu.minX, kd[0]) < Math.min(gioiHanMayChu.maxX, kd[2]) && Math.max(gioiHanMayChu.minY, kd[1]) < Math.min(gioiHanMayChu.maxY, kd[3])
    ? { minX: Math.max(gioiHanMayChu.minX, kd[0]), maxX: Math.min(gioiHanMayChu.maxX, kd[2]), minY: Math.max(gioiHanMayChu.minY, kd[1]), maxY: Math.min(gioiHanMayChu.maxY, kd[3]) }
    : gioiHanMayChu
  const gioiHan = viTri
    ? {
        minX: Math.min(gioiHanGoc.minX, mercX(viTri.lng) - 0.00005),
        maxX: Math.max(gioiHanGoc.maxX, mercX(viTri.lng) + 0.00005),
        minY: Math.min(gioiHanGoc.minY, mercY(viTri.lat) - 0.00005),
        maxY: Math.max(gioiHanGoc.maxY, mercY(viTri.lat) + 0.00005),
      }
    : gioiHanGoc
  const gioiHanRef = useRef(gioiHan)
  gioiHanRef.current = gioiHan

  // giữ khung nhìn nằm trong giới hạn bản đồ TP.HCM do admin cài đặt
  const rangBuoc = useCallback((v: Vu): Vu => {
    const { w, h } = kichThuocRef.current
    const g = gioiHanRef.current
    if (!w || !h) return v
    const zToiThieu = Math.max(12, Math.log2(Math.max(w / ((g.maxX - g.minX) * KICH_THUOC_O), h / ((g.maxY - g.minY) * KICH_THUOC_O))))
    const z = Math.min(Z_TOI_DA, Math.max(zToiThieu, v.z))
    const tiLe = KICH_THUOC_O * 2 ** z
    const nuaW = w / 2 / tiLe, nuaH = h / 2 / tiLe
    const kep = (gt: number, lo: number, hi: number, nua: number) => (hi - lo <= 2 * nua ? (lo + hi) / 2 : Math.min(hi - nua, Math.max(lo + nua, gt)))
    return { z, cx: kep(v.cx, g.minX, g.maxX, nuaW), cy: kep(v.cy, g.minY, g.maxY, nuaH) }
  }, [])

  useEffect(() => dangKyDuLieuNen(setNen), [])

  useEffect(() => {
    const el = goc.current
    if (!el) return
    const quanSat = new ResizeObserver(() => setKichThuoc({ w: el.clientWidth, h: el.clientHeight }))
    quanSat.observe(el)
    setKichThuoc({ w: el.clientWidth, h: el.clientHeight })
    return () => quanSat.disconnect()
  }, [])

  // khi có kích thước thật hoặc giới hạn đổi thì ràng buộc lại khung nhìn
  useEffect(() => { setVu(v => rangBuoc(v)) }, [kichThuoc, nen, khung.viDoNam, khung.viDoBac, khung.kinhDoTay, khung.kinhDoDong, rangBuoc])

  // chuyển khung nhìn tới điểm được chọn từ danh sách hoặc tới vị trí GPS đầu tiên
  useEffect(() => {
    if (!tieuDiem) return
    setVu(v => rangBuoc({ cx: mercX(tieuDiem.lng), cy: mercY(tieuDiem.lat), z: Math.max(v.z, 16) }))
  }, [tieuDiem?.khoa, rangBuoc]) // eslint-disable-line react-hooks/exhaustive-deps

  const tiLe = KICH_THUOC_O * 2 ** vu.z
  const raManHinh = (x: number, y: number) => ({ px: (x - vu.cx) * tiLe + kichThuoc.w / 2, py: (y - vu.cy) * tiLe + kichThuoc.h / 2 })
  const metRaPx = (viDo: number) => tiLe / (MET_QUANH_TRAI_DAT * Math.cos((viDo * Math.PI) / 180))

  // vẽ lại nền bản đồ mỗi khi khung nhìn hoặc dữ liệu thay đổi
  useEffect(() => {
    const cv = canvas.current
    if (!cv || !kichThuoc.w) return
    const dpr = window.devicePixelRatio || 1
    cv.width = kichThuoc.w * dpr; cv.height = kichThuoc.h * dpr
    const c = cv.getContext('2d')!
    c.setTransform(dpr, 0, 0, dpr, 0, 0)
    c.fillStyle = '#eef1f4'
    c.fillRect(0, 0, kichThuoc.w, kichThuoc.h)
    if (!nen) return

    const { w, h } = kichThuoc
    const trai = vu.cx - w / 2 / tiLe, phai = vu.cx + w / 2 / tiLe, tren = vu.cy - h / 2 / tiLe, duoi = vu.cy + h / 2 / tiLe
    const thay = (hh: HinhHoc) => !(hh.khung[2] < trai || hh.khung[0] > phai || hh.khung[3] < tren || hh.khung[1] > duoi)
    const dat = (v: Float64Array) => {
      c.moveTo((v[0] - vu.cx) * tiLe + w / 2, (v[1] - vu.cy) * tiLe + h / 2)
      for (let i = 2; i < v.length; i += 2) c.lineTo((v[i] - vu.cx) * tiLe + w / 2, (v[i + 1] - vu.cy) * tiLe + h / 2)
    }
    const veDaGiac = (ds: HinhHoc[], mau: string, vien?: string) => {
      c.beginPath()
      for (const hh of ds) if (thay(hh)) for (const v of hh.vong) { if (v.length >= 6) { dat(v); c.closePath() } }
      c.fillStyle = mau; c.fill('evenodd')
      if (vien) { c.strokeStyle = vien; c.lineWidth = 0.6; c.stroke() }
    }

    veDaGiac(nen.congVien.filter(hh => hh.vong[0].length >= 6), '#dcebd6')
    veDaGiac(nen.nuoc.filter(hh => hh.vong[0].length >= 6 && hh.vong[0][0] === hh.vong[0][hh.vong[0].length - 2]), '#bcd8ee')
    // đường nước (sông, kênh) vẽ thành nét dày
    c.strokeStyle = '#bcd8ee'; c.lineCap = 'round'; c.lineJoin = 'round'
    c.lineWidth = Math.max(2, 2.2 * 2 ** (vu.z - 14))
    c.beginPath()
    for (const hh of nen.nuoc) if (thay(hh)) for (const v of hh.vong) if (v.length >= 4 && !(v.length >= 6 && v[0] === v[v.length - 2] && v[1] === v[v.length - 1])) dat(v)
    c.stroke()
    if (vu.z >= 15.5) veDaGiac(nen.toaNha, '#e1e5ea', '#d3d8de')

    // đường: vẽ viền xám trước rồi nét trắng ở trên, đường lớn dày hơn
    const heSo = Math.max(0.5, 0.55 * 1.35 ** (vu.z - 14))
    for (const lop of [{ mau: '#cdd4dc', them: 1.6 }, { mau: '#ffffff', them: 0 }]) {
      for (let hang = 0; hang <= 5; hang++) {
        // thu nhỏ xa thì bỏ đường nhỏ cho bản đồ gọn và vẽ nhanh, phóng to dần mới hiện thêm
        if ((hang <= 1 && vu.z < 13) || (hang === 2 && vu.z < 11.5)) continue
        c.beginPath()
        let coDuong = false
        for (const hh of nen.duong) if (hh.hang === hang && thay(hh)) { for (const v of hh.vong) dat(v); coDuong = true }
        if (!coDuong) continue
        c.lineWidth = Math.max(0.6, (0.6 + hang * 0.7) * heSo) + lop.them
        c.strokeStyle = lop.mau
        c.stroke()
      }
    }
  }, [nen, vu, kichThuoc, tiLe])

  // vùng kích hoạt thuyết minh và vòng sai số GPS vẽ bằng SVG phủ lên nền
  const gesture = useRef({ cacChamm: new Map<number, { x: number; y: number }>(), daKeo: false })

  const phongTo = useCallback((dz: number, px?: number, py?: number) => {
    setVu(v => {
      const { w, h } = kichThuocRef.current
      const x = px ?? w / 2, y = py ?? h / 2
      const tiLeCu = KICH_THUOC_O * 2 ** v.z
      const mx = (x - w / 2) / tiLeCu + v.cx, my = (y - h / 2) / tiLeCu + v.cy
      const z = Math.min(Z_TOI_DA, Math.max(10, v.z + dz))
      const tiLeMoi = KICH_THUOC_O * 2 ** z
      return rangBuoc({ z, cx: mx - (x - w / 2) / tiLeMoi, cy: my - (y - h / 2) / tiLeMoi })
    })
  }, [rangBuoc])

  useEffect(() => {
    const el = goc.current
    if (!el) return
    const khiCuon = (e: WheelEvent) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      phongTo(-e.deltaY * 0.0015, e.clientX - r.left, e.clientY - r.top)
    }
    el.addEventListener('wheel', khiCuon, { passive: false })
    return () => el.removeEventListener('wheel', khiCuon)
  }, [phongTo])

  const khiNhan = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    e.currentTarget.setPointerCapture(e.pointerId)
    gesture.current.cacChamm.set(e.pointerId, { x: e.clientX, y: e.clientY })
    gesture.current.daKeo = false
  }
  const khiDiChuyen = (e: React.PointerEvent) => {
    const g = gesture.current
    const truoc = g.cacChamm.get(e.pointerId)
    if (!truoc) return
    const moi = { x: e.clientX, y: e.clientY }
    if (g.cacChamm.size === 1) {
      const dx = moi.x - truoc.x, dy = moi.y - truoc.y
      if (Math.abs(dx) + Math.abs(dy) > 3) g.daKeo = true
      setVu(v => rangBuoc({ ...v, cx: v.cx - dx / (KICH_THUOC_O * 2 ** v.z), cy: v.cy - dy / (KICH_THUOC_O * 2 ** v.z) }))
    } else if (g.cacChamm.size === 2) {
      g.daKeo = true
      const [a, b] = [...g.cacChamm.entries()]
      const khacId = a[0] === e.pointerId ? b[1] : a[1]
      const dCu = Math.hypot(truoc.x - khacId.x, truoc.y - khacId.y)
      const dMoi = Math.hypot(moi.x - khacId.x, moi.y - khacId.y)
      const r = e.currentTarget.getBoundingClientRect()
      if (dCu > 0 && dMoi > 0) phongTo(Math.log2(dMoi / dCu), (moi.x + khacId.x) / 2 - r.left, (moi.y + khacId.y) / 2 - r.top)
    }
    g.cacChamm.set(e.pointerId, moi)
  }
  const khiNha = (e: React.PointerEvent) => {
    const g = gesture.current
    if (!g.cacChamm.has(e.pointerId)) return
    g.cacChamm.delete(e.pointerId)
    if (g.cacChamm.size === 0 && !g.daKeo && e.type === 'pointerup' && chedoGia) {
      // chạm (không kéo) khi đang ở chế độ vị trí giả: đặt vị trí tại điểm chạm
      const r = e.currentTarget.getBoundingClientRect()
      const x = (e.clientX - r.left - kichThuoc.w / 2) / tiLe + vu.cx
      const y = (e.clientY - r.top - kichThuoc.h / 2) / tiLe + vu.cy
      khiChamBanDo({ lat: viDoTuY(y), lng: kinhDoTuX(x) })
    }
  }

  const trongKhung = (px: number, py: number, le = 160) => px > -le && py > -le && px < kichThuoc.w + le && py < kichThuoc.h + le

  return <div ref={goc} className="ban-do-goc" onPointerDown={khiNhan} onPointerMove={khiDiChuyen} onPointerUp={khiNha} onPointerCancel={khiNha}
    style={{ cursor: chedoGia ? 'crosshair' : 'grab' }}>
    <canvas ref={canvas} className="ban-do-canvas" style={{ width: kichThuoc.w, height: kichThuoc.h }} />
    {nen && !nen.dangTai && !nen.coDuLieu && <div className="demo-label"><Icon name="info" size={15} /> {t('map.noBase')}</div>}
    {chedoGia && <div className="demo-label demo-label-gia"><Icon name="location" size={15} /> {t('sim.hint')}</div>}

    {diem.map(d => {
      const { px, py } = raManHinh(mercX(d.kinhDo), mercY(d.viDo))
      if (!trongKhung(px, py)) return null
      const dkVung = Math.max(24, 2 * d.banKinh * metRaPx(d.viDo))
      const dangChon = chon === d.slug
      return <button key={d.slug} aria-label={d.ten} onClick={() => khiChonDiem(d.slug)} className={`map-marker ${dangChon ? 'active' : ''}`}
        style={{ left: px, top: py }}>
        <span className="radius" style={{ width: dkVung, height: dkVung }} />
        <span className="pin"><Icon name="location" size={18} /></span>
        {dangChon && <strong>{d.ten}</strong>}
      </button>
    })}

    {viTri && (() => {
      const { px, py } = raManHinh(mercX(viTri.lng), mercY(viTri.lat))
      if (!trongKhung(px, py, 40)) return null
      const dk = doChinhXac ? Math.min(2 * doChinhXac * metRaPx(viTri.lat), 600) : 0
      return <div className="nguoi-dung-diem" style={{ left: px, top: py }}>
        {dk > 12 && <span className="do-chinh-xac" style={{ width: dk, height: dk }} />}
        <span className="cham" /><em>{t('map.you')}</em>
      </div>
    })()}

    <div className="map-controls">
      <button onClick={khiDinhVi} aria-label={t('map.locate')} title={t('map.locate')}><Icon name="location" /></button>
      <button onClick={() => phongTo(0.6)} aria-label={t('map.zoomIn')} title={t('map.zoomIn')}><Icon name="plus" /></button>
      <button onClick={() => phongTo(-0.6)} aria-label={t('map.zoomOut')} title={t('map.zoomOut')}><Icon name="minus" /></button>
    </div>
    <div className="ban-do-ban-quyen">© OpenStreetMap contributors</div>
  </div>
}
