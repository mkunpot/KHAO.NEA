/**
 * One slide of the projector, drawn from a lesson step.
 *
 * It is laid out in 1920×1080 design pixels and fills whatever box it is put in: Spectacle's canvas
 * on the projector, a scaled frame in the lesson editor. It reads the lesson and the live session
 * from useSession(); nothing in here contains lesson text.
 */

import { useRef, type ReactNode } from 'react'
import { BlockMath, RichText } from '../../components/Math'
import { HeatEngineDiagram } from '../../components/HeatEngineDiagram'
import { CountdownRing } from '../../components/CountdownRing'
import { optionStyle, Shape } from '../../components/optionStyle'
import { QRCodeBlock } from '../../components/QRCodeBlock'
import { isRevealed, positionAt, questionBlockOf } from '../../lesson/cursor'
import type { Block, ConceptBlock, EquationBlock, LessonStep, Question, SimulationBlock } from '../../lesson/types'
import { useSession } from '../../session/SessionProvider'
import { studentJoinUrl } from '../../session/sessionService'
import { useCountdown } from '../../session/useCountdown'
import { ThermalContactSimulation } from '../../simulations/thermal-contact/ThermalContactSimulation'
import { percentOf, tallyResponses } from '../results'
import { useSessionSimulation } from '../useSessionSimulation'

