import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { calcGrade, fmt2, roomPassword } from '../utils'
import { Lock, Eye, EyeOff } from 'lucide-react'

export default function StudentView() {
  const [step, setStep] = useState('select')  // select | login | scores
  const [subjects, setSubjects] = useState([])
  const [classrooms, setClassrooms] = useState([])
  const [selSubject, setSelSubject] = useState('')
  const [selClassroom, setSelClassroom] = useState(null)
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [scores, setScores] = useState(null)
  const [settings, setSettings] = useState({ academic_year: '', semester: '' })

  useEffect(() => {
    supabase.from('subjects').select('*').order('created_at').then(({ data }) => setSubjects(data || []))
    supabase.from('settings').select('*').single().then(({ data }) => data && setSettings(data))
  }, [])

  const handleSubjectChange = async (subjectId) => {
    setSelSubject(subjectId)
    setSelClassroom(null)
    setError('')
    const { data } = await supabase.from('classrooms').select('*').eq('subject_id', subjectId).order('name')
    setClassrooms(data || [])
  }

  const handleLogin = async () => {
    setError('')
    if (!selClassroom) return setError('กรุณาเลือกห้องเรียน')
    const correct = roomPassword(selClassroom.name)
    if (password.trim() !== correct) {
      return setError('รหัสผ่านไม่ถูกต้อง กรุณาถามคุณครูอีกครั้ง')
    }
    // load scores
    const { data: students } = await supabase.from('students')
      .select('*').eq('classroom_id', selClassroom.id).order('number')
    const { data: assignments } = await supabase.from('assignments')
      .select('*').eq('subject_id', selSubject).order('order_num')
    const studentIds = students?.map(s => s.id) || []
    const [{ data: scoresData }, { data: finalsData }] = await Promise.all([
      supabase.from('scores').select('*').in('student_id', studentIds),
      supabase.from('final_scores').select('*').in('student_id', studentIds)
    ])
    const { data: gs } = await supabase.from('grade_settings').select('*').eq('classroom_id', selClassroom.id).single()

    setScores({ students: students || [], assignments: assignments || [], scoresData: scoresData || [], finalsData: finalsData || [], gs })
    setStep('scores')
  }

  if (step === 'scores' && scores) {
    return <ScoreDisplay scores={scores} classroom={selClassroom} subject={subjects.find(s => s.id === selSubject)} settings={settings} onBack={() => { setStep('select'); setPassword(''); setScores(null) }} />
  }

  return (
    <div className="student-shell">
      <div className="student-card">
        <div className="student-title">
          <div style={{ fontSize: '2.5rem', marginBottom: '.5rem' }}>📊</div>
          <h2>ดูคะแนนของฉัน</h2>
          <p>ครูปรัชญา ทรงบรรพต · ปีการศึกษา {settings.academic_year}/{settings.semester}</p>
        </div>

        <div className="input-group">
          <label className="label">วิชา</label>
          <select className="select" value={selSubject} onChange={e => handleSubjectChange(e.target.value)}>
            <option value="">-- เลือกวิชา --</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name} {s.code ? `(${s.code})` : ''}</option>)}
          </select>
        </div>

        <div className="input-group">
          <label className="label">ห้องเรียน</label>
          <select className="select" value={selClassroom?.id || ''} onChange={e => setSelClassroom(classrooms.find(c => c.id === e.target.value) || null)} disabled={!selSubject}>
            <option value="">-- เลือกห้อง --</option>
            {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="input-group">
          <label className="label"><Lock size={13} className="inline" /> รหัสผ่านเข้าห้อง</label>
          <div className="flex gap-1">
            <input
              className="input"
              type={showPw ? 'text' : 'password'}
              placeholder="กรอกรหัสผ่านที่ครูให้"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
            <button className="btn btn-ghost btn-icon" onClick={() => setShowPw(v => !v)}>
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {error && <div className="badge badge-red mb-2" style={{ display: 'block', borderRadius: 8, padding: '.5rem .75rem' }}>⚠️ {error}</div>}

        <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleLogin} disabled={!selClassroom || !password}>
          เข้าดูคะแนน →
        </button>
      </div>
    </div>
  )
}

