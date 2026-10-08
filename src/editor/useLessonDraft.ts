import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { secondLawLesson } from '../lesson'
import { clearDraft, currentLesson, isEdited, saveDraft } from '../lesson/draft'
import type { LessonDefinition } from '../lesson/types'

/** A change to the lesson, written as plain mutations of a private copy — the hook takes care of the rest. */
export type LessonEdit = (draft: LessonDefinition) => void

const SAVE_DELAY_MS = 300

/**
 * The lesson being edited: starts from the saved draft (or the built-in lesson), applies every edit to a
 * copy, and saves the draft shortly after the last keystroke — and on the way out, so nothing typed is lost.
 * `pending` is true between an edit and its save; `savedAt` is when the draft was last written.
 */
export function useLessonDraft(base: LessonDefinition = secondLawLesson) {
  const [lesson, setLesson] = useState<LessonDefinition>(() => currentLesson(base).lesson)
  const [pending, setPending] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const latest = useRef(lesson)
  const timer = useRef<number | undefined>(undefined)

  /** Writes the draft now (also what the autosave timer does). */
  const saveNow = useCallback(() => {
    window.clearTimeout(timer.current)
    timer.current = undefined
    saveDraft(latest.current, base)
    setPending(false)
    setSavedAt(new Date())
  }, [base])

  const update = useCallback(
    (edit: LessonEdit) => {
      const next = structuredClone(latest.current)
      edit(next)
      latest.current = next
      setLesson(next)
      setPending(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(saveNow, SAVE_DELAY_MS)
    },
    [saveNow],
  )

  /** Throws the draft away: back to the lesson that ships with the app. */
  const reset = useCallback(() => {
    window.clearTimeout(timer.current)
    timer.current = undefined
    clearDraft()
    latest.current = base
    setLesson(base)
    setPending(false)
    setSavedAt(null)
  }, [base])

  // Leaving the page: write whatever is still waiting for the timer.
  useEffect(() => {
    const flush = () => {
      if (timer.current === undefined) return
      window.clearTimeout(timer.current)
      timer.current = undefined
      saveDraft(latest.current, base)
    }
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [base])

  const edited = useMemo(() => isEdited(lesson, base), [lesson, base])
  return { lesson, edited, update, reset, saveNow, pending, savedAt }
}
