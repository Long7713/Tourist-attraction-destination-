import { useCallback, useEffect, useState } from 'react'
import { goiApi, type Diem, type NoiDungNgonNgu } from '../api'
import { Nhan, Nut, TheTrang, ThongBao } from '../ui'

type BanSoan = { tieu_de: string; mo_ta_ngan: string; noi_dung: string; trang_thai: 'nhap' | 'da_dang' }

const tuNoiDung = (n: NoiDungNgonNgu): BanSoan => ({
  tieu_de: n.tieu_de || '', mo_ta_ngan: n.mo_ta_ngan || '', noi_dung: n.noi_dung || '', trang_thai: n.trang_thai || 'nhap',
})

function NhanTrangThai({ n }: { n: NoiDungNgonNgu }) {
  if (n.thieu) return <Nhan mau="do">Thiếu</Nhan>
  return n.trang_thai === 'da_dang' ? <Nhan mau="luc">Đã đăng</Nhan> : <Nhan mau="cam">Nháp</Nhan>
}

// chức năng quản lý nội dung thuyết minh đa ngôn ngữ của từng điểm
export default function NoiDung({ diemBanDau }: { diemBanDau: number | null }) {
  const [danhSachDiem, setDanhSachDiem] = useState<Diem[]>([])
  const [diemId, setDiemId] = useState<number | null>(diemBanDau)
  const [noiDung, setNoiDung] = useState<NoiDungNgonNgu[]>([])
  const [ma, setMa] = useState('vi')
  const [ban, setBan] = useState<BanSoan>({ tieu_de: '', mo_ta_ngan: '', noi_dung: '', trang_thai: 'nhap' })
  const [daSua, setDaSua] = useState(false)
  const [thongBao, setThongBao] = useState<{ loai: 'loi' | 'ok'; nd: string } | null>(null)
  const [dangXuLy, setDangXuLy] = useState('')
  const [phienAudio, setPhienAudio] = useState(0)

  useEffect(() => {
    goiApi<{ du_lieu: Diem[] }>('/api/admin/diem').then(kq => {
      setDanhSachDiem(kq.du_lieu)
      setDiemId(hienTai => hienTai ?? kq.du_lieu[0]?.id ?? null)
    }).catch(e => setThongBao({ loai: 'loi', nd: e.message }))
  }, [])

  const tai = useCallback((id: number, maGiu?: string) =>
    goiApi<{ noi_dung: NoiDungNgonNgu[] }>(`/api/admin/diem/${id}/noi-dung`).then(kq => {
      setNoiDung(kq.noi_dung)
      const dangChon = kq.noi_dung.find(n => n.ma_ngon_ngu === (maGiu || 'vi'))
      if (dangChon) { setMa(dangChon.ma_ngon_ngu); setBan(tuNoiDung(dangChon)); setDaSua(false) }
    }).catch(e => setThongBao({ loai: 'loi', nd: e.message })), [])

  useEffect(() => { if (diemId) { setThongBao(null); tai(diemId, 'vi') } }, [diemId, tai])

  const chonNgonNgu = (m: string) => {
    if (daSua && !confirm('Nội dung đang sửa chưa lưu, bỏ thay đổi?')) return
    const n = noiDung.find(x => x.ma_ngon_ngu === m)!
    setMa(m); setBan(tuNoiDung(n)); setDaSua(false); setThongBao(null)
  }
  const sua = <K extends keyof BanSoan>(khoa: K, gia_tri: BanSoan[K]) => { setBan(b => ({ ...b, [khoa]: gia_tri })); setDaSua(true) }
  const hienTai = noiDung.find(n => n.ma_ngon_ngu === ma)

  const chay = async (ten: string, viec: () => Promise<string>) => {
    if (!diemId) return
    setDangXuLy(ten); setThongBao(null)
    try {
      const nd = await viec()
      await tai(diemId, ma)
      setPhienAudio(v => v + 1)
      setThongBao({ loai: 'ok', nd })
    } catch (e) { setThongBao({ loai: 'loi', nd: (e as Error).message }) }
    finally { setDangXuLy('') }
  }

  const luu = (e: React.FormEvent) => {
    e.preventDefault()
    chay('luu', async () => {
      await goiApi(`/api/admin/diem/${diemId}/noi-dung/${ma}`, { method: 'PUT', body: { ...ban, mo_ta_ngan: ban.mo_ta_ngan || null } })
      return 'Đã lưu nội dung.'
    })
  }
  const dich = () => {
    if (hienTai && !hienTai.thieu && !confirm('Ghi đè bản hiện có bằng bản dịch tự động (sẽ ở trạng thái Nháp)?')) return
    chay('dich', async () => {
      await goiApi(`/api/admin/diem/${diemId}/noi-dung/${ma}/dich-tu-dong`, { method: 'POST' })
      return 'Đã dịch tự động từ tiếng Việt và lưu ở trạng thái Nháp. Hãy xem lại rồi chuyển sang Đã đăng.'
    })
  }
  const taoAudio = () => chay('audio', async () => {
    await goiApi(`/api/admin/diem/${diemId}/noi-dung/${ma}/tao-am-thanh`, { method: 'POST' })
    return 'Đã tạo file audio.'
  })

  return <>
    <div className="adm-dau-trang">
      <h1>Nội dung thuyết minh</h1>
      <label className="adm-chon-thang">Địa điểm
        <select value={diemId ?? ''} onChange={e => { if (!daSua || confirm('Bỏ thay đổi chưa lưu?')) setDiemId(Number(e.target.value)) }}>
          {danhSachDiem.map(d => <option key={d.id} value={d.id}>{d.ten_diem}{d.dang_dung ? '' : ' (đã ẩn)'}</option>)}
        </select>
      </label>
    </div>
    {thongBao && <ThongBao loai={thongBao.loai}>{thongBao.nd}</ThongBao>}
    {noiDung.length > 0 && <TheTrang
      tabs={noiDung.map(n => ({ ma: n.ma_ngon_ngu, nhan: n.thieu ? `${n.ten} (thiếu)` : n.ten }))} tabHienTai={ma} doiTab={chonNgonNgu}>
      <div className="adm-thanh-cong-cu">
        <span className="adm-dem">{hienTai?.ten}</span>{hienTai && <NhanTrangThai n={hienTai} />}
        {hienTai?.am_thanh_cu && <Nhan mau="cam">Audio đã cũ, cần tạo lại</Nhan>}
        {ma !== 'vi' && <Nut mau="luc" className="adm-day-phai" disabled={!!dangXuLy} onClick={dich}>{dangXuLy === 'dich' ? 'Đang dịch...' : 'Dịch tự động từ tiếng Việt'}</Nut>}
      </div>
      <form onSubmit={luu} className="adm-form">
        <label>Tiêu đề<input required maxLength={200} value={ban.tieu_de} onChange={e => sua('tieu_de', e.target.value)} /></label>
        <label>Mô tả ngắn (hiện ở danh sách điểm)<input maxLength={300} value={ban.mo_ta_ngan} onChange={e => sua('mo_ta_ngan', e.target.value)} /></label>
        <label>Nội dung thuyết minh<textarea required rows={9} value={ban.noi_dung} onChange={e => sua('noi_dung', e.target.value)} /></label>
        <label>Trạng thái
          <select value={ban.trang_thai} onChange={e => sua('trang_thai', e.target.value as BanSoan['trang_thai'])}>
            <option value="nhap">Nháp (khách chưa thấy, dùng tiếng Việt thay thế)</option>
            <option value="da_dang">Đã đăng (hiện cho khách)</option>
          </select>
        </label>
        <div className="adm-hang-nut">
          <Nut type="submit" disabled={!!dangXuLy || !daSua}>{dangXuLy === 'luu' ? 'Đang lưu...' : 'Lưu nội dung'}</Nut>
          <Nut type="button" mau="cam" disabled={!!dangXuLy || daSua || !hienTai || hienTai.thieu} onClick={taoAudio}
            title={daSua ? 'Hãy lưu nội dung trước khi tạo audio' : undefined}>{dangXuLy === 'audio' ? 'Đang tạo audio...' : 'Tạo audio'}</Nut>
        </div>
        {hienTai?.co_am_thanh && <div className="adm-audio"><span>Nghe thử audio hiện có</span>
          <audio controls src={`/am-thanh/${diemId}_${ma}.mp3?v=${phienAudio}`} /></div>}
      </form>
    </TheTrang>}
  </>
}
