/**
 * The guided flow: ONE button for the whole lesson.
 *
 * `planNext` looks at where the class is (the session state) and the lesson, and says what the next
 * press of the big button should do — start the lesson, run the simulation, reveal the next part of
 * the slide, open voting, show the results, move on. The teacher never has to decide *which* button;
 * the label always says what is about to happen. It is a pure function of (state, lesson, settings),
 * so it is easy to test and the buttons can be rebuilt however the UI likes.
 */

import {
  positionAt,
  questionBlockOf,
  simulationBlockOf,
  stepAt,
  stepRevealStages,
} from '../lesson/cursor'
import type { EquationBlock, LessonDefinition, LessonStep } from '../lesson/types'
import type { ClassroomEvent } from '../realtime/events'
import type { ReadoutKey } from '../simulations/thermal-contact/types'
import { reduceSession } from './sessionReducer'
import type { SessionState } from './sessionTypes'

export type BeatKind = 'start' | 'simulate' | 'reveal' | 'open-question' | 'finish-question' | 'next-step' | 'end'

export interface Beat {
  kind: BeatKind
  /** Text of the big button. */
  label: string
  /** One short line under it: what the press will do. */
  hint: string
  /** The command(s) to send. A function because some carry the moment of the press. */
  events: (now: number) => ClassroomEvent[]
  /** True when there is nothing left to do. */
  disabled?: boolean
}

export interface ScriptSettings {
  /** Countdown given to each question, in seconds (0 = none). */
  timerS: number
  /** Close voting by itself when everyone who joined has answered. */
  finishWhenAllAnswered: boolean
}

export const DEFAULT_SCRIPT_SETTINGS: ScriptSettings = { timerS: 30, finishWhenAllAnswered: true }

const READOUT_NAMES: Record<ReadoutKey, string> = {
  tHot: 'T_hot',
  tCold: 'T_cold',
  heat: 'Q',
  dSHot: 'ΔS_hot',
  dSCold: 'ΔS_cold',
  dSTotal: 'ΔS_total',
}

/** Best-effort plain text for a LaTeX fragment (used only for the one-line hints). */
function plainLatex(latex: string): string {
  return latex
    .replace(/\\Delta\s*/g, 'Δ')
    .replace(/\\ge\b/g, '≥')
    .replace(/\\le\b/g, '≤')
    .replace(/\\text\{([^}]*)\}/g, '$1')
    .replace(/_\{([^}]*)\}/g, '_$1')
    .replace(/\\[a-zA-Z]+/g, '')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function plainText(text: string): string {
  return text
    .split('$')
    .map((part, index) => (index % 2 === 1 ? plainLatex(part) : part))
    .join('')
}

function describeEquation(block: EquationBlock): string {
  const body = /\\frac/.test(block.latex) ? '' : plainLatex(block.latex)
  return [body, block.caption ? plainText(block.caption) : ''].filter(Boolean).join(' — ')
}

/** What appears on the slide at a reveal stage, as a short phrase. */
function describeReveal(step: LessonStep, stage: number): string {
  const parts: string[] = []
  for (const block of step.blocks) {
    if ((block.reveal ?? 0) !== stage) continue
    if (block.type === 'concept') parts.push(plainText(block.text))
    else if (block.type === 'equation') parts.push(describeEquation(block))
    else if (block.type === 'summary') parts.push('The summary')
  }
  if (parts.length === 0) {
    for (const block of step.blocks) {
      if (block.type !== 'simulation') continue
      for (const [key, at] of Object.entries(block.readouts)) {
        if (at === stage) parts.push(READOUT_NAMES[key as ReadoutKey])
      }
    }
  }
  const text = parts.join(' · ')
  return text.length > 90 ? `${text.slice(0, 87)}…` : text || 'The next part of the slide'
}

export function planNext(state: SessionState, lesson: LessonDefinition, settings: ScriptSettings): Beat {
  if (!state.started) {
    return {
      kind: 'start',
      label: 'Start lesson',
      hint: 'Show the first slide on the projector.',
      events: () => [{ type: 'START_LESSON' }],
    }
  }

  const step = stepAt(lesson, state.currentStep)
  const { stepIndex, reveal } = positionAt(lesson, state.currentStep)
  const lastReveal = stepRevealStages(step)
  const simulation = simulationBlockOf(step)
  const questionBlock = questionBlockOf(step)
  const question = questionBlock ? lesson.questions[questionBlock.questionId] : undefined

  // 1. A live simulation that has not been run in this step yet.
  if (simulation?.display === 'live' && state.sim.mode === 'idle') {
    const spec = lesson.simulations[simulation.simulationId]
    const mode = simulation.controls.includes('connect') ? 'forward' : simulation.controls.includes('reverse') ? 'reverse' : null
    if (spec && mode) {
      return {
        kind: 'simulate',
        label: mode === 'forward' ? 'Connect the bodies' : 'Try the reverse',
        hint: mode === 'forward' ? 'Heat starts flowing hot → cold on every screen.' : 'Show the hypothetical cold → hot transfer.',
        events: (now) => [
          { type: 'START_SIMULATION', simulationId: simulation.simulationId, mode, startedAt: now, params: spec.params },
        ],
      }
    }
  }

  // 2. The question, once the slide has shown what it needs to.
  if (question && questionBlock) {
    const active = state.activeQuestionId === question.id
    if (!active && reveal >= (questionBlock.afterReveal ?? 0)) {
      return {
        kind: 'open-question',
        label: 'Open voting',
        hint: settings.timerS > 0 ? `Phones show the question; ${settings.timerS} s countdown starts.` : 'Phones show the question. No time limit.',
        events: () => [{ type: 'OPEN_QUESTION', questionId: question.id, timerS: settings.timerS }],
      }
    }
    if (active && !state.answerRevealed) {
      const automatic = state.questionOpen && (settings.finishWhenAllAnswered || settings.timerS > 0)
      return {
        kind: 'finish-question',
        label: 'Show results',
        hint: automatic
          ? 'Closes by itself when everyone has answered or time runs out — press to show now.'
          : state.questionOpen
            ? 'Close voting and show the results and the correct answer.'
            : 'Show the results and the correct answer.',
        events: () => [{ type: 'FINISH_QUESTION', questionId: question.id }],
      }
    }
  }

  // 3. The next reveal stage on the slide.
  if (reveal < lastReveal) {
    return {
      kind: 'reveal',
      label: 'Reveal next',
      hint: describeReveal(step, reveal + 1),
      events: () => [{ type: 'NEXT_STEP' }],
    }
  }

  // 4. On to the next step, or the end.
  const next = lesson.steps[stepIndex + 1]
  if (next) {
    return {
      kind: 'next-step',
      label: `Next: ${next.title}`,
      hint: `${next.minutes} min`,
      events: () => [{ type: 'NEXT_STEP' }],
    }
  }
  return { kind: 'end', label: 'End of lesson', hint: 'That was the last step.', events: () => [], disabled: true }
}

/** What the press after this one will be — shown as "Then: …". */
export function planAfter(
  state: SessionState,
  beat: Beat,
  lesson: LessonDefinition,
  settings: ScriptSettings,
  now: number,
): Beat {
  const next = beat.events(now).reduce((s, event) => reduceSession(s, event, lesson), state)
  return planNext(next, lesson, settings)
}
