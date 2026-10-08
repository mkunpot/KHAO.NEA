import { describe, expect, it } from 'vitest'
import { secondLawLesson } from './secondLaw'
import type { LessonDefinition } from './types'
import { hasErrors, isUsableLesson, validateLesson } from './validate'

const clone = (): LessonDefinition => structuredClone(secondLawLesson)
const errorPaths = (lesson: unknown) => validateLesson(lesson).filter((p) => p.severity === 'error').map((p) => p.path)
const blockIndex = (lesson: LessonDefinition, stepIndex: number, type: string) => lesson.steps[stepIndex]!.blocks.findIndex((b) => b.type === type)

describe('validateLesson', () => {
  it('finds nothing to complain about in the built-in lesson', () => {
    expect(validateLesson(secondLawLesson)).toEqual([])
  })

  it('still accepts it after a JSON round trip (that is how drafts and session copies travel)', () => {
    expect(validateLesson(JSON.parse(JSON.stringify(secondLawLesson)))).toEqual([])
  })

  it('rejects things that are not lessons', () => {
    for (const input of [null, undefined, 42, 'lesson', [], {}]) expect(isUsableLesson(input)).toBe(false)
  })

  it('treats an empty field as a warning — the lesson still runs', () => {
    const lesson = clone()
    lesson.steps[0]!.title = '   '
    const problems = validateLesson(lesson)
    expect(problems).toEqual([{ severity: 'warning', path: 'steps[0].title', message: 'The slide title is empty' }])
    expect(hasErrors(problems)).toBe(false)
    expect(isUsableLesson(lesson)).toBe(true)
  })

  it('names the exact field when the text is not text at all', () => {
    const lesson = clone() as unknown as { steps: Array<{ title: unknown }> }
    lesson.steps[2]!.title = 7
    expect(errorPaths(lesson)).toEqual(['steps[2].title'])
  })

  it('errors on a question block that points at a question that does not exist', () => {
    const lesson = clone()
    const at = blockIndex(lesson, 0, 'question')
    ;(lesson.steps[0]!.blocks[at] as { questionId: string }).questionId = 'nope'
    expect(errorPaths(lesson)).toEqual([`steps[0].blocks[${at}].questionId`])
  })

  it('errors on a simulation block that points at a simulation that does not exist', () => {
    const lesson = clone()
    const at = blockIndex(lesson, 1, 'simulation')
    ;(lesson.steps[1]!.blocks[at] as { simulationId: string }).simulationId = 'nope'
    expect(errorPaths(lesson)).toEqual([`steps[1].blocks[${at}].simulationId`])
  })

  it('requires the correct answer to be one of the answer choices', () => {
    const lesson = clone()
    lesson.questions.prediction!.correctOptionId = 'Z'
    expect(errorPaths(lesson)).toEqual(['questions.prediction.correctOptionId'])
  })

  it('wants between two and four answer choices, each with its own id', () => {
    const tooFew = clone()
    tooFew.questions.prediction!.options = [{ id: 'A', text: 'Only one' }]
    expect(errorPaths(tooFew)).toEqual(['questions.prediction.options'])

    const tooMany = clone()
    tooMany.questions.prediction!.options = ['A', 'B', 'C', 'D', 'E'].map((id) => ({ id, text: id }))
    expect(errorPaths(tooMany)).toEqual(['questions.prediction.options'])

    const duplicate = clone()
    duplicate.questions.prediction!.options[1]!.id = 'A'
    expect(errorPaths(duplicate)).toContain('questions.prediction.options[1].id')
  })

  it('wants every slide id and block id to be unique', () => {
    const lesson = clone()
    lesson.steps[1]!.id = lesson.steps[0]!.id
    lesson.steps[2]!.blocks[0]!.id = lesson.steps[0]!.blocks[0]!.id
    expect(errorPaths(lesson)).toEqual(['steps[1].id', 'steps[2].blocks[0].id'])
  })

  it('needs at least one slide', () => {
    const lesson = clone()
    lesson.steps = []
    expect(errorPaths(lesson)).toEqual(['steps'])
  })

  it('lets a slide show one simulation or diagram and ask one question — the projector can show no more', () => {
    const two = clone()
    two.steps[0]!.blocks.push({ id: 'extra-sim', type: 'diagram', diagramId: 'heat-engine' })
    expect(errorPaths(two)).toEqual(['steps[0]'])

    const questions = clone()
    questions.steps[0]!.blocks.push({ id: 'extra-q', type: 'question', questionId: 'exit' })
    expect(errorPaths(questions)).toEqual(['steps[0]'])
  })

  it('rejects simulation settings the model cannot run', () => {
    const lesson = clone()
    lesson.simulations['thermal-contact']!.params.hotK = -5
    expect(errorPaths(lesson)).toEqual(['simulations.thermal-contact.params'])
  })

  it('rejects a kind of content the renderers have never heard of', () => {
    const lesson = clone() as unknown as { steps: Array<{ blocks: Array<Record<string, unknown>> }> }
    lesson.steps[0]!.blocks.push({ id: 'mystery', type: 'video' })
    expect(errorPaths(lesson)).toEqual(['steps[0].blocks[4].type'])
  })

  it('accepts PNG, JPG, WebP and SVG image blocks, and rejects other paths', () => {
    for (const src of ['/lesson-assets/fridge.png', '/lesson-assets/photo.jpg', 'https://cdn.example.com/diagram.webp?rev=4', '/art/engine.svg#detail']) {
      const lesson = clone()
      lesson.steps.at(-1)!.blocks.push({ id: `image-${src}`, type: 'image', src, alt: 'A refrigerator' })
      expect(isUsableLesson(lesson)).toBe(true)
    }

    const invalid = clone() as unknown as { steps: Array<{ blocks: Array<Record<string, unknown>> }> }
    invalid.steps.at(-1)!.blocks.push({ id: 'bad-image', type: 'image', src: '/lesson-assets/notes.pdf', alt: 'Not an image' })
    expect(errorPaths(invalid)).toEqual(['steps[6].blocks[2].src'])
  })

  it('accepts preset text roles, highlights and simple entrance animations', () => {
    const lesson = clone()
    lesson.steps.at(-1)!.blocks.push({
      id: 'modern-heading',
      type: 'text',
      role: 'title',
      text: 'Entropy decides the direction',
      highlights: ['Entropy'],
      animation: 'rise',
      align: 'center',
    })
    expect(isUsableLesson(lesson)).toBe(true)

    const invalid = structuredClone(lesson) as unknown as { steps: Array<{ blocks: Array<Record<string, unknown>> }> }
    invalid.steps.at(-1)!.blocks.at(-1)!.role = 'rainbow'
    expect(errorPaths(invalid)).toEqual(['steps[6].blocks[2].role'])
  })
})
