/**
 * DEV-ONLY visual-QA harness (lives in the scratch copy; never shipped).
 *
 *   /__harness?view=try                       practice room: teacher + projector + phone side by side, live and in sync
 *   /__harness?view=present|student|teacher   one screen with its own seeded in-memory classroom
 *       &started=1 &step=3 &q=open|results|answer &timer=30 &joined=24 &n=18 &sim=forward|reverse
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { SessionGate } from '../components/SessionGate'
import { fridgeRoomLesson, secondLawLesson } from '../lesson'
import { cursorPositions, positionAt, questionIdOf } from '../lesson/cursor'
import { currentLesson } from '../lesson/draft'
import type { LessonDefinition } from '../lesson/types'
import { TeacherConsole } from '../pages/TeacherPage'
import { PresentationRenderer } from '../renderers/presentation/PresentationRenderer'
import { StudentRenderer } from '../renderers/student/StudentRenderer'
import { SessionProvider, useSession } from '../session/SessionProvider'
import { initialSessionState } from '../session/sessionReducer'
import { createClassroomSession } from '../session/sessionService'
import { reduceSession } from '../session/sessionReducer'
import { planNext, type ScriptSettings } from '../session/script'
import { stateOf, type SessionRecord } from '../session/sessionTypes'
import { useTeacherSettings } from '../session/teacherSettings'
import type { ClassroomEvent } from '../realtime/events'
import { MemoryRealtimeAdapter } from '../test/MemoryRealtimeAdapter'

const NAMES = ['Blue Fox', 'Amber Owl', 'Quiet Otter', 'Swift Heron', 'Bright Lynx', 'Calm Panda', 'Lucky Gecko', 'Brave Falcon', 'Silver Koala', 'Misty Marten', 'Cosmic Ibis', 'Nimble Orca']
const nameOf = (i: number) => `${NAMES[i % NAMES.length]}${i >= NAMES.length ? ' ' + (Math.floor(i / NAMES.length) + 1) : ''}`

type Role = 'teacher' | 'presenter' | 'student'
interface Shared {
  adapter: MemoryRealtimeAdapter
  sessionId: string
  code: string
  /** The lesson this practice class runs: the teacher's edited copy from /edit if there is one. */
  lesson: LessonDefinition
}

function selectedLesson(): LessonDefinition {
  return new URLSearchParams(window.location.search).get('lesson') === fridgeRoomLesson.id ? fridgeRoomLesson : secondLawLesson
}

export default function Harness() {
  const params = new URLSearchParams(window.location.search)
  const view = params.get('view') ?? 'try'
  if (view === 'try') return <Try />
  if (params.get('shared') === '1') return <SharedView view={view} />
  return <Seeded view={view} />
}

const screenOf = (view: string): { role: Role; child: ReactNode } =>
  view === 'present'
    ? { role: 'presenter', child: <PresentationRenderer /> }
    : view === 'student'
      ? { role: 'student', child: <StudentRenderer /> }
      : { role: 'teacher', child: <TeacherConsole /> }

// ── one screen, its own seeded classroom ────────────────────────────────────

function useSeeded() {
  const lesson = selectedLesson()
  const adapter = useMemo(() => new MemoryRealtimeAdapter(), [])
  const [code, setCode] = useState<string | null>(null)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    let cancelled = false
    void (async () => {
      const record = await createClassroomSession(adapter, lesson)
      const state = initialSessionState(lesson)
      state.started = p.get('started') === '1' || p.has('step') || p.has('q')
      const step = Number(p.get('step') ?? 0)
      state.currentStep = step
      const stepIndex = cursorPositions(lesson)[step]?.stepIndex ?? 0
      const qid = questionIdOf(lesson.steps[stepIndex]!)
      const q = p.get('q')
      if (q && qid) {
        state.activeQuestionId = qid
        state.questionOpen = q === 'open'
        state.questionTimerS = Number(p.get('timer') ?? 0)
        state.resultsVisible = q === 'results' || q === 'answer'
        state.answerRevealed = q === 'answer'
      }
      const sim = p.get('sim')
      if (sim === 'forward' || sim === 'reverse') state.sim = { ...state.sim, mode: sim, runId: Date.now() }

      const joined = Number(p.get('joined') ?? p.get('n') ?? 0)
      for (let i = 0; i < joined; i++) {
        await adapter.joinSession({ sessionId: record.id, participant: { id: `seed-${i}`, name: nameOf(i) } })
      }
      const n = Number(p.get('n') ?? 0)
      if (n && qid) {
        const question = lesson.questions[qid]!
        await adapter.publishSessionState(record.id, { ...state, started: true, questionOpen: true, activeQuestionId: qid }, 1)
        for (let i = 0; i < n; i++) {
          const correct = question.correctOptionId
          const others = question.options.filter((o) => o.id !== correct)
          const pick = Math.random() < 0.58 ? correct : (others[Math.floor(Math.random() * others.length)]?.id ?? correct)
          await adapter.submitResponse({ sessionId: record.id, participantId: `seed-${i}`, questionId: qid, answer: pick })
        }
      }
      await adapter.publishSessionState(record.id, state, 2)
      if (!cancelled) setCode(record.sessionCode)
    })()
    return () => {
      cancelled = true
    }
  }, [adapter])
  return { adapter, code }
}

