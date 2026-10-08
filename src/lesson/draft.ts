/**
 * The teacher's edited copy of the lesson ("the draft"), kept in this browser's localStorage.
 *
 * It is a complete LessonDefinition, not a list of changed strings: the same JSON is what a class
 * later runs (copied into the session when it is created) and what a richer editor would produce.
 * Only this browser ever reads it — phones and the projector get the copy stored in their session,
 * so a class never mixes the teacher's edits with somebody's built-in text.
 */

import { secondLawLesson } from './secondLaw'
import type { LessonDefinition } from './types'
import { hasErrors, validateLesson } from './validate'

export const DRAFT_STORAGE_KEY = 'khao-nea:lesson-draft:v1'

function storage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null // blocked (private window, strict settings): the editor still works for this visit
  }
}

export const sameLesson = (a: LessonDefinition, b: LessonDefinition): boolean => JSON.stringify(a) === JSON.stringify(b)

/** True when `lesson` differs from the lesson that ships with the app. */
export const isEdited = (lesson: LessonDefinition, base: LessonDefinition = secondLawLesson): boolean => !sameLesson(lesson, base)

/** The saved draft, or null when there is none or it is no longer usable (damaged, or for another lesson). */
export function loadDraft(base: LessonDefinition = secondLawLesson): LessonDefinition | null {
  try {
    const raw = storage()?.getItem(DRAFT_STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (hasErrors(validateLesson(parsed))) return null
    const lesson = parsed as LessonDefinition
    return lesson.id === base.id ? lesson : null
  } catch {
    return null
  }
}

/** Saves the draft; a lesson identical to the built-in one is "no draft", so the key is removed. */
export function saveDraft(lesson: LessonDefinition, base: LessonDefinition = secondLawLesson): void {
  const store = storage()
  if (!store) return
  try {
    if (isEdited(lesson, base)) store.setItem(DRAFT_STORAGE_KEY, JSON.stringify(lesson))
    else store.removeItem(DRAFT_STORAGE_KEY)
  } catch {
    // storage full or blocked — nothing sensible to do
  }
}

export function clearDraft(): void {
  try {
    storage()?.removeItem(DRAFT_STORAGE_KEY)
  } catch {
    // ignore
  }
}

export interface CurrentLesson {
  lesson: LessonDefinition
  /** True when `lesson` is the teacher's edited copy rather than the built-in one. */
  edited: boolean
}

/** What this browser would teach right now: the usable draft if there is one, else the built-in lesson. */
export function currentLesson(base: LessonDefinition = secondLawLesson): CurrentLesson {
  const draft = loadDraft(base)
  return draft && isEdited(draft, base) ? { lesson: draft, edited: true } : { lesson: base, edited: false }
}
