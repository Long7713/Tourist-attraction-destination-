import { useEffect, useState } from 'react'
import { goiApi, TEN_NGON_NGU, TEN_THIET_BI, type Dashboard as DuLieu } from '../api'
import { dinhDangSo, Nut, TheTrang, ThongBao } from '../ui'

const THU = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN']

function thangHienTai() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function The({ nhan, so, phu }: { nhan: string; so: string; phu?: string }) {
  return <div className="adm-so-lieu"><span>{nhan}</span><strong>{so}</strong>{phu && <small>{phu}</small>}</div>
}

// thanh ngang thể hiện tỷ lệ, dùng cho ngôn ngữ và loại thiết bị
function BieuDoNgang({ du_lieu, tenHienThi }: { du_lieu: Record<string, number>; tenHienThi: Record<string, string> }) {
  const muc = Object.entries(du_lieu).sort((a, b) => b[1] - a[1])
  const tong = muc.reduce((t, [, v]) => t + v, 0)
  if (!tong) return <p className="adm-rong">Chưa có dữ liệu.</p>
  return <div className="adm-ngang">{muc.map(([ma, so]) => <div key={ma}>
    <span>{tenHienThi[ma] || ma}</span>
    <div className="adm-ngang-thanh"><i style={{ width: `${(so / tong) * 100}%` }} /></div>
    <b>{dinhDangSo(so)} ({Math.round((so / tong) * 100)}%)</b>
  </div>)}</div>
}

