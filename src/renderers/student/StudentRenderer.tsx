/**
 * LIVE STUDENT rendering state: a phone in portrait.
 *
 * It does NOT mirror the projector. A student's phone is a game controller:
 *   lobby → big coloured answer tiles (one tap) → "answer sent" → full-screen ✓ / ✗ when the teacher finishes the question.
 * Between questions it shows a compact simulation read-out. Everything is driven by the same lesson + the shared session.
 */

import { useState, type ReactNode } from 'react'
import { ConnectionBadge } from '../../components/ConnectionBadge'
import { CountdownBar } from '../../components/CountdownRing'
import { RichText } from '../../components/Math'
import { optionStyle, Shape } from '../../components/optionStyle'
import { positionAt, simulationBlockOf, stepAt } from '../../lesson/cursor'
import type { Question, SimulationBlock } from '../../lesson/types'
import { useSession } from '../../session/SessionProvider'
import { useCountdown } from '../../session/useCountdown'
import { ThermalContactSimulation } from '../../simulations/thermal-contact/ThermalContactSimulation'
import { useSessionSimulation } from '../useSessionSimulation'

// The practice-room device has a visible Dynamic Island overlay. Reserve its space there
// while keeping the real student page flush with the native browser safe area.
const inPhoneFrame = new URLSearchParams(window.location.search).get('phoneFrame') === '1'

export function StudentRenderer() {
  const { lesson, session, participant, connection, code } = useSession()
  if (!session) return null

  if (!session.started) return <Lobby name={participant?.name ?? ''} code={code} />

  const question = session.activeQuestionId ? lesson.questions[session.activeQuestionId] : undefined
  if (question) return <QuestionScreen key={question.id} question={question} />

  const position = positionAt(lesson, session.currentStep)
  const step = stepAt(lesson, session.currentStep)
  const simulation = simulationBlockOf(step)

  return (
    <Page>
      <header className="flex items-start justify-between">
        <div>
          <p className="mono-label text-accent">Second Law · {code}</p>
          <p className="mt-1 text-sm text-ink-dim">
            You are <span className="font-semibold text-ink">{participant?.name}</span>
          </p>
        </div>
        <ConnectionBadge status={connection} />
      </header>

      <p className="mono-label mt-6 text-[10px] text-ink-faint">
        {String(position.stepIndex + 1).padStart(2, '0')} / {String(lesson.steps.length).padStart(2, '0')} · {step.title}
      </p>

      <main className="mt-3 flex flex-1 flex-col gap-5">
        <Waiting />
        {simulation && <SimulationCard block={simulation} reveal={position.reveal} />}
      </main>
    </Page>
  )
}

function Page({ children }: { children: ReactNode }) {
  return (
    <div className="bg-instrument grain relative min-h-dvh">
      <div
        className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-10 pt-[max(1.25rem,env(safe-area-inset-top))]"
        style={inPhoneFrame ? { paddingTop: '4rem' } : undefined}
      >
        {children}
      </div>
    </div>
  )
}

function Lobby({ name, code }: { name: string; code: string }) {
  const { connection } = useSession()
  return (
    <Page>
      <header className="flex items-start justify-between">
        <p className="mono-label text-accent">Second Law · {code}</p>
        <ConnectionBadge status={connection} />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
        <div className="flex items-center gap-4">
          <span className="h-9 w-9 animate-breathe rounded-full bg-hot shadow-[0_0_40px_var(--hot)]" />
          <span className="h-9 w-9 animate-breathe rounded-full bg-cold shadow-[0_0_40px_var(--cold)]" style={{ animationDelay: '0.9s' }} />
        </div>
        <div>
          <p className="mono-label">You’re in!</p>
          <h1 className="mt-3 font-display text-5xl font-semibold leading-tight">{name}</h1>
          <p className="mx-auto mt-5 max-w-[16rem] text-ink-dim">Your name is on the big screen. The lesson starts when your teacher presses Start.</p>
        </div>
      </main>
    </Page>
  )
}

