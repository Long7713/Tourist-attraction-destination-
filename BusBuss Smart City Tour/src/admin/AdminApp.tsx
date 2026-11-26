import { useCallback, useEffect, useState } from 'react'
import './admin.css'
import { layTenAdmin, layToken, xoaPhien } from './api'
import Dashboard from './trang/Dashboard'
import DangNhap from './trang/DangNhap'
import DiaDiem from './trang/DiaDiem'
import LuotTruyCap from './trang/LuotTruyCap'
import NoiDung from './trang/NoiDung'

const MENU = [
  { to: '/admin', nhan: 'Thống kê truy cập' },
  { to: '/admin/luot-truy-cap', nhan: 'Quản lý lượt truy cập' },
  { to: '/admin/dia-diem', nhan: 'Quản lý địa điểm & phân vùng' },
  { to: '/admin/noi-dung', nhan: 'Quản lý nội dung thuyết minh' },
]

// chức năng khung trang quản trị: kiểm tra đăng nhập, thanh menu, chuyển trang không tải lại
export default function AdminApp() {
  const [duongDan, setDuongDan] = useState(window.location.pathname.replace(/\/$/, '') || '/admin')
  const [tim, setTim] = useState(window.location.search)
  const [daDangNhap, setDaDangNhap] = useState(!!layToken())

  const dieuHuong = useCallback((url: string) => {
    window.history.pushState({}, '', url)
    const u = new URL(url, window.location.origin)
    setDuongDan(u.pathname.replace(/\/$/, '') || '/admin'); setTim(u.search)
  }, [])

  useEffect(() => {
    const khiLui = () => { setDuongDan(window.location.pathname.replace(/\/$/, '') || '/admin'); setTim(window.location.search) }
    const khiHetPhien = () => setDaDangNhap(false)
    window.addEventListener('popstate', khiLui)
    window.addEventListener('admin-het-phien', khiHetPhien)
    return () => { window.removeEventListener('popstate', khiLui); window.removeEventListener('admin-het-phien', khiHetPhien) }
  }, [])

  useEffect(() => { document.title = 'Quản trị BusBuss' }, [])

  if (!daDangNhap) return <div className="adm"><DangNhap khiThanhCong={() => setDaDangNhap(true)} /></div>

  const ten = layTenAdmin()
  let trang: React.ReactNode
  if (duongDan === '/admin/luot-truy-cap') trang = <LuotTruyCap />
  else if (duongDan === '/admin/dia-diem') trang = <DiaDiem dieuHuong={dieuHuong} />
  else if (duongDan === '/admin/noi-dung') trang = <NoiDung key={tim} diemBanDau={Number(new URLSearchParams(tim).get('diem')) || null} />
  else trang = <Dashboard />

  return <div className="adm adm-khung">
    <aside className="adm-thanh-ben">
      <div className="adm-nguoi-dung">
        <span className="adm-avatar">{ten.charAt(0).toUpperCase()}</span>
        <div><strong>Hệ thống quản lý</strong><small><i /> Online</small></div>
      </div>
      <nav>
        {MENU.map(m => <a key={m.to} href={m.to} className={duongDan === m.to ? 'dang-chon' : ''}
          onClick={e => { e.preventDefault(); dieuHuong(m.to) }}>{m.nhan}</a>)}
      </nav>
      <div className="adm-chan-thanh-ben">
        <button onClick={() => { xoaPhien(); setDaDangNhap(false) }}>Đăng xuất</button>
      </div>
    </aside>
    <div className="adm-chinh">
      <header className="adm-thanh-tren"><span className="adm-thuong-hieu">BUSBUSS SMART CITY TOUR</span></header>
      <main className="adm-noi-dung">{trang}</main>
    </div>
  </div>
}