function Seeded({ view }: { view: string }) {
  const { adapter, code } = useSeeded()
  const lesson = selectedLesson()
  if (!code) return <div className="p-6 text-ink-dim">seeding…</div>
  const { role, child } = screenOf(view)
  return (
    <>
      <SessionProvider code={code} role={role} lesson={lesson} adapter={adapter}>
        <SessionGate>{child}</SessionGate>
      </SessionProvider>
      {role !== 'teacher' && (
        <SessionProvider code={code} role="teacher" lesson={lesson} adapter={adapter}>
          <TeacherBridge />
        </SessionProvider>
      )}
    </>
  )
}

/** Dev only: drive the teacher side from the console, e.g. `await __teacher({ type: 'START_LESSON' })`. */
function TeacherBridge() {
  const { dispatch } = useSession()
  ;(window as unknown as { __teacher?: typeof dispatch }).__teacher = dispatch
  return null
}

// ── practice room: the three screens of a class, live, in one window ────────

const sharedOf = (): Shared | undefined => (window.parent as unknown as { __shared?: Shared }).__shared

/** Runs inside one of the practice room's iframes and joins the classroom that the parent page created. */
function SharedView({ view }: { view: string }) {
  const shared = sharedOf()
  if (!shared) return <div className="p-6 text-ink-dim">Open /__harness?view=try</div>
  const { role, child } = screenOf(view)
  return (
    <SessionProvider code={shared.code} role={role} lesson={shared.lesson} adapter={shared.adapter}>
      <SessionGate>{child}</SessionGate>
    </SessionProvider>
  )
}

/** Simulated classmates: they fill the waiting room and, when voting opens, answer at random moments. */
function useClassmates(shared: Shared | null) {
  const [count, setCount] = useState(0)
  const mates = useRef<string[]>([])

  useEffect(() => {
    if (!shared) return
    const { adapter, sessionId, lesson: classLesson } = shared
    const timers: number[] = []
    let answering: string | null = null
    const off = adapter.subscribeToSessionState(sessionId, {
      onState: (record) => {
        if (!record.questionOpen || !record.activeQuestionId) {
          timers.splice(0).forEach((t) => window.clearTimeout(t))
          answering = null
          return
        }
        if (answering === record.activeQuestionId) return
        answering = record.activeQuestionId
        const question = classLesson.questions[record.activeQuestionId]
        if (!question) return
        const spreadMs = (record.questionTimerS > 0 ? Math.max(3, record.questionTimerS - 5) : 20) * 1000
        for (const id of mates.current) {
          const wrong = question.options.filter((o) => o.id !== question.correctOptionId)
          const answer = Math.random() < 0.55 ? question.correctOptionId : (wrong[Math.floor(Math.random() * wrong.length)]?.id ?? question.correctOptionId)
          timers.push(
            window.setTimeout(() => void adapter.submitResponse({ sessionId, participantId: id, questionId: question.id, answer }), 1000 + Math.random() * spreadMs),
          )
        }
      },
    })
    return () => {
      off()
      timers.forEach((t) => window.clearTimeout(t))
    }
  }, [shared])

  const add = useCallback(
    async (n: number) => {
      if (!shared) return
      for (let i = 0; i < n && mates.current.length < 38; i++) {
        const id = `mate-${mates.current.length}`
        await shared.adapter.joinSession({ sessionId: shared.sessionId, participant: { id, name: nameOf(mates.current.length) } })
        mates.current.push(id)
        setCount(mates.current.length)
        await new Promise((resolve) => setTimeout(resolve, 60))
      }
    },
    [shared],
  )
  return { count, add }
}

