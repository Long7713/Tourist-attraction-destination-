import { useState } from 'react'
import { goiApi, luuPhien } from '../api'
import { Nut, ThongBao } from '../ui'

// chức năng đăng nhập trang quản trị
export default function DangNhap({ khiThanhCong }: { khiThanhCong: () => void }) {
  const [tenDangNhap, setTenDangNhap] = useState('')
  const [matKhau, setMatKhau] = useState('')
  const [loi, setLoi] = useState('')
  const [dangGui, setDangGui] = useState(false)

  const gui = async (e: React.FormEvent) => {
    e.preventDefault()
    setDangGui(true); setLoi('')
    try {
      const kq = await goiApi<{ token: string; ho_ten: string }>('/api/admin/dang-nhap', { method: 'POST', body: { ten_dang_nhap: tenDangNhap, mat_khau: matKhau } })
      luuPhien(kq.token, kq.ho_ten)
      khiThanhCong()
    } catch (err) {
      setLoi((err as Error).message)
    } finally {
      setDangGui(false)
    }
  }

  return <div className="adm-trang-dang-nhap">
    <form className="adm-the adm-form-dang-nhap" onSubmit={gui}>
      <div className="adm-the-noi-dung">
        <div className="adm-thuong-hieu">BUSBUSS</div>
        <h1>Đăng nhập quản trị</h1>
        {loi && <ThongBao loai="loi">{loi}</ThongBao>}
        <label>Tên đăng nhập<input value={tenDangNhap} onChange={e => setTenDangNhap(e.target.value)} autoComplete="username" required autoFocus /></label>
        <label>Mật khẩu<input type="password" value={matKhau} onChange={e => setMatKhau(e.target.value)} autoComplete="current-password" required /></label>
        <Nut type="submit" disabled={dangGui}>{dangGui ? 'Đang đăng nhập...' : 'Đăng nhập'}</Nut>
      </div>
    </form>
  </div>
}
