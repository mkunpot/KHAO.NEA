/**
 * Which slides are too full for the projector? The projector slide is always 16:9 (1920×1080), so longer
 * wording does not make the slide grow — the text that does not fit is cut off at the bottom. This lays
 * every slide out, hidden, at its real size in the fullest state it can reach (every part revealed, the
 * question showing its results and explanation) and measures the real layout.
 *
 * Reveal stages do not change the layout (hidden parts keep their place), so one measurement per slide
 * covers all of them.
 */

import { memo, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { stepRevealStages } from '../lesson/cursor'
import type { LessonDefinition } from '../lesson/types'
import { StepSlide } from '../renderers/presentation/StepSlide'
import { PreviewSession } from '../session/PreviewSession'
import { measureOverflow, type Overflow } from './measureOverflow'

/** Slide number (0-based) → what is cut off on it. Slides that fit are absent. */
export type SlideFit = ReadonlyMap<number, Overflow>

/** Wait for a pause in typing before measuring, so it does not run on every keystroke. */
const SETTLE_MS = 400

function useSettled<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs])
  return settled
}

const FitProbe = memo(function FitProbe({ lesson, onMeasured }: { lesson: LessonDefinition; onMeasured: (fit: SlideFit) => void }) {
  const host = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const element = host.current
    if (!element) return
    const run = () => {
      const fit = new Map<number, Overflow>()
      element.querySelectorAll<HTMLElement>('[data-fit-step]').forEach((slide) => {
        const overflow = measureOverflow(slide)
        if (overflow) fit.set(Number(slide.dataset.fitStep), overflow)
      })
      onMeasured(fit)
    }
    run() // lays the slides out, which also starts loading any font they use…
    let cancelled = false
    void document.fonts?.ready.then(() => {
      if (!cancelled) run() // …and measure again once the real fonts are in, since they change line breaks
    })
    return () => {
      cancelled = true
    }
  }, [lesson, onMeasured])

  return (
    <div ref={host} aria-hidden inert className="pointer-events-none fixed left-[-10000px] top-0 opacity-0">
      {lesson.steps.map((step, index) => (
        <PreviewSession key={step.id} lesson={lesson} stepIndex={index} reveal={stepRevealStages(step)} question="results" role="presenter">
          <div data-fit-step={index} style={{ width: 1920, height: 1080 }} className="bg-[#03060c] text-ink">
            <StepSlide step={step} index={index} total={lesson.steps.length} />
          </div>
        </PreviewSession>
      ))}
    </div>
  )
})

/** `probe` must be rendered somewhere on the page (it is invisible); `fit` follows the lesson a moment after each change. */
export function useSlideFit(lesson: LessonDefinition): { fit: SlideFit; probe: ReactNode } {
  const settled = useSettled(lesson, SETTLE_MS)
  const [fit, setFit] = useState<SlideFit>(new Map())
  return { fit, probe: <FitProbe lesson={settled} onMeasured={setFit} /> }
}
