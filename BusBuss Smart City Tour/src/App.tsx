import AdminApp from './admin/AdminApp'
import KhachApp from './khach/KhachApp'

// chia hai ứng dụng: trang quản trị (/admin) và ứng dụng của khách quét mã QR
export default function App() {
  const path = window.location.pathname
  return path === '/admin' || path.startsWith('/admin/') ? <AdminApp /> : <KhachApp />
}
