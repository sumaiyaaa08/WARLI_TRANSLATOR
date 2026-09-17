import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ProgressProvider } from './context/ProgressContext'
import './index.css'
import LearnPage from './pages/LearnPage'
import LessonPlayer from './pages/LessonPlayer'
import TeacherDashboard from './pages/TeacherDashboard'
import TranslatePage from './pages/TranslatePage'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ProgressProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LearnPage />} />
          <Route path="/lesson/:lessonId" element={<LessonPlayer />} />
          <Route path="/teacher" element={<TeacherDashboard />} />
          <Route path="/translate" element={<TranslatePage />} />
        </Routes>
      </BrowserRouter>
    </ProgressProvider>
  </StrictMode>,
)