function Try() {
  const lesson = selectedLesson()
  const adapter = useMemo(() => new MemoryRealtimeAdapter(), [])
  const [shared, setShared] = useState<Shared | null>(null)
  const [big, setBig] = useState<'teacher' | 'projector' | null>(null)
  const [guideOpen, setGuideOpen] = useState(false)
  const [teacherVisible, setTeacherVisible] = useState(true)
  const [currentStep, setCurrentStep] = useState(0)
  const [sessionRecord, setSessionRecord] = useState<SessionRecord | null>(null)
  const [settings] = useTeacherSettings()
  const { count, add } = useClassmates(shared)
  // The edited lesson (if any) goes into the session exactly as it does for a real class, so the three
  // screens below read it from the session — like phones — and never from this browser's draft.
  const [mine] = useState(() => currentLesson(lesson))

  useEffect(() => {
    let cancelled = false
    void createClassroomSession(adapter, mine.lesson, { snapshot: mine.edited }).then((record) => {
      if (cancelled) return
      const next = { adapter, sessionId: record.id, code: record.sessionCode, lesson: mine.lesson }
      ;(window as unknown as { __shared?: Shared }).__shared = next
      setShared(next)
    })
    return () => {
      cancelled = true
    }
  }, [adapter, mine])

  useEffect(() => {
    if (!shared) return
    return shared.adapter.subscribeToSessionState(shared.sessionId, {
      onState: (record) => {
        setSessionRecord(record)
        setCurrentStep(positionAt(shared.lesson, record.currentStep).stepIndex)
      },
    })
  }, [shared])

  if (!shared) return <div className="p-6 text-ink-dim">starting the practice room…</div>
  const lessonQuery = lesson.id === fridgeRoomLesson.id ? '&lesson=fridge-room' : ''
  const src = (view: string) => `/__harness?view=${view}&shared=1${lessonQuery}`
  const editHref = `/edit?step=${currentStep + 1}${lessonQuery ? lessonQuery.replace('&', '&') : ''}`

  return (
    <div className="practice-room grid h-dvh grid-rows-[auto_minmax(0,1fr)] gap-3 p-3 text-ink">
      <header className="practice-header flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-3 py-2">
        <div className="flex items-center gap-4">
          <a href="/lessons" className="rounded-lg border border-line-strong px-3 py-1.5 text-xs font-semibold text-ink-dim transition hover:bg-surface-2 hover:text-ink">
            ← Lessons
          </a>
          <h1 className="flex items-baseline gap-2 font-display text-xl font-semibold leading-none sm:text-2xl">
            โหมดซ้อม <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-ink-dim">Practice mode</span>
          </h1>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <button
            type="button"
            onClick={() => setGuideOpen(true)}
            className="grid size-8 place-items-center rounded-full border border-line-strong font-display text-lg font-semibold text-ink-dim transition hover:border-cold hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cold"
            aria-label="วิธีใช้โหมดซ้อม"
            title="วิธีใช้โหมดซ้อม"
          >
            ?
          </button>
          <span className="text-ink-dim">
            เพื่อน <b className="text-ink">{count}</b>
          </span>
          {[5, 15, 30].map((n) => (
            <button key={n} type="button" onClick={() => void add(n)} className="rounded-lg border border-line-strong px-3 py-1 font-mono text-xs font-bold hover:bg-surface-2">
              +{n}
            </button>
          ))}
        </div>
      </header>

      <div className={`practice-screens grid min-h-0 gap-3 max-xl:grid-cols-1 max-xl:min-h-auto ${teacherVisible ? 'grid-cols-[minmax(380px,1.1fr)_minmax(0,1.4fr)_390px]' : 'grid-cols-[minmax(0,1fr)_390px]'}`}>
        {teacherVisible && (
          <Pane
            title="ครู · Teacher"
            editHref={editHref}
            actions={
              <button
                type="button"
                onClick={() => {
                  setBig(null)
                  setTeacherVisible(false)
                }}
                className="text-xs text-ink-dim hover:text-ink"
              >
                ซ่อนจอครู
              </button>
            }
            expanded={big === 'teacher'}
            onToggle={() => setBig(big === 'teacher' ? null : 'teacher')}
          >
            <iframe title="teacher" src={src('teacher')} className="absolute inset-0 h-full w-full border-0" />
          </Pane>
        )}

        <div className="flex min-h-0 flex-col gap-3">
          <Pane
            title="จอโปรเจกเตอร์ · Projector"
            editHref={editHref}
            expanded={big === 'projector'}
            onToggle={() => setBig(big === 'projector' ? null : 'projector')}
            className={`practice-pane--projector !border-[#d8e1ec] !bg-white ${big === 'projector' ? '' : 'aspect-video'}`}
          >
            <ScaledFrame title="projector" src={src('present')} width={1280} height={720} layoutKey={big} />
          </Pane>
          {!teacherVisible && sessionRecord && <PracticeControls shared={shared} session={sessionRecord} settings={settings} onShowTeacher={() => setTeacherVisible(true)} />}
        </div>

        <Pane title="มือถือนักเรียน · Phone" editHref={editHref}>
          <PhoneFrame src={`${src('student')}&phoneFrame=1`} />
        </Pane>
      </div>
      {guideOpen && <HowTo onClose={() => setGuideOpen(false)} />}
    </div>
  )
}

