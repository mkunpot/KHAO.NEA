/**
 * Teacher controller — a remote with ONE big button.
 *
 * The button always does the next sensible thing (start the lesson, run the simulation, open voting,
 * show the results, reveal the next part, move on) and says what that is, so the teacher never has to
 * decide which button to press. Questions finish by themselves when time runs out or everyone has
 * answered. Everything else (timer length, manual controls, jumping around) lives under Settings.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ConnectionBadge } from '../components/ConnectionBadge'
import { CopyField } from '../components/CopyField'
import { CountdownRing } from '../components/CountdownRing'
import { RichText } from '../components/Math'
import { optionStyle, Shape } from '../components/optionStyle'
import { positionAt, questionBlockOf, simulationBlockOf, stepAt } from '../lesson/cursor'
import type { ClassroomEvent } from '../realtime/events'
import { percentOf, tallyResponses, type Tally } from '../renderers/results'
import { useSessionSimulation } from '../renderers/useSessionSimulation'
import { autoFinishReason, EVERYONE_ANSWERED_DELAY_MS } from '../session/autoFinish'
import { useSession } from '../session/SessionProvider'
import { planAfter, planNext, type Beat, type BeatKind, type ScriptSettings } from '../session/script'
import { presentPath, studentJoinUrl } from '../session/sessionService'
import { stateOf, type QuestionClock, type SessionRecord } from '../session/sessionTypes'
import { TIMER_CHOICES, useTeacherSettings } from '../session/teacherSettings'
import { useCountdown } from '../session/useCountdown'
import type { Question } from '../lesson/types'
import { ThermalContactSimulation } from '../simulations/thermal-contact/ThermalContactSimulation'
import { ClassroomRoute } from './ClassroomRoute'

export default function TeacherPage() {
  return (
    <ClassroomRoute role="teacher">
      <TeacherConsole />
    </ClassroomRoute>
  )
}

export function TeacherConsole() {
  const { session } = useSession()
  return session ? <Console session={session} /> : null
}

const BTN = 'rounded-2xl px-4 py-3 font-mono text-xs font-bold uppercase tracking-[0.12em] transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-35 disabled:active:scale-100'
const BTN_GHOST = `${BTN} border border-line-strong text-ink enabled:hover:bg-surface-2`

/** Colour of the big button tells the teacher which phase they are in without reading. */
const PRIMARY_LOOK: Record<BeatKind, string> = {
  start: 'bg-accent text-[#1a1200]',
  simulate: 'bg-hot text-[#2b0a00]',
  'open-question': 'bg-good text-[#04281a]',
  'finish-question': 'bg-cold text-[#04202b]',
  reveal: 'bg-accent text-[#1a1200]',
  'next-step': 'bg-accent text-[#1a1200]',
  end: 'bg-surface-3 text-ink-dim',
}