// chức năng mã QR chung: máy chủ Python tự mở tunnel HTTPS công khai (hoặc IP LAN) và sinh mã QR (?qr=<ma_qr>) cho mọi thiết bị quét
function MaQr() {
  const macDinh = `${window.location.origin}/?qr=1`
  const [diaChi, setDiaChi] = useState(macDinh)
  const [diaChiAnh, setDiaChiAnh] = useState(macDinh)
  const [dangTaoTunnel, setDangTaoTunnel] = useState(false)
  const sach = diaChi.trim()
  const hopLe = /^https?:\/\/\S{3,}$/.test(sach)

  const taoMaQrMoi = () => {
    fetch('/api/qr/thong-tin')
      .then(r => (r.ok ? r.json() : null))
      .then((kq: { dia_chi_qr?: string; dia_chi_cong_khai?: string | null; dang_tao_tunnel?: boolean } | null) => {
        if (kq?.dia_chi_qr) {
          setDiaChi(kq.dia_chi_qr)
          setDiaChiAnh(kq.dia_chi_qr)
        }
        setDangTaoTunnel(Boolean(kq?.dang_tao_tunnel && !kq?.dia_chi_cong_khai))
      })
      .catch(() => { /* giữ địa chỉ mặc định */ })
  }

  useEffect(() => {
    let huy = false
    let henPoll: number | undefined
    const batDau = Date.now()

    const taiThongTin = () => {
      fetch('/api/qr/thong-tin')
        .then(r => (r.ok ? r.json() : null))
        .then((kq: { dia_chi_qr?: string; dia_chi_cong_khai?: string | null; dang_tao_tunnel?: boolean } | null) => {
          if (huy) return
          if (kq?.dia_chi_qr) {
            setDiaChi(kq.dia_chi_qr)
            setDiaChiAnh(kq.dia_chi_qr)
          }
          const dangCho = Boolean(kq?.dang_tao_tunnel && !kq?.dia_chi_cong_khai)
          setDangTaoTunnel(dangCho)
          if (dangCho && Date.now() - batDau < 15000) {
            henPoll = window.setTimeout(taiThongTin, 2000)
          }
        })
        .catch(() => {
          if (!huy) setDangTaoTunnel(false)
        })
    }

    taiThongTin()
    return () => {
      huy = true
      if (henPoll !== undefined) window.clearTimeout(henPoll)
    }
  }, [])

  // chờ người dùng gõ xong một chút rồi mới sinh lại ảnh QR, tránh gọi máy chủ sau mỗi phím
  useEffect(() => {
    if (!hopLe) return
    const hen = window.setTimeout(() => setDiaChiAnh(sach), 400)
    return () => window.clearTimeout(hen)
  }, [sach, hopLe])

  const duongAnh = `/api/qr.png?dia_chi=${encodeURIComponent(diaChiAnh)}`
  return <TheTrang>
    <h2 className="adm-tieu-de-the">Mã QR truy cập hệ thống</h2>
    <div className="adm-qr-bo-cuc">
      <div className="adm-form">
        <label>Địa chỉ mà mã QR dẫn tới
          <input type="url" value={diaChi} onChange={e => setDiaChi(e.target.value)} placeholder="https://..." />
          <small>Mã QR được sinh trực tiếp bằng Python trên máy chủ qua đường truyền công khai (hỗ trợ cả 4G/5G và mọi mạng Wi-Fi) kèm tham số <code>?qr=...</code>. Mỗi lần tắt tab và mở tab mới, khách bắt buộc phải quét mã QR lại để vào hệ thống và được tính vào thống kê lượt truy cập.</small>
        </label>
        {!hopLe && <ThongBao loai="loi">Địa chỉ phải bắt đầu bằng http:// hoặc https://</ThongBao>}
        {hopLe && dangTaoTunnel && <ThongBao loai="canh-bao">Đang khởi tạo đường truyền công khai (4G/Wi-Fi khác mạng), mã QR sẽ tự động cập nhật sau vài giây...</ThongBao>}
      </div>
      <div className="adm-qr">
        {hopLe ? <img src={duongAnh} alt="Mã QR truy cập hệ thống" width={180} height={180} /> : <div className="adm-qr-trong">Nhập địa chỉ hợp lệ để tạo mã</div>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Nut onClick={taoMaQrMoi}>Tạo mã QR mới</Nut>
          {hopLe ? <a className="adm-nut adm-nut-xanh" href={duongAnh} download="busbuss-qr.png">Tải mã QR</a> : <Nut disabled>Tải mã QR</Nut>}
        </div>
      </div>
    </div>
  </TheTrang>
}

// chức năng dashboard thống kê lượt truy cập qua mã QR theo tháng
export default function Dashboard() {
  const [thang, setThang] = useState(thangHienTai())
  const [dl, setDl] = useState<DuLieu | null>(null)
  const [loi, setLoi] = useState('')

  useEffect(() => {
    setLoi('')
    goiApi<DuLieu>(`/api/admin/dashboard?thang=${thang}`).then(setDl).catch(e => setLoi(e.message))
  }, [thang])

  const maxNgay = Math.max(1, ...(dl?.theo_ngay.map(n => n.luot) || [0]))
  const maxNhiet = Math.max(1, ...(dl?.ban_do_nhiet.flat() || [0]))

  return <>
    <div className="adm-dau-trang">
      <h1>Thống kê truy cập</h1>
      <label className="adm-chon-thang">Tháng <input type="month" value={thang} onChange={e => e.target.value && setThang(e.target.value)} /></label>
    </div>
    {loi && <ThongBao loai="loi">{loi}</ThongBao>}
    {dl && <>
      <div className="adm-luoi-so-lieu">
        <The nhan="Tổng lượt truy cập" so={dinhDangSo(dl.tong_luot)} phu="từ trước đến nay" />
        <The nhan="Tổng số người" so={dinhDangSo(dl.tong_nguoi)} phu="thiết bị khác nhau" />
        <The nhan="Hôm nay" so={dinhDangSo(dl.hom_nay)} phu="lượt quét" />
        <The nhan={`Tháng ${dl.thang}`} so={dinhDangSo(dl.luot_trong_thang)} phu={`${dinhDangSo(dl.nguoi_trong_thang)} người`} />
      </div>

      <TheTrang>
        <h2 className="adm-tieu-de-the">Lượt truy cập theo ngày trong tháng</h2>
        <div className="adm-cot" role="img" aria-label="Biểu đồ cột lượt truy cập theo ngày">
          {dl.theo_ngay.map(n => <div key={n.ngay} className="adm-cot-mot" title={`Ngày ${n.ngay}: ${n.luot} lượt`}>
            <i style={{ height: `${(n.luot / maxNgay) * 100}%` }} className={dl.ngay_cao_diem?.ngay === n.ngay ? 'cao-diem' : ''} />
            <span>{n.ngay % 5 === 0 || n.ngay === 1 ? n.ngay : ''}</span>
          </div>)}
        </div>
        <div className="adm-cao-diem">
          <div><span>Ngày cao điểm</span><strong>{dl.ngay_cao_diem ? `Ngày ${dl.ngay_cao_diem.ngay} (${dinhDangSo(dl.ngay_cao_diem.luot)} lượt)` : 'Chưa có dữ liệu'}</strong></div>
          <div><span>Giờ cao điểm</span><strong>{dl.gio_cao_diem ? `${dl.gio_cao_diem.gio}:00 - ${dl.gio_cao_diem.gio + 1}:00 (${dinhDangSo(dl.gio_cao_diem.luot)} lượt)` : 'Chưa có dữ liệu'}</strong></div>
        </div>
      </TheTrang>

      <TheTrang>
        <h2 className="adm-tieu-de-the">Thời điểm truy cập nhiều (thứ × giờ)</h2>
        <div className="adm-nhiet-khung"><div className="adm-nhiet">
          <div className="adm-nhiet-hang"><b />{Array.from({ length: 24 }, (_, g) => <span key={g}>{g % 3 === 0 ? g : ''}</span>)}</div>
          {dl.ban_do_nhiet.map((hang, i) => <div className="adm-nhiet-hang" key={i}>
            <b>{THU[i]}</b>
            {hang.map((so, g) => <i key={g} title={`${THU[i]}, ${g}h: ${so} lượt`} style={{ opacity: so ? 0.15 + 0.85 * (so / maxNhiet) : 0.05 }} />)}
          </div>)}
        </div></div>
      </TheTrang>

      <div className="adm-hai-cot">
        <TheTrang><h2 className="adm-tieu-de-the">Ngôn ngữ khách chọn</h2><BieuDoNgang du_lieu={dl.ty_le_ngon_ngu} tenHienThi={TEN_NGON_NGU} /></TheTrang>
        <TheTrang><h2 className="adm-tieu-de-the">Loại thiết bị</h2><BieuDoNgang du_lieu={dl.ty_le_thiet_bi} tenHienThi={TEN_THIET_BI} /></TheTrang>
      </div>

      <TheTrang>
        <h2 className="adm-tieu-de-the">Điểm được nghe thuyết minh nhiều nhất</h2>
        {dl.diem_nghe_nhieu_nhat.length === 0 ? <p className="adm-rong">Chưa có dữ liệu.</p> :
          <table className="adm-bang"><thead><tr><th style={{ width: 70 }}>STT</th><th>Tên điểm</th><th style={{ width: 140 }}>Số lần nghe</th></tr></thead>
            <tbody>{dl.diem_nghe_nhieu_nhat.map((d, i) => <tr key={d.ten_diem}><td className="giua">{i + 1}</td><td>{d.ten_diem}</td><td className="giua">{dinhDangSo(d.so_lan)}</td></tr>)}</tbody></table>}
      </TheTrang>
    </>}
    {/* thẻ mã QR nằm cuối trang, sau các số liệu thống kê */}
    <MaQr />
  </>
}
