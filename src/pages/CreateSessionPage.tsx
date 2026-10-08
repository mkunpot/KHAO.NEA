import '@fontsource-variable/fraunces'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { CopyField } from '../components/CopyField'
import { QRCodeBlock } from '../components/QRCodeBlock'
import { SetupNotice } from '../components/SetupNotice'
import { secondLawLesson } from '../lesson'
import { currentLesson } from '../lesson/draft'
import { validateLesson } from '../lesson/validate'
import { getRealtimeAdapter, type RealtimeAdapter } from '../realtime'
import { createClassroomSession, presentPath, studentJoinUrl, teacherPath } from '../session/sessionService'
import type { SessionRecord } from '../session/sessionTypes'

const action =
  'inline-flex items-center justify-center rounded-xl px-5 py-4 text-center font-mono text-xs font-bold uppercase tracking-[0.14em] transition active:scale-[0.97]'

export default function CreateSessionPage({ adapter: injected }: { adapter?: RealtimeAdapter } = {}) {
  const adapter = injected ?? getRealtimeAdapter()
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<SessionRecord | null>(null)
  const [showQr, setShowQr] = useState(false)
  // The teacher's edited copy of the lesson (from /edit), if there is one, and whether to teach it.
  const [mine] = useState(currentLesson)
  const [useEdited, setUseEdited] = useState(true)
  const edited = mine.edited && useEdited
  const lesson = edited ? mine.lesson : secondLawLesson
  const emptyFields = useMemo(() => validateLesson(lesson).filter((problem) => problem.severity === 'warning').length, [lesson])

  if (!adapter) return <SetupNotice />

  async function create() {
    if (!adapter) return
    setCreating(true)
    setError(null)
    try {
      setSession(await createClassroomSession(adapter, lesson, { snapshot: edited }))
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      setError(
        edited && /lesson_json/.test(message)
          ? `This Supabase project is not ready for edited lessons yet. Run supabase/migrations/003_lesson_snapshot.sql in its SQL Editor (see the README), or untick “Use my edited lesson”. (${message})`
          : message,
      )
    } finally {
      setCreating(false)
    }
  }

  const joinUrl = session ? studentJoinUrl(session.sessionCode) : ''
  const unreachable = session && /^(localhost|127\.|\[::1\])/.test(new URL(joinUrl).hostname)

  return (
    <main className="bg-instrument grain relative min-h-dvh px-5 py-10">
      <div className="relative z-10 mx-auto max-w-3xl">
        <Link to="/" className="font-mono text-xs uppercase tracking-[0.14em] text-ink-dim hover:text-ink">
          ← Back to start
        </Link>
        <p className="mono-label mt-10 text-accent">New classroom session</p>
        <h1 className="mt-3 font-display text-5xl font-semibold leading-tight">Create a session</h1>

        {!session ? (
          <section className="panel mt-8 p-7">
            <p className="mono-label">Lesson</p>
            <div className="mt-3 flex items-center justify-between gap-4 rounded-2xl border-2 border-accent bg-accent/10 p-5">
              <div>
                <h2 className="font-display text-2xl font-semibold">{lesson.metadata.title}</h2>
                <p className="mt-1 text-sm text-ink-dim">
                  {lesson.metadata.durationMinutes} minutes · {lesson.steps.length} steps · {Object.keys(lesson.questions).length} live questions
                </p>
              </div>
              <span className="grid h-7 w-7 place-items-center rounded-full bg-accent font-bold text-[#1a1200]">✓</span>
            </div>
            {mine.edited && (
              <div className="mt-4 rounded-2xl border border-line-strong p-4 text-sm">
                <label className="flex cursor-pointer items-start gap-3">
                  <input type="checkbox" checked={useEdited} onChange={(e) => setUseEdited(e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--accent)]" />
                  <span>
                    <span className="font-semibold">Use my edited lesson</span>
                    <span className="mt-0.5 block text-ink-dim">
                      The words you changed in the editor will be on the projector and on every phone in this class.{' '}
                      <Link to="/edit" className="font-semibold text-accent hover:underline">
                        Edit again
                      </Link>
                    </span>
                  </span>
                </label>
                {edited && emptyFields > 0 && (
                  <p className="mt-3 text-accent">
                    ⚠ {emptyFields} {emptyFields === 1 ? 'field is' : 'fields are'} empty in your edited lesson.{' '}
                    <Link to="/edit" className="font-semibold hover:underline">
                      Take a look
                    </Link>
                  </p>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={() => void create()}
              disabled={creating}
              className={`${action} mt-6 w-full bg-accent py-5 text-sm text-[#1a1200] hover:brightness-110 disabled:opacity-60`}
            >
              {creating ? 'Creating…' : 'Create session'}
            </button>
            {error && <p className="mt-4 rounded-xl bg-bad/10 px-4 py-3 text-sm text-bad">{error}</p>}
          </section>
        ) : (
          <section className="panel animate-rise mt-8 p-7">
            <div className="grid gap-8 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <p className="mono-label">Session code</p>
                <p className="mt-2 font-mono text-5xl font-bold tracking-[0.14em] text-accent sm:text-7xl sm:tracking-[0.18em]">{session.sessionCode}</p>
                <p className="mt-4 text-sm text-ink-dim">Students scan the QR code, or open the link and type the code.</p>
                {session.lesson && <p className="mt-2 text-sm font-semibold text-accent">✎ This class runs your edited lesson.</p>}
                <CopyField value={joinUrl} className="mt-4" />
              </div>
              <QRCodeBlock value={joinUrl} size={196} className="mx-auto" />
            </div>

            {unreachable && (
              <p className="mt-6 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm leading-relaxed text-ink-dim">
                <span className="font-semibold text-accent">Phones cannot reach “localhost”.</span> Open this page via your computer’s network address (run{' '}
                <code className="font-mono text-ink">npm run dev:lan</code>), or set <code className="font-mono text-ink">VITE_PUBLIC_BASE_URL</code> in <code className="font-mono text-ink">.env.local</code>, then create a new session.
              </p>
            )}

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <Link to={teacherPath(session.sessionCode)} className={`${action} bg-accent text-[#1a1200] hover:brightness-110`}>
                Open teacher control
              </Link>
              <a href={presentPath(session.sessionCode)} target="_blank" rel="noopener" className={`${action} border border-line-strong hover:bg-surface-2`}>
                Open presentation ↗
              </a>
              <button type="button" onClick={() => setShowQr(true)} className={`${action} border border-line-strong hover:bg-surface-2`}>
                QR code
              </button>
            </div>
          </section>
        )}
      </div>

      {session && showQr && <QrOverlay code={session.sessionCode} url={joinUrl} onClose={() => setShowQr(false)} />}
    </main>
  )
}

/** Full-screen QR, for putting on a projector before the presentation starts. */
function QrOverlay({ code, url, onClose }: { code: string; url: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div role="dialog" aria-label="Join QR code" onClick={onClose} className="fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center gap-8 bg-[#04070d]/95 p-6">
      <QRCodeBlock value={url} size={Math.min(560, Math.round(Math.min(window.innerWidth, window.innerHeight) * 0.7))} />
      <div className="text-center">
        <p className="mono-label">Join the class</p>
        <p className="mt-2 font-mono text-6xl font-bold tracking-[0.2em] text-accent">{code}</p>
        <p className="mt-3 break-all font-mono text-sm text-ink-dim">{url.replace(/^https?:\/\//, '')}</p>
        <p className="mt-6 font-mono text-xs uppercase tracking-[0.16em] text-ink-faint">Click anywhere or press Esc to close</p>
      </div>
    </div>
  )
}
