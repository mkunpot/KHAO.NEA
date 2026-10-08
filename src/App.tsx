import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'

// Route-level code splitting: a phone joining a class never downloads Spectacle, and
// Self-Study never downloads the Supabase client.
const Landing = lazy(() => import('./pages/Landing'))
const LessonsPage = lazy(() => import('./pages/LessonsPage'))
const CreateSessionPage = lazy(() => import('./pages/CreateSessionPage'))
const CodeEntryPage = lazy(() => import('./pages/CodeEntryPage'))
const TeacherPage = lazy(() => import('./pages/TeacherPage'))
const PresentPage = lazy(() => import('./pages/PresentPage'))
const StudentPage = lazy(() => import('./pages/StudentPage'))
const StudyPage = lazy(() => import('./pages/StudyPage'))
const EditPage = lazy(() => import('./editor/EditPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))
const Harness = import.meta.env.DEV ? lazy(() => import('./dev/Harness')) : null

function Loading() {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg">
      <div className="flex items-center gap-4" role="status" aria-label="Loading">
        <span className="h-4 w-4 animate-breathe rounded-full bg-hot" />
        <span className="h-4 w-4 animate-breathe rounded-full bg-cold" style={{ animationDelay: '0.5s' }} />
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<LessonsPage />} />
          <Route path="/lessons" element={<LessonsPage />} />
          <Route path="/lesson/second-law" element={<Landing />} />
          <Route path="/create-session" element={<CreateSessionPage />} />
          <Route path="/teacher" element={<CodeEntryPage target="/teacher" />} />
          <Route path="/teacher/:code" element={<TeacherPage />} />
          <Route path="/present" element={<CodeEntryPage target="/present" />} />
          <Route path="/present/:code" element={<PresentPage />} />
          <Route path="/student" element={<CodeEntryPage target="/student" />} />
          <Route path="/student/:code" element={<StudentPage />} />
          <Route path="/study" element={<StudyPage />} />
          <Route path="/edit" element={<EditPage />} />
          {Harness && <Route path="/__harness" element={<Harness />} />}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
