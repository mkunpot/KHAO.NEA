import { beforeEach, describe, expect, it } from 'vitest'
import { clearDraft, currentLesson, DRAFT_STORAGE_KEY, isEdited, loadDraft, saveDraft } from './draft'
import { secondLawLesson } from './secondLaw'
import { fridgeRoomLesson } from './fridgeRoom'
import type { LessonDefinition } from './types'

const edited = (): LessonDefinition => {
  const lesson = structuredClone(secondLawLesson)
  lesson.steps[0]!.title = 'My own title'
  return lesson
}

beforeEach(() => window.localStorage.clear())

describe('the lesson draft', () => {
  it('is the built-in lesson until something is saved', () => {
    expect(loadDraft()).toBeNull()
    expect(currentLesson()).toEqual({ lesson: secondLawLesson, edited: false })
  })

  it('round-trips an edited lesson', () => {
    saveDraft(edited())
    expect(loadDraft()?.steps[0]?.title).toBe('My own title')
    const current = currentLesson()
    expect(current.edited).toBe(true)
    expect(current.lesson.steps[0]?.title).toBe('My own title')
  })

  it('saving the built-in lesson again means "no draft" — the key goes away', () => {
    saveDraft(edited())
    expect(window.localStorage.getItem(DRAFT_STORAGE_KEY)).not.toBeNull()
    saveDraft(structuredClone(secondLawLesson))
    expect(window.localStorage.getItem(DRAFT_STORAGE_KEY)).toBeNull()
  })

  it('clearDraft returns to the built-in lesson', () => {
    saveDraft(edited())
    clearDraft()
    expect(currentLesson().edited).toBe(false)
  })

  it('keeps a draft that only has empty fields (the teacher is mid-edit) but marks it edited', () => {
    const lesson = edited()
    lesson.steps[0]!.title = ''
    saveDraft(lesson)
    expect(loadDraft()?.steps[0]?.title).toBe('')
    expect(currentLesson().edited).toBe(true)
  })

  it('ignores a draft it cannot trust: damaged JSON, a broken lesson, or another lesson', () => {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, '{not json')
    expect(loadDraft()).toBeNull()

    const broken = edited()
    broken.steps = []
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(broken))
    expect(loadDraft()).toBeNull()

    const other = edited()
    other.id = 'another-lesson'
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(other))
    expect(loadDraft()).toBeNull()
    expect(currentLesson().edited).toBe(false)
  })

  it('isEdited compares content, not identity', () => {
    expect(isEdited(structuredClone(secondLawLesson))).toBe(false)
    expect(isEdited(edited())).toBe(true)
  })

  it('adds new built-in blocks to an older draft without losing the teacher’s wording', () => {
    const oldDraft = structuredClone(fridgeRoomLesson)
    oldDraft.steps[0]!.title = 'คำถามของฉัน'
    oldDraft.steps[0]!.blocks = oldDraft.steps[0]!.blocks.filter((block) => block.type !== 'image')
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(oldDraft))

    const restored = loadDraft(fridgeRoomLesson)!
    expect(restored.steps[0]?.title).toBe('คำถามของฉัน')
    expect(restored.steps[0]?.blocks.find((block) => block.type === 'image')).toMatchObject({
      id: 'midnight-fridge-photo',
      src: '/lesson-assets/midnight-breeze-by-the-fridge.png',
    })
  })
})