function ScoreDisplay({ scores, classroom, subject, settings, onBack }) {
  const { students, assignments, scoresData, finalsData, gs } = scores
  const cw = gs?.collected_weight ?? 80
  const fw = gs?.final_weight ?? 20

  const getScore = (studentId, assignId) => {
    const r = scoresData.find(s => s.student_id === studentId && s.assignment_id === assignId)
    return r?.score
  }
  const getFinal = (studentId) => {
    const r = finalsData?.find(s => s.student_id === studentId)
    return r?.score
  }

  const calcRow = (student) => {
    const totalMax = assignments.reduce((s, a) => s + parseFloat(a.max_score || 0), 0)
    const totalGot = assignments.reduce((s, a) => {
      const v = getScore(student.id, a.id)
      return s + (v != null ? parseFloat(v) : 0)
    }, 0)
    const collectedPct = totalMax > 0 ? (totalGot / totalMax) * cw : 0
    const finalRaw = getFinal(student.id)
    const finalPct = finalRaw != null ? (parseFloat(finalRaw) / 100) * fw : 0
    const total = collectedPct + finalPct
    return { totalGot, totalMax, collectedPct, finalPct, total, grade: calcGrade(total) }
  }

  return (
    <div className="student-shell" style={{ alignItems: 'flex-start', paddingTop: '2rem' }}>
      <div style={{ width: '100%', maxWidth: 900, background: 'var(--white)', borderRadius: 16, padding: '1.5rem', boxShadow: '0 25px 50px rgba(0,0,0,.3)' }}>
        <div className="flex-between mb-3 flex-wrap gap-2">
          <div>
            <h2 style={{ color: 'var(--blue)' }}>📊 ตารางคะแนน</h2>
            <p className="text-muted text-sm">{subject?.name} — {classroom?.name} | ปีการศึกษา {settings.academic_year}/{settings.semester}</p>
            <p className="text-xs text-muted">สัดส่วน: คะแนนเก็บ {cw}% + ปลายภาค {fw}%</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onBack}>← กลับ</button>
        </div>

        <div className="table-wrap">
          <table className="my-score-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>เลขที่</th>
                <th style={{ textAlign: 'left' }}>ชื่อ-สกุล</th>
                {assignments.map(a => <th key={a.id}>{a.name}<br /><span style={{ fontWeight: 400, fontSize: '.75rem' }}>/{a.max_score}</span></th>)}
                <th>ปลายภาค<br />/100</th>
                <th>เก็บ {cw}%</th>
                <th>ปลาย {fw}%</th>
                {gs?.show_total !== false && <th style={{ color: '#34d399' }}>รวม 100%</th>}
                {gs?.show_grade !== false && <th style={{ color: '#c4b5fd' }}>เกรด</th>}
              </tr>
            </thead>
            <tbody>
              {students.map(s => {
                const calc = calcRow(s)
                return (
                  <tr key={s.id}>
                    <td>{s.number}</td>
                    <td>{s.name}</td>
                    {assignments.map(a => {
                      const v = getScore(s.id, a.id)
                      return <td key={a.id} className="text-mono">{v != null ? v : '—'}</td>
                    })}
                    <td className="text-mono">{getFinal(s.id) != null ? getFinal(s.id) : '—'}</td>
                    <td className="text-mono">{fmt2(calc.collectedPct)}</td>
                    <td className="text-mono">{fmt2(calc.finalPct)}</td>
                    {gs?.show_total !== false && <td className="text-mono" style={{ fontWeight: 700, color: 'var(--green)' }}>{fmt2(calc.total)}</td>}
                    {gs?.show_grade !== false && <td className={`text-mono ${calc.grade.cls}`}>{calc.grade.grade}</td>}
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