function Console({ session }: { session: SessionRecord }) {
  const { lesson, dispatch, responses, participants, connection, code, questionClock } = useSession()
  const [settings, updateSettings] = useTeacherSettings()
  const [error, setError] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  const state = stateOf(session)
  const position = positionAt(lesson, session.currentStep)
  const step = stepAt(lesson, session.currentStep)
  const questionBlock = questionBlockOf(step)
  const question = questionBlock ? lesson.questions[questionBlock.questionId] : undefined
  const simulation = simulationBlockOf(step)

  const beat = planNext(state, lesson, settings)
  const then = beat.disabled ? null : planAfter(state, beat, lesson, settings, Date.now())

  const active = Boolean(question) && session.activeQuestionId === question?.id
  const finished = active && session.answerRevealed
  // Still on the question until the answer is revealed — also after a manual "Close voting".
  const voting = active && !session.answerRevealed
  const tally = question ? tallyResponses(responses, question) : { counts: {}, total: 0 }

  const send = useCallback(
    async (event: ClassroomEvent) => {
      setError(null)
      try {
        await dispatch(event)
      } catch (e) {
        setError(`Could not send to the class: ${e instanceof Error ? e.message : String(e)}`)
      }
    },
    [dispatch],
  )

  // The big button. A short lock stops a double tap (or a jumpy clicker) from skipping a beat.
  const beatRef = useRef<Beat>(beat)
  beatRef.current = beat
  const locked = useRef(false)
  const press = useCallback(async () => {
    const current = beatRef.current
    if (current.disabled || locked.current) return
    locked.current = true
    window.setTimeout(() => {
      locked.current = false
    }, 450)
    for (const event of current.events(Date.now())) await send(event)
  }, [send])
  const back = useCallback(() => void send({ type: 'PREVIOUS_STEP' }), [send])
  const skip = useCallback(() => void send({ type: 'GO_TO_STEP', stepIndex: position.stepIndex + 1 }), [send, position.stepIndex])

  const finish = useCallback((questionId: string) => void send({ type: 'FINISH_QUESTION', questionId }), [send])

  useGuidedKeys(press, back)
  useAutoFinish({ session, questionClock, answered: tally.total, joined: participants.length, settings, finish })

  return (
    <div className="bg-instrument grain relative min-h-dvh">
      <div className="relative z-10 mx-auto max-w-3xl px-4 pb-52 pt-5">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mono-label text-accent">Teacher</p>
            <h1 className="mt-1 font-display text-2xl font-semibold leading-tight">{lesson.metadata.title}</h1>
            <p className="mt-1 font-mono text-sm text-ink-dim">
              Session <span className="font-bold tracking-[0.2em] text-accent">{code}</span> ·{' '}
              <span className="font-bold text-ink">{participants.length}</span> joined
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <ConnectionBadge status={connection} />
            <a href={presentPath(code)} target="_blank" rel="noopener" className={`${BTN_GHOST} px-3 py-2`}>
              Open presentation ↗
            </a>
          </div>
        </header>

        <CopyField value={studentJoinUrl(code)} className="mt-4 max-w-xl" />

        {error && (
          <p role="alert" className="mt-4 rounded-xl border border-bad/40 bg-bad/10 px-4 py-3 text-sm text-bad">
            {error}
          </p>
        )}

        {session.started && (
          <ol className="mt-5 flex gap-1.5" aria-label="Lesson progress">
            {lesson.steps.map((s, index) => (
              <li
                key={s.id}
                title={s.title}
                className={`h-2 flex-1 rounded-full ${index < position.stepIndex ? 'bg-ink-dim/60' : index === position.stepIndex ? 'bg-accent' : 'bg-surface-3'}`}
              />
            ))}
          </ol>
        )}

        {!session.started ? (
          <LobbyStage names={participants.map((p) => p.name)} />
        ) : voting && question ? (
          <VotingStage
            question={question}
            open={session.questionOpen}
            tally={tally}
            joined={participants.length}
            settings={settings}
            timerS={session.questionTimerS}
            clock={questionClock}
          />
        ) : finished && question ? (
          <ResultsStage question={question} tally={tally} />
        ) : (
          <SlideStage title={step.title} index={position.stepIndex} total={lesson.steps.length} minutes={step.minutes} reveal={position.reveal} simulationBlock={simulation} />
        )}

        <button
          type="button"
          onClick={() => setShowSettings((open) => !open)}
          aria-expanded={showSettings}
          className="mt-6 font-mono text-xs font-bold uppercase tracking-[0.14em] text-ink-dim transition hover:text-ink"
        >
          {showSettings ? '▾' : '▸'} Settings &amp; manual controls
        </button>
        {showSettings && (
          <SettingsPanel
            settings={settings}
            update={updateSettings}
            send={send}
            started={session.started}
            questionId={question?.id}
            simulationId={simulation?.simulationId}
            stepIndex={position.stepIndex}
            stepTitles={lesson.steps.map((s) => s.title)}
          />
        )}
      </div>

      {/* The remote: always in the same place, always the same one big button. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line-strong bg-surface/95 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md">
        <div className="mx-auto grid max-w-3xl grid-cols-[auto_1fr_auto] items-stretch gap-2 px-4 pt-3 sm:gap-3">
          <button
            type="button"
            aria-label="Back"
            className={`${BTN_GHOST} px-3 sm:px-4`}
            disabled={!session.started || session.currentStep === 0}
            onClick={back}
          >
            ←<span className="hidden sm:inline"> Back</span>
          </button>
          <button
            type="button"
            disabled={beat.disabled}
            onClick={(e) => {
              e.currentTarget.blur()
              void press()
            }}
            className={`flex min-h-[4.75rem] flex-col items-center justify-center rounded-2xl px-4 text-center shadow-[0_6px_0_rgb(0_0_0/0.3)] transition active:translate-y-1 active:shadow-[0_1px_0_rgb(0_0_0/0.3)] disabled:cursor-not-allowed disabled:shadow-none ${PRIMARY_LOOK[beat.kind]}`}
          >
            <span className="text-xl font-bold leading-tight sm:text-2xl">{beat.label}</span>
            {!beat.disabled && <span className="mt-0.5 hidden font-mono text-[11px] font-semibold uppercase tracking-[0.14em] opacity-70 sm:block">Space · →</span>}
          </button>
          <button
            type="button"
            aria-label="Skip step"
            className={`${BTN_GHOST} px-3 sm:px-4`}
            disabled={!session.started || position.stepIndex >= lesson.steps.length - 1}
            onClick={skip}
          >
            Skip<span className="hidden sm:inline"> step</span>
          </button>
        </div>
        <p className="mx-auto max-w-3xl truncate px-4 pt-2 text-center text-xs text-ink-dim">
          {beat.hint}
          {then && <span className="text-ink-faint"> · then: {then.label.replace(/^Next: /, '')}</span>}
        </p>
      </div>
    </div>
  )
}

// ── what the teacher sees in the middle ─────────────────────────────────────

function Stage({ children }: { children: ReactNode }) {
  return <section className="panel mt-5 p-6">{children}</section>
}

function LobbyStage({ names }: { names: string[] }) {
  return (
    <Stage>
      <p className="mono-label">Waiting room</p>
      <div className="mt-2 flex items-end gap-3">
        <span className="font-mono text-7xl font-bold leading-none text-accent tabular-nums">{names.length}</span>
        <span className="pb-1.5 text-ink-dim">{names.length === 1 ? 'student' : 'students'} joined</span>
      </div>
      {names.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {names.map((name) => (
            <li key={name} className="animate-rise rounded-full border border-line-strong bg-surface-2/80 px-3 py-1 text-sm font-semibold">
              {name}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-sm leading-relaxed text-ink-dim">
        Students scan the QR code on the projector. Press <span className="font-semibold text-ink">Start lesson</span> when everyone is in.
      </p>
    </Stage>
  )
}

function SlideStage({
  title,
  index,
  total,
  minutes,
  reveal,
  simulationBlock,
}: {
  title: string
  index: number
  total: number
  minutes: number
  reveal: number
  simulationBlock: ReturnType<typeof simulationBlockOf>
}) {
  return (
    <Stage>
      <p className="mono-label">
        Step {index + 1} of {total} · {minutes} min{reveal > 0 ? ` · reveal ${reveal}` : ''}
      </p>
      <h2 className="mt-2 font-display text-4xl font-semibold leading-tight">{title}</h2>
      {simulationBlock && <TeacherSimulation block={simulationBlock} reveal={reveal} />}
    </Stage>
  )
}

function Distribution({ question, tally, showCorrect }: { question: Question; tally: Tally; showCorrect: boolean }) {
  return (
    <div className="mt-4 space-y-2">
      {question.options.map((option, index) => {
        const style = optionStyle(index, question.options.length)
        const count = tally.counts[option.id] ?? 0
        const correct = showCorrect && option.id === question.correctOptionId
        return (
          <div key={option.id} className={`relative overflow-hidden rounded-xl border px-3 py-2 ${correct ? 'border-good' : 'border-line'}`}>
            <div className="absolute inset-y-0 left-0 opacity-30 transition-[width] duration-500" style={{ width: `${percentOf(count, tally.total)}%`, background: style.bg }} />
            <div className="relative flex items-center gap-3 text-sm">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ background: style.bg, color: style.ink }}>
                <Shape kind={style.shape} className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <RichText text={option.text} />
                {correct && <span className="ml-2 font-mono text-[10px] font-bold uppercase tracking-wider text-good">correct</span>}
              </span>
              <span className="font-mono font-bold tabular-nums">{count}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function VotingStage({
  question,
  open,
  tally,
  joined,
  settings,
  timerS,
  clock,
}: {
  question: Question
  open: boolean
  tally: Tally
  joined: number
  settings: ScriptSettings
  timerS: number
  clock: QuestionClock | null
}) {
  const countdown = useCountdown(timerS, clock?.startedAtMs ?? null)
  const total = Math.max(joined, tally.total)
  const closesBy = [settings.finishWhenAllAnswered && 'everyone has answered', timerS > 0 && 'time runs out'].filter(Boolean).join(' or ')
  return (
    <Stage>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className={`mono-label flex items-center gap-2 ${open ? 'text-good' : 'text-ink-dim'}`}>
            <span className={`h-2.5 w-2.5 rounded-full ${open ? 'animate-ring bg-good' : 'bg-ink-faint'}`} />
            {open ? 'Voting open' : 'Voting closed'}
          </p>
          <h2 className="mt-2 font-display text-2xl font-medium leading-snug">
            <RichText text={question.prompt} />
          </h2>
        </div>
        {open && timerS > 0 && <CountdownRing remainingS={countdown.remainingS} totalS={timerS} size={80} />}
      </div>

      <div className="mt-5 flex items-end justify-between gap-4">
        <div className="font-mono leading-none">
          <span className="text-6xl font-bold tabular-nums">{tally.total}</span>
          <span className="text-2xl text-ink-faint"> / {total} answered</span>
        </div>
      </div>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-surface-3">
        <div className="h-full rounded-full bg-good transition-[width] duration-300" style={{ width: `${percentOf(tally.total, total)}%` }} />
      </div>
      <p className="mt-2 text-xs text-ink-dim">
        {!open
          ? 'Voting is closed — press Show results to reveal the answer.'
          : closesBy
            ? `Closes by itself when ${closesBy}.`
            : 'No time limit — press Show results when you are ready.'}
      </p>

      <Distribution question={question} tally={tally} showCorrect />
    </Stage>
  )
}

function ResultsStage({ question, tally }: { question: Question; tally: Tally }) {
  const right = tally.counts[question.correctOptionId] ?? 0
  return (
    <Stage>
      <p className="mono-label text-good">Results shown · answer revealed</p>
      <h2 className="mt-2 font-display text-2xl font-medium leading-snug">
        <RichText text={question.prompt} />
      </h2>
      <p className="mt-3 font-mono text-sm text-ink-dim">
        <span className="text-4xl font-bold text-ink">{percentOf(right, tally.total)}%</span> got it right · {tally.total} {tally.total === 1 ? 'answer' : 'answers'}
      </p>
      <Distribution question={question} tally={tally} showCorrect />
    </Stage>
  )
}

function TeacherSimulation({ block, reveal }: { block: NonNullable<ReturnType<typeof simulationBlockOf>>; reveal: number }) {
  const view = useSessionSimulation(block, reveal)
  return (
    <div className="mt-5">
      <ThermalContactSimulation snapshot={view.snapshot} params={view.params} declared={view.declared} visible={view.visible} variant="student" />
    </div>
  )
}

// ── settings & manual controls (rarely needed) ──────────────────────────────

function SettingsPanel({
  settings,
  update,
  send,
  started,
  questionId,
  simulationId,
  stepIndex,
  stepTitles,
}: {
  settings: ScriptSettings
  update: (patch: Partial<ScriptSettings>) => void
  send: (event: ClassroomEvent) => Promise<void>
  started: boolean
  questionId: string | undefined
  simulationId: string | undefined
  stepIndex: number
  stepTitles: string[]
}) {
  const { lesson } = useSession()
  const params = simulationId ? lesson.simulations[simulationId]?.params : undefined
  const q = questionId
  return (
    <div className="panel mt-3 space-y-6 p-5">
      <div>
        <p className="mono-label">Countdown for each question</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {TIMER_CHOICES.map((choice) => (
            <button
              key={choice}
              type="button"
              aria-pressed={settings.timerS === choice}
              onClick={() => update({ timerS: choice })}
              className={`${BTN} ${settings.timerS === choice ? 'bg-accent text-[#1a1200]' : 'border border-line-strong text-ink hover:bg-surface-2'}`}
            >
              {choice === 0 ? 'Off' : `${choice} s`}
            </button>
          ))}
        </div>
        <label className="mt-4 flex cursor-pointer items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={settings.finishWhenAllAnswered}
            onChange={(e) => update({ finishWhenAllAnswered: e.target.checked })}
            className="h-5 w-5 accent-[var(--accent)]"
          />
          Show the results as soon as everyone has answered
        </label>
      </div>

      <div>
        <p className="mono-label">Manual controls</p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button type="button" className={BTN_GHOST} disabled={!started || !q} onClick={() => q && void send({ type: 'OPEN_QUESTION', questionId: q, timerS: settings.timerS })}>
            Open voting
          </button>
          <button type="button" className={BTN_GHOST} disabled={!started || !q} onClick={() => q && void send({ type: 'CLOSE_QUESTION', questionId: q })}>
            Close voting
          </button>
          <button type="button" className={BTN_GHOST} disabled={!started || !q} onClick={() => q && void send({ type: 'SHOW_RESULTS', questionId: q })}>
            Show results
          </button>
          <button type="button" className={BTN_GHOST} disabled={!started || !q} onClick={() => q && void send({ type: 'REVEAL_ANSWER', questionId: q })}>
            Reveal answer
          </button>
          <button
            type="button"
            className={BTN_GHOST}
            disabled={!started || !simulationId || !params}
            onClick={() => simulationId && params && void send({ type: 'START_SIMULATION', simulationId, mode: 'forward', startedAt: Date.now(), params })}
          >
            Connect
          </button>
          <button
            type="button"
            className={BTN_GHOST}
            disabled={!started || !simulationId || !params}
            onClick={() => simulationId && params && void send({ type: 'START_SIMULATION', simulationId, mode: 'reverse', startedAt: Date.now(), params })}
          >
            Try reverse
          </button>
          <button type="button" className={BTN_GHOST} disabled={!started || !simulationId} onClick={() => simulationId && void send({ type: 'RESET_SIMULATION', simulationId })}>
            Reset sim
          </button>
        </div>
      </div>

      <label className="block">
        <span className="mono-label">Jump to a step</span>
        <select
          disabled={!started}
          value={stepIndex}
          onChange={(e) => void send({ type: 'GO_TO_STEP', stepIndex: Number(e.target.value) })}
          className="mt-2 w-full rounded-xl border border-line-strong bg-surface-2/70 px-3 py-3 text-sm text-ink outline-none focus:border-accent disabled:opacity-40"
        >
          {stepTitles.map((title, index) => (
            <option key={title} value={index}>
              {index + 1}. {title}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

// ── behaviour ───────────────────────────────────────────────────────────────

/** Space / → / PageDown (what presentation clickers send) = the big button; ← / PageUp = back. */
function useGuidedKeys(press: () => Promise<void>, back: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || (e.key === ' ' && tag !== 'BUTTON')) {
        e.preventDefault()
        void press()
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        back()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [press, back])
}

/**
 * Voting closes by itself — when time is up, or when everyone who joined has answered. Only the
 * teacher's screen may change the class state, so this runs here (keep this tab open during class).
 */
function useAutoFinish({
  session,
  questionClock,
  answered,
  joined,
  settings,
  finish,
}: {
  session: SessionRecord
  questionClock: QuestionClock | null
  answered: number
  joined: number
  settings: ScriptSettings
  finish: (questionId: string) => void
}) {
  const everyoneSince = useRef<number | null>(null)
  const handled = useRef<string | null>(null)
  const questionId = session.activeQuestionId
  const timerS = session.questionTimerS
  const key = session.questionOpen && questionId && questionClock ? `${questionId}@${questionClock.startedAtMs}` : null
  const startedAtMs = questionClock?.startedAtMs ?? 0

  useEffect(() => {
    everyoneSince.current = null
    if (!key || !questionId) return
    const timer = window.setInterval(() => {
      if (handled.current === key) return
      const reason = autoFinishReason({
        open: true,
        timerS,
        elapsedS: (performance.now() - startedAtMs) / 1000,
        answered,
        joined,
        finishWhenAllAnswered: settings.finishWhenAllAnswered,
      })
      if (reason === 'time') {
        handled.current = key
        finish(questionId)
      } else if (reason === 'everyone') {
        everyoneSince.current ??= performance.now()
        if (performance.now() - everyoneSince.current >= EVERYONE_ANSWERED_DELAY_MS) {
          handled.current = key
          finish(questionId)
        }
      } else {
        everyoneSince.current = null
      }
    }, 150)
    return () => window.clearInterval(timer)
  }, [key, questionId, timerS, startedAtMs, answered, joined, settings.finishWhenAllAnswered, finish])
}
