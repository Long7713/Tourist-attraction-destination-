import { useCallback, useEffect, useRef, useState } from 'react'
import type { Diem } from './du-lieu'
import { useNgonNgu } from './ngon-ngu'
import { ghiLuotNghe } from './theo-doi'

// chức năng phát thuyết minh: ưu tiên file audio tạo sẵn (nghe được offline), không có thì dùng giọng đọc của trình duyệt
export function useThuyetMinh() {
  const { ma, giongDoc } = useNgonNgu()
  const audio = useRef<HTMLAudioElement | null>(null)
  const [dangPhat, setDangPhat] = useState(false)
  const [slugDangPhat, setSlugDangPhat] = useState<string | null>(null)

  const dung = useCallback(() => {
    audio.current?.pause()
    audio.current = null
    if ('speechSynthesis' in window) speechSynthesis.cancel()
    setDangPhat(false)
  }, [])

  const phat = useCallback(async (diem: Diem) => {
    dung()
    setSlugDangPhat(diem.slug)
    ghiLuotNghe(diem.slug, diem.ngonNguHienThi)
    if (diem.amThanh) {
      const a = new Audio(diem.amThanh)
      audio.current = a
      a.onended = () => setDangPhat(false)
      try { await a.play(); setDangPhat(true); return } catch { audio.current = null /* chưa có file hoặc bị chặn tự phát */ }
    }
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(`${diem.ten}. ${diem.noiDung}`)
      u.lang = diem.ngonNguHienThi === ma ? giongDoc : 'vi-VN'
      u.onend = () => setDangPhat(false)
      u.onerror = () => setDangPhat(false)
      speechSynthesis.speak(u)
      setDangPhat(true)
    }
  }, [dung, ma, giongDoc])

  // rời trang hoặc đổi ngôn ngữ thì dừng đọc
  useEffect(() => dung, [dung, ma])

  return { dangPhat, slugDangPhat, phat, dung }
}
