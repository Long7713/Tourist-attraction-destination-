import { useCallback, useEffect, useMemo, useState } from 'react'
import { goiApi, type CapChongVung, type Diem } from '../api'
import { HopThoai, Nhan, Nut, TheTrang, ThongBao } from '../ui'

type FormDiem = Omit<Diem, 'id'> & { id?: number }

const DIEM_MOI: FormDiem = { slug: '', ten_diem: '', vi_do: 10.7769, kinh_do: 106.7009, ban_kinh_m: 100, hinh_anh: '', thu_tu: 0, dang_dung: true }

// đổi tên có dấu thành slug dùng trong đường dẫn, ví dụ "Chợ Bến Thành" -> "cho-ben-thanh"
const taoSlug = (ten: string) => ten.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

// sơ đồ phẳng các vùng kích hoạt, vẽ bằng SVG nên không cần bản đồ bên ngoài, vùng chồng nhau được tô đỏ
function SoDoVung({ diem, chongVung }: { diem: Diem[]; chongVung: CapChongVung[] }) {
  const hinh = useMemo(() => {
    const dangDung = diem.filter(d => d.dang_dung)
    if (!dangDung.length) return null
    const vi0 = dangDung.reduce((t, d) => t + d.vi_do, 0) / dangDung.length
    const kinh0 = dangDung.reduce((t, d) => t + d.kinh_do, 0) / dangDung.length
    // đổi độ sang mét quanh tâm, đủ chính xác cho phạm vi vài km
    const toa = dangDung.map(d => ({ d, x: (d.kinh_do - kinh0) * 111320 * Math.cos(vi0 * Math.PI / 180), y: -(d.vi_do - vi0) * 110574 }))
    const bien = 40
    const minX = Math.min(...toa.map(t => t.x - t.d.ban_kinh_m)) - bien, maxX = Math.max(...toa.map(t => t.x + t.d.ban_kinh_m)) + bien
    const minY = Math.min(...toa.map(t => t.y - t.d.ban_kinh_m)) - bien, maxY = Math.max(...toa.map(t => t.y + t.d.ban_kinh_m)) + bien
    return { toa, viewBox: `${minX} ${minY} ${maxX - minX} ${maxY - minY}`, co: (maxX - minX) / 55 }
  }, [diem])
  if (!hinh) return <p className="adm-rong">Chưa có điểm nào đang hiển thị.</p>
  const ten = new Set(chongVung.flatMap(c => [c.diem_a, c.diem_b]))
  return <svg className="adm-so-do" viewBox={hinh.viewBox} role="img" aria-label="Sơ đồ các vùng kích hoạt thuyết minh">
    {hinh.toa.map(({ d, x, y }, i) => <g key={d.id}>
      <circle cx={x} cy={y} r={d.ban_kinh_m} className={ten.has(d.ten_diem) ? 'vung chong' : 'vung'} />
      <circle cx={x} cy={y} r={hinh.co * 0.35} className="tam" />
      {/* nhãn xen kẽ phía trên và phía dưới để các điểm gần nhau không đè chữ lên nhau */}
      <text x={x} y={i % 2 === 0 ? y - d.ban_kinh_m - hinh.co * 0.4 : y + d.ban_kinh_m + hinh.co * 1.5} textAnchor="middle" fontSize={hinh.co * 1.5}>{d.ten_diem}</text>
    </g>)}
  </svg>
}

