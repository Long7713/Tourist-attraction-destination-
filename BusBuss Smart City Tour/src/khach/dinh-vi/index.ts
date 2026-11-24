import { useCallback, useEffect, useRef, useState } from 'react'

export type ViTri = { lat: number; lng: number; doChinhXac?: number }

// khoảng cách giữa hai tọa độ theo công thức haversine, đơn vị mét (cùng công thức với backend)
export function khoangCachM(a: ViTri, b: ViTri): number {
  const r = 6371e3, p1 = a.lat * Math.PI / 180, p2 = b.lat * Math.PI / 180
  const dp = (b.lat - a.lat) * Math.PI / 180, dl = (b.lng - a.lng) * Math.PI / 180
  const x = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2
  return r * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

type DiemVung = { slug: string; viDo: number; kinhDo: number; banKinh: number }

// chức năng phân vùng: tìm điểm mà vị trí khách đang nằm trong vùng bán kính, nhiều vùng chồng nhau thì lấy tâm gần nhất
export function diemTrongVung<T extends DiemVung>(viTri: ViTri, danhSach: T[]): T | null {
  let tot: T | null = null
  let khoangTot = Infinity
  for (const d of danhSach) {
    const k = khoangCachM(viTri, { lat: d.viDo, lng: d.kinhDo })
    if (k <= d.banKinh && k < khoangTot) { tot = d; khoangTot = k }
  }
  return tot
}

export type TrangThaiGps = 'idle' | 'loading' | 'active' | 'error'

// chức năng định vị: dùng GPS của thiết bị (chạy được cả khi offline), có chế độ đặt vị trí giả để demo
export function useViTri() {
  const [viTri, setViTri] = useState<ViTri | null>(null)
  const [trangThai, setTrangThai] = useState<TrangThaiGps>('idle')
  const [viTriGia, setViTriGia] = useState(false)
  const [hienPopupCaiDat, setHienPopupCaiDat] = useState(false)
  const idTheoDoi = useRef<number | null>(null)
  const daYeuCau = useRef(false)
  const trangThaiRef = useRef<TrangThaiGps>('idle')
  const viTriGiaRef = useRef(false)
  trangThaiRef.current = trangThai
  viTriGiaRef.current = viTriGia

  const dung = useCallback(() => {
    if (idTheoDoi.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(idTheoDoi.current)
    idTheoDoi.current = null
  }, [])

  const bat = useCallback((imLang = false) => {
    daYeuCau.current = true
    const thanhCong = (lat: number, lng: number, doChinhXac?: number) => {
      setViTri({ lat, lng, doChinhXac })
      setTrangThai('active')
      setHienPopupCaiDat(false)
    }
    const layViTriDuPhongQuaMang = async () => {
      try {
        const r = await fetch('https://get.geojs.io/v1/ip/geo.json')
        if (r.ok) {
          const d = (await r.json()) as { latitude?: string | number; longitude?: string | number }
          const lat = Number(d.latitude)
          const lng = Number(d.longitude)
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            thanhCong(lat, lng, 150)
            return true
          }
        }
      } catch { /* bỏ qua lỗi mạng */ }
      return false
    }
    const xuLyTuChoiQuyen = async () => {
      if (!window.isSecureContext) {
        if (!(await layViTriDuPhongQuaMang())) thanhCong(10.7726, 106.6981, 120)
        return
      }
      setTrangThai('error')
      setHienPopupCaiDat(true)
    }

    if (!navigator.geolocation) {
      void xuLyTuChoiQuyen()
      return
    }
    dung()
    setViTriGia(false)
    if (!imLang || trangThaiRef.current !== 'error') setTrangThai('loading')
    idTheoDoi.current = navigator.geolocation.watchPosition(
      p => thanhCong(p.coords.latitude, p.coords.longitude, p.coords.accuracy),
      err => {
        if (err.code !== 1) {
          // người dùng đã bật quyền vị trí nhưng GPS phần cứng trong nhà/máy tính chưa bắt được vệ tinh -> chuyển sang định vị Wi-Fi/hệ điều hành
          dung()
          idTheoDoi.current = navigator.geolocation.watchPosition(
            p2 => thanhCong(p2.coords.latitude, p2.coords.longitude, p2.coords.accuracy),
            async err2 => {
              if (err2.code !== 1) {
                if (!(await layViTriDuPhongQuaMang())) thanhCong(10.7726, 106.6981, 120)
              } else {
                await xuLyTuChoiQuyen()
              }
            },
            { enableHighAccuracy: false, maximumAge: 300000, timeout: 10000 },
          )
        } else {
          void xuLyTuChoiQuyen()
        }
      },
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 7000 },
    )
  }, [dung])

  // tự động kiểm tra lại khi người dùng từ Cài đặt quay về ứng dụng hoặc vừa bật quyền chia sẻ vị trí
  useEffect(() => {
    const thuLaiNeuCan = () => {
      if (daYeuCau.current && !viTriGiaRef.current && trangThaiRef.current === 'error') {
        bat(true)
      }
    }
    const khiDoiTrangThaiTab = () => {
      if (document.visibilityState === 'visible') thuLaiNeuCan()
    }
    document.addEventListener('visibilitychange', khiDoiTrangThaiTab)
    window.addEventListener('focus', thuLaiNeuCan)

    let quyenStatus: PermissionStatus | null = null
    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then(status => {
          quyenStatus = status
          status.onchange = () => {
            if (status.state === 'granted' && daYeuCau.current && !viTriGiaRef.current && trangThaiRef.current !== 'active') {
              bat(true)
            } else {
              thuLaiNeuCan()
            }
          }
        })
        .catch(() => { /* trình duyệt không hỗ trợ permissions API */ })
    }

    return () => {
      document.removeEventListener('visibilitychange', khiDoiTrangThaiTab)
      window.removeEventListener('focus', thuLaiNeuCan)
      if (quyenStatus) quyenStatus.onchange = null
    }
  }, [bat])

  // đặt vị trí thủ công (chế độ demo), dừng theo dõi GPS thật để không bị ghi đè
  const datViTriGia = useCallback((v: ViTri) => {
    dung()
    setViTriGia(true); setViTri(v); setTrangThai('active'); setHienPopupCaiDat(false)
  }, [dung])

  const tatViTriGia = useCallback(() => {
    dung()
    setViTriGia(false); setViTri(null); setTrangThai('idle')
  }, [dung])

  useEffect(() => dung, [dung])
  return {
    viTri,
    trangThai,
    viTriGia,
    hienPopupCaiDat,
    dongPopupCaiDat: () => setHienPopupCaiDat(false),
    bat: () => bat(false),
    datViTriGia,
    tatViTriGia,
  }
}