/** The full teacher remote remains available below the projector when the full teacher view is hidden. */
function PracticeControls({ shared, session, settings, onShowTeacher }: { shared: Shared; session: SessionRecord; settings: ScriptSettings; onShowTeacher: () => void }) {
  const beat = planNext(stateOf(session), shared.lesson, settings)
  const position = positionAt(shared.lesson, session.currentStep)
  const [sending, setSending] = useState(false)

  const send = async (events: ClassroomEvent[]) => {
    if (sending) return
    setSending(true)
    try {
      let current = shared.adapter.sessions.get(shared.sessionId) ?? session
      for (const event of events) {
        const nextState = reduceSession(stateOf(current), event, shared.lesson)
        const next = { ...current, ...nextState, version: current.version + 1 }
        await shared.adapter.publishSessionState(next.id, nextState, next.version)
        current = next
      }
    } finally {
      setSending(false)
    }
  }

  const advance = () => {
    if (!beat.disabled) void send(beat.events(Date.now()))
  }
  const back = () => void send([{ type: 'PREVIOUS_STEP' }])
  const skip = () => void send([{ type: 'GO_TO_STEP', stepIndex: position.stepIndex + 1 }])
  const backDisabled = sending || !session.started || session.currentStep === 0
  const skipDisabled = sending || !session.started || position.stepIndex >= shared.lesson.steps.length - 1

  return (
    <section className="panel practice-controls flex shrink-0 flex-wrap items-center gap-2 px-3 py-2">
      <button type="button" onClick={onShowTeacher} className="rounded-lg border border-line-strong px-3 py-1.5 text-xs font-semibold text-ink-dim transition hover:bg-surface-2 hover:text-ink">
        แสดงจอครู
      </button>
      <div className="grid min-w-[19rem] flex-1 grid-cols-[auto_1fr_auto] gap-2">
        <button
          type="button"
          aria-label="Back"
          disabled={backDisabled}
          onClick={back}
          className="rounded-lg border border-line-strong px-3 text-sm font-semibold text-ink-dim transition hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-35"
        >
          ← <span className="hidden sm:inline">Back</span>
        </button>
        <button
          type="button"
          disabled={Boolean(beat.disabled) || sending}
          onClick={advance}
          title={beat.hint}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-[#1a1200] transition hover:brightness-110 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {sending ? 'Updating…' : beat.label}
        </button>
        <button
          type="button"
          disabled={skipDisabled}
          onClick={skip}
          className="rounded-lg border border-line-strong px-3 text-sm font-semibold text-ink-dim transition hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-35"
        >
          Skip<span className="hidden sm:inline"> step</span> →
        </button>
      </div>
    </section>
  )
}

function Pane({ title, editHref, actions, expanded, onToggle, className = '', children }: { title: string; editHref?: string; actions?: ReactNode; expanded?: boolean; onToggle?: () => void; className?: string; children: ReactNode }) {
  return (
    <section className={`practice-pane flex min-h-0 flex-col overflow-hidden rounded-xl border border-line bg-surface ${expanded ? 'fixed inset-3 z-50 shadow-2xl' : 'relative'} ${className}`}>
      <div className="flex shrink-0 items-center justify-between px-3 py-2">
        <span className="mono-label text-[10px]">{title}</span>
        <div className="flex items-center gap-3">
          {editHref && <a href={editHref} className="text-xs text-ink-dim hover:text-accent">แก้ไขสไลด์นี้ ✎</a>}
          {actions}
          {onToggle && (
            <button type="button" onClick={onToggle} className="text-xs text-ink-dim hover:text-ink">
              {expanded ? 'ย่อกลับ ✕' : 'ขยาย ⤢'}
            </button>
          )}
        </div>
      </div>
      <div className="relative min-h-0 flex-1 bg-black">{children}</div>
    </section>
  )
}

/** An iframe that keeps a fixed layout size (e.g. a 1280×720 "projector") and is shrunk to fit its pane. */
function ScaledFrame({ title, src, width, height, layoutKey }: { title: string; src: string; width: number; height: number; layoutKey: unknown }) {
  const box = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState({ scale: 0.5, left: 0, top: 0 })
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => {
      const scale = Math.min(el.clientWidth / width, el.clientHeight / height)
      setFit({ scale, left: (el.clientWidth - width * scale) / 2, top: (el.clientHeight - height * scale) / 2 })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [width, height, layoutKey])
  return (
    <div ref={box} className="absolute inset-0">
      <iframe
        title={title}
        src={src}
        className="absolute border-0"
        style={{ width, height, left: fit.left, top: fit.top, transform: `scale(${fit.scale})`, transformOrigin: 'top left' }}
      />
    </div>
  )
}

/** A fixed mobile viewport inside a physical device shell, scaled without changing the student's responsive layout. */
function PhoneFrame({ src }: { src: string }) {
  const box = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.7)
  const device = { width: 414, height: 874 }

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => setScale(Math.min((el.clientWidth - 32) / device.width, (el.clientHeight - 44) / device.height, 1))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={box} className="absolute inset-0 grid place-items-center overflow-hidden bg-[#17263a] px-4 pb-3 pt-8">
      <div
        className="shrink-0"
        style={{ width: device.width * scale, height: device.height * scale }}
      >
        <div
          className="relative rounded-[3.2rem] bg-[#e7eef6] p-[9px] shadow-[0_24px_52px_rgb(0_0_0_/_0.38),0_0_0_2px_rgb(255_255_255_/_0.45),inset_0_0_0_1px_rgb(57_73_95_/_0.55)]"
          style={{ width: device.width, height: device.height, transform: `scale(${scale})`, transformOrigin: 'top left' }}
        >
          <div className="relative h-full overflow-hidden rounded-[2.65rem] bg-black ring-1 ring-[#26364c]">
            <iframe title="phone" src={src} className="absolute inset-0 h-full w-full border-0" />
            <div className="pointer-events-none absolute left-1/2 top-2 h-6 w-28 -translate-x-1/2 rounded-full bg-[#27384f] shadow-sm" aria-hidden />
            <div className="pointer-events-none absolute bottom-2 left-1/2 h-1.5 w-28 -translate-x-1/2 rounded-full bg-white/85" aria-hidden />
          </div>
        </div>
      </div>
    </div>
  )
}

