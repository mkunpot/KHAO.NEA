/**
 * SELF-STUDY rendering state: independent review after class. No Supabase, no session.
 *
 * The same lesson as the projector and the phones, laid out as a reading page: objectives, the
 * long-form explanations (which the projector skips), every equation, a simulation the learner
 * can run freely, expandable explanations on each question, and a self-check at the end.
 */

import '@fontsource-variable/fraunces'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { HeatEngineDiagram } from '../../components/HeatEngineDiagram'
import { BlockMath, HighlightedRichText, RichText } from '../../components/Math'
import { optionBadge } from '../results'
import type {
  Block,
  ConceptBlock,
  LessonDefinition,
  LessonStep,
  Question,
  SimulationBlock,
  TextBlock,
} from '../../lesson/types'
import { finalSnapshot, snapshotAt } from '../../simulations/thermal-contact/model'
import { ThermalContactSimulation } from '../../simulations/thermal-contact/ThermalContactSimulation'
import { useLocalThermalController } from '../../simulations/thermal-contact/useThermalContact'
import type { ReadoutKey } from '../../simulations/thermal-contact/types'

type Answers = Record<string, string>

export function StudyRenderer({ lesson }: { lesson: LessonDefinition }) {
  const [answers, setAnswers] = useState<Answers>({})
  const onAnswer = (questionId: string, optionId: string | null) =>
    setAnswers((previous) => {
      const next = { ...previous }
      if (optionId === null) delete next[questionId]
      else next[questionId] = optionId
      return next
    })

  return (
    <div className="theme-paper bg-notebook min-h-dvh text-ink">
      <StudyHeader lesson={lesson} />
      <main className="mx-auto max-w-5xl px-5 pb-24 sm:px-8">
        {lesson.steps.map((step, index) => (
          <StudyStep key={step.id} lesson={lesson} step={step} index={index} answers={answers} onAnswer={onAnswer} />
        ))}
        <SelfCheck lesson={lesson} answers={answers} onReset={() => setAnswers({})} />
      </main>
    </div>
  )
}