function Waiting() {
  return (
    <section className="panel flex flex-1 flex-col items-center justify-center gap-6 px-6 py-14 text-center">
      <div className="flex items-center gap-4">
        <span className="h-7 w-7 animate-breathe rounded-full bg-hot shadow-[0_0_30px_var(--hot)]" />
        <span className="h-7 w-7 animate-breathe rounded-full bg-cold shadow-[0_0_30px_var(--cold)]" style={{ animationDelay: '0.9s' }} />
      </div>
      <div>
        <h1 className="font-display text-3xl font-semibold">Waiting for teacher…</h1>
        <p className="mt-2 text-sm text-ink-dim">Questions will appear here. Keep an eye on the screen.</p>
      </div>
    </section>
  )
}

function SimulationCard({ block, reveal }: { block: SimulationBlock; reveal: number }) {
  const view = useSessionSimulation(block, reveal)
  return (
    <section className="panel animate-rise p-4">
      <p className="mono-label mb-3 text-[10px]">Simulation read-out</p>
      <ThermalContactSimulation snapshot={view.snapshot} params={view.params} declared={view.declared} visible={view.visible} variant="student" />
    </section>
  )
}

// ── a question, from "tap" to "✓ / ✗" ───────────────────────────────────────

function Fullscreen({ background, children }: { background?: string; children: ReactNode }) {
  return (
    <div
      className="fixed inset-0 flex flex-col overflow-y-auto pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] text-ink"
      style={{ background: background ?? 'var(--bg)', paddingTop: inPhoneFrame ? '4rem' : 'env(safe-area-inset-top)' }}
    >
      {children}
    </div>
  )
}

function QuestionScreen({ question }: { question: Question }) {
  const { session, myAnswers, submitAnswer, questionClock } = useSession()
  const [pending, setPending] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const open = Boolean(session?.questionOpen)
  const countdown = useCountdown(session?.questionTimerS ?? 0, open ? (questionClock?.startedAtMs ?? null) : null)
  if (!session) return null

  const mine = myAnswers[question.id]
  const chosen = mine ?? pending ?? undefined

  async function choose(optionId: string) {
    if (mine || pending || !open) return
    setPending(optionId)
    setNotice(null)
    try {
      const result = await submitAnswer(question.id, optionId)
      if (result === 'closed') {
        setPending(null)
        setNotice('Voting had just closed — that answer was not counted.')
      }
    } catch {
      setPending(null)
      setNotice('Could not send your answer. Check your connection and tap again.')
    }
  }

  if (session.answerRevealed) return <ResultScreen question={question} mine={mine} />

  if (!open) {
    return <ClosedScreen question={question} mine={mine} />
  }

  if (chosen) {
    return (
      <SentScreen question={question} optionId={chosen} sending={!mine} countdown={countdown} timed={session.questionTimerS > 0} />
    )
  }

  return (
    <Fullscreen>
      {session.questionTimerS > 0 && <CountdownBar fraction={countdown.fraction} urgent={countdown.remainingS <= 5} />}
      <div className="flex items-start justify-between gap-4 px-5 pt-4">
        <h1 className="font-display text-[22px] font-medium leading-snug">
          <RichText text={question.prompt} />
        </h1>
        {session.questionTimerS > 0 && (
          <span className={`mt-1 font-mono text-2xl font-bold tabular-nums ${countdown.remainingS <= 5 ? 'text-bad' : 'text-ink-dim'}`}>
            {Math.ceil(countdown.remainingS)}
          </span>
        )}
      </div>

      {notice && <p className="mx-5 mt-3 rounded-xl bg-bad/15 px-4 py-3 text-sm text-bad">{notice}</p>}

      <div className={`grid flex-1 gap-3 p-4 ${question.options.length === 2 ? 'grid-cols-1 grid-rows-2' : 'grid-cols-2 grid-rows-2'}`}>
        {question.options.map((option, index) => {
          const style = optionStyle(index, question.options.length)
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => void choose(option.id)}
              className="flex min-h-[7.5rem] flex-col items-center justify-center gap-3 rounded-3xl p-3 text-center font-bold shadow-[0_8px_0_rgb(0_0_0/0.28)] transition active:translate-y-1.5 active:shadow-[0_2px_0_rgb(0_0_0/0.28)]"
              style={{ background: style.bg, color: style.ink }}
            >
              <Shape kind={style.shape} className="h-11 w-11" />
              <span className="text-[19px] leading-tight">
                <RichText text={option.text} />
              </span>
            </button>
          )
        })}
      </div>
    </Fullscreen>
  )
}