// chức năng quản lý địa điểm và phân vùng (tâm + bán kính kích hoạt)
export default function DiaDiem({ dieuHuong }: { dieuHuong: (duongDan: string) => void }) {
  const [tab, setTab] = useState('ds')
  const [diem, setDiem] = useState<Diem[]>([])
  const [chongVung, setChongVung] = useState<CapChongVung[]>([])
  const [form, setForm] = useState<FormDiem | null>(null)
  const [loi, setLoi] = useState('')
  const [loiForm, setLoiForm] = useState('')

  const tai = useCallback(() => goiApi<{ du_lieu: Diem[]; canh_bao_chong_vung: CapChongVung[] }>('/api/admin/diem')
    .then(kq => { setDiem(kq.du_lieu); setChongVung(kq.canh_bao_chong_vung) }).catch(e => setLoi(e.message)), [])
  useEffect(() => { tai() }, [tai])

  const luu = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form) return
    setLoiForm('')
    const { id, ...noiDung } = form
    try {
      await goiApi(id ? `/api/admin/diem/${id}` : '/api/admin/diem', { method: id ? 'PUT' : 'POST', body: { ...noiDung, hinh_anh: noiDung.hinh_anh || null } })
      setForm(null); tai()
    } catch (err) { setLoiForm((err as Error).message) }
  }

  const an = async (d: Diem) => {
    if (!confirm(`Ẩn "${d.ten_diem}" khỏi khách? Lịch sử thống kê vẫn được giữ.`)) return
    await goiApi(`/api/admin/diem/${d.id}`, { method: 'DELETE' }).then(tai).catch(e => setLoi(e.message))
  }

  const dat = <K extends keyof FormDiem>(khoa: K, gia_tri: FormDiem[K]) => setForm(f => f && { ...f, [khoa]: gia_tri })
  const diemChong = new Set(chongVung.flatMap(c => [c.diem_a, c.diem_b]))

  return <>
    <div className="adm-dau-trang"><h1>Quản lý địa điểm & phân vùng</h1></div>
    {loi && <ThongBao loai="loi">{loi}</ThongBao>}
    {chongVung.length > 0 && <ThongBao loai="canh-bao">
      Có vùng kích hoạt chồng lên nhau: {chongVung.map(c => `${c.diem_a} và ${c.diem_b} (cách ${c.khoang_cach_m} m, tổng bán kính ${c.tong_ban_kinh_m} m)`).join('; ')}.
      Khi đứng trong nhiều vùng, hệ thống chọn điểm có tâm gần nhất. Nên giảm bán kính.
    </ThongBao>}
    <TheTrang tabs={[{ ma: 'ds', nhan: 'Danh sách điểm' }, { ma: 'so-do', nhan: 'Sơ đồ vùng' }]} tabHienTai={tab} doiTab={setTab}>
      {tab === 'ds' ? <>
        <div className="adm-thanh-cong-cu"><span className="adm-dem">{diem.length} điểm</span><Nut className="adm-day-phai" onClick={() => { setLoiForm(''); setForm({ ...DIEM_MOI, thu_tu: diem.length + 1 }) }}>+ Thêm điểm</Nut></div>
        <div className="adm-cuon-ngang"><table className="adm-bang">
          <thead><tr><th>STT</th><th>Tên điểm</th><th>Tọa độ tâm</th><th>Bán kính</th><th>Trạng thái</th><th>Tác vụ</th></tr></thead>
          <tbody>{diem.map((d, i) => <tr key={d.id}>
            <td className="giua">{i + 1}</td>
            <td><b>{d.ten_diem}</b><div className="adm-phu">/landmark/{d.slug}</div></td>
            <td className="giua">{d.vi_do.toFixed(5)}, {d.kinh_do.toFixed(5)}</td>
            <td className="giua">{d.ban_kinh_m} m</td>
            <td className="giua"><div className="adm-nhan-cot">
              {d.dang_dung ? <Nhan mau="luc">Đang hiển thị</Nhan> : <Nhan mau="xam">Đã ẩn</Nhan>}
              {d.dang_dung && diemChong.has(d.ten_diem) && <Nhan mau="cam">Chồng vùng</Nhan>}
            </div></td>
            <td className="giua"><div className="adm-nhom-nut">
              <Nut nho onClick={() => dieuHuong(`/admin/noi-dung?diem=${d.id}`)}>Nội dung</Nut>
              <Nut nho mau="cam" onClick={() => { setLoiForm(''); setForm(d) }}>Sửa</Nut>
              {d.dang_dung && <Nut nho mau="do" onClick={() => an(d)}>Ẩn</Nut>}
            </div></td>
          </tr>)}</tbody>
        </table></div>
      </> : <SoDoVung diem={diem} chongVung={chongVung} />}
    </TheTrang>

    {form && <HopThoai tieuDe={form.id ? 'Sửa địa điểm' : 'Thêm địa điểm'} dong={() => setForm(null)}>
      <form onSubmit={luu} className="adm-form">
        {loiForm && <ThongBao loai="loi">{loiForm}</ThongBao>}
        <label>Tên điểm (nội bộ)<input required value={form.ten_diem} onChange={e => { dat('ten_diem', e.target.value); if (!form.id) dat('slug', taoSlug(e.target.value)) }} /></label>
        <label>Slug (đường dẫn)<input required value={form.slug} pattern="[a-z0-9]+(-[a-z0-9]+)*" title="Chữ thường không dấu, nối bằng gạch ngang" onChange={e => dat('slug', e.target.value)} /></label>
        <div className="adm-hang-2">
          <label>Vĩ độ<input type="number" step="0.0000001" min={0} max={90} required value={form.vi_do} onChange={e => dat('vi_do', Number(e.target.value))} /></label>
          <label>Kinh độ<input type="number" step="0.0000001" min={0} max={180} required value={form.kinh_do} onChange={e => dat('kinh_do', Number(e.target.value))} /></label>
        </div>
        <label>Bán kính kích hoạt: <b>{form.ban_kinh_m} m</b>
          <input type="range" min={20} max={500} step={5} value={Math.min(form.ban_kinh_m, 500)} onChange={e => dat('ban_kinh_m', Number(e.target.value))} />
          <small>GPS điện thoại sai số 10-30 m nên không nên đặt dưới khoảng 40 m.</small>
        </label>
        <div className="adm-hang-2">
          <label>Thứ tự hiển thị<input type="number" value={form.thu_tu} onChange={e => dat('thu_tu', Number(e.target.value))} /></label>
          <label>Ảnh (đường dẫn)<input value={form.hinh_anh || ''} onChange={e => dat('hinh_anh', e.target.value)} placeholder="https://..." /></label>
        </div>
        <label className="adm-hop-kiem"><input type="checkbox" checked={form.dang_dung} onChange={e => dat('dang_dung', e.target.checked)} /> Hiển thị cho khách</label>
        <div className="adm-hang-nut"><Nut type="button" mau="xam" onClick={() => setForm(null)}>Hủy</Nut><Nut type="submit">Lưu</Nut></div>
      </form>
    </HopThoai>}
  </>
}
