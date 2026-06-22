import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import TeacherDashboard from './pages/TeacherDashboard'
import GradingTable from './pages/GradingTable'
import StudentView from './pages/StudentView'
import { useToast } from './useToast'
import { BookOpen } from 'lucide-react'

export default function App() {
  const [page, setPage] = useState('teacher')   // 'teacher' | 'grading' | 'student'
  const [settings, setSettings] = useState({ academic_year: '2568', semester: '1' })
  const [currentClassroom, setCurrentClassroom] = useState(null)
  const [currentSubject, setCurrentSubject] = useState(null)
  const { toast, ToastContainer } = useToast()

  // โหลด settings
  useEffect(() => {
    supabase.from('settings').select('*').single().then(({ data }) => {
      if (data) setSettings(data)
    })
  }, [])

  // ตรวจ URL path → student view
  useEffect(() => {
    if (window.location.pathname === '/student') setPage('student')
  }, [])

  const enterClassroom = (classroom, subject) => {
    setCurrentClassroom(classroom)
    setCurrentSubject(subject)
    setPage('grading')
  }

  if (page === 'student') return <StudentView />

  return (
    <div className="app-shell">
      {/* Topbar */}
      <header className="topbar no-print">
        <div>
          <div className="topbar-title">📚 สมุดเก็บคะแนนอิเล็กทรอนิกส์</div>
          <div className="topbar-sub">ครูปรัชญา ทรงบรรพต · ปีการศึกษา {settings.academic_year} ภาคเรียนที่ {settings.semester}</div>
        </div>
        <div className="flex gap-1">
          {page === 'grading' && (
            <button className="btn btn-ghost btn-sm" onClick={() => setPage('teacher')}>
              ← กลับหน้าหลัก
            </button>
          )}
          <a href="/student" target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
            <BookOpen size={14} /> หน้านักเรียน
          </a>
        </div>
      </header>

      <main className="main-content">
        {page === 'teacher' && (
          <TeacherDashboard
            settings={settings}
            setSettings={setSettings}
            onEnterClassroom={enterClassroom}
            toast={toast}
          />
        )}
        {page === 'grading' && currentClassroom && (
          <GradingTable
            classroom={currentClassroom}
            subject={currentSubject}
            settings={settings}
            toast={toast}
          />
        )}
      </main>

      <ToastContainer />
    </div>
  )
}