function SentScreen({
  question,
  optionId,
  sending,
  countdown,
  timed,
}: {
  question: Question
  optionId: string
  sending: boolean
  countdown: { fraction: number; remainingS: number }
  timed: boolean
}) {
  const index = question.options.findIndex((o) => o.id === optionId)
  const style = optionStyle(Math.max(0, index), question.options.length)
  return (
    <Fullscreen background={style.bg}>
      <div style={{ color: style.ink }} className="flex flex-1 flex-col">
        {timed && <CountdownBar fraction={countdown.fraction} urgent={countdown.remainingS <= 5} />}
        <div className="flex flex-1 animate-rise flex-col items-center justify-center gap-6 px-8 text-center">
          <Shape kind={style.shape} className="h-28 w-28" />
          <div>
            <h1 className="font-display text-4xl font-semibold">{sending ? 'Sending…' : 'Answer sent'}</h1>
            <p className="mt-3 text-lg font-medium opacity-80">
              <RichText text={question.options[Math.max(0, index)]?.text ?? ''} />
            </p>
          </div>
          <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] opacity-70">Waiting for everyone…</p>
        </div>
      </div>
    </Fullscreen>
  )
}

function ClosedScreen({ question, mine }: { question: Question; mine: string | undefined }) {
  const index = question.options.findIndex((o) => o.id === mine)
  const style = index >= 0 ? optionStyle(index, question.options.length) : null
  return (
    <Fullscreen>
      <div className="flex flex-1 animate-rise flex-col items-center justify-center gap-6 px-8 text-center">
        <h1 className="font-display text-4xl font-semibold">Voting closed</h1>
        {style && mine ? (
          <div className="flex items-center gap-3 rounded-2xl px-5 py-3 font-bold" style={{ background: style.bg, color: style.ink }}>
            <Shape kind={style.shape} className="h-6 w-6" />
            <RichText text={question.options[index]?.text ?? ''} />
          </div>
        ) : (
          <p className="text-ink-dim">You did not answer this one.</p>
        )}
        <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-ink-faint">Look at the screen</p>
      </div>
    </Fullscreen>
  )
}

function ResultScreen({ question, mine }: { question: Question; mine: string | undefined }) {
  const answered = mine !== undefined
  const correct = mine === question.correctOptionId
  const tone = !answered ? 'none' : correct ? 'correct' : 'wrong'
  const look = {
    correct: { bg: 'linear-gradient(165deg, #1fcf8a 0%, #0b7a52 100%)', icon: '✓', title: 'Correct!' },
    wrong: { bg: 'linear-gradient(165deg, #ff6a85 0%, #b5183a 100%)', icon: '✗', title: 'Not quite' },
    none: { bg: 'linear-gradient(165deg, #6b7a9e 0%, #2b3650 100%)', icon: '⏱', title: 'Time’s up' },
  }[tone]
  const answerIndex = question.options.findIndex((o) => o.id === question.correctOptionId)
  const answerStyle = optionStyle(Math.max(0, answerIndex), question.options.length)

  return (
    <Fullscreen background={look.bg}>
      <div className="flex flex-1 animate-rise flex-col items-center gap-6 px-6 py-10 text-center text-white">
        <div className="grid h-28 w-28 place-items-center rounded-full bg-white/20 text-6xl font-bold">{look.icon}</div>
        <h1 className="font-display text-5xl font-semibold">{look.title}</h1>

        <div className="w-full max-w-sm rounded-2xl bg-black/20 p-4 text-left">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] opacity-70">The answer</p>
          <div className="mt-2 flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: answerStyle.bg, color: answerStyle.ink }}>
              <Shape kind={answerStyle.shape} className="h-5 w-5" />
            </span>
            <span className="text-lg font-semibold leading-snug">
              <RichText text={question.options[answerIndex]?.text ?? ''} />
            </span>
          </div>
        </div>

        <p className="max-w-sm text-left text-[15px] leading-relaxed opacity-90">
          <RichText text={question.explanation} />
        </p>
        <p className="mt-auto font-mono text-[11px] font-bold uppercase tracking-[0.16em] opacity-60">Waiting for the next one…</p>
      </div>
    </Fullscreen>
  )
}
