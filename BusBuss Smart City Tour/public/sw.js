// service worker của ứng dụng khách: giúp bản đồ, dữ liệu thuyết minh và audio dùng được khi offline
const BO_NHO = 'busbuss-v2'
const BO_NHO_NGOAI = 'busbuss-ngoai-v1'
// các API chỉ đọc: ưu tiên dữ liệu mới, mất mạng thì dùng bản đã lưu
const API_DOC = ['/api/goi-offline', '/api/ngon-ngu', '/api/phien-ban']

self.addEventListener('install', e => {
  e.waitUntil(caches.open(BO_NHO).then(c => c.add('/')).catch(() => undefined).then(() => self.skipWaiting()))
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ds => Promise.all(ds.filter(k => k !== BO_NHO && k !== BO_NHO_NGOAI).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

async function mangTruoc(request, tenBoNho = BO_NHO) {
  const bo = await caches.open(tenBoNho)
  try {
    const res = await fetch(request)
    if (res.ok) bo.put(request, res.clone())
    return res
  } catch (loi) {
    const cu = await bo.match(request)
    if (cu) return cu
    throw loi
  }
}

async function boNhoTruoc(request, tenBoNho = BO_NHO) {
  const bo = await caches.open(tenBoNho)
  const co = await bo.match(request)
  if (co) return co
  const res = await fetch(request)
  // kết quả 206 (tải một phần khi phát audio) không lưu được, chỉ lưu bản đầy đủ
  if (res.status === 200 || res.type === 'opaque') bo.put(request, res.clone())
  return res
}

async function lamMoiSauCung(request) {
  const bo = await caches.open(BO_NHO)
  const co = await bo.match(request)
  const moi = fetch(request).then(res => { if (res.ok) bo.put(request, res.clone()); return res }).catch(() => co)
  return co || moi
}

self.addEventListener('fetch', e => {
  const { request } = e
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  if (url.origin !== self.location.origin) {
    // ảnh, font từ nơi khác: lưu lại ở lần xem đầu để lần sau offline vẫn thấy
    if (['image', 'font', 'style'].includes(request.destination)) e.respondWith(boNhoTruoc(request, BO_NHO_NGOAI))
    return
  }
  // trang quản trị và các API ghi/xác thực luôn đi thẳng ra mạng
  if (url.pathname.startsWith('/admin') || url.pathname.startsWith('/api/admin')) return

  if (request.mode === 'navigate') {
    e.respondWith(mangTruoc(new Request('/')).catch(() => caches.match('/')))
    return
  }
  if (API_DOC.some(p => url.pathname === p)) return e.respondWith(mangTruoc(request))
  if (url.pathname.startsWith('/api/')) return
  if (url.pathname.startsWith('/am-thanh/') || url.pathname.startsWith('/assets/')) return e.respondWith(boNhoTruoc(request))
  if (url.pathname.startsWith('/du-lieu-ban-do/')) return e.respondWith(lamMoiSauCung(request))
  if (/\.(svg|png|jpg|ico|webmanifest|css|js)$/.test(url.pathname)) e.respondWith(lamMoiSauCung(request))
})
