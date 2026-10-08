/**
 * Can the renderers run this lesson? Pure data checks — no React, no KaTeX — so one function guards
 * three doors: the lesson editor (live feedback), a saved draft (is it still usable?) and a lesson
 * arriving inside a session row from the database (JSON from outside is never trusted).
 *
 *   error    — the app could crash or silently drop content (a question that does not exist, no steps…).
 *              A lesson with errors is never used for a class.
 *   warning  — it runs, but a field a teacher would expect to be filled in is empty.
 */

import { isThermalParams } from '../simulations/thermal-contact/model'
import type { LessonDefinition } from './types'

export interface LessonProblem {
  severity: 'error' | 'warning'
  /** Where, in the notation the editor uses for its fields — e.g. `steps[2].blocks[0].text`. */
  path: string
  /** Plain words for a teacher. */
  message: string
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const isCount = (value: unknown): boolean => typeof value === 'number' && Number.isInteger(value) && value >= 0
const at = (path: string, key: string) => (path ? `${path}.${key}` : key)

const QUESTION_KINDS = ['prediction', 'concept-check', 'exit']
const CONCEPT_TONES = ['default', 'key', 'warning', 'stamp']
const EQUATION_TONES = ['default', 'key']
const DISPLAYS = ['initial', 'settled', 'live']
const CONTROLS = ['connect', 'reverse', 'reset']
const READOUTS = ['tHot', 'tCold', 'heat', 'dSHot', 'dSCold', 'dSTotal']
/** Every answer option gets its own colour and shape (▲ ◆ ● ■), so there are at most four. */
export const MAX_OPTIONS = 4

export function validateLesson(input: unknown): LessonProblem[] {
  const problems: LessonProblem[] = []
  const error = (path: string, message: string) => void problems.push({ severity: 'error', path, message })
  const warning = (path: string, message: string) => void problems.push({ severity: 'warning', path, message })

  /** A text field that must exist; empty text is only a warning. */
  const text = (owner: Record<string, unknown>, key: string, path: string, label: string) => {
    const value = owner[key]
    if (typeof value !== 'string') error(at(path, key), `${label} is missing`)
    else if (value.trim() === '') warning(at(path, key), `${label} is empty`)
  }
  /** A text field that may be left out. */
  const optionalText = (owner: Record<string, unknown>, key: string, path: string, label: string) => {
    if (owner[key] !== undefined && typeof owner[key] !== 'string') error(at(path, key), `${label} must be text`)
  }
  const textList = (value: unknown, path: string, label: string) => {
    if (!Array.isArray(value)) return void error(path, `${label} list is missing`)
    value.forEach((item, index) => {
      if (typeof item !== 'string') error(`${path}[${index}]`, `${label} ${index + 1} must be text`)
      else if (item.trim() === '') warning(`${path}[${index}]`, `${label} ${index + 1} is empty`)
    })
  }
  const oneOf = (owner: Record<string, unknown>, key: string, allowed: string[], path: string, label: string, optional = false) => {
    const value = owner[key]
    if (value === undefined && optional) return
    if (typeof value !== 'string' || !allowed.includes(value)) error(at(path, key), `${label} is not one of: ${allowed.join(', ')}`)
  }

  if (!isRecord(input)) {
    error('', 'The lesson is not an object')
    return problems
  }
  const lesson = input

  if (typeof lesson.id !== 'string' || lesson.id.trim() === '') error('id', 'The lesson needs an id')

  // ── lesson info ───────────────────────────────────────────────────────────
  if (!isRecord(lesson.metadata)) error('metadata', 'The lesson info is missing')
  else {
    const info = lesson.metadata
    text(info, 'title', 'metadata', 'The lesson title')
    text(info, 'subtitle', 'metadata', 'The subtitle')
    text(info, 'level', 'metadata', 'The level line')
    if (typeof info.durationMinutes !== 'number' || !Number.isFinite(info.durationMinutes) || info.durationMinutes < 0) {
      error('metadata.durationMinutes', 'The duration must be a number of minutes')
    }
    textList(info.prerequisites, 'metadata.prerequisites', 'Prerequisite')
  }
  textList(lesson.objectives, 'objectives', 'Learning objective')

  // ── simulations ───────────────────────────────────────────────────────────
  const simulationIds = new Set<string>()
  if (!isRecord(lesson.simulations)) error('simulations', 'The simulations are missing')
  else {
    for (const [key, spec] of Object.entries(lesson.simulations)) {
      const path = `simulations.${key}`
      if (!isRecord(spec)) {
        error(path, 'This simulation is not valid')
        continue
      }
      simulationIds.add(key)
      if (spec.id !== key) error(at(path, 'id'), 'The simulation id must match its name')
      if (spec.kind !== 'thermal-contact') error(at(path, 'kind'), 'This kind of simulation does not exist')
      text(spec, 'title', path, 'The simulation title')
      if (!isThermalParams(spec.params)) error(at(path, 'params'), 'The simulation settings are not valid')
      textList(spec.assumptions, at(path, 'assumptions'), 'Assumption')
    }
  }

  // ── questions ─────────────────────────────────────────────────────────────
  const questionIds = new Set<string>()
  if (!isRecord(lesson.questions)) error('questions', 'The questions are missing')
  else {
    for (const [key, question] of Object.entries(lesson.questions)) {
      const path = `questions.${key}`
      if (!isRecord(question)) {
        error(path, 'This question is not valid')
        continue
      }
      questionIds.add(key)
      if (question.id !== key) error(at(path, 'id'), 'The question id must match its name')
      oneOf(question, 'kind', QUESTION_KINDS, path, 'The question kind')
      text(question, 'prompt', path, 'The question')
      if (typeof question.explanation !== 'string') error(at(path, 'explanation'), 'The explanation is missing')
      else if (question.explanation.trim() === '') warning(at(path, 'explanation'), 'The explanation is empty')

      const options = question.options
      if (!Array.isArray(options) || options.length < 2 || options.length > MAX_OPTIONS) {
        error(at(path, 'options'), `A question needs between 2 and ${MAX_OPTIONS} answer choices`)
        continue
      }
      const optionIds = new Set<string>()
      options.forEach((option, index) => {
        const optionPath = `${path}.options[${index}]`
        if (!isRecord(option)) return void error(optionPath, `Answer choice ${index + 1} is not valid`)
        if (typeof option.id !== 'string' || option.id === '') error(at(optionPath, 'id'), `Answer choice ${index + 1} needs an id`)
        else if (optionIds.has(option.id)) error(at(optionPath, 'id'), `Two answer choices share the id "${option.id}"`)
        else optionIds.add(option.id)
        text(option, 'text', optionPath, `Answer choice ${index + 1}`)
      })
      if (typeof question.correctOptionId !== 'string' || !optionIds.has(question.correctOptionId)) {
        error(at(path, 'correctOptionId'), 'The correct answer is not one of the answer choices')
      }
    }
  }

  // ── steps and their blocks ────────────────────────────────────────────────
  const blockIds = new Set<string>()
  const stepIds = new Set<string>()
  if (!Array.isArray(lesson.steps) || lesson.steps.length === 0) error('steps', 'The lesson needs at least one slide')
  else {
    lesson.steps.forEach((step, stepIndex) => {
      const path = `steps[${stepIndex}]`
      if (!isRecord(step)) return void error(path, `Slide ${stepIndex + 1} is not valid`)

      if (typeof step.id !== 'string' || step.id === '') error(at(path, 'id'), `Slide ${stepIndex + 1} needs an id`)
      else if (stepIds.has(step.id)) error(at(path, 'id'), `Two slides share the id "${step.id}"`)
      else stepIds.add(step.id)
      text(step, 'title', path, 'The slide title')
      if (typeof step.minutes !== 'number' || !Number.isFinite(step.minutes) || step.minutes < 0) error(at(path, 'minutes'), 'The minutes must be a number')

      if (!Array.isArray(step.blocks)) return void error(at(path, 'blocks'), 'The slide content is missing')
      let media = 0
      let questions = 0
      step.blocks.forEach((block, blockIndex) => {
        const blockPath = `${path}.blocks[${blockIndex}]`
        if (!isRecord(block)) return void error(blockPath, 'This piece of content is not valid')

        if (typeof block.id !== 'string' || block.id === '') error(at(blockPath, 'id'), 'This piece of content needs an id')
        else if (blockIds.has(block.id)) error(at(blockPath, 'id'), `Two pieces of content share the id "${block.id}"`)
        else blockIds.add(block.id)
        if (block.reveal !== undefined && !isCount(block.reveal)) error(at(blockPath, 'reveal'), 'The reveal step must be a whole number')

        switch (block.type) {
          case 'concept':
            text(block, 'text', blockPath, 'The text')
            oneOf(block, 'tone', CONCEPT_TONES, blockPath, 'The style', true)
            break
          case 'equation':
            text(block, 'latex', blockPath, 'The equation')
            optionalText(block, 'caption', blockPath, 'The caption')
            oneOf(block, 'tone', EQUATION_TONES, blockPath, 'The style', true)
            break
          case 'simulation': {
            media++
            if (typeof block.simulationId !== 'string' || !simulationIds.has(block.simulationId)) error(at(blockPath, 'simulationId'), 'This slide uses a simulation that does not exist')
            oneOf(block, 'display', DISPLAYS, blockPath, 'The simulation display')
            if (!Array.isArray(block.controls) || block.controls.some((control) => typeof control !== 'string' || !CONTROLS.includes(control))) {
              error(at(blockPath, 'controls'), 'The simulation controls are not valid')
            }
            if (!isRecord(block.readouts)) error(at(blockPath, 'readouts'), 'The simulation read-outs are missing')
            else {
              for (const [name, stage] of Object.entries(block.readouts)) {
                if (!READOUTS.includes(name) || !isCount(stage)) error(at(blockPath, 'readouts'), `The read-out "${name}" is not valid`)
              }
            }
            break
          }
          case 'question':
            questions++
            if (typeof block.questionId !== 'string' || !questionIds.has(block.questionId)) error(at(blockPath, 'questionId'), 'This slide asks a question that does not exist')
            break
          case 'explanation':
            optionalText(block, 'title', blockPath, 'The explanation title')
            textList(block.paragraphs, at(blockPath, 'paragraphs'), 'Paragraph')
            break
          case 'diagram':
            media++
            if (block.diagramId !== 'heat-engine') error(at(blockPath, 'diagramId'), 'This diagram does not exist')
            optionalText(block, 'caption', blockPath, 'The caption')
            break
          case 'summary':
            break
          default:
            error(at(blockPath, 'type'), 'This kind of content does not exist')
        }
      })
      if (media > 1) error(path, `Slide ${stepIndex + 1} has more than one simulation or diagram; the projector can show only one`)
      if (questions > 1) error(path, `Slide ${stepIndex + 1} asks more than one question; a slide can ask only one`)
    })
  }

  // ── summary ───────────────────────────────────────────────────────────────
  if (!isRecord(lesson.summary)) error('summary', 'The summary is missing')
  else {
    const summary = lesson.summary
    text(summary, 'heading', 'summary', 'The summary heading')
    if (!Array.isArray(summary.rows)) error('summary.rows', 'The summary rows are missing')
    else {
      summary.rows.forEach((row, index) => {
        const path = `summary.rows[${index}]`
        if (!isRecord(row)) return void error(path, `Summary row ${index + 1} is not valid`)
        text(row, 'law', path, `Row ${index + 1} name`)
        text(row, 'question', path, `Row ${index + 1} question`)
        optionalText(row, 'equation', path, `Row ${index + 1} equation`)
        optionalText(row, 'note', path, `Row ${index + 1} note`)
      })
    }
  }

  return problems
}

export const hasErrors = (problems: LessonProblem[]): boolean => problems.some((problem) => problem.severity === 'error')

/** True when the renderers can run it (warnings about empty fields are fine). */
export function isUsableLesson(input: unknown): input is LessonDefinition {
  return !hasErrors(validateLesson(input))
}
