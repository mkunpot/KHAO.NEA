/**
 * The canonical lesson schema. Pure data: no React, no Spectacle, no Supabase.
 *
 * One LessonDefinition drives all three rendering states:
 *   - Presentation  (projector)     — shows concept / equation / diagram / simulation / question blocks, with progressive reveal
 *   - Live Student  (phone)         — shows only the active question and a compact simulation read-out
 *   - Self-Study    (after class)   — shows every block, including long-form explanations, with free interaction
 *
 * Any string may contain inline math written between dollar signs, e.g. "$\Delta S \ge 0$".
 */

import type { ReadoutKey, SimulationControl, ThermalParams } from '../simulations/thermal-contact/types'

export interface LessonDefinition {
  id: string
  metadata: LessonMetadata
  objectives: string[]
  simulations: Record<string, SimulationSpec>
  questions: Record<string, Question>
  steps: LessonStep[]
  summary: LessonSummary
}

export interface LessonMetadata {
  title: string
  subtitle: string
  level: string
  durationMinutes: number
  prerequisites: string[]
}

export interface SimulationSpec {
  id: string
  kind: 'thermal-contact'
  title: string
  params: ThermalParams
  /** Modelling assumptions, shown next to the simulation in Self-Study. */
  assumptions: string[]
}

export interface Question {
  id: string
  /** Why the question is asked; renderers use it for a small label. */
  kind: 'prediction' | 'concept-check' | 'exit'
  prompt: string
  options: QuestionOption[]
  correctOptionId: string
  /** Shown after the answer is revealed (class) or on request (Self-Study). */
  explanation: string
}

export interface QuestionOption {
  id: string
  text: string
}

/** One teaching segment of the 15-minute lesson. A step may contain several progressive-reveal stages. */
export interface LessonStep {
  id: string
  title: string
  /** Planned minutes for this step; the lesson's steps add up to metadata.durationMinutes. */
  minutes: number
  blocks: Block[]
}

interface BlockBase {
  id: string
  /** Presentation only: the reveal stage at which the block appears (0 or undefined = visible immediately). */
  reveal?: number
}

export interface ConceptBlock extends BlockBase {
  type: 'concept'
  text: string
  tone?: 'default' | 'key' | 'warning' | 'stamp'
}

/** Modern, preset-driven copy for titles, subheads and supporting text. */
export type TextRole = 'kicker' | 'title' | 'subtitle' | 'section' | 'body' | 'callout' | 'caption'
export type TextAnimation = 'none' | 'fade' | 'rise'

export interface TextBlock extends BlockBase {
  type: 'text'
  text: string
  /** The role fixes type scale, colour, weight and line-height—authors never tune raw CSS values. */
  role: TextRole
  align?: 'left' | 'center' | 'right'
  /** Exact words or `$…$` inline equations to draw attention to. */
  highlights?: string[]
  animation?: TextAnimation
}

export interface EquationBlock extends BlockBase {
  type: 'equation'
  latex: string
  caption?: string
  tone?: 'default' | 'key'
}

export interface SimulationBlock extends BlockBase {
  type: 'simulation'
  simulationId: string
  /**
   * initial — bodies at their starting temperatures, not in contact (static)
   * settled — final state of the spontaneous process (static)
   * live    — running; driven by the classroom session (Presentation/Student) or by the learner (Self-Study)
   */
  display: 'initial' | 'settled' | 'live'
  /** Which controls are relevant here (teacher buttons in class, learner buttons in Self-Study). */
  controls: SimulationControl[]
  /** Read-outs shown, each with the reveal stage at which it appears. A missing key means "not shown". */
  readouts: Partial<Record<ReadoutKey, number>>
}

export interface QuestionBlock extends BlockBase {
  type: 'question'
  questionId: string
  /**
   * `deferred` collects an answer now but deliberately withholds the result until a
   * later `question-review` block. Useful for a pre-test or a prediction.
   */
  answerTiming?: 'immediate' | 'deferred'
  /**
   * In the teacher's guided flow: the reveal stage that must be on screen before voting opens
   * (default 0 = vote first, reveal afterwards).
   */
  afterReveal?: number
}

/** Revisit a previously asked deferred question, normally at the end of a lesson. */
export interface QuestionReviewBlock extends BlockBase {
  type: 'question-review'
  questionId: string
}

/** Long-form prose. Self-Study only — too wordy for a projector slide. */
export interface ExplanationBlock extends BlockBase {
  type: 'explanation'
  title?: string
  paragraphs: string[]
}

export interface DiagramBlock extends BlockBase {
  type: 'diagram'
  diagramId: 'heat-engine'
  caption?: string
}

/** A raster or SVG visual, served from `public/` (for example `/lesson-assets/fridge.png`) or HTTPS. */
export interface ImageBlock extends BlockBase {
  type: 'image'
  src: string
  /** Meaningful description for assistive technology; use an empty string only for purely decorative art. */
  alt: string
  /** `contain` keeps the whole image; `cover` fills its stage and may crop its edges. */
  fit?: 'contain' | 'cover'
  caption?: string
}

/** Renders lesson.summary. */
export interface SummaryBlock extends BlockBase {
  type: 'summary'
}

export type Block =
  | ConceptBlock
  | TextBlock
  | EquationBlock
  | SimulationBlock
  | QuestionBlock
  | QuestionReviewBlock
  | ExplanationBlock
  | DiagramBlock
  | ImageBlock
  | SummaryBlock

export interface LessonSummary {
  heading: string
  rows: Array<{ law: string; question: string; equation?: string; note?: string }>
}
