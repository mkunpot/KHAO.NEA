/**
 * One slide of the projector, drawn from a lesson step.
 *
 * It is laid out in 1920×1080 design pixels and fills whatever box it is put in: Spectacle's canvas
 * on the projector, a scaled frame in the lesson editor. It reads the lesson and the live session
 * from useSession(); nothing in here contains lesson text.
 */

import { useRef, type ReactNode } from 'react'
import { BlockMath, HighlightedRichText, RichText } from '../../components/Math'
import { HeatEngineDiagram } from '../../components/HeatEngineDiagram'
import { CountdownRing } from '../../components/CountdownRing'
import { optionStyle, Shape } from '../../components/optionStyle'
import { QRCodeBlock } from '../../components/QRCodeBlock'
import { isRevealed, positionAt, questionBlockOf, questionReviewBlockOf } from '../../lesson/cursor'
import type { Block, ConceptBlock, EquationBlock, ImageBlock, LessonStep, Question, SimulationBlock, TextBlock } from '../../lesson/types'
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

  const media = step.blocks.find((b) => b.type === 'simulation' || b.type === 'diagram' || b.type === 'image')
  const text = step.blocks.filter((b) => b !== media && (b.type === 'concept' || b.type === 'text' || b.type === 'equation' || b.type === 'summary'))
  const question = questionBlockOf(step) ?? questionReviewBlockOf(step)

  if (lesson.id === 'fridge-room') {
    return <FridgeRoomSlide step={step} index={index} total={total} question={question ? lesson.questions[question.questionId] : undefined} />
  }

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
    ) : block.type === 'image' ? (
      <ImageStage block={block} />
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

/**
 * A deliberately separate art direction for the short refrigerator prediction lesson.
 * It is a projector-first poster: the large question and answer strips do the teaching,
 * while the refrigerator and heat stream establish the physical situation at a glance.
 */
function FridgeRoomSlide({ step, index, total, question }: { step: LessonStep; index: number; total: number; question: Question | undefined }) {
  const supportingText = step.blocks.filter((block): block is TextBlock => block.type === 'text')
  const heroImage = step.blocks.find((block): block is ImageBlock => block.type === 'image')
  if (heroImage) return <FridgeMuseumSlide step={step} index={index} total={total} question={question} heroImage={heroImage} supportingText={supportingText} />

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#f5efe2] px-[96px] pb-[56px] pt-[52px] text-[#071b35]">
      <div className="absolute inset-0 opacity-[0.17]" style={{ backgroundImage: 'radial-gradient(#071b35 0.8px, transparent 0.8px)', backgroundSize: '8px 8px' }} />
      <div className="absolute -right-[190px] top-[205px] h-[270px] w-[570px] rounded-[50%] border-[28px] border-[#f04c24]/60 blur-[1px]" />
      <div className="absolute -right-[220px] top-[280px] h-[220px] w-[540px] rounded-[50%] border-[18px] border-[#f88a43]/55" />
      <FridgeArtwork />

      <header className="relative z-10 flex items-start justify-between gap-12">
        <div>
          <p className="font-mono text-[22px] font-bold tracking-[0.16em] text-[#e94e28]">
            {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
          </p>
          <p className="mt-3 max-w-[760px] font-display text-[66px] font-semibold leading-[0.98] tracking-tight">{step.title}</p>
          {supportingText.map((block) => (
            <p key={block.id} className="mt-5 max-w-[790px] text-[25px] font-medium leading-snug text-[#38506c]">
              <HighlightedRichText text={block.text} highlights={block.highlights} />
            </p>
          ))}
        </div>
        <JoinChip poster />
      </header>

      {question ? (
        <main className="relative z-10 mt-4 flex min-h-0 flex-1 flex-col justify-end">
          <QuestionPanel question={question} poster />
        </main>
      ) : (
        <main className="relative z-10 mt-8 flex min-h-0 flex-1 items-end">
          <div className="max-w-[1080px] space-y-5">
            {step.blocks.filter((block) => block.type === 'concept').map((block) => (
              <p key={block.id} className="text-[45px] font-medium leading-[1.14]">
                <RichText text={block.text} />
              </p>
            ))}
          </div>
        </main>
      )}
    </div>
  )
}

/** The first fridge slide is a science-museum poster: image is the evidence, copy only frames it. */
function FridgeMuseumSlide({
  step,
  index,
  total,
  question,
  heroImage,
  supportingText,
}: {
  step: LessonStep
  index: number
  total: number
  question: Question | undefined
  heroImage: ImageBlock
  supportingText: TextBlock[]
}) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#f7f0e3] text-[#061a36]">
      <img src={heroImage.src} alt={heroImage.alt} className="absolute inset-y-0 right-0 h-full w-[72%] object-cover object-[42%_center]" />
      <div className="absolute inset-y-0 left-0 w-[30%] bg-[#f7f0e3]" />
      <div className="absolute inset-y-0 left-[28%] w-24 bg-[linear-gradient(90deg,#f7f0e3_0%,rgba(247,240,227,0)_100%)]" />
      <div className="absolute inset-x-[30%] bottom-0 h-[26%] bg-[linear-gradient(0deg,rgba(4,18,42,0.16),transparent)]" />

      <header className="absolute left-[72px] top-[66px] z-10 w-[455px]">
        <p className="font-mono text-[18px] font-bold tracking-[0.16em] text-[#e94e28]">
          {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
        </p>
        <p className="mt-5 font-display text-[62px] font-semibold leading-[0.98] tracking-tight">{step.title}</p>
        {supportingText.map((block) => (
          <p key={block.id} className="mt-7 max-w-[430px] text-[21px] font-medium leading-[1.35] text-[#38506c]">
            <HighlightedRichText text={block.text} highlights={block.highlights} />
          </p>
        ))}
      </header>

      <div className="absolute right-[56px] top-[42px] z-10"><JoinChip poster compact /></div>
      {question && <QuestionPanel question={question} poster museum />}
    </div>
  )
}

