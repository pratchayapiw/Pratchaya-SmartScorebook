import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../supabase'
import { calcGrade, fmt2 } from '../utils'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Eye, EyeOff, Download, Printer, Save, RefreshCw } from 'lucide-react'

export default function GradingTable({ classroom, subject, settings, toast }) {
  const [students, setStudents] = useState([])
  const [assignments, setAssignments] = useState([])
  const [scoreMap, setScoreMap] = useState({})   // { studentId_assignId: score }
  const [finalMap, setFinalMap] = useState({})   // { studentId: finalExamScore }
  const [gradeSetting, setGradeSetting] = useState({ collected_weight: 80, final_weight: 20, show_total: true, show_grade: true })
  const [pendingSave, setPendingSave] = useState({})
  const [saving, setSaving] = useState(false)
  const [showTotal, setShowTotal] = useState(true)
  const [showGrade, setShowGrade] = useState(true)
  const saveTimeout = useRef({})

  useEffect(() => { loadAll() }, [classroom.id, subject.id])

  const loadAll = async () => {
    const [{ data: sts }, { data: asgns }, { data: gs }] = await Promise.all([
      supabase.from('students').select('*').eq('classroom_id', classroom.id).order('number'),
      supabase.from('assignments').select('*').eq('subject_id', subject.id).order('order_num'),
      supabase.from('grade_settings').select('*').eq('classroom_id', classroom.id).single()
    ])
    setStudents(sts || [])
    setAssignments(asgns || [])
    if (gs) {
      setGradeSetting(gs)
      setShowTotal(gs.show_total)
      setShowGrade(gs.show_grade)
    } else {
      // สร้างค่าเริ่มต้น
      await supabase.from('grade_settings').insert({ classroom_id: classroom.id })
    }

    if (sts?.length && asgns?.length) {
      const studentIds = sts.map(s => s.id)
      const [{ data: scores }, { data: finals }] = await Promise.all([
        supabase.from('scores').select('*').in('student_id', studentIds),
        supabase.from('final_scores').select('*').in('student_id', studentIds)
      ])
      const sm = {}, fm = {}
      scores?.forEach(sc => { sm[`${sc.student_id}_${sc.assignment_id}`] = sc.score })
      finals?.forEach(f => { fm[f.student_id] = f.score })
      setScoreMap(sm)
      setFinalMap(fm)
    }
  }

  // คำนวณคะแนนรวมของนักเรียนหนึ่งคน
  const calcStudent = useCallback((student) => {
    const totalMax = assignments.reduce((sum, a) => sum + parseFloat(a.max_score || 0), 0)
    const totalGot = assignments.reduce((sum, a) => {
      const v = scoreMap[`${student.id}_${a.id}`]
      return sum + (v !== undefined && v !== null && v !== '' ? parseFloat(v) : 0)
    }, 0)

    const cw = gradeSetting.collected_weight
    const fw = gradeSetting.final_weight
    const collectedPct = totalMax > 0 ? (totalGot / totalMax) * cw : 0
    const finalRaw = finalMap[student.id]
    const finalPct = finalRaw !== undefined && finalRaw !== '' ? (parseFloat(finalRaw) / 100) * fw : 0
    const total = collectedPct + finalPct
    return { totalGot, totalMax, collectedPct, finalPct, total, grade: calcGrade(total) }
  }, [assignments, scoreMap, finalMap, gradeSetting])

  // debounced save
  const handleScoreChange = (studentId, assignId, val, maxScore) => {
    const key = `${studentId}_${assignId}`
    const num = parseFloat(val)

    if (val !== '' && !isNaN(num) && num > parseFloat(maxScore)) {
      toast(`คะแนนเกิน ${maxScore} ไม่ได้!`, 'error')
      return
    }

    setScoreMap(m => ({ ...m, [key]: val }))
    setPendingSave(p => ({ ...p, [key]: { studentId, assignId, val } }))

    clearTimeout(saveTimeout.current[key])
    saveTimeout.current[key] = setTimeout(async () => {
      const score = val === '' ? null : parseFloat(val)
      await supabase.from('scores').upsert(
        { student_id: studentId, assignment_id: assignId, score, updated_at: new Date().toISOString() },
        { onConflict: 'student_id,assignment_id' }
      )
      setPendingSave(p => { const np = { ...p }; delete np[key]; return np })
    }, 800)
  }

  const handleFinalChange = (studentId, val) => {
    const num = parseFloat(val)
    if (val !== '' && !isNaN(num) && num > 100) {
      toast('คะแนนปลายภาคเกิน 100!', 'error')
      return
    }
    setFinalMap(m => ({ ...m, [studentId]: val }))
    setPendingSave(p => ({ ...p, [`final_${studentId}`]: true }))
    clearTimeout(saveTimeout.current[`final_${studentId}`])
    saveTimeout.current[`final_${studentId}`] = setTimeout(async () => {
      const score = val === '' ? null : parseFloat(val)
      await supabase.from('final_scores').upsert(
        { student_id: studentId, score, updated_at: new Date().toISOString() },
        { onConflict: 'student_id' }
      )
      setPendingSave(p => { const np = { ...p }; delete np[`final_${studentId}`]; return np })
    }, 800)
  }

  const saveWeights = async () => {
    setSaving(true)
    const cw = parseInt(gradeSetting.collected_weight)
    const fw = 100 - cw
    const updated = { ...gradeSetting, collected_weight: cw, final_weight: fw, show_total: showTotal, show_grade: showGrade }
    await supabase.from('grade_settings').update(updated).eq('classroom_id', classroom.id)
    setGradeSetting(updated)
    setSaving(false)
    toast('บันทึกการตั้งค่าคะแนนแล้ว', 'success')
  }

  // ── Export Excel ──
  const exportExcel = () => {
    const headers = ['เลขที่', 'รหัส', 'ชื่อ-สกุล',
      ...assignments.map(a => `${a.name} (${a.max_score})`),
      'ปลายภาค (/100)',
      `คะแนนเก็บ ${gradeSetting.collected_weight}%`,
      `ปลายภาค ${gradeSetting.final_weight}%`,
      'รวม 100%', 'เกรด'
    ]
    const rows = students.map(s => {
      const calc = calcStudent(s)
      return [
        s.number, s.student_id, s.name,
        ...assignments.map(a => scoreMap[`${s.id}_${a.id}`] ?? ''),
        finalMap[s.id] ?? '',
        fmt2(calc.collectedPct),
        fmt2(calc.finalPct),
        fmt2(calc.total),
        calc.grade.grade
      ]
    })
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    XLSX.utils.book_append_sheet(wb, ws, classroom.name)
    XLSX.writeFile(wb, `คะแนน_${subject.name}_${classroom.name}_ปี${settings.academic_year}.xlsx`)
    toast('ดาวน์โหลด Excel แล้ว', 'success')
  }

  // ── Export PDF ──
  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    doc.addFont('https://fonts.gstatic.com/s/sarabun/v13/DtVmJx26TKEr37c9YOZqulw.woff2', 'Sarabun', 'normal')
    
    const title = `คะแนน ${subject.name} — ${classroom.name} | ปีการศึกษา ${settings.academic_year} ภาคเรียน ${settings.semester}`
    
    const headers = [['เลขที่', 'ชื่อ-สกุล',
      ...assignments.map(a => `${a.name}\n(/${a.max_score})`),
      'ปลายภาค', `เก็บ\n${gradeSetting.collected_weight}%`, `ปลาย\n${gradeSetting.final_weight}%`,
      ...(showTotal ? ['รวม 100%'] : []),
      ...(showGrade ? ['เกรด'] : [])
    ]]
    const body = students.map(s => {
      const calc = calcStudent(s)
      return [
        s.number, s.name,
        ...assignments.map(a => scoreMap[`${s.id}_${a.id}`] ?? '-'),
        finalMap[s.id] ?? '-',
        fmt2(calc.collectedPct),
        fmt2(calc.finalPct),
        ...(showTotal ? [fmt2(calc.total)] : []),
        ...(showGrade ? [calc.grade.grade] : [])
      ]
    })

    autoTable(doc, {
      head: headers,
      body,
      startY: 18,
      styles: { fontSize: 8, halign: 'center', font: 'helvetica' },
      headStyles: { fillColor: [26, 31, 46], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'left', cellWidth: 40 } },
      didDrawPage: (d) => {
        doc.setFontSize(10)
        doc.text(title, 14, 12)
      }
    })
    doc.save(`คะแนน_${subject.name}_${classroom.name}.pdf`)
    toast('ดาวน์โหลด PDF แล้ว', 'success')
  }

  const hasPending = Object.keys(pendingSave).length > 0

  return (
    <div>
      {/* Header */}
      <div className="flex-between mb-2 flex-wrap gap-2 no-print">
        <div>
          <h2>{subject.name} — {classroom.name}</h2>
          <p className="text-muted text-sm">ปีการศึกษา {settings.academic_year} ภาคเรียนที่ {settings.semester}</p>
        </div>
        <div className="flex gap-1 flex-wrap">
          {hasPending && <span className="badge badge-amber">⏳ กำลังบันทึก...</span>}
          <button className="btn btn-ghost btn-sm" onClick={loadAll}><RefreshCw size={13} /></button>
          <button className="btn btn-success btn-sm" onClick={exportExcel}><Download size={13} /> Excel</button>
          <button className="btn btn-purple btn-sm" onClick={exportPDF}><Printer size={13} /> PDF</button>
        </div>
      </div>

      {/* Settings bar */}
      <div className="card mb-2 no-print">
        <div className="flex-wrap gap-2 flex" style={{ alignItems: 'flex-end' }}>
          <div style={{ minWidth: 200 }}>
            <label className="label">สัดส่วนคะแนนเก็บ : ปลายภาค</label>
            <div className="flex gap-1" style={{ alignItems: 'center' }}>
              <select className="select" style={{ width: 80 }} value={gradeSetting.collected_weight}
                onChange={e => setGradeSetting(g => ({ ...g, collected_weight: parseInt(e.target.value), final_weight: 100 - parseInt(e.target.value) }))}>
                {[90,80,70,60,50].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
              <span className="text-muted">:</span>
              <span className="badge badge-blue">{gradeSetting.final_weight}</span>
            </div>
          </div>

          <div className="toggle-wrap">
            <button className={`toggle ${showTotal ? 'on' : ''}`} onClick={() => setShowTotal(t => !t)} />
            <span className="toggle-label"><Eye size={13} className="inline" /> แสดงรวม 100%</span>
          </div>
          <div className="toggle-wrap">
            <button className={`toggle ${showGrade ? 'on' : ''}`} onClick={() => setShowGrade(g => !g)} />
            <span className="toggle-label"><Eye size={13} className="inline" /> แสดงเกรด</span>
          </div>

          <button className="btn btn-primary btn-sm" onClick={saveWeights} disabled={saving}>
            <Save size={13} /> บันทึกการตั้งค่า
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid-4 mb-2 no-print">
        <div className="stat-card">
          <div className="stat-num">{students.length}</div>
          <div className="stat-label">นักเรียนทั้งหมด</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{assignments.length}</div>
          <div className="stat-label">งาน/ชิ้นงาน</div>
        </div>
        <div className="stat-card">
          <div className="stat-num" style={{ color: 'var(--blue)' }}>
            {students.length > 0 ? fmt2(students.reduce((s, st) => s + calcStudent(st).total, 0) / students.length) : '-'}
          </div>
          <div className="stat-label">คะแนนเฉลี่ย</div>
        </div>
        <div className="stat-card">
          <div className="stat-num" style={{ color: 'var(--green)' }}>
            {gradeSetting.collected_weight}:{gradeSetting.final_weight}
          </div>
          <div className="stat-label">สัดส่วนคะแนน</div>
        </div>
      </div>

      {/* Grade table */}
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', minWidth: 50 }}>เลขที่</th>
                <th style={{ textAlign: 'left', minWidth: 180 }}>ชื่อ-สกุล</th>
                {assignments.map(a => (
                  <th key={a.id} style={{ minWidth: 80 }}>
                    {a.name}<br />
                    <span style={{ fontFamily: 'IBM Plex Mono', fontWeight: 400, fontSize: '.75rem', opacity: .8 }}>/{a.max_score}</span>
                  </th>
                ))}
                <th style={{ minWidth: 80 }}>ปลายภาค<br /><span style={{ fontWeight: 400, fontSize: '.75rem', opacity: .8 }}>/100</span></th>
                <th style={{ minWidth: 80, background: 'var(--blue-dark)' }}>เก็บ {gradeSetting.collected_weight}%</th>
                <th style={{ minWidth: 80, background: 'var(--blue-dark)' }}>ปลาย {gradeSetting.final_weight}%</th>
                {showTotal && <th style={{ minWidth: 80, background: '#059669' }}>รวม 100%</th>}
                {showGrade && <th style={{ minWidth: 70, background: '#7c3aed' }}>เกรด</th>}
              </tr>
            </thead>
            <tbody>
              {students.length === 0 && (
                <tr><td colSpan={99} className="empty-state">ยังไม่มีนักเรียน กลับไปเพิ่มในแท็บ "นักเรียน" ก่อนครับ</td></tr>
              )}
              {students.map(s => {
                const calc = calcStudent(s)
                return (
                  <tr key={s.id}>
                    <td>{s.number}</td>
                    <td>{s.name}</td>
                    {assignments.map(a => {
                      const key = `${s.id}_${a.id}`
                      const val = scoreMap[key] ?? ''
                      const num = parseFloat(val)
                      const isOver = val !== '' && !isNaN(num) && num > parseFloat(a.max_score)
                      const isPending = pendingSave[key]
                      return (
                        <td key={a.id}>
                          <input
                            type="number"
                            className={`score-input ${isOver ? 'over' : ''} ${isPending ? '' : val !== '' ? 'saved' : ''}`}
                            value={val}
                            min={0} max={a.max_score}
                            onChange={e => handleScoreChange(s.id, a.id, e.target.value, a.max_score)}
                            placeholder="—"
                          />
                        </td>
                      )
                    })}
                    {/* ปลายภาค */}
                    <td>
                      <input
                        type="number"
                        className={`score-input ${pendingSave[`final_${s.id}`] ? '' : finalMap[s.id] !== undefined && finalMap[s.id] !== '' ? 'saved' : ''}`}
                        value={finalMap[s.id] ?? ''}
                        min={0} max={100}
                        onChange={e => handleFinalChange(s.id, e.target.value)}
                        placeholder="—"
                      />
                    </td>
                    {/* คำนวณ */}
                    <td className="text-mono">{fmt2(calc.collectedPct)}</td>
                    <td className="text-mono">{fmt2(calc.finalPct)}</td>
                    {showTotal && <td className="text-mono" style={{ fontWeight: 700, color: 'var(--green)' }}>{fmt2(calc.total)}</td>}
                    {showGrade && <td className={`text-mono ${calc.grade.cls}`}>{calc.grade.grade}</td>}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
