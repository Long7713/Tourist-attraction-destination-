import { useCallback, useEffect, useRef, useState } from 'react'
import { DANH_SACH_NGON_NGU, useNgonNgu, type MaNgonNgu } from '../ngon-ngu'
import { Icon } from '../thanh-phan/Icon'
import { Button } from '../thanh-phan/chung'

type TrangThaiGhi = 'idle' | 'permission' | 'listening' | 'stopped' | 'error'
type Doan = { id: number; ngonNguNguon: string; goc: string; dich: string }

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

const TAN_SO_CHUAN = 16000
const NGUONG_AM_LUONG = 0.008
const THOI_GIAN_NGUNG_CAU_MS = 900
const DO_DAI_CAU_TOI_DA_MS = 8000

function layBoNhanDien(): LopNhanDien | undefined {
  const w = window as unknown as { SpeechRecognition?: LopNhanDien; webkitSpeechRecognition?: LopNhanDien }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

function laThietBiIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function layMaGiong(maNgonNgu: MaNgonNgu): string {
  return DANH_SACH_NGON_NGU.find(n => n.ma === maNgonNgu)?.giongDoc ?? 'vi-VN'
}

// hạ tần số mẫu từ tần số micro (44.1k/48k Hz) xuống 16kHz mono để gửi lên máy chủ nhẹ và chuẩn xác
function giamTanSoMau(mauGoc: Float32Array, tanSoGoc: number, tanSoDich: number): Float32Array {
  if (tanSoGoc === tanSoDich) return mauGoc
  const tiLe = tanSoGoc / tanSoDich
  const doDaiMoi = Math.max(1, Math.round(mauGoc.length / tiLe))
  const ketQua = new Float32Array(doDaiMoi)
  for (let i = 0; i < doDaiMoi; i++) {
    const viTri = i * tiLe
    const truoc = Math.floor(viTri)
    const sau = Math.min(mauGoc.length - 1, truoc + 1)
    const lech = viTri - truoc
    ketQua[i] = mauGoc[truoc] * (1 - lech) + mauGoc[sau] * lech
  }
  return ketQua
}

// đóng gói mảng mẫu PCM thành file .wav 16-bit chuẩn (chạy trên mọi trình duyệt kể cả iOS Safari)
function dongGoiWav(cacDoan: Float32Array[], tanSoGoc: number): Blob {
  let tongDoDai = 0
  for (const d of cacDoan) tongDoDai += d.length
  const gop = new Float32Array(tongDoDai)
  let buoc = 0
  for (const d of cacDoan) {
    gop.set(d, buoc)
    buoc += d.length
  }
  const mau16k = giamTanSoMau(gop, tanSoGoc, TAN_SO_CHUAN)
  const buffer = new ArrayBuffer(44 + mau16k.length * 2)
  const view = new DataView(buffer)
  const ghiChu = (viTri: number, chuoi: string) => {
    for (let i = 0; i < chuoi.length; i++) view.setUint8(viTri + i, chuoi.charCodeAt(i))
  }
  ghiChu(0, 'RIFF')
  view.setUint32(4, 36 + mau16k.length * 2, true)
  ghiChu(8, 'WAVE')
  ghiChu(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, TAN_SO_CHUAN, true)
  view.setUint32(28, TAN_SO_CHUAN * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  ghiChu(36, 'data')
  view.setUint32(40, mau16k.length * 2, true)
  let offset = 44
  for (let i = 0; i < mau16k.length; i++) {
    const s = Math.max(-1, Math.min(1, mau16k[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    offset += 2
  }
  return new Blob([buffer], { type: 'audio/wav' })
}

// chức năng phiên dịch giọng nói: hỗ trợ mọi thiết bị (iPhone/Android/PC), người dùng chọn rõ ngôn ngữ đầu vào và ngôn ngữ đầu ra để nhận diện và dịch chính xác
export default function DichGiongNoi() {
  const { t, ma, tenNgonNgu } = useNgonNgu()
  // mặc định đầu vào ưu tiên Tiếng Việt khi người dùng chọn ngoại ngữ, hoặc Tiếng Anh khi người dùng đang xem Tiếng Việt
  const [nguon, setNguon] = useState<MaNgonNgu>(() => (ma === 'vi' ? 'en' : 'vi'))
  const [dich, setDich] = useState<MaNgonNgu>(ma)
  const [trangThai, setTrangThai] = useState<TrangThaiGhi>('idle')
  const [online, setOnline] = useState(navigator.onLine)
  const [doan, setDoan] = useState<Doan[]>([])
  const [tamThoi, setTamThoi] = useState('')
  const [dangXuLy, setDangXuLy] = useState(0)
  const [loiServer, setLoiServer] = useState(false)
  const [loiChiTiet, setLoiChiTiet] = useState('')

  const luong = useRef<MediaStream | null>(null)
  const boNhanDien = useRef<BoNhanDien | null>(null)
  const ghiWavCtx = useRef<{ ctx: AudioContext; xuLy: ScriptProcessorNode; tatTieng: GainNode; dayRa: () => void } | null>(null)
  const dangNghe = useRef(false)
  const nguonRef = useRef(nguon)
  nguonRef.current = nguon
  const dichRef = useRef(dich)
  dichRef.current = dich
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
      if (kq.ngon_ngu_nguon !== maDich) docBanDich(kq.ban_dich, maDich)
    }
  }, [])

  // gửi văn bản vừa nhận diện được lên máy chủ kèm ngôn ngữ đầu vào để dịch chính xác sang ngôn ngữ đích
  const guiVanBan = useCallback(async (vanBan: string) => {
    const sach = vanBan.trim()
    if (!sach) return
    const maNguon = nguonRef.current
    const maDich = dichRef.current
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

  // gửi file âm thanh .wav (dùng cho iPhone/iOS và các trình duyệt chặn Web Speech API)
  const guiFileWav = useCallback(async (blob: Blob) => {
    const maNguon = nguonRef.current
    const maDich = dichRef.current
    const form = new FormData()
    form.append('file', blob, 'doan.wav')
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

  // thu âm micro trực tiếp thành .wav 16kHz mono (tương thích mọi thiết bị iOS, Android, PC)
  const batDauGhiAmWav = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setLoiChiTiet('Thiết bị hoặc trình duyệt không hỗ trợ thu âm micro (cần mở qua https:// hoặc localhost).')
      setTrangThai('error')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      if (!dangNghe.current) {
        stream.getTracks().forEach(tr => tr.stop())
        return
      }
      luong.current = stream
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new AudioCtx()
      if (ctx.state === 'suspended') await ctx.resume()
      const nguonAm = ctx.createMediaStreamSource(stream)
      const xuLy = ctx.createScriptProcessor(4096, 1, 1)
      const tatTieng = ctx.createGain()
      tatTieng.gain.value = 0

      let boDem: Float32Array[] = []
      let daCoTieng = false
      let batDauCau = 0
      let lanNoiCuoi = 0

      const dayCauHienTai = () => {
        if (!daCoTieng || !boDem.length) {
          boDem = []
          daCoTieng = false
          return
        }
        const duLieuGui = boDem
        boDem = []
        daCoTieng = false
        batDauCau = 0
        lanNoiCuoi = 0
        const wav = dongGoiWav(duLieuGui, ctx.sampleRate)
        if (wav.size > 4000) void guiFileWav(wav)
      }

      xuLy.onaudioprocess = ev => {
        if (!dangNghe.current) return
        const duLieu = ev.inputBuffer.getChannelData(0)
        let tong = 0
        for (let i = 0; i < duLieu.length; i++) tong += duLieu[i] * duLieu[i]
        const rms = Math.sqrt(tong / duLieu.length)
        const gio = Date.now()
        if (rms >= NGUONG_AM_LUONG) {
          if (!daCoTieng) {
            daCoTieng = true
            batDauCau = gio
          }
          lanNoiCuoi = gio
          boDem.push(new Float32Array(duLieu))
        } else if (daCoTieng) {
          boDem.push(new Float32Array(duLieu))
          if (gio - lanNoiCuoi >= THOI_GIAN_NGUNG_CAU_MS) dayCauHienTai()
        }
        if (daCoTieng && gio - batDauCau >= DO_DAI_CAU_TOI_DA_MS) dayCauHienTai()
      }

      nguonAm.connect(xuLy)
      xuLy.connect(tatTieng)
      tatTieng.connect(ctx.destination)
      ghiWavCtx.current = { ctx, xuLy, tatTieng, dayRa: dayCauHienTai }
      setLoiChiTiet('')
      setTrangThai('listening')
    } catch (err) {
      dangNghe.current = false
      const tenLoi = err instanceof Error ? err.name : ''
      if (tenLoi === 'NotFoundError' || tenLoi === 'DevicesNotFoundError') {
        setLoiChiTiet('Không tìm thấy thiết bị microphone nào trên máy.')
      } else if (tenLoi === 'NotReadableError' || tenLoi === 'TrackStartError') {
        setLoiChiTiet('Microphone đang được ứng dụng khác sử dụng.')
      } else {
        setLoiChiTiet('Quyền microphone đang bị chặn. Hãy cấp quyền Micro trong cài đặt trình duyệt/thiết bị rồi thử lại.')
      }
      setTrangThai('error')
    }
  }, [guiFileWav])

  const khoiTaoNhanDien = useCallback(() => {
    const Lop = layBoNhanDien()
    if (!Lop || !dangNghe.current) return false
    const rec = new Lop()
    rec.lang = layMaGiong(nguonRef.current)
    rec.continuous = true
    rec.interimResults = true
    let daTungNhanKetQua = false
    rec.onstart = () => {
      setTrangThai('listening')
      setLoiServer(false)
    }
    rec.onresult = (e: SuKienGiongNoi) => {
      daTungNhanKetQua = true
      let tam = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const ketQua = e.results[i]
        const chu = ketQua[0]?.transcript ?? ''
        if (ketQua.isFinal) {
          setTamThoi('')
          void guiVanBan(chu)
        } else {
          tam += chu
        }
      }
      if (tam.trim()) setTamThoi(tam.trim())
    }
    rec.onerror = e => {
      // nếu trình duyệt chặn Web Speech API (như iOS Safari, Brave, WebView...), tự động chuyển sang thu âm micro trực tiếp gửi máy chủ
      if (e.error === 'service-not-allowed' || e.error === 'language-not-supported' || e.error === 'network' || (!daTungNhanKetQua && e.error === 'audio-capture')) {
        rec.onend = null
        try { rec.stop() } catch { /* bỏ qua */ }
        boNhanDien.current = null
        setTamThoi('')
        void batDauGhiAmWav()
        return
      }
      if (e.error === 'not-allowed' || e.error === 'audio-capture') {
        dangNghe.current = false
        boNhanDien.current = null
        setTamThoi('')
        setLoiChiTiet('Quyền microphone đang bị chặn. Hãy bấm vào biểu tượng cài đặt cạnh thanh địa chỉ và Cho phép Micro.')
        setTrangThai('error')
      }
    }
    rec.onend = () => {
      setTamThoi('')
      if (!dangNghe.current || !boNhanDien.current) return
      window.setTimeout(() => {
        if (!dangNghe.current || !boNhanDien.current) return
        try {
          rec.lang = layMaGiong(nguonRef.current)
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
  }, [batDauGhiAmWav, guiVanBan])

  const batDau = async () => {
    setTrangThai('permission')
    setLoiServer(false)
    setLoiChiTiet('')
    if (!window.isSecureContext) {
      setLoiChiTiet('Trình duyệt chặn micro trên HTTP thường. Hãy mở bằng link https:// hoặc http://localhost:8000.')
      setTrangThai('error')
      return
    }
    dangNghe.current = true
    // trên iPhone/iPad (iOS) dùng thẳng thu âm micro .wav vì Web Speech API thường bị chặn service-not-allowed
    if (!laThietBiIos() && layBoNhanDien()) {
      if (khoiTaoNhanDien()) return
    }
    await batDauGhiAmWav()
  }

  const dung = useCallback(() => {
    dangNghe.current = false
    setTamThoi('')
    if (boNhanDien.current) {
      boNhanDien.current.onend = null
      try { boNhanDien.current.stop() } catch { /* bỏ qua */ }
      boNhanDien.current = null
    }
    if (ghiWavCtx.current) {
      ghiWavCtx.current.dayRa()
      ghiWavCtx.current.xuLy.disconnect()
      ghiWavCtx.current.tatTieng.disconnect()
      void ghiWavCtx.current.ctx.close()
      ghiWavCtx.current = null
    }
    luong.current?.getTracks().forEach(tr => tr.stop())
    luong.current = null
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
    if (ghiWavCtx.current) {
      ghiWavCtx.current.xuLy.disconnect()
      ghiWavCtx.current.tatTieng.disconnect()
      void ghiWavCtx.current.ctx.close()
      ghiWavCtx.current = null
    }
    luong.current?.getTracks().forEach(tr => tr.stop())
    if ('speechSynthesis' in window) speechSynthesis.cancel()
  }, [])

  const doiNgonNguVao = (moi: MaNgonNgu) => {
    setNguon(moi)
    nguonRef.current = moi
    if (dangNghe.current && boNhanDien.current) {
      try { boNhanDien.current.stop() } catch { /* bỏ qua */ }
    }
  }

  const daoNgonNgu = () => {
    const nguonCu = nguon
    const dichCu = dich
    doiNgonNguVao(dichCu)
    setDich(nguonCu)
  }

  const hoatDong = trangThai === 'listening'
  const tieuDe = !online ? t('voice.needOnline') : trangThai === 'permission' ? t('voice.permission') : hoatDong ? t('voice.listening') : trangThai === 'stopped' ? t('voice.stopped') : trangThai === 'error' ? t('voice.errMic') : t('voice.idleTitle')
  const moTa = !online ? t('voice.needOnlineText') : hoatDong ? t('voice.listeningText') : trangThai === 'error' ? (loiChiTiet || t('voice.errMicText')) : t('voice.idleText')

  return <main className="voice-page"><section className="voice-hero"><div className="container"><div className="eyebrow">{t('voice.eyebrow')}</div><h1>{t('voice.title1')}<br /><em>{t('voice.title2')}</em></h1><p>{t('voice.text')}</p></div></section>
    <section className="voice-workspace container">
      <div className="language-bar"><label><span className="lang-icon"><Icon name="globe" /></span><span><small>{t('voice.inLabel')}</small><select value={nguon} onChange={e => doiNgonNguVao(e.target.value as MaNgonNgu)}>{DANH_SACH_NGON_NGU.map(n => <option key={n.ma} value={n.ma}>{n.ten}</option>)}</select></span><Icon name="chevron" /></label><button type="button" className="flow-arrow" onClick={daoNgonNgu} title="Đổi chiều ngôn ngữ" style={{ background: 'transparent', border: 0, cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Icon name="arrow" /></button><label><span className="lang-icon orange"><Icon name="translate" /></span><span><small>{t('voice.outLabel')}</small><select value={dich} onChange={e => setDich(e.target.value as MaNgonNgu)}>{DANH_SACH_NGON_NGU.map(n => <option key={n.ma} value={n.ma}>{n.ten}</option>)}</select></span><Icon name="chevron" /></label></div>
      <div className="voice-core"><div className={`mic-orbit ${hoatDong ? 'active' : ''}`}><span className="orbit one" /><span className="orbit two" /><button aria-label={hoatDong ? t('voice.stop') : t('voice.start')} onClick={hoatDong ? dung : batDau} disabled={trangThai === 'permission' || !online}><Icon name={hoatDong ? 'stop' : 'mic'} size={36} /></button></div><h2>{tieuDe}</h2><p>{moTa}</p><div className={`voice-wave ${hoatDong ? 'animated' : ''}`}>{Array.from({ length: 42 }, (_, i) => <i key={i} />)}</div><Button onClick={hoatDong ? dung : batDau} disabled={trangThai === 'permission' || !online} variant={hoatDong ? 'dark' : 'primary'} icon={hoatDong ? 'stop' : 'mic'}>{hoatDong ? t('voice.stop') : trangThai === 'permission' ? t('voice.connecting') : t('voice.start')}</Button></div>
      <div className="realtime-note"><Icon name="info" /><span>{loiServer ? t('voice.errServer') : t('voice.note')}</span></div>
      <div className="translation-grid">
        <div className="translation-panel"><div className="panel-head"><div><span className="panel-icon"><Icon name="audio" /></span><span><small>{t('voice.srcTitle')}</small><strong>{tenNgonNgu(nguon)}</strong></span></div><span className={`status-dot ${hoatDong ? 'on' : ''}`} /></div>
          {doan.length === 0 && !tamThoi ? <div className="empty-transcript"><Icon name="audio" size={32} /><strong>{hoatDong ? t('voice.srcWaiting') : t('voice.srcEmpty')}</strong><p>{t('voice.srcNote')}</p></div>
            : <div className="danh-sach-doan">{doan.map(d => <p key={d.id} lang={d.ngonNguNguon}><small>{tenNgonNgu(d.ngonNguNguon)}</small>{d.goc}</p>)}{tamThoi && <p className="dang-xu-ly">{tamThoi}...</p>}{dangXuLy > 0 && <p className="dang-xu-ly">{t('voice.processing')}</p>}<div ref={cuoiDanhSachSrc} /></div>}</div>
        <div className="translation-panel translated"><div className="panel-head"><div><span className="panel-icon orange"><Icon name="translate" /></span><span><small>{t('voice.dstTitle')}</small><strong>{tenNgonNgu(dich)}</strong></span></div><Icon name="volume" /></div>
          {doan.length === 0 ? <div className="empty-transcript"><Icon name="spark" size={32} /><strong>{t('voice.dstEmptyTitle')}</strong><p>{t('voice.dstEmptyText')}</p></div>
            : <div className="danh-sach-doan">{doan.map(d => <p key={d.id} lang={dich}>{d.dich}</p>)}{dangXuLy > 0 && <p className="dang-xu-ly">{t('voice.processing')}</p>}<div ref={cuoiDanhSachDst} /></div>}</div>
      </div>
      <div className="status-bar"><span><i className={hoatDong ? 'active' : ''} /><Icon name="mic" /> {t('status.mic')}</span><span><i className={hoatDong ? 'active' : ''} /><Icon name="globe" /> {t('status.detect')}</span><span><i className={hoatDong ? 'active' : ''} /><Icon name="volume" /> {t('status.audio')}</span><span><i className={online ? 'active' : ''} /><Icon name="spark" /> {t('status.online')}</span></div>
    </section></main>
}
