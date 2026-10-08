/**
 * The teacher advances through the lesson one "position" at a time. A position is a
 * (step, reveal stage) pair, flattened into a single integer — the session's `current_step`.
 * Progressive reveal inside a step therefore needs no extra state.
 */

import type { Block, LessonDefinition, LessonStep, QuestionBlock, QuestionReviewBlock, SimulationBlock } from './types'
import type { ReadoutKey } from '../simulations/thermal-contact/types'

export interface CursorPosition {
  stepIndex: number
  reveal: number
}

export function blockReveal(block: Block): number {
  return block.reveal ?? 0
}

/** Number of reveal stages after the initial view (0 = the step has no progressive reveal). */
export function stepRevealStages(step: LessonStep): number {
  let max = 0
  for (const block of step.blocks) {
    max = Math.max(max, blockReveal(block))
    if (block.type === 'simulation') {
      for (const stage of Object.values(block.readouts)) {
        if (typeof stage === 'number') max = Math.max(max, stage)
      }
    }
  }
  return max
}

const cache = new WeakMap<LessonDefinition, CursorPosition[]>()

export function cursorPositions(lesson: LessonDefinition): CursorPosition[] {
  const cached = cache.get(lesson)
  if (cached) return cached
  const positions: CursorPosition[] = []
  lesson.steps.forEach((step, stepIndex) => {
    for (let reveal = 0; reveal <= stepRevealStages(step); reveal++) positions.push({ stepIndex, reveal })
  })
  cache.set(lesson, positions)
  return positions
}

/** The cursor of a step's first position (its initial view, before any reveal). */
export function firstPositionOfStep(lesson: LessonDefinition, stepIndex: number): number {
  const index = cursorPositions(lesson).findIndex((p) => p.stepIndex === stepIndex)
  return index < 0 ? 0 : index
}

export function positionCount(lesson: LessonDefinition): number {
  return cursorPositions(lesson).length
}

export function clampCursor(lesson: LessonDefinition, cursor: number): number {
  const last = positionCount(lesson) - 1
  if (!Number.isFinite(cursor)) return 0
  return Math.min(Math.max(Math.trunc(cursor), 0), last)
}

export function positionAt(lesson: LessonDefinition, cursor: number): CursorPosition {
  const position = cursorPositions(lesson)[clampCursor(lesson, cursor)]
  if (!position) throw new Error(`Lesson "${lesson.id}" has no steps`)
  return position
}

export function stepAt(lesson: LessonDefinition, cursor: number): LessonStep {
  const step = lesson.steps[positionAt(lesson, cursor).stepIndex]
  if (!step) throw new Error(`Lesson "${lesson.id}" has no step for cursor ${cursor}`)
  return step
}

export function questionBlockOf(step: LessonStep): QuestionBlock | undefined {
  return step.blocks.find((b): b is QuestionBlock => b.type === 'question')
}

export function questionIdOf(step: LessonStep): string | undefined {
  return questionBlockOf(step)?.questionId
}

export function questionReviewBlockOf(step: LessonStep): QuestionReviewBlock | undefined {
  return step.blocks.find((b): b is QuestionReviewBlock => b.type === 'question-review')
}

export function simulationBlockOf(step: LessonStep): SimulationBlock | undefined {
  return step.blocks.find((b): b is SimulationBlock => b.type === 'simulation')
}

export function isRevealed(block: Block, reveal: number): boolean {
  return blockReveal(block) <= reveal
}

export function isReadoutVisible(block: SimulationBlock, key: ReadoutKey, reveal: number): boolean {
  const stage = block.readouts[key]
  return stage !== undefined && stage <= reveal
}

/** Sum of the planned minutes of every step. */
export function totalMinutes(lesson: LessonDefinition): number {
  return lesson.steps.reduce((sum, step) => sum + step.minutes, 0)
}
