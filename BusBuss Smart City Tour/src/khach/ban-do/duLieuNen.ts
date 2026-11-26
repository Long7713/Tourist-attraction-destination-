// dữ liệu nền bản đồ TP.HCM dạng GeoJSON do backend Python xuất từ OpenStreetMap, vẽ hoàn toàn trên máy khách, không cần dịch vụ bản đồ bên ngoài

export type HinhHoc = {
  // mỗi phần tử là một đường hoặc một vòng, tọa độ đã đổi sang hệ Mercator chuẩn hóa 0..1 dạng [x0, y0, x1, y1, ...]
  vong: Float64Array[]
  khung: [number, number, number, number]
  hang: number
}
export type DuLieuNen = {
  duong: HinhHoc[]; nuoc: HinhHoc[]; congVien: HinhHoc[]; toaNha: HinhHoc[]; coDuLieu: boolean
  // khung bao toàn bộ dữ liệu đường (hệ Mercator chuẩn hóa), bản đồ không cho kéo hoặc thu nhỏ ra ngoài khung này
  khungDuLieu: [number, number, number, number] | null
  // còn lớp dữ liệu đang tải thì vẫn vẽ phần đã có, không báo thiếu dữ liệu
  dangTai: boolean
}

export const mercX = (kinhDo: number) => (kinhDo + 180) / 360
export const mercY = (viDo: number) => {
  const s = Math.sin((viDo * Math.PI) / 180)
  return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)
}
export const kinhDoTuX = (x: number) => x * 360 - 180
export const viDoTuY = (y: number) => (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI

// độ rộng nét vẽ theo cấp đường: càng lớn càng quan trọng
const HANG_DUONG: Record<string, number> = {
  motorway: 5, trunk: 5, primary: 4, secondary: 3, tertiary: 2, residential: 1, unclassified: 1, living_street: 1, pedestrian: 0,
}

type Toa = number[]
function doiVong(vong: Toa[]): Float64Array {
  const kq = new Float64Array(vong.length * 2)
  vong.forEach(([kinh, vi], i) => { kq[2 * i] = mercX(kinh); kq[2 * i + 1] = mercY(vi) })
  return kq
}
function tinhKhung(vong: Float64Array[]): HinhHoc['khung'] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const v of vong) for (let i = 0; i < v.length; i += 2) {
    if (v[i] < minX) minX = v[i]; if (v[i] > maxX) maxX = v[i]
    if (v[i + 1] < minY) minY = v[i + 1]; if (v[i + 1] > maxY) maxY = v[i + 1]
  }
  return [minX, minY, maxX, maxY]
}

type DacTrung = { properties?: { highway?: string } | null; geometry: { type: string; coordinates: any } | null }

function phanTich(json: { features?: DacTrung[] }): HinhHoc[] {
  const kq: HinhHoc[] = []
  for (const f of json.features ?? []) {
    const g = f.geometry
    if (!g) continue
    let vong: Float64Array[] = []
    if (g.type === 'LineString') vong = [doiVong(g.coordinates)]
    else if (g.type === 'MultiLineString') vong = g.coordinates.map(doiVong)
    else if (g.type === 'Polygon') vong = g.coordinates.map(doiVong)
    else if (g.type === 'MultiPolygon') vong = g.coordinates.flatMap((p: Toa[][]) => p.map(doiVong))
    else continue
    if (vong.length) kq.push({ vong, khung: tinhKhung(vong), hang: HANG_DUONG[f.properties?.highway ?? ''] ?? 1 })
  }
  return kq
}

async function taiLop(ten: string): Promise<HinhHoc[]> {
  try {
    const res = await fetch(`/du-lieu-ban-do/${ten}.geojson`)
    // máy chủ dev có thể trả index.html cho đường dẫn không có thật, nên kiểm tra cả loại nội dung
    if (!res.ok || (res.headers.get('content-type') || '').includes('text/html')) return []
    return phanTich(await res.json())
  } catch { return [] }
}

const RONG: DuLieuNen = { duong: [], nuoc: [], congVien: [], toaNha: [], coDuLieu: false, khungDuLieu: null, dangTai: true }
let nenHienTai: DuLieuNen = RONG
let daBatDauTai = false
const nguoiNghe = new Set<(n: DuLieuNen) => void>()

function tinhKhungDuLieu(duong: HinhHoc[]): DuLieuNen['khungDuLieu'] {
  // chỉ tính theo đường, vì sông trong OpenStreetMap là các đường rất dài kéo ra xa ngoài vùng đã xuất
  return duong.length
    ? duong.reduce<[number, number, number, number]>((k, h) => [Math.min(k[0], h.khung[0]), Math.min(k[1], h.khung[1]), Math.max(k[2], h.khung[2]), Math.max(k[3], h.khung[3])], [Infinity, Infinity, -Infinity, -Infinity])
    : null
}

// tải các lớp lần lượt từ lớp quan trọng nhất, mỗi lớp xong là bản đồ vẽ thêm ngay, khách không phải chờ tải hết mới thấy bản đồ
async function batDauTai() {
  daBatDauTai = true
  const thuTu: [string, keyof Pick<DuLieuNen, 'duong' | 'nuoc' | 'congVien' | 'toaNha'>][] = [
    ['duong_chinh', 'duong'], ['nuoc', 'nuoc'], ['duong_phu', 'duong'], ['duong', 'duong'], ['cong_vien', 'congVien'], ['toa_nha', 'toaNha'],
  ]
  for (const [ten, nhom] of thuTu) {
    const moi = await taiLop(ten)
    const gop = { ...nenHienTai, [nhom]: [...nenHienTai[nhom], ...moi] }
    nenHienTai = { ...gop, khungDuLieu: tinhKhungDuLieu(gop.duong), coDuLieu: gop.duong.length + gop.nuoc.length + gop.congVien.length + gop.toaNha.length > 0, dangTai: ten !== 'toa_nha' }
    nguoiNghe.forEach(cb => cb(nenHienTai))
  }
}

// đăng ký nhận dữ liệu nền, gọi ngay với phần đã có và gọi lại mỗi khi tải thêm được một lớp
export function dangKyDuLieuNen(cb: (n: DuLieuNen) => void): () => void {
  nguoiNghe.add(cb)
  cb(nenHienTai)
  if (!daBatDauTai) void batDauTai()
  return () => { nguoiNghe.delete(cb) }
}
