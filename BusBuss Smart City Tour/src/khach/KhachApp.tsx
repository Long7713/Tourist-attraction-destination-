import { useEffect, useState } from 'react'
import './khach.css'
import { DieuHuongProvider, useDieuHuong } from './dieu-huong'
import { DuLieuProvider } from './du-lieu'
import { NgonNguProvider, useNgonNgu } from './ngon-ngu'
import { daQuetQr, layMaQrTuUrl, moKhoaTabSauKhiQuetQr } from './theo-doi'
import BanDoKhamPha from './trang/BanDoKhamPha'
import ChiTietDiem from './trang/ChiTietDiem'
import DichGiongNoi from './trang/DichGiongNoi'
import GioiThieu from './trang/GioiThieu'
import TrangChu from './trang/TrangChu'
import { BangOffline, ChonNgonNgu } from './thanh-phan/chung'
import { Footer, Header } from './thanh-phan/KhungTrang'

function ManHinhQuetQr() {
  const macDinh = `${window.location.origin}/?qr=1`
  const [diaChiQr, setDiaChiQr] = useState(macDinh)
  const [sanSangHienThi, setSanSangHienThi] = useState(false)

  useEffect(() => {
    let huy = false
    let henPoll: number | undefined
    const batDau = Date.now()

    const taiThongTin = () => {
      fetch('/api/qr/thong-tin')
        .then(r => (r.ok ? r.json() : null))
        .then((kq: { dia_chi_qr?: string; dia_chi_cong_khai?: string | null; dang_tao_tunnel?: boolean } | null) => {
          if (huy) return
          if (kq?.dia_chi_qr) setDiaChiQr(kq.dia_chi_qr)
          const daQua15Giay = Date.now() - batDau >= 15000
          if (kq?.dia_chi_cong_khai || kq?.dang_tao_tunnel === false) {
            setSanSangHienThi(true)
          } else {
            if (daQua15Giay) setSanSangHienThi(true)
            if (Date.now() - batDau < 30000) {
              henPoll = window.setTimeout(taiThongTin, 2000)
            }
          }
        })
        .catch(() => {
          if (!huy) setSanSangHienThi(true)
        })
    }

    taiThongTin()
    return () => {
      huy = true
      if (henPoll !== undefined) window.clearTimeout(henPoll)
    }
  }, [])

  return <div className="chon-ngon-ngu">
    <div className="chon-ngon-ngu-hop">
      <h1>Hãy quét mã QR bên dưới để truy cập vào BussBuss nhé !</h1>
      <div style={{ margin: '20px auto 0', padding: 16, background: '#fff', borderRadius: 16, display: 'inline-block', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
        {sanSangHienThi ? (
          <img src={"/api/qr.png?dia_chi=" + encodeURIComponent(diaChiQr)} width={220} height={220} alt="Mã QR truy cập" />
        ) : (
          <div style={{ width: 220, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontSize: 14, color: '#475569', padding: 12 }}>
            Đang khởi tạo mã QR kết nối mọi mạng...
          </div>
        )}
      </div>
    </div>
  </div>
}

function Khung() {
  const { duongDan } = useDieuHuong()
  const { ma, daChon } = useNgonNgu()
  const [daQuetQrState] = useState(() => {
    const maQrTuUrl = layMaQrTuUrl()
    if (maQrTuUrl) {
      moKhoaTabSauKhiQuetQr(daChon ? ma : null)
      return true
    }
    return daQuetQr()
  })

  if (!daQuetQrState) return <ManHinhQuetQr />
  // lần đầu vào ứng dụng khách phải chọn ngôn ngữ trước, sau đó mọi nội dung dùng ngôn ngữ đó
  if (!daChon) return <ChonNgonNgu />

  let trang: React.ReactNode
  if (duongDan === '/explore') trang = <BanDoKhamPha />
  else if (duongDan === '/live-translation') trang = <DichGiongNoi />
  else if (duongDan === '/about') trang = <GioiThieu />
  else if (duongDan.startsWith('/landmark/')) trang = <ChiTietDiem slug={decodeURIComponent(duongDan.split('/').pop() || '')} />
  else trang = <TrangChu />
  return <><BangOffline /><Header />{trang}{duongDan !== '/explore' && <Footer />}</>
}

// chức năng ứng dụng dành cho khách quét mã QR: không cần đăng nhập, dùng được cả khi offline
export default function KhachApp() {
  return <NgonNguProvider><DuLieuProvider><DieuHuongProvider><Khung /></DieuHuongProvider></DuLieuProvider></NgonNguProvider>
}