function FridgeArtwork() {
  return (
    <div className="absolute right-[255px] top-[205px] z-0 h-[310px] w-[198px] rounded-l-[24px] rounded-r-[10px] border-[11px] border-[#227eb7] bg-[linear-gradient(135deg,#c9ecf4,#77bee1_55%,#2d83b9)] p-4 opacity-70 shadow-[-15px_18px_0_#071b35]">
      <div className="h-full rounded-[12px] border-[11px] border-[#e9fbff] bg-[#b9e9f3]/60 p-6 shadow-inner">
        <div className="h-[31%] border-b-[5px] border-[#e9fbff]" />
        <div className="mt-3 h-[31%] border-b-[5px] border-[#e9fbff]" />
        <div className="mt-3 h-[20%] rounded-b-md border border-[#e9fbff]" />
      </div>
      <span className="absolute -right-[22px] top-8 h-[190px] w-5 rounded-full bg-[#16577d]" />
    </div>
  )
}

function JoinChip({ poster = false, compact = false }: { poster?: boolean; compact?: boolean }) {
  const { code } = useSession()
  const url = studentJoinUrl(code)
  return (
    <div className={`flex shrink-0 items-center rounded-3xl border ${compact ? 'gap-3 p-2.5 pr-4' : 'gap-6 p-4 pr-8'} ${poster ? 'border-[#071b35] bg-[#fffaf0]/90 text-[#071b35] shadow-[7px_7px_0_#071b35]' : 'border-line-strong bg-surface/70'}`}>
      <QRCodeBlock value={url} size={compact ? 76 : 112} />
      <div>
        <div className={`mono-label ${compact ? 'text-[13px]' : 'text-[17px]'} ${poster ? 'text-[#071b35]' : ''}`}>Join on your phone</div>
        <div className={`mt-1 font-mono font-bold leading-none tracking-[0.18em] ${compact ? 'text-[31px]' : 'text-[44px]'} ${poster ? 'text-[#e94e28]' : 'text-accent'}`}>{code}</div>
        {!compact && <div className={`mt-2 max-w-[330px] break-all font-mono text-[15px] ${poster ? 'text-[#38506c]' : 'text-ink-faint'}`}>{url.replace(/^https?:\/\//, '')}</div>}
      </div>
    </div>
  )
}

function TextBlock({ block }: { block: Block }) {
  const { lesson } = useSession()
  switch (block.type) {
    case 'concept':
      return <Concept block={block} />
    case 'text':
      return <PresetText block={block} />
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

const TEXT_PRESETS: Record<TextBlock['role'], string> = {
  kicker: 'font-mono text-[22px] font-semibold tracking-[0.16em] uppercase text-accent',
  title: 'font-display text-[84px] font-semibold leading-[1.02] tracking-tight text-ink',
  subtitle: 'font-display text-[52px] font-medium leading-[1.12] text-ink-dim',
  section: 'font-display text-[62px] font-semibold leading-[1.08] text-ink',
  body: 'text-[38px] font-medium leading-[1.28] text-ink',
  callout: 'rounded-3xl border-2 border-accent bg-accent/10 px-8 py-5 text-[44px] font-semibold leading-[1.15] text-ink shadow-[0_0_80px_-20px_var(--accent)]',
  caption: 'font-mono text-[20px] leading-relaxed text-ink-dim',
}

function PresetText({ block }: { block: TextBlock }) {
  const align = block.align === 'center' ? 'text-center' : block.align === 'right' ? 'text-right' : 'text-left'
  const motion = block.animation && block.animation !== 'none' ? `text-motion-${block.animation}` : ''
  return (
    <p className={`${TEXT_PRESETS[block.role]} ${align} ${motion}`}>
      <HighlightedRichText text={block.text} highlights={block.highlights} />
    </p>
  )
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

function ImageStage({ block }: { block: ImageBlock }) {
  return (
    <figure className="flex h-full min-h-0 flex-col gap-4">
      <img src={block.src} alt={block.alt} className={`min-h-0 w-full flex-1 rounded-3xl ${block.fit === 'cover' ? 'object-cover' : 'object-contain'}`} />
      {block.caption && <figcaption className="shrink-0 text-center font-mono text-[20px] text-ink-dim"><RichText text={block.caption} /></figcaption>}
    </figure>
  )
}

const KIND_LABEL: Record<Question['kind'], string> = {
  prediction: 'Predict',
  'concept-check': 'Concept check',
  exit: 'Exit question',
}

function QuestionPanel({ question, poster = false, darkPoster = false, museum = false }: { question: Question | undefined; poster?: boolean; darkPoster?: boolean; museum?: boolean }) {
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
    <section className={museum ? 'absolute inset-x-[28px] bottom-[34px] z-20 flex min-h-0 flex-col' : poster ? `flex min-h-0 flex-col ${darkPoster ? 'rounded-[30px] bg-[#06152b]/72 p-7 backdrop-blur-[3px]' : ''}` : `panel flex min-h-0 flex-col p-7 transition-shadow duration-500 ${voting ? 'shadow-[0_0_90px_-24px_var(--good)]' : ''}`}>
      <div className={`flex items-center justify-between gap-4 ${museum ? 'hidden' : ''}`}>
        <span className={`mono-label text-[20px] ${poster ? 'text-[#e94e28]' : ''}`}>{KIND_LABEL[question.kind]}</span>
        {voting ? (
          <VotingMeter answered={tally.total} joined={participantCount} timerS={session.questionTimerS} remainingS={countdown.remainingS} />
        ) : (
          <StatusChip active={active} showResults={showResults} revealed={revealed} total={tally.total} />
        )}
      </div>
      <h2 className={museum ? 'ml-[400px] rounded-[44px] bg-[#061a36] px-9 py-5 font-display text-[45px] font-semibold leading-[1.05] tracking-tight text-white shadow-[0_7px_0_#061a36]' : poster ? `mt-4 max-w-[1160px] font-display text-[72px] font-semibold leading-[1.02] tracking-tight ${darkPoster ? 'text-white' : ''}` : 'mt-4 font-display text-[40px] font-medium leading-[1.15]'}>
        <RichText text={question.prompt} />
      </h2>
      <div className={poster ? `${museum ? 'mt-5' : 'mt-9'} grid min-h-0 flex-1 grid-cols-4 gap-3` : 'mt-5 flex min-h-0 flex-1 flex-col gap-2.5'}>
        {question.options.map((option, index) => {
          const style = optionStyle(index, question.options.length)
          const correct = option.id === question.correctOptionId
          const count = tally.counts[option.id] ?? 0
          const pct = percentOf(count, tally.total)
          const state = revealed ? (correct ? 'border-good bg-good/10' : 'border-line opacity-40') : 'border-line-strong bg-surface-2/60'
          return (
            <div key={option.id} className={poster ? `relative flex ${museum ? 'min-h-[108px] flex-row items-center gap-4 rounded-[18px] px-4 py-3' : 'min-h-[165px] flex-col items-start justify-center gap-3 rounded-[24px] px-6 py-5'} overflow-hidden border-2 border-[#071b35] shadow-[5px_6px_0_#071b35] ${revealed && !correct ? 'opacity-40' : ''}` : `relative flex max-h-[170px] flex-1 items-center gap-5 overflow-hidden rounded-2xl border px-4 py-3 transition-all duration-500 ${state}`} style={poster ? { background: style.bg, color: style.ink } : undefined}>
              {showResults && (
                <div className="absolute inset-y-0 left-0 opacity-30 transition-[width] duration-700" style={{ width: `${pct}%`, background: style.bg }} />
              )}
              <span className={`relative grid ${museum ? 'h-11 w-11 rounded-xl text-[23px]' : 'h-14 w-14 rounded-2xl text-[30px]'} shrink-0 place-items-center font-bold ${poster ? 'bg-[#fffaf0]' : ''}`} style={poster ? { color: '#071b35' } : { background: style.bg, color: style.ink }}>
                {revealed && correct ? '✓' : <Shape kind={style.shape} className="h-7 w-7" />}
              </span>
              <p className={poster ? `relative min-w-0 font-bold leading-[1.08] ${museum ? 'text-[19px]' : 'text-[29px]'}` : 'relative min-w-0 flex-1 text-[28px] leading-snug'}>
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
        <>
          <p className="mt-4 font-mono text-[18px] font-bold uppercase tracking-[0.12em] text-good">
            Correct: {percentOf(tally.counts[question.correctOptionId] ?? 0, tally.total)}% of answers
          </p>
          <p className="animate-rise mt-3 text-[24px] leading-snug text-ink-dim">
            <RichText text={question.explanation} />
          </p>
        </>
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
