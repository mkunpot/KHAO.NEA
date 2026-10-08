/**
 * What the class will see, drawn by the same renderers the classroom uses: the slide as the projector
 * shows it, and — when the slide asks a question — the phone. Both follow the lesson being edited live.
 */

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { questionBlockOf, stepRevealStages } from '../lesson/cursor'
import type { LessonDefinition } from '../lesson/types'
import { StepSlide } from '../renderers/presentation/StepSlide'
import { StudentRenderer } from '../renderers/student/StudentRenderer'
import { PreviewSession, type PreviewQuestionState } from '../session/PreviewSession'
import { Segmented } from './fields'
import type { Overflow } from './measureOverflow'

/** Lays `children` out at a fixed design size and shrinks the whole picture to the width this box is given. */
function ScaledStage({ width, height, className = '', children }: { width: number; height: number; className?: string; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0)
  useLayoutEffect(() => {
    const element = box.current
    if (!element) return
    const measure = () => setScale(element.clientWidth / width)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [width])

  return (
    <div ref={box} className={`relative overflow-hidden ${className}`} style={{ aspectRatio: `${width} / ${height}` }}>
      {/* The transform also makes this the containing block of the phone's `position: fixed` screens. */}
      <div className="pointer-events-none absolute left-0 top-0 select-none" style={{ width, height, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        {children}
      </div>
    </div>
  )
}

const QUESTION_STATES: Array<{ value: PreviewQuestionState; label: string }> = [
  { value: 'none', label: 'Before voting' },
  { value: 'voting', label: 'Voting' },
  { value: 'results', label: 'Results' },
]

/**
 * Remount it (`key`) when the slide changes: it starts fully revealed, on the results, so every word is visible.
 * `tooFull` says that part of this slide does not fit the (always 16:9) projector slide and is cut off.
 */
export function Preview({ lesson, stepIndex, tooFull }: { lesson: LessonDefinition; stepIndex: number; tooFull?: Overflow }) {
  const step = lesson.steps[stepIndex]
  const stages = step ? stepRevealStages(step) : 0
  const asksQuestion = step ? questionBlockOf(step) !== undefined : false
  const [reveal, setReveal] = useState(stages)
  const [question, setQuestion] = useState<PreviewQuestionState>('results')
  if (!step) return null

  const shownReveal = Math.min(reveal, stages)

  return (
    <section className="panel p-4" aria-label="Preview">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="mono-label">Projector · always 16:9</p>
        <div className="flex flex-wrap items-center gap-2">
          {stages > 0 && (
            <Segmented
              label="Reveal step"
              value={shownReveal}
              onChange={setReveal}
              options={Array.from({ length: stages + 1 }, (_, i) => ({ value: i, label: i === 0 ? 'Start' : `+${i}` }))}
            />
          )}
          {asksQuestion && <Segmented label="Question" value={question} onChange={setQuestion} options={QUESTION_STATES} />}
        </div>
      </div>

      {tooFull && (
        <p className="mt-3 rounded-xl border border-accent/50 bg-accent/10 px-4 py-3 text-sm leading-relaxed text-accent" aria-live="polite">
          ⚠ <b>This slide is too full.</b>{' '}
          {tooFull.kind === 'cut-off'
            ? `The slide is always 16:9, so what does not fit is cut off — around “${tooFull.sample}”.`
            : 'The slide is always 16:9, so the long text squeezes the simulation into a box too small to read from the back of the room.'}{' '}
          Shorten the wording, or move part of it to the next slide.
        </p>
      )}

      <ScaledStage width={1920} height={1080} className={`mt-3 rounded-xl border ${tooFull ? 'border-accent' : 'border-line'}`}>
        <PreviewSession lesson={lesson} stepIndex={stepIndex} reveal={shownReveal} question={question} role="presenter">
          <div style={{ width: 1920, height: 1080 }} className="bg-[#03060c] text-ink">
            <StepSlide step={step} index={stepIndex} total={lesson.steps.length} />
          </div>
        </PreviewSession>
      </ScaledStage>
      <p className="mt-2 text-xs text-ink-faint">Sample classroom: 20 students{asksQuestion && question !== 'none' ? ', made-up answers' : ''}.</p>

      {asksQuestion && (
        <div className="mt-5 border-t border-line pt-4">
          <p className="mono-label">Phone</p>
          {question === 'none' ? (
            <p className="mt-2 text-sm text-ink-dim">Phones say “Waiting for teacher…” until voting opens. Choose Voting or Results above to see the question.</p>
          ) : (
            <div className="mx-auto mt-3 w-[220px]">
              <ScaledStage width={390} height={760} className="rounded-[2rem] border-4 border-line-strong bg-bg">
                <PreviewSession lesson={lesson} stepIndex={stepIndex} reveal={shownReveal} question={question} role="student">
                  <div className="relative overflow-hidden" style={{ width: 390, height: 760 }}>
                    <StudentRenderer />
                  </div>
                </PreviewSession>
              </ScaledStage>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