function StudyHeader({ lesson }: { lesson: LessonDefinition }) {
  const { metadata } = lesson
  return (
    <header className="relative overflow-hidden border-b border-line-strong">
      <div
        className="pointer-events-none absolute -right-24 -top-28 h-[28rem] w-[28rem] rounded-full opacity-40 blur-3xl"
        style={{ background: 'radial-gradient(closest-side, var(--hot), transparent)' }}
      />
      <div
        className="pointer-events-none absolute -left-32 top-40 h-[22rem] w-[22rem] rounded-full opacity-30 blur-3xl"
        style={{ background: 'radial-gradient(closest-side, var(--cold), transparent)' }}
      />
      <div className="relative mx-auto max-w-5xl px-5 pb-14 pt-8 sm:px-8">
        <nav className="flex items-center justify-between font-mono text-xs uppercase tracking-[0.16em] text-ink-dim">
          <Link to="/" className="transition hover:text-ink">
            ← Second Law demo
          </Link>
          <span>Self-study</span>
        </nav>
        <p className="mono-label mt-16 text-hot">{metadata.level}</p>
        <h1 className="mt-4 max-w-3xl break-words font-display text-[2.35rem] font-semibold leading-[1.04] tracking-tight sm:text-7xl">{metadata.title}</h1>
        <p className="mt-5 max-w-xl font-display text-2xl italic text-ink-dim">{metadata.subtitle}</p>
        <div className="mt-8 flex flex-wrap gap-2">
          {[`≈ ${metadata.durationMinutes} minutes`, `${lesson.steps.length} parts`, 'interactive simulation'].map((chip) => (
            <span key={chip} className="rounded-full border border-line-strong bg-surface/70 px-4 py-1.5 font-mono text-xs tracking-wide">
              {chip}
            </span>
          ))}
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-[1.5fr_1fr]">
          <section className="rounded-3xl border border-line-strong bg-surface p-7 shadow-[0_18px_40px_-28px_rgba(40,30,10,0.5)]">
            <h2 className="mono-label">Learning objectives</h2>
            <ol className="mt-4 space-y-3">
              {lesson.objectives.map((objective, index) => (
                <li key={index} className="flex gap-4 leading-snug">
                  <span className="mt-0.5 font-mono text-sm font-bold text-hot">{index + 1}</span>
                  <span>
                    <RichText text={objective} />
                  </span>
                </li>
              ))}
            </ol>
          </section>
          <section className="rounded-3xl border border-line bg-surface-2/60 p-7">
            <h2 className="mono-label">You should already know</h2>
            <ul className="mt-4 space-y-2 text-sm text-ink-dim">
              {metadata.prerequisites.map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="text-cold">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </header>
  )
}

function StudyStep({
  lesson,
  step,
  index,
  answers,
  onAnswer,
}: {
  lesson: LessonDefinition
  step: LessonStep
  index: number
  answers: Answers
  onAnswer: (questionId: string, optionId: string | null) => void
}) {
  return (
    <section className="grid gap-x-12 gap-y-4 border-b border-line py-14 lg:grid-cols-[120px_minmax(0,1fr)]">
      <div className="lg:sticky lg:top-8 lg:self-start">
        <div className="font-display text-7xl italic leading-none text-ink-faint/60 lg:text-8xl">{String(index + 1).padStart(2, '0')}</div>
        <div className="mono-label mt-2">{step.minutes} min</div>
      </div>
      <div className="min-w-0 space-y-6">
        <h2 className="font-display text-4xl font-semibold leading-tight">{step.title}</h2>
        {step.blocks.map((block) => (
          <StudyBlock key={block.id} lesson={lesson} block={block} answers={answers} onAnswer={onAnswer} />
        ))}
      </div>
    </section>
  )
}

function StudyBlock({
  lesson,
  block,
  answers,
  onAnswer,
}: {
  lesson: LessonDefinition
  block: Block
  answers: Answers
  onAnswer: (questionId: string, optionId: string | null) => void
}) {
  switch (block.type) {
    case 'concept':
      return <Concept block={block} />

    case 'text':
      return <StudyPresetText block={block} />

    case 'equation':
      return (
        <figure
          className={`rounded-2xl border px-6 py-5 text-center ${
            block.tone === 'key' ? 'border-accent bg-accent/10' : 'border-line bg-surface'
          }`}
        >
          <BlockMath latex={block.latex} className="text-2xl sm:text-3xl" />
          {block.caption && (
            <figcaption className="mt-1 font-mono text-xs text-ink-dim">
              <RichText text={block.caption} />
            </figcaption>
          )}
        </figure>
      )

    case 'explanation':
      return (
        <div className="rounded-2xl border border-line bg-surface-2/70 p-6">
          <p className="mono-label text-hot">In depth</p>
          {block.title && <h3 className="mt-2 font-display text-2xl font-semibold">{block.title}</h3>}
          <div className="mt-3 space-y-4 text-[17px] leading-relaxed">
            {block.paragraphs.map((paragraph, i) => (
              <p key={i}>
                <RichText text={paragraph} />
              </p>
            ))}
          </div>
        </div>
      )

    case 'simulation': {
      const spec = lesson.simulations[block.simulationId]
      if (!spec) return null
      return block.display === 'live' ? (
        <LiveSimulation block={block} params={spec.params} assumptions={spec.assumptions} title={spec.title} />
      ) : (
        <StaticSimulation block={block} params={spec.params} title={spec.title} />
      )
    }

    case 'diagram':
      return (
        <figure className="theme-dark bg-instrument grain relative overflow-hidden rounded-3xl p-6 text-ink">
          <HeatEngineDiagram className="mx-auto max-h-[420px] w-full" />
          {block.caption && <figcaption className="mt-3 text-center font-mono text-xs text-ink-dim">{block.caption}</figcaption>}
        </figure>
      )

    case 'image':
      return (
        <figure className="overflow-hidden rounded-3xl border border-line-strong bg-surface p-3 shadow-[0_18px_40px_-28px_rgba(40,30,10,0.5)]">
          <img src={block.src} alt={block.alt} className={`max-h-[560px] w-full rounded-2xl ${block.fit === 'cover' ? 'object-cover' : 'object-contain'}`} />
          {block.caption && <figcaption className="px-3 pb-1 pt-4 text-center font-mono text-xs text-ink-dim"><RichText text={block.caption} /></figcaption>}
        </figure>
      )

    case 'question': {
      const question = lesson.questions[block.questionId]
      return question ? <StudyQuestion question={question} selected={answers[question.id] ?? null} onAnswer={onAnswer} /> : null
    }

    case 'summary':
      return (
        <div className="space-y-4 rounded-3xl border-2 border-line-strong bg-surface p-7">
          <h3 className="mono-label">{lesson.summary.heading}</h3>
          {lesson.summary.rows.map((row) => (
            <div key={row.law} className="rounded-2xl bg-surface-2/70 p-5">
              <p className="font-mono text-sm font-bold uppercase tracking-[0.16em] text-hot">{row.law}</p>
              <p className="mt-1 font-display text-2xl leading-snug">“{row.question}”</p>
              {row.equation && (
                <div className="mt-2 flex flex-wrap items-baseline gap-4">
                  <BlockMath latex={row.equation} align="left" className="text-2xl text-entropy" />
                  {row.note && <span className="font-mono text-xs text-ink-dim">{row.note}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )
  }
}

const STUDY_TEXT_PRESETS: Record<TextBlock['role'], string> = {
  kicker: 'font-mono text-xs font-semibold tracking-[0.14em] uppercase text-hot',
  title: 'font-display text-5xl font-semibold leading-[1.02]',
  subtitle: 'font-display text-3xl leading-tight text-ink-dim',
  section: 'font-display text-4xl font-semibold leading-tight',
  body: 'text-xl leading-relaxed',
  callout: 'rounded-2xl border-2 border-accent bg-accent/10 px-6 py-5 text-2xl font-semibold leading-snug',
  caption: 'font-mono text-xs leading-relaxed text-ink-dim',
}

function StudyPresetText({ block }: { block: TextBlock }) {
  const align = block.align === 'center' ? 'text-center' : block.align === 'right' ? 'text-right' : 'text-left'
  return <p className={`${STUDY_TEXT_PRESETS[block.role]} ${align}`}><HighlightedRichText text={block.text} highlights={block.highlights} /></p>
}

function Concept({ block }: { block: ConceptBlock }) {
  const tone = block.tone ?? 'default'
  if (tone === 'stamp') {
    return (
      <div className="inline-block -rotate-1 rounded-lg border-4 border-accent px-6 py-2 font-mono text-lg font-bold tracking-[0.16em] text-accent">
        <RichText text={block.text} />
      </div>
    )
  }
  const border = tone === 'key' ? 'border-accent bg-accent/10' : tone === 'warning' ? 'border-bad bg-bad/10' : 'border-transparent'
  return (
    <p className={`rounded-r-xl border-l-4 py-1 pl-5 pr-3 text-xl leading-relaxed ${border}`}>
      <RichText text={block.text} />
    </p>
  )
}

// ── simulation ──────────────────────────────────────────────────────────────

function InstrumentCard({ title, children }: { title: string; children: ReactNode }) {
  // The instrument keeps the dark palette even on the paper page, like a screen set into a notebook.
  return (
    <figure className="theme-dark bg-instrument grain relative overflow-hidden rounded-3xl p-4 text-ink shadow-[0_24px_50px_-28px_rgba(10,16,32,0.8)] sm:p-6">
      <figcaption className="mono-label relative z-10 mb-3">{title}</figcaption>
      <div className="relative z-10">{children}</div>
    </figure>
  )
}

function StaticSimulation({ block, params, title }: { block: SimulationBlock; params: ReturnType<typeof useLocalThermalController>['params']; title: string }) {
  const snapshot = block.display === 'settled' ? finalSnapshot(params, 'forward') : snapshotAt(params, 'idle', 0)
  const declared = Object.keys(block.readouts) as ReadoutKey[]
  return (
    <InstrumentCard title={`${title} · ${block.display === 'settled' ? 'after equilibrium' : 'before contact'}`}>
      <ThermalContactSimulation snapshot={snapshot} params={params} declared={declared} visible={new Set(declared)} variant="study" />
    </InstrumentCard>
  )
}

function LiveSimulation({
  block,
  params: initial,
  assumptions,
  title,
}: {
  block: SimulationBlock
  params: ReturnType<typeof useLocalThermalController>['params']
  assumptions: string[]
  title: string
}) {
  const sim = useLocalThermalController(initial)
  const declared = Object.keys(block.readouts) as ReadoutKey[]
  const button = 'rounded-xl px-5 py-3 font-mono text-xs font-bold uppercase tracking-[0.14em] transition active:scale-[0.97]'
  return (
    <InstrumentCard title={`${title} · try it`}>
      <ThermalContactSimulation snapshot={sim.snapshot} params={sim.params} declared={declared} visible={new Set(declared)} variant="study" />

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="flex items-baseline justify-between font-mono text-xs text-ink-dim">
            <span>
              T<sub>hot</sub> (initial)
            </span>
            <span className="text-hot">{sim.params.hotK} K</span>
          </span>
          <input
            type="range"
            min={sim.hotRange.min}
            max={sim.hotRange.max}
            step={5}
            value={sim.params.hotK}
            onChange={(e) => sim.setHot(Number(e.target.value))}
            className="mt-2 w-full accent-hot"
            aria-label="Initial temperature of the hot body in kelvin"
          />
        </label>
        <label className="block">
          <span className="flex items-baseline justify-between font-mono text-xs text-ink-dim">
            <span>
              T<sub>cold</sub> (initial)
            </span>
            <span className="text-cold">{sim.params.coldK} K</span>
          </span>
          <input
            type="range"
            min={sim.coldRange.min}
            max={sim.coldRange.max}
            step={5}
            value={sim.params.coldK}
            onChange={(e) => sim.setCold(Number(e.target.value))}
            className="mt-2 w-full accent-cold"
            aria-label="Initial temperature of the cold body in kelvin"
          />
        </label>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" onClick={() => sim.start('forward')} className={`${button} bg-accent text-[#1a1200] hover:brightness-110`}>
          Connect
        </button>
        <button type="button" onClick={() => sim.start('reverse')} className={`${button} border border-bad/60 text-bad hover:bg-bad/10`}>
          Try reverse
        </button>
        <button type="button" onClick={sim.reset} className={`${button} border border-line-strong text-ink hover:bg-surface-2`}>
          Reset
        </button>
      </div>

      <details className="mt-5 text-sm text-ink-dim">
        <summary className="cursor-pointer font-mono text-xs uppercase tracking-[0.14em] hover:text-ink">Model assumptions</summary>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          {assumptions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </details>
    </InstrumentCard>
  )
}

// ── questions & self-check ──────────────────────────────────────────────────

function StudyQuestion({
  question,
  selected,
  onAnswer,
}: {
  question: Question
  selected: string | null
  onAnswer: (questionId: string, optionId: string | null) => void
}) {
  const answered = selected !== null
  const correct = selected === question.correctOptionId
  return (
    <div className="rounded-3xl border-2 border-line-strong bg-surface p-6 shadow-[0_18px_40px_-30px_rgba(40,30,10,0.6)]">
      <p className="mono-label text-hot">{question.kind === 'prediction' ? 'Predict' : question.kind === 'exit' ? 'Check yourself' : 'Concept check'}</p>
      <h3 className="mt-2 font-display text-2xl font-medium leading-snug">
        <RichText text={question.prompt} />
      </h3>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {question.options.map((option) => {
          const isSelected = selected === option.id
          const isCorrect = option.id === question.correctOptionId
          let look = 'border-line-strong bg-surface-2/50 hover:bg-surface-2'
          if (answered && isCorrect) look = 'border-good bg-good/10'
          else if (answered && isSelected) look = 'border-bad bg-bad/10'
          else if (answered) look = 'border-line opacity-50'
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onAnswer(question.id, option.id)}
              aria-pressed={isSelected}
              className={`flex items-center gap-4 rounded-2xl border-2 px-4 py-3 text-left transition active:scale-[0.99] ${look}`}
            >
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full font-mono text-sm font-bold ${answered && isCorrect ? 'bg-good text-white' : 'bg-surface-3'}`}>
                {answered && isCorrect ? '✓' : optionBadge(option.id)}
              </span>
              <span className="leading-snug">
                <RichText text={option.text} />
              </span>
            </button>
          )
        })}
      </div>
      {answered && (
        <div className="animate-rise mt-4">
          <p className={`font-semibold ${correct ? 'text-good' : 'text-bad'}`}>{correct ? 'Correct.' : 'Not quite — have another look.'}</p>
          <details className="mt-2 rounded-xl bg-surface-2/70 px-4 py-3">
            <summary className="cursor-pointer font-mono text-xs font-semibold uppercase tracking-[0.14em] text-ink-dim">Why?</summary>
            <p className="mt-2 leading-relaxed">
              <RichText text={question.explanation} />
            </p>
          </details>
          <button type="button" onClick={() => onAnswer(question.id, null)} className="mt-3 font-mono text-xs uppercase tracking-[0.14em] text-ink-dim underline-offset-4 hover:text-ink hover:underline">
            Try again
          </button>
        </div>
      )}
    </div>
  )
}

function SelfCheck({ lesson, answers, onReset }: { lesson: LessonDefinition; answers: Answers; onReset: () => void }) {
  const questions = lesson.steps.flatMap((step) => step.blocks.flatMap((b) => (b.type === 'question' ? [lesson.questions[b.questionId]] : [])))
  const list = questions.filter((q): q is Question => q !== undefined)
  const answered = list.filter((q) => answers[q.id] !== undefined).length
  const correct = list.filter((q) => answers[q.id] === q.correctOptionId).length
  return (
    <section className="py-14">
      <h2 className="font-display text-4xl font-semibold">Self-check</h2>
      <p className="mt-3 text-ink-dim">
        You have answered {answered} of {list.length} questions and got {correct} right.
      </p>
      <div className="mt-5 flex gap-2" aria-hidden>
        {list.map((q) => {
          const state = answers[q.id] === undefined ? 'bg-surface-3' : answers[q.id] === q.correctOptionId ? 'bg-good' : 'bg-bad'
          return <span key={q.id} className={`h-3 flex-1 rounded-full ${state}`} />
        })}
      </div>
      <button type="button" onClick={onReset} className="mt-6 rounded-xl border border-line-strong px-5 py-3 font-mono text-xs font-bold uppercase tracking-[0.14em] transition hover:bg-surface-2">
        Reset answers
      </button>
    </section>
  )
}
