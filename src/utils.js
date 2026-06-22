/** คำนวณเกรด 0–4.00 จากคะแนนรวม (%) */
export function calcGrade(pct) {
  if (pct >= 80) return { grade: '4.00', cls: 'grade-4' }
  if (pct >= 75) return { grade: '3.50', cls: 'grade-3' }
  if (pct >= 70) return { grade: '3.00', cls: 'grade-3' }
  if (pct >= 65) return { grade: '2.50', cls: 'grade-2' }
  if (pct >= 60) return { grade: '2.00', cls: 'grade-2' }
  if (pct >= 55) return { grade: '1.50', cls: 'grade-1' }
  if (pct >= 50) return { grade: '1.00', cls: 'grade-1' }
  return { grade: '0.00', cls: 'grade-0' }
}

/** รหัสผ่านห้อง เช่น ม.5/6 → 506, ม.1/1 → 101 */
export function roomPassword(name = '') {
  // หา pattern "ม.X/Y" หรือ "ม.XY"
  const m = name.match(/ม\.?\s*(\d+)\s*[/\/]\s*(\d+)/)
  if (m) return `${m[1]}0${m[2]}`  // 5/6 → 506
  // fallback: เอาตัวเลขออกมาเชื่อมกัน
  const nums = name.replace(/[^0-9]/g, '')
  return nums || '000'
}

/** ฟอร์แมตตัวเลขทศนิยม 2 ตำแหน่ง */
export function fmt2(n) {
  if (n === null || n === undefined || n === '') return '-'
  const num = parseFloat(n)
  return isNaN(num) ? '-' : num.toFixed(2)
}
