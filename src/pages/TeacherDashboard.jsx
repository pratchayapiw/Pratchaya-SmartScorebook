import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import * as XLSX from 'xlsx'
import {
  Plus, Trash2, BookOpen, Users, ClipboardList,
  Upload, Save, ChevronRight, Settings
} from 'lucide-react'

export default function TeacherDashboard({ settings, setSettings, onEnterClassroom, toast }) {
  const [tab, setTab] = useState('subjects')           // subjects | classrooms | students
  const [subjects, setSubjects] = useState([])
  const [classrooms, setClassrooms] = useState([])
  const [assignments, setAssignments] = useState([])
  const [students, setStudents] = useState([])
  const [selSubject, setSelSubject] = useState(null)
  const [selClassroom, setSelClassroom] = useState(null)

  // forms
  const [newSubName, setNewSubName] = useState('')
  const [newSubCode, setNewSubCode] = useState('')
  const [newClass, setNewClass] = useState({ name: '', level: '', room_number: '' })
  const [newAssign, setNewAssign] = useState({ name: '', max_score: '' })
  const [newStudent, setNewStudent] = useState({ number: '', student_id: '', name: '' })
  const [settingsDraft, setSettingsDraft] = useState(settings)
  const [showSettings, setShowSettings] = useState(false)
  const fileRef = useRef()

  // load
  useEffect(() => { loadSubjects() }, [])
  useEffect(() => { if (selSubject) { loadClassrooms(selSubject.id); loadAssignments(selSubject.id) } }, [selSubject])
  useEffect(() => { if (selClassroom) loadStudents(selClassroom.id) }, [selClassroom])

  const loadSubjects = async () => {
    const { data } = await supabase.from('subjects').select('*').order('created_at')
    setSubjects(data || [])
    if (data?.length && !selSubject) setSelSubject(data[0])
  }
  const loadClassrooms = async (subId) => {
    const { data } = await supabase.from('classrooms').select('*').eq('subject_id', subId).order('name')
    setClassrooms(data || [])
    if (data?.length) setSelClassroom(prev => data.find(c => c.id === prev?.id) || data[0])
    else setSelClassroom(null)
  }
  const loadAssignments = async (subId) => {
    const { data } = await supabase.from('assignments').select('*').eq('subject_id', subId).order('order_num')
    setAssignments(data || [])
  }
  const loadStudents = async (clId) => {
    const { data } = await supabase.from('students').select('*').eq('classroom_id', clId).order('number')
    setStudents(data || [])
  }

  // save settings
  const saveSettings = async () => {
    const { error } = await supabase.from('settings').update(settingsDraft).eq('id', settings.id)
    if (!error) { setSettings(settingsDraft); toast('บันทึกการตั้งค่าแล้ว', 'success'); setShowSettings(false) }
    else toast('เกิดข้อผิดพลาด', 'error')
  }

  // subjects
  const addSubject = async () => {
    if (!newSubName.trim()) return toast('กรุณากรอกชื่อวิชา', 'error')
    const { data, error } = await supabase.from('subjects').insert({ name: newSubName.trim(), code: newSubCode.trim() }).select().single()
    if (!error) { setSubjects(s => [...s, data]); setSelSubject(data); setNewSubName(''); setNewSubCode(''); toast('เพิ่มวิชาแล้ว', 'success') }
  }
  const delSubject = async (id) => {
    if (!confirm('ลบวิชานี้และข้อมูลทั้งหมดที่เกี่ยวข้อง?')) return
    await supabase.from('subjects').delete().eq('id', id)
    const rest = subjects.filter(s => s.id !== id)
    setSubjects(rest)
    if (selSubject?.id === id) { setSelSubject(rest[0] || null); setClassrooms([]); setAssignments([]) }
    toast('ลบวิชาแล้ว', 'success')
  }

  // assignments
  const addAssignment = async () => {
    if (!selSubject) return toast('กรุณาเลือกวิชาก่อน', 'error')
    if (!newAssign.name.trim()) return toast('กรุณากรอกชื่องาน', 'error')
    const score = parseFloat(newAssign.max_score)
    if (isNaN(score) || score <= 0) return toast('คะแนนเต็มต้องมากกว่า 0', 'error')
    const { data, error } = await supabase.from('assignments')
      .insert({ subject_id: selSubject.id, name: newAssign.name.trim(), max_score: score, order_num: assignments.length })
      .select().single()
    if (!error) { setAssignments(a => [...a, data]); setNewAssign({ name: '', max_score: '' }); toast('เพิ่มงานแล้ว', 'success') }
  }
  const delAssignment = async (id) => {
    if (!confirm('ลบงานชิ้นนี้?')) return
    await supabase.from('assignments').delete().eq('id', id)
    setAssignments(a => a.filter(x => x.id !== id))
    toast('ลบงานแล้ว', 'success')
  }

  // classrooms
  const addClassroom = async () => {
    if (!selSubject) return toast('กรุณาเลือกวิชาก่อน', 'error')
    if (!newClass.name.trim()) return toast('กรุณากรอกชื่อห้อง', 'error')
    const { data, error } = await supabase.from('classrooms')
      .insert({ subject_id: selSubject.id, ...newClass })
      .select().single()
    if (!error) {
      setClassrooms(c => [...c, data])
      setSelClassroom(data)
      setNewClass({ name: '', level: '', room_number: '' })
      toast('เพิ่มห้องเรียนแล้ว', 'success')
    }
  }
  const delClassroom = async (id) => {
    if (!confirm('ลบห้องเรียนนี้และข้อมูลนักเรียนทั้งหมด?')) return
    await supabase.from('classrooms').delete().eq('id', id)
    const rest = classrooms.filter(c => c.id !== id)
    setClassrooms(rest)
    if (selClassroom?.id === id) setSelClassroom(rest[0] || null)
    toast('ลบห้องแล้ว', 'success')
  }

  // students
  const addStudent = async () => {
    if (!selClassroom) return toast('กรุณาเลือกห้องเรียนก่อน', 'error')
    if (!newStudent.name.trim()) return toast('กรุณากรอกชื่อนักเรียน', 'error')
    const { data, error } = await supabase.from('students')
      .insert({ classroom_id: selClassroom.id, number: parseInt(newStudent.number) || null, student_id: newStudent.student_id.trim(), name: newStudent.name.trim() })
      .select().single()
    if (!error) { setStudents(s => [...s, data]); setNewStudent({ number: '', student_id: '', name: '' }); toast('เพิ่มนักเรียนแล้ว', 'success') }
  }
  const delStudent = async (id) => {
    await supabase.from('students').delete().eq('id', id)
    setStudents(s => s.filter(x => x.id !== id))
    toast('ลบนักเรียนแล้ว', 'success')
  }

  // Excel upload
  const handleExcelUpload = async (e) => {
    const file = e.target.files[0]
    if (!file || !selClassroom) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws)
        // รองรับหัว column ภาษาไทยหรืออังกฤษ
        const mapped = rows.map(r => ({
          classroom_id: selClassroom.id,
          number: parseInt(r['เลขที่'] || r['ลำดับ'] || r['number'] || r['no'] || '') || null,
          student_id: String(r['รหัส'] || r['รหัสประจำตัว'] || r['student_id'] || r['id'] || '').trim(),
          name: String(r['ชื่อ-สกุล'] || r['ชื่อ'] || r['name'] || r['fullname'] || '').trim()
        })).filter(r => r.name)

        if (!mapped.length) return toast('ไม่พบข้อมูลในไฟล์', 'error')
        const { error } = await supabase.from('students').insert(mapped)
        if (!error) { loadStudents(selClassroom.id); toast(`นำเข้า ${mapped.length} คนสำเร็จ`, 'success') }
        else toast('เกิดข้อผิดพลาดในการนำเข้า', 'error')
      } catch { toast('ไฟล์ไม่ถูกต้อง', 'error') }
    }
    reader.readAsBinaryString(file)
    e.target.value = ''
  }

  return (
    <div>
      {/* Header row */}
      <div className="flex-between mb-3 flex-wrap gap-2">
        <div>
          <h1>หน้าหลักครู</h1>
          <p className="text-muted text-sm mt-1">จัดการวิชา ห้องเรียน และนักเรียน</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowSettings(true)}>
          <Settings size={14} /> ตั้งค่าปีการศึกษา
        </button>
      </div>

      {/* Settings modal */}
      {showSettings && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowSettings(false)}>
          <div className="modal">
            <div className="modal-title">⚙️ ตั้งค่าปีการศึกษา</div>
            <div className="input-group">
              <label className="label">ปีการศึกษา</label>
              <input className="input" value={settingsDraft.academic_year || ''}
                onChange={e => setSettingsDraft(d => ({ ...d, academic_year: e.target.value }))} />
            </div>
            <div className="input-group">
              <label className="label">ภาคเรียนที่</label>
              <input className="input" value={settingsDraft.semester || ''}
                onChange={e => setSettingsDraft(d => ({ ...d, semester: e.target.value }))} />
            </div>
            <div className="flex gap-1">
              <button className="btn btn-primary" onClick={saveSettings}><Save size={14} /> บันทึก</button>
              <button className="btn btn-ghost" onClick={() => setShowSettings(false)}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${tab === 'subjects' ? 'active' : ''}`} onClick={() => setTab('subjects')}>
          📖 วิชา & งาน
        </button>
        <button className={`tab ${tab === 'classrooms' ? 'active' : ''}`} onClick={() => setTab('classrooms')}>
          🏫 ห้องเรียน
        </button>
        <button className={`tab ${tab === 'students' ? 'active' : ''}`} onClick={() => setTab('students')}>
          👥 นักเรียน
        </button>
      </div>

      {/* ─── TAB: วิชา & งาน ─── */}
      {tab === 'subjects' && (
        <div className="grid-2">
          {/* วิชา */}
          <div className="card">
            <div className="card-header">
              <span className="card-title"><BookOpen size={16} className="inline mr-1" /> รายวิชา</span>
            </div>
            <div className="input-group">
              <label className="label">ชื่อวิชา</label>
              <input className="input" placeholder="เช่น ภาษาอังกฤษ" value={newSubName}
                onChange={e => setNewSubName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addSubject()} />
            </div>
            <div className="input-group">
              <label className="label">รหัสวิชา (ไม่บังคับ)</label>
              <input className="input" placeholder="เช่น ENG001" value={newSubCode}
                onChange={e => setNewSubCode(e.target.value)} />
            </div>
            <button className="btn btn-primary btn-sm mb-2" onClick={addSubject}><Plus size={14} /> เพิ่มวิชา</button>
            <div className="divider" />
            {subjects.length === 0 && <div className="empty-state text-sm">ยังไม่มีวิชา</div>}
            {subjects.map(s => (
              <div key={s.id} className="flex-between p-1 mb-1" style={{ borderRadius: 8, background: selSubject?.id === s.id ? 'var(--blue-light)' : 'var(--paper)', cursor: 'pointer' }}
                onClick={() => setSelSubject(s)}>
                <div>
                  <div className="text-sm" style={{ fontWeight: 600 }}>{s.name}</div>
                  {s.code && <div className="text-xs text-mono text-muted">{s.code}</div>}
                </div>
                <button className="btn btn-icon btn-danger btn-sm" onClick={e => { e.stopPropagation(); delSubject(s.id) }}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>

          {/* งาน */}
          <div className="card">
            <div className="card-header">
              <span className="card-title"><ClipboardList size={16} className="inline mr-1" />
                งาน/ชิ้นงาน {selSubject ? `— ${selSubject.name}` : '(เลือกวิชาก่อน)'}
              </span>
            </div>
            {!selSubject ? (
              <div className="empty-state text-sm">เลือกวิชาทางซ้ายก่อนครับ</div>
            ) : (
              <>
                <div className="grid-2">
                  <div className="input-group">
                    <label className="label">ชื่องาน</label>
                    <input className="input" placeholder="เช่น แบบฝึกหัด 1" value={newAssign.name}
                      onChange={e => setNewAssign(a => ({ ...a, name: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && addAssignment()} />
                  </div>
                  <div className="input-group">
                    <label className="label">คะแนนเต็ม</label>
                    <input className="input" type="number" placeholder="10" value={newAssign.max_score}
                      onChange={e => setNewAssign(a => ({ ...a, max_score: e.target.value }))} />
                  </div>
                </div>
                <button className="btn btn-primary btn-sm mb-2" onClick={addAssignment}><Plus size={14} /> เพิ่มงาน</button>
                <div className="divider" />
                {assignments.length === 0 && <div className="empty-state text-sm">ยังไม่มีงาน</div>}
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left' }}>ชื่องาน</th>
                        <th>คะแนนเต็ม</th>
                        <th>ลบ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignments.map((a, i) => (
                        <tr key={a.id}>
                          <td>{i + 1}. {a.name}</td>
                          <td><span className="badge badge-blue">{a.max_score}</span></td>
                          <td>
                            <button className="btn btn-icon btn-danger btn-sm" onClick={() => delAssignment(a.id)}>
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB: ห้องเรียน ─── */}
      {tab === 'classrooms' && (
        <div className="grid-2">
          <div className="card">
            <div className="card-header">
              <span className="card-title">🏫 เพิ่มห้องเรียน</span>
            </div>
            <div className="input-group">
              <label className="label">วิชา</label>
              <select className="select" value={selSubject?.id || ''} onChange={e => setSelSubject(subjects.find(s => s.id === e.target.value))}>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label className="label">ชื่อห้อง (เช่น ม.1/1 หรือ ม.5/6)</label>
              <input className="input" placeholder="ม.1/1" value={newClass.name}
                onChange={e => setNewClass(c => ({ ...c, name: e.target.value }))} />
            </div>
            <div className="grid-2">
              <div className="input-group">
                <label className="label">ระดับชั้น</label>
                <select className="select" value={newClass.level} onChange={e => setNewClass(c => ({ ...c, level: e.target.value }))}>
                  <option value="">-- เลือก --</option>
                  {['ม.1','ม.2','ม.3','ม.4','ม.5','ม.6'].map(l => <option key={l}>{l}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label className="label">ห้องที่</label>
                <input className="input" placeholder="1" value={newClass.room_number}
                  onChange={e => setNewClass(c => ({ ...c, room_number: e.target.value }))} />
              </div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={addClassroom}><Plus size={14} /> เพิ่มห้อง</button>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">ห้องเรียนทั้งหมด — {selSubject?.name || 'เลือกวิชาก่อน'}</span>
            </div>
            {classrooms.length === 0 && <div className="empty-state text-sm">ยังไม่มีห้องเรียน</div>}
            {classrooms.map(c => (
              <div key={c.id} className="flex-between p-1 mb-1" style={{ borderRadius: 8, background: 'var(--paper)', border: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{c.name}</div>
                  {c.level && <div className="text-xs text-muted">{c.level}</div>}
                </div>
                <div className="flex gap-1">
                  <button className="btn btn-primary btn-sm" onClick={() => onEnterClassroom(c, selSubject)}>
                    เข้าชั้นเรียน <ChevronRight size={14} />
                  </button>
                  <button className="btn btn-icon btn-danger btn-sm" onClick={() => delClassroom(c.id)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── TAB: นักเรียน ─── */}
      {tab === 'students' && (
        <div>
          {/* selectors */}
          <div className="card mb-2">
            <div className="grid-2">
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="label">วิชา</label>
                <select className="select" value={selSubject?.id || ''} onChange={e => setSelSubject(subjects.find(s => s.id === e.target.value))}>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="label">ห้องเรียน</label>
                <select className="select" value={selClassroom?.id || ''} onChange={e => setSelClassroom(classrooms.find(c => c.id === e.target.value))}>
                  {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="grid-2">
            {/* เพิ่มทีละคน */}
            <div className="card">
              <div className="card-title mb-2">✍️ เพิ่มนักเรียนทีละคน</div>
              <div className="grid-3">
                <div className="input-group">
                  <label className="label">เลขที่</label>
                  <input className="input" type="number" placeholder="1" value={newStudent.number}
                    onChange={e => setNewStudent(s => ({ ...s, number: e.target.value }))} />
                </div>
                <div className="input-group" style={{ gridColumn: 'span 2' }}>
                  <label className="label">รหัสประจำตัว</label>
                  <input className="input" placeholder="12345" value={newStudent.student_id}
                    onChange={e => setNewStudent(s => ({ ...s, student_id: e.target.value }))} />
                </div>
              </div>
              <div className="input-group">
                <label className="label">ชื่อ-สกุล</label>
                <input className="input" placeholder="ด.ช. สมชาย ใจดี" value={newStudent.name}
                  onChange={e => setNewStudent(s => ({ ...s, name: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && addStudent()} />
              </div>
              <button className="btn btn-primary btn-sm" onClick={addStudent} disabled={!selClassroom}>
                <Plus size={14} /> เพิ่มนักเรียน
              </button>
            </div>

            {/* อัปโหลด Excel */}
            <div className="card">
              <div className="card-title mb-2">📂 นำเข้าจาก Excel / CSV</div>
              <p className="text-sm text-muted mb-2">
                ไฟล์ต้องมีหัวคอลัมน์: <span className="text-mono">เลขที่, รหัสประจำตัว, ชื่อ-สกุล</span><br />
                (หรือ number, student_id, name)
              </p>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleExcelUpload} />
              <button className="btn btn-amber" onClick={() => fileRef.current?.click()} disabled={!selClassroom}>
                <Upload size={14} /> เลือกไฟล์ Excel
              </button>
              {!selClassroom && <p className="text-xs text-muted mt-1">กรุณาเลือกห้องเรียนก่อน</p>}
            </div>
          </div>

          {/* รายชื่อ */}
          <div className="card mt-2">
            <div className="card-header">
              <span className="card-title">
                รายชื่อนักเรียน — {selClassroom?.name || 'ยังไม่ได้เลือกห้อง'}
                {students.length > 0 && <span className="badge badge-blue ml-1">{students.length} คน</span>}
              </span>
              {selClassroom && (
                <button className="btn btn-primary btn-sm" onClick={() => onEnterClassroom(selClassroom, selSubject)}>
                  เข้าชั้นเรียน <ChevronRight size={14} />
                </button>
              )}
            </div>
            {students.length === 0
              ? <div className="empty-state text-sm">ยังไม่มีนักเรียน</div>
              : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', width: 60 }}>เลขที่</th>
                        <th style={{ textAlign: 'left' }}>รหัส</th>
                        <th style={{ textAlign: 'left' }}>ชื่อ-สกุล</th>
                        <th width={50}>ลบ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map(s => (
                        <tr key={s.id}>
                          <td>{s.number}</td>
                          <td className="text-mono text-sm">{s.student_id}</td>
                          <td>{s.name}</td>
                          <td>
                            <button className="btn btn-icon btn-danger btn-sm" onClick={() => delStudent(s.id)}>
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            }
          </div>
        </div>
      )}
    </div>
  )
}
