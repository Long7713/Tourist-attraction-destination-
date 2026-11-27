import { useCallback, useEffect, useRef, useState } from 'react'
import { DANH_SACH_NGON_NGU, useNgonNgu, type MaNgonNgu } from '../ngon-ngu'
import { Icon } from '../thanh-phan/Icon'
import { Button } from '../thanh-phan/chung'

type TrangThaiGhi = 'idle' | 'permission' | 'listening' | 'stopped' | 'error'
type Doan = { id: number; ngonNguNguon: string; goc: string; dich: string }
type NgonNguVao = 'auto' | MaNgonNgu

type KetQuaGiongNoi = { isFinal: boolean; 0: { transcript: string } }
type SuKienGiongNoi = { resultIndex: number; results: ArrayLike<KetQuaGiongNoi> }
type BoNhanDien = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onstart: (() => void) | null
  onresult: ((e: SuKienGiongNoi) => void) | null
  onerror: ((e: { error?: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}
type LopNhanDien = new () => BoNhanDien

const DO_DAI_DOAN_MS = 6000
// ngưỡng âm lượng tối thiểu để coi là có tiếng nói khi dùng phương án ghi âm dự phòng
const NGUONG_AM_LUONG = 0.012

function layBoNhanDien(): LopNhanDien | undefined {
  const w = window as unknown as { SpeechRecognition?: LopNhanDien; webkitSpeechRecognition?: LopNhanDien }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

function chonKieuGhi(): string | undefined {
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find(k => window.MediaRecorder?.isTypeSupported?.(k))
}

function chonMaGiongNhanDien(nguon: NgonNguVao, dich: MaNgonNgu): string {
  if (nguon !== 'auto') {
    return DANH_SACH_NGON_NGU.find(n => n.ma === nguon)?.giongDoc ?? 'vi-VN'
  }
  // ở chế độ tự động: nếu khách dùng ngoại ngữ (vd Tiếng Anh) thì ưu tiên nghe tiếng địa phương (Tiếng Việt), và ngược lại
  return dich === 'vi' ? 'en-US' : 'vi-VN'
}

// chức năng phiên dịch giọng nói: ghi nhận lời nói, tự phát hiện ngôn ngữ nguồn ở ô Nội dung gốc và dịch sang ngôn ngữ người dùng đang chọn ở ô Bản dịch
export default function DichGiongNoi() {
  const { t, ma, tenNgonNgu } = useNgonNgu()
  const [nguon, setNguon] = useState<NgonNguVao>('auto')
  const [dich, setDich] = useState<MaNgonNgu>(ma)
  const [trangThai, setTrangThai] = useState<TrangThaiGhi>('idle')
  const [online, setOnline] = useState(navigator.onLine)
  const [doan, setDoan] = useState<Doan[]>([])
  const [tamThoi, setTamThoi] = useState('')
  const [dangXuLy, setDangXuLy] = useState(0)
  const [loiServer, setLoiServer] = useState(false)

  const luong = useRef<MediaStream | null>(null)
  const boNhanDien = useRef<BoNhanDien | null>(null)
  const dangNghe = useRef(false)
  const nguonRef = useRef(nguon)
  nguonRef.current = nguon
  const dichRef = useRef(dich)
  dichRef.current = dich
  const phanTichAm = useRef<{ ctx: AudioContext; node: AnalyserNode } | null>(null)
  const idDoan = useRef(0)
  const cuoiDanhSachSrc = useRef<HTMLDivElement>(null)
  const cuoiDanhSachDst = useRef<HTMLDivElement>(null)

  useEffect(() => setDich(ma), [ma])
  useEffect(() => {
    const bat = () => setOnline(true), tat = () => setOnline(false)
    window.addEventListener('online', bat); window.addEventListener('offline', tat)
    return () => { window.removeEventListener('online', bat); window.removeEventListener('offline', tat) }
  }, [])
  useEffect(() => {
    cuoiDanhSachSrc.current?.scrollIntoView({ block: 'nearest' }); cuoiDanhSachDst.current?.scrollIntoView({ block: 'nearest' })
  }, [doan, tamThoi])

  const docBanDich = (van: string, maDich: string) => {
    if (!('speechSynthesis' in window) || !van.trim()) return
    const u = new SpeechSynthesisUtterance(van)
    u.lang = DANH_SACH_NGON_NGU.find(n => n.ma === maDich)?.giongDoc ?? 'en-US'
    speechSynthesis.speak(u)
  }

  const xuLyKetQua = useCallback((kq: { ngon_ngu_nguon: string | null; van_ban_goc: string; ban_dich: string }, maDich: MaNgonNgu) => {
    setLoiServer(false)
    if (kq.van_ban_goc && kq.ngon_ngu_nguon) {
      setDoan(ds => [...ds, { id: ++idDoan.current, ngonNguNguon: kq.ngon_ngu_nguon!, goc: kq.van_ban_goc, dich: kq.ban_dich }])
      // chỉ đọc to khi bản dịch khác ngôn ngữ nói, tránh đọc lặp lại câu vừa nói
      if (kq.ngon_ngu_nguon !== maDich) docBanDich(kq.ban_dich, maDich)
    }
  }, [])

  // gửi văn bản vừa nhận diện được lên máy chủ để dịch sang ngôn ngữ người dùng chọn
  // ngôn ngữ nguồn chính là ngôn ngữ trình duyệt đang nghe (rec.lang, vd vi-VN), đổi về mã hệ thống (vi)
  const guiVanBan = useCallback(async (vanBan: string, maGiong: string) => {
    const sach = vanBan.trim()
    if (!sach) return
    const maDich = dichRef.current
    const maNguon = DANH_SACH_NGON_NGU.find(n => n.giongDoc === maGiong)?.ma ?? maGiong.slice(0, 2)
    const form = new FormData()
    form.append('van_ban_goc', sach)
    form.append('ngon_ngu_nguon', maNguon)
    form.append('ngon_ngu_dich', maDich)
    setDangXuLy(n => n + 1)
    try {
      const res = await fetch('/api/dich-giong-noi', { method: 'POST', body: form })
      if (!res.ok) throw new Error(String(res.status))
      const kq = (await res.json()) as { ngon_ngu_nguon: string | null; van_ban_goc: string; ban_dich: string }
      xuLyKetQua(kq, maDich)
    } catch {
      setLoiServer(true)
    } finally {
      setDangXuLy(n => n - 1)
    }
  }, [xuLyKetQua])

  // phương án dự phòng cho trình duyệt không hỗ trợ Web Speech API: gửi đoạn ghi âm lên máy chủ
  const guiDoan = useCallback(async (blob: Blob) => {
    const maDich = dichRef.current
    const form = new FormData()
    const duoi = blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm'
    form.append('file', blob, `doan.${duoi}`)
    form.append('ngon_ngu_dich', maDich)
    setDangXuLy(n => n + 1)
    try {
      const res = await fetch('/api/dich-giong-noi', { method: 'POST', body: form })
      if (!res.ok) throw new Error(String(res.status))
      const kq = (await res.json()) as { ngon_ngu_nguon: string | null; van_ban_goc: string; ban_dich: string }
      xuLyKetQua(kq, maDich)
    } catch {
      setLoiServer(true)
    } finally {
      setDangXuLy(n => n - 1)
    }
  }, [xuLyKetQua])

  // ghi từng đoạn ngắn nối tiếp nhau cho trình duyệt dùng phương án dự phòng
  const ghiMotDoan = useCallback(() => {
    const stream = luong.current
    if (!stream || !dangNghe.current) return
    const kieu = chonKieuGhi()
    const rec = new MediaRecorder(stream, kieu ? { mimeType: kieu } : undefined)
    const manh: Blob[] = []
    let amLonNhat = 0
    const bo = new Float32Array(phanTichAm.current?.node.fftSize ?? 1024)
    const doAm = window.setInterval(() => {
      const nd = phanTichAm.current?.node
      if (!nd) return
      nd.getFloatTimeDomainData(bo)
      let tong = 0
      for (const v of bo) tong += v * v
      amLonNhat = Math.max(amLonNhat, Math.sqrt(tong / bo.length))
    }, 100)
    rec.ondataavailable = e => { if (e.data.size) manh.push(e.data) }
    rec.onstop = () => {
      window.clearInterval(doAm)
      if (amLonNhat >= NGUONG_AM_LUONG && manh.length) void guiDoan(new Blob(manh, { type: rec.mimeType }))
      ghiMotDoan()
    }
    rec.start()
    window.setTimeout(() => { if (rec.state !== 'inactive') rec.stop() }, DO_DAI_DOAN_MS)
  }, [guiDoan])

  const khoiTaoNhanDien = useCallback(() => {
    const Lop = layBoNhanDien()
    if (!Lop || !dangNghe.current) return false
    const rec = new Lop()
    rec.lang = chonMaGiongNhanDien(nguonRef.current, dichRef.current)
    rec.continuous = true
    rec.interimResults = true
    rec.onstart = () => {
      setTrangThai('listening')
      setLoiServer(false)
    }
    rec.onresult = (e: SuKienGiongNoi) => {
      let tam = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const ketQua = e.results[i]
        const chu = ketQua[0]?.transcript ?? ''
        if (ketQua.isFinal) {
          setTamThoi('')
          void guiVanBan(chu, rec.lang)
        } else {
          tam += chu
        }
      }
      if (tam.trim()) setTamThoi(tam.trim())
    }
    rec.onerror = e => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture') {
        dangNghe.current = false
        boNhanDien.current = null
        setTamThoi('')
        setTrangThai('error')
      }
    }
    rec.onend = () => {
      setTamThoi('')
      if (!dangNghe.current) return
      window.setTimeout(() => {
        if (!dangNghe.current) return
        try {
          rec.lang = chonMaGiongNhanDien(nguonRef.current, dichRef.current)
          rec.start()
        } catch {
          khoiTaoNhanDien()
        }
      }, 150)
    }
    boNhanDien.current = rec
    try {
      rec.start()
      return true
    } catch {
      boNhanDien.current = null
      return false
    }
  }, [guiVanBan])

  const batDau = async () => {
    setTrangThai('permission')
    setLoiServer(false)
    if (layBoNhanDien()) {
      dangNghe.current = true
      if (khoiTaoNhanDien()) return
      dangNghe.current = false
    }
    try {
      luong.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      const ctx = new AudioContext()
      const node = ctx.createAnalyser()
      ctx.createMediaStreamSource(luong.current).connect(node)
      phanTichAm.current = { ctx, node }
      dangNghe.current = true
      setTrangThai('listening')
      ghiMotDoan()
    } catch { setTrangThai('error') }
  }

  const dung = useCallback(() => {
    dangNghe.current = false
    setTamThoi('')
    if (boNhanDien.current) {
      boNhanDien.current.onend = null
      try { boNhanDien.current.stop() } catch { /* bỏ qua */ }
      boNhanDien.current = null
    }
    luong.current?.getTracks().forEach(tr => tr.stop())
    luong.current = null
    void phanTichAm.current?.ctx.close()
    phanTichAm.current = null
    if ('speechSynthesis' in window) speechSynthesis.cancel()
    setTrangThai('stopped')
  }, [])

  useEffect(() => () => {
    dangNghe.current = false
    if (boNhanDien.current) {
      boNhanDien.current.onend = null
      try { boNhanDien.current.stop() } catch { /* bỏ qua */ }
      boNhanDien.current = null
    }
    luong.current?.getTracks().forEach(tr => tr.stop())
    if ('speechSynthesis' in window) speechSynthesis.cancel()
  }, [])

  const doiNgonNguVao = (moi: NgonNguVao) => {
    setNguon(moi)
    nguonRef.current = moi
    // nếu đang nghe bằng Web Speech API thì khởi động lại nhẹ để áp dụng ngôn ngữ nghe mới ngay
    if (dangNghe.current && boNhanDien.current) {
      try { boNhanDien.current.stop() } catch { /* bỏ qua */ }
    }
  }

  const hoatDong = trangThai === 'listening'
  const ngonNguCuoi = doan.at(-1)?.ngonNguNguon
  const tieuDe = !online ? t('voice.needOnline') : trangThai === 'permission' ? t('voice.permission') : hoatDong ? t('voice.listening') : trangThai === 'stopped' ? t('voice.stopped') : trangThai === 'error' ? t('voice.errMic') : t('voice.idleTitle')
  const moTa = !online ? t('voice.needOnlineText') : hoatDong ? t('voice.listeningText') : trangThai === 'error' ? t('voice.errMicText') : t('voice.idleText')

  return <main className="voice-page"><section className="voice-hero"><div className="container"><div className="eyebrow">{t('voice.eyebrow')}</div><h1>{t('voice.title1')}<br /><em>{t('voice.title2')}</em></h1><p>{t('voice.text')}</p></div></section>
    <section className="voice-workspace container">
      <div className="language-bar"><label><span className="lang-icon"><Icon name="globe" /></span><span><small>{t('voice.inLabel')}</small><select value={nguon} onChange={e => doiNgonNguVao(e.target.value as NgonNguVao)}><option value="auto">{t('voice.inAuto')}</option>{DANH_SACH_NGON_NGU.map(n => <option key={n.ma} value={n.ma}>{n.ten}</option>)}</select></span><span className="auto-badge">{nguon === 'auto' ? 'AUTO' : nguon.toUpperCase()}</span></label><span className="flow-arrow"><Icon name="arrow" /></span><label><span className="lang-icon orange"><Icon name="translate" /></span><span><small>{t('voice.outLabel')}</small><select value={dich} onChange={e => setDich(e.target.value as MaNgonNgu)}>{DANH_SACH_NGON_NGU.map(n => <option key={n.ma} value={n.ma}>{n.ten}</option>)}</select></span><Icon name="chevron" /></label></div>
      <div className="voice-core"><div className={`mic-orbit ${hoatDong ? 'active' : ''}`}><span className="orbit one" /><span className="orbit two" /><button aria-label={hoatDong ? t('voice.stop') : t('voice.start')} onClick={hoatDong ? dung : batDau} disabled={trangThai === 'permission' || !online}><Icon name={hoatDong ? 'stop' : 'mic'} size={36} /></button></div><h2>{tieuDe}</h2><p>{moTa}</p><div className={`voice-wave ${hoatDong ? 'animated' : ''}`}>{Array.from({ length: 42 }, (_, i) => <i key={i} />)}</div><Button onClick={hoatDong ? dung : batDau} disabled={trangThai === 'permission' || !online} variant={hoatDong ? 'dark' : 'primary'} icon={hoatDong ? 'stop' : 'mic'}>{hoatDong ? t('voice.stop') : trangThai === 'permission' ? t('voice.connecting') : t('voice.start')}</Button></div>
      <div className="realtime-note"><Icon name="info" /><span>{loiServer ? t('voice.errServer') : t('voice.note')}</span></div>
      <div className="translation-grid">
        <div className="translation-panel"><div className="panel-head"><div><span className="panel-icon"><Icon name="audio" /></span><span><small>{t('voice.srcTitle')}</small><strong>{ngonNguCuoi ? t('voice.srcDetected', { lang: tenNgonNgu(ngonNguCuoi) }) : t('voice.srcWait')}</strong></span></div><span className={`status-dot ${hoatDong ? 'on' : ''}`} /></div>
          {doan.length === 0 && !tamThoi ? <div className="empty-transcript"><Icon name="audio" size={32} /><strong>{hoatDong ? t('voice.srcWaiting') : t('voice.srcEmpty')}</strong><p>{t('voice.srcNote')}</p></div>
            : <div className="danh-sach-doan">{doan.map(d => <p key={d.id} lang={d.ngonNguNguon}><small>{tenNgonNgu(d.ngonNguNguon)}</small>{d.goc}</p>)}{tamThoi && <p className="dang-xu-ly">{tamThoi}...</p>}{dangXuLy > 0 && <p className="dang-xu-ly">{t('voice.processing')}</p>}<div ref={cuoiDanhSachSrc} /></div>}</div>
        <div className="translation-panel translated"><div className="panel-head"><div><span className="panel-icon orange"><Icon name="translate" /></span><span><small>{t('voice.dstTitle')}</small><strong>{tenNgonNgu(dich)}</strong></span></div><Icon name="volume" /></div>
          {doan.length === 0 ? <div className="empty-transcript"><Icon name="spark" size={32} /><strong>{t('voice.dstEmptyTitle')}</strong><p>{t('voice.dstEmptyText')}</p></div>
            : <div className="danh-sach-doan">{doan.map(d => <p key={d.id} lang={dich}>{d.dich}</p>)}{dangXuLy > 0 && <p className="dang-xu-ly">{t('voice.processing')}</p>}<div ref={cuoiDanhSachDst} /></div>}</div>
      </div>
      <div className="status-bar"><span><i className={hoatDong ? 'active' : ''} /><Icon name="mic" /> {t('status.mic')}</span><span><i className={hoatDong ? 'active' : ''} /><Icon name="globe" /> {t('status.detect')}</span><span><i className={hoatDong ? 'active' : ''} /><Icon name="volume" /> {t('status.audio')}</span><span><i className={online ? 'active' : ''} /><Icon name="spark" /> {t('status.online')}</span></div>
    </section></main>
}