function HowTo({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-[#02050c]/70 p-4 backdrop-blur-sm" role="presentation" onMouseDown={onClose}>
      <section className="w-full max-w-2xl rounded-2xl border border-line-strong bg-surface p-5 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="practice-guide-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mono-label">โหมดซ้อม</p>
            <h2 id="practice-guide-title" className="mt-1 font-display text-2xl font-semibold">วิธีลอง flow</h2>
          </div>
          <button type="button" onClick={onClose} className="grid size-8 place-items-center rounded-full border border-line text-lg text-ink-dim hover:bg-surface-2 hover:text-ink" aria-label="ปิดวิธีใช้">
            ×
          </button>
        </div>
        <ol className="mt-5 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-ink-dim">
          <li>
            เริ่มที่<b className="text-ink">จอครู (ซ้าย)</b> — กดปุ่มใหญ่ <b className="text-ink">Start lesson</b> แล้วกดปุ่มใหญ่ต่อไปเรื่อย ๆ (คลิกในจอครูก่อน จะใช้ Space / → แทนก็ได้)
          </li>
          <li>
            <b className="text-ink">จอกลาง = โปรเจกเตอร์</b> เปลี่ยนตามที่ครูกดเอง (ห้องรอ → สไลด์ → โหวต → ผลลัพธ์) — กด “ขยาย” เพื่อดูเต็มจอ
          </li>
          <li>
            <b className="text-ink">ขวา = มือถือนักเรียน</b> — พอครูกด Open voting จะเห็นปุ่มสี แตะเพื่อตอบ (ไม่ตอบก็ได้ จะเห็น “Time’s up”)
          </li>
          <li>
            กด <b className="text-ink">+5 / +15 / +30</b> ด้านบนเพื่อเติมเพื่อนร่วมชั้นจำลอง: ห้องรอจะเต็ม และพวกเขาจะตอบสุ่มทุกครั้งที่เปิดโหวต
          </li>
          <li>ใต้จอครูมี “Settings” ไว้ปรับเวลานับถอยหลัง / ปิดโหวตเองเมื่อทุกคนตอบ</li>
        </ol>
      </section>
    </div>
  )
}
