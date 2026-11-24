import { useCallback, useEffect, useState } from 'react'
import { goiApi, taiFile, TEN_NGON_NGU, TEN_THIET_BI, type LuotTruyCap as Luot } from '../api'
import { dinhDangGio, dinhDangSo, Nhan, Nut, TheTrang, ThongBao } from '../ui'

const SO_DONG = 20

// chức năng quản lý lượt truy cập: lọc, phân trang, xuất CSV
export default function LuotTruyCap() {
  const [tu, setTu] = useState('')
  const [den, setDen] = useState('')
  const [ngonNgu, setNgonNgu] = useState('')
  const [trang, setTrang] = useState(1)
  const [kq, setKq] = useState<{ tong: number; du_lieu: Luot[] } | null>(null)
  const [loi, setLoi] = useState('')

  const boLoc = useCallback(() => {
    const p = new URLSearchParams()
    if (tu) p.set('tu', tu)
    if (den) p.set('den', den)
    if (ngonNgu) p.set('ngon_ngu', ngonNgu)
    return p
  }, [tu, den, ngonNgu])

  useEffect(() => {
    const p = boLoc()
    p.set('trang', String(trang)); p.set('so_luong', String(SO_DONG))
    setLoi('')
    goiApi<{ tong: number; du_lieu: Luot[] }>(`/api/admin/luot-truy-cap?${p}`).then(setKq).catch(e => setLoi(e.message))
  }, [boLoc, trang])

  const xuatCsv = () => taiFile(`/api/admin/luot-truy-cap/xuat-csv?${boLoc()}`, 'luot_truy_cap.csv').catch(e => setLoi(e.message))
  const tongTrang = Math.max(1, Math.ceil((kq?.tong || 0) / SO_DONG))
  const doiLoc = (hamDat: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { hamDat(e.target.value); setTrang(1) }

  return <>
    <div className="adm-dau-trang"><h1>Quản lý lượt truy cập</h1></div>
    <TheTrang>
      <div className="adm-thanh-cong-cu">
        <span className="adm-dem">{kq ? `${dinhDangSo(kq.tong)} lượt` : '...'}</span>
        <label>Từ ngày<input type="date" value={tu} onChange={doiLoc(setTu)} /></label>
        <label>Đến ngày<input type="date" value={den} onChange={doiLoc(setDen)} /></label>
        <label>Ngôn ngữ<select value={ngonNgu} onChange={doiLoc(setNgonNgu)}>
          <option value="">Tất cả</option>
          {['vi', 'en', 'es', 'ko', 'zh', 'ru'].map(m => <option key={m} value={m}>{TEN_NGON_NGU[m]}</option>)}
        </select></label>
        <Nut onClick={xuatCsv} className="adm-day-phai">Xuất CSV</Nut>
      </div>
      {loi && <ThongBao loai="loi">{loi}</ThongBao>}
      <div className="adm-cuon-ngang"><table className="adm-bang">
        <thead><tr><th style={{ width: 70 }}>STT</th><th>Thời gian truy cập</th><th>Mã phiên (thiết bị)</th><th>Ngôn ngữ</th><th>Thiết bị</th></tr></thead>
        <tbody>
          {kq?.du_lieu.map((l, i) => <tr key={l.id}>
            <td className="giua">{(trang - 1) * SO_DONG + i + 1}</td>
            <td>{dinhDangGio(l.thoi_gian_truy_cap)}</td>
            <td><code>{l.ma_phien.slice(0, 12)}</code></td>
            <td>{l.ma_ngon_ngu ? <Nhan mau="xanh">{TEN_NGON_NGU[l.ma_ngon_ngu] || l.ma_ngon_ngu}</Nhan> : <Nhan mau="xam">Không rõ</Nhan>}</td>
            <td>{TEN_THIET_BI[l.loai_thiet_bi] || l.loai_thiet_bi}</td>
          </tr>)}
          {kq && kq.du_lieu.length === 0 && <tr><td colSpan={5} className="giua adm-rong">Không có lượt truy cập nào phù hợp.</td></tr>}
        </tbody>
      </table></div>
      <div className="adm-phan-trang">
        <Nut mau="xam" nho disabled={trang <= 1} onClick={() => setTrang(trang - 1)}>‹ Trước</Nut>
        <span>Trang {trang} / {tongTrang}</span>
        <Nut mau="xam" nho disabled={trang >= tongTrang} onClick={() => setTrang(trang + 1)}>Sau ›</Nut>
      </div>
    </TheTrang>
  </>
}