export function StepSlide({ step, index, total }: { step: LessonStep; index: number; total: number }) {
  const { lesson, session } = useSession()
  const position = session ? positionAt(lesson, session.currentStep) : { stepIndex: 0, reveal: 0 }
  const active = position.stepIndex === index

  // While Spectacle cross-fades away from this slide, keep it as it was instead of collapsing its reveals.
  const lastReveal = useRef(0)
  if (active) lastReveal.current = position.reveal
  const reveal = active ? position.reveal : lastReveal.current

  const media = step.blocks.find((b) => b.type === 'simulation' || b.type === 'diagram')
  const text = step.blocks.filter((b) => b !== media && (b.type === 'concept' || b.type === 'equation' || b.type === 'summary'))
  const question = questionBlockOf(step)

  const renderText = (block: Block) => (
    <div key={block.id} className="reveal" data-shown={isRevealed(block, reveal)}>
      <TextBlock block={block} />
    </div>
  )
  const renderMedia = (block: Block, stage: number) =>
    block.type === 'simulation' ? (
      <SimulationStage block={block} reveal={stage} />
    ) : block.type === 'diagram' ? (
      <figure className="flex h-full flex-col items-center justify-center gap-4">
        <HeatEngineDiagram className="min-h-0 w-full flex-1" />
        {block.caption && (
          <figcaption className="font-mono text-[22px] text-ink-dim">
            <RichText text={block.caption} />
          </figcaption>
        )}
      </figure>
    ) : null

  return (
    <div className="bg-instrument grain relative flex h-full w-full flex-col overflow-hidden px-[96px] pb-[56px] pt-[52px] text-ink">
      <header className="flex items-start justify-between gap-12">
        <div className="min-w-0">
          <div className="mono-label text-[21px]">
            {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')} · {lesson.metadata.title}
          </div>
          <h1 className="mt-3 font-display text-[84px] font-semibold leading-[1.02] tracking-tight">{step.title}</h1>
        </div>
        <JoinChip />
      </header>

      {question ? (
        <main className="mt-8 grid min-h-0 flex-1 grid-cols-2 gap-14">
          <div className="flex min-h-0 flex-col gap-6">
            <div className="flex shrink-0 flex-col gap-4">{text.map(renderText)}</div>
            {media && (
              <div className="reveal min-h-0 flex-1" data-shown={isRevealed(media, reveal)} data-slide-media>
                {renderMedia(media, reveal)}
              </div>
            )}
          </div>
          <QuestionPanel question={lesson.questions[question.questionId]} />
        </main>
      ) : (
        <main
          className="mt-8 grid min-h-0 flex-1 gap-16"
          style={{ gridTemplateColumns: media ? 'minmax(0, 5fr) minmax(0, 7fr)' : 'minmax(0, 1fr)' }}
        >
          <div className="flex min-h-0 flex-col gap-4 [justify-content:safe_center]">{text.map(renderText)}</div>
          {media && (
            <div className="reveal min-h-0" data-shown={isRevealed(media, reveal)} data-slide-media>
              {renderMedia(media, reveal)}
            </div>
          )}
        </main>
      )}
    </div>
  )
}

function JoinChip() {
  const { code } = useSession()
  const url = studentJoinUrl(code)
  return (
    <div className="flex shrink-0 items-center gap-6 rounded-3xl border border-line-strong bg-surface/70 p-4 pr-8">
      <QRCodeBlock value={url} size={112} />
      <div>
        <div className="mono-label text-[17px]">Join on your phone</div>
        <div className="mt-1 font-mono text-[44px] font-bold leading-none tracking-[0.18em] text-accent">{code}</div>
        <div className="mt-2 max-w-[330px] break-all font-mono text-[15px] text-ink-faint">{url.replace(/^https?:\/\//, '')}</div>
      </div>
    </div>
  )
}

function TextBlock({ block }: { block: Block }) {
  const { lesson } = useSession()
  switch (block.type) {
    case 'concept':
      return <Concept block={block} />
    case 'equation':
      return <Equation block={block} />
    case 'summary':
      return (
        <div className="space-y-6">
          <div className="mono-label text-[22px]">{lesson.summary.heading}</div>
          {lesson.summary.rows.map((row) => (
            <div key={row.law} className="panel p-8">
              <div className="font-mono text-[26px] font-bold uppercase tracking-[0.16em] text-accent">{row.law}</div>
              <div className="mt-2 font-display text-[54px] leading-tight">“{row.question}”</div>
              {row.equation && (
                <div className="mt-3 flex items-baseline gap-6 text-[56px]">
                  <BlockMath latex={row.equation} align="left" className="text-entropy" />
                  {row.note && <span className="font-mono text-[22px] text-ink-dim">{row.note}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )
    default:
      return null
  }
}

function Concept({ block }: { block: ConceptBlock }) {
  const tone = block.tone ?? 'default'
  if (tone === 'stamp') {
    return (
      <div className="inline-block -rotate-2 rounded-xl border-[5px] border-accent px-9 py-4 font-mono text-[40px] font-bold tracking-[0.16em] text-accent">
        <RichText text={block.text} />
      </div>
    )
  }
  const bar = tone === 'key' ? 'border-accent' : tone === 'warning' ? 'border-bad' : 'border-transparent'
  return (
    <p className={`border-l-[10px] pl-8 text-[40px] leading-[1.2] ${bar} ${tone === 'default' ? 'text-ink' : 'font-medium'}`}>
      <RichText text={block.text} />
    </p>
  )
}

function Equation({ block }: { block: EquationBlock }) {
  const key = block.tone === 'key'
  return (
    <div className={key ? 'rounded-3xl border-2 border-accent bg-accent/10 px-9 py-3 shadow-[0_0_80px_-20px_var(--accent)]' : ''}>
      <BlockMath latex={block.latex} align="left" className={`${key ? 'text-[56px]' : 'text-[46px]'} text-ink`} />
      {block.caption && (
        <p className="font-mono text-[21px] text-ink-dim">
          <RichText text={block.caption} />
        </p>
      )}
    </div>
  )
}

function SimulationStage({ block, reveal }: { block: SimulationBlock; reveal: number }) {
  const view = useSessionSimulation(block, reveal)
  return (
    <ThermalContactSimulation
      snapshot={view.snapshot}
      params={view.params}
      declared={view.declared}
      visible={view.visible}
      variant="presentation"
      className="flex h-full min-h-0 flex-col"
    />
  )
}

const KIND_LABEL: Record<Question['kind'], string> = {
  prediction: 'Predict',
  'concept-check': 'Concept check',
  exit: 'Exit question',
}

function QuestionPanel({ question }: { question: Question | undefined }) {
  const { session, responses, participantCount, questionClock } = useSession()
  const open = Boolean(session?.questionOpen)
  const countdown = useCountdown(session?.questionTimerS ?? 0, open ? (questionClock?.startedAtMs ?? null) : null)
  if (!question || !session) return null

  const active = session.activeQuestionId === question.id
  const voting = active && open
  const showResults = active && session.resultsVisible
  const revealed = active && session.answerRevealed
  const tally = tallyResponses(responses, question)

  return (
    <section className={`panel flex min-h-0 flex-col p-7 transition-shadow duration-500 ${voting ? 'shadow-[0_0_90px_-24px_var(--good)]' : ''}`}>
      <div className="flex items-center justify-between gap-4">
        <span className="mono-label text-[20px]">{KIND_LABEL[question.kind]}</span>
        {voting ? (
          <VotingMeter answered={tally.total} joined={participantCount} timerS={session.questionTimerS} remainingS={countdown.remainingS} />
        ) : (
          <StatusChip active={active} showResults={showResults} revealed={revealed} total={tally.total} />
        )}
      </div>
      <h2 className="mt-4 font-display text-[40px] font-medium leading-[1.15]">
        <RichText text={question.prompt} />
      </h2>
      <div className="mt-5 flex min-h-0 flex-1 flex-col gap-2.5">
        {question.options.map((option, index) => {
          const style = optionStyle(index, question.options.length)
          const correct = option.id === question.correctOptionId
          const count = tally.counts[option.id] ?? 0
          const pct = percentOf(count, tally.total)
          const state = revealed ? (correct ? 'border-good bg-good/10' : 'border-line opacity-40') : 'border-line-strong bg-surface-2/60'
          return (
            <div key={option.id} className={`relative flex max-h-[170px] flex-1 items-center gap-5 overflow-hidden rounded-2xl border px-4 py-3 transition-all duration-500 ${state}`}>
              {showResults && (
                <div className="absolute inset-y-0 left-0 opacity-30 transition-[width] duration-700" style={{ width: `${pct}%`, background: style.bg }} />
              )}
              <span className="relative grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-[30px] font-bold" style={{ background: style.bg, color: style.ink }}>
                {revealed && correct ? '✓' : <Shape kind={style.shape} className="h-7 w-7" />}
              </span>
              <p className="relative min-w-0 flex-1 text-[28px] leading-snug">
                <RichText text={option.text} />
              </p>
              {showResults && (
                <div className="relative text-right">
                  <div className="font-mono text-[34px] font-bold leading-none tabular-nums">{pct}%</div>
                  <div className="mt-1 font-mono text-[16px] text-ink-dim">
                    {count} {count === 1 ? 'vote' : 'votes'}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      {revealed && (
        <p className="animate-rise mt-4 text-[24px] leading-snug text-ink-dim">
          <RichText text={question.explanation} />
        </p>
      )}
    </section>
  )
}

/** While voting is open: how many have answered (not WHAT they answered) and the countdown. */
function VotingMeter({ answered, joined, timerS, remainingS }: { answered: number; joined: number; timerS: number; remainingS: number }) {
  return (
    <div className="flex items-center gap-6">
      <div className="text-right">
        <div className="font-mono text-[36px] font-bold leading-none tabular-nums">
          {answered}
          <span className="text-ink-faint"> / {Math.max(joined, answered)}</span>
        </div>
        <div className="mono-label mt-2 flex items-center justify-end gap-2 text-[15px] text-good">
          <span className="h-2.5 w-2.5 animate-ring rounded-full bg-good" />
          answered
        </div>
      </div>
      {timerS > 0 && <CountdownRing remainingS={remainingS} totalS={timerS} size={88} />}
    </div>
  )
}

function StatusChip({
  active,
  showResults,
  revealed,
  total,
}: {
  active: boolean
  showResults: boolean
  revealed: boolean
  total: number
}): ReactNode {
  const base = 'inline-flex items-center gap-3 rounded-full border px-5 py-2 font-mono text-[18px] font-semibold uppercase tracking-[0.14em]'
  if (revealed) return <span className={`${base} border-good/50 bg-good/10 text-good`}>Answer · {total} {total === 1 ? 'response' : 'responses'}</span>
  if (showResults) return <span className={`${base} border-cold/50 bg-cold/10 text-cold`}>Results · {total} {total === 1 ? 'response' : 'responses'}</span>
  if (active) return <span className={`${base} border-line-strong text-ink-dim`}>Voting closed</span>
  return <span className={`${base} border-line text-ink-faint`}>Standby</span>
}
