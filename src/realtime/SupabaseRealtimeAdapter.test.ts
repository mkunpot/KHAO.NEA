import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { secondLawLesson } from '../lesson'
import { initialSessionState } from '../session/sessionReducer'
import type { Database, SessionRow } from '../supabase/types'
import { SupabaseRealtimeAdapter } from './SupabaseRealtimeAdapter'
import { lessonFromJson, rowToRecord } from './supabaseMapping'

const baseRow: SessionRow = {
  id: 'id', session_code: 'ABCDEF', lesson_id: 'second-law', status: 'active', created_at: 'a', updated_at: 'b',
  started: false, question_timer_s: 0, current_step: 0, question_open: false, active_question_id: null,
  answer_revealed: false, results_visible: false, sim: { mode: 'idle' }, version: 0,
}

/** Just enough of supabase-js for `from(...).insert(row).select().single()`: remembers what was inserted and echoes it back. */
function fakeClient() {
  const inserted: Array<Record<string, unknown>> = []
  const client = {
    from: () => ({
      insert: (row: Record<string, unknown>) => {
        inserted.push(row)
        return { select: () => ({ single: async () => ({ data: { ...baseRow, ...row }, error: null }) }) }
      },
    }),
  }
  return { client: client as unknown as SupabaseClient<Database>, inserted }
}

const editedLesson = () => {
  const lesson = structuredClone(secondLawLesson)
  lesson.steps[0]!.title = 'My own first slide'
  return lesson
}

describe('the lesson copy in the session row', () => {
  it('is only written when the teacher edited the lesson — so the built-in lesson works on a database without migration 003', async () => {
    const { client, inserted } = fakeClient()
    const adapter = new SupabaseRealtimeAdapter(client)
    const input = { sessionCode: 'ABCDEF', lessonId: 'second-law', initialState: initialSessionState(secondLawLesson) }

    const plain = await adapter.createSession(input)
    expect(inserted[0]).not.toHaveProperty('lesson_json')
    expect(plain.lesson).toBeUndefined()

    const edited = await adapter.createSession({ ...input, lesson: editedLesson() })
    expect(inserted[1]).toHaveProperty('lesson_json')
    expect(edited.lesson?.steps[0]?.title).toBe('My own first slide')
  })

  it('rowToRecord hands every screen a usable copy, and nothing at all when there is none', () => {
    expect(rowToRecord(baseRow)).not.toHaveProperty('lesson')
    expect(rowToRecord({ ...baseRow, lesson_json: null })).not.toHaveProperty('lesson')
    const copy = JSON.parse(JSON.stringify(editedLesson()))
    expect(rowToRecord({ ...baseRow, lesson_json: copy }).lesson?.steps[0]?.title).toBe('My own first slide')
  })

  it('never lets an unusable copy reach a renderer — it falls back to the built-in lesson', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      expect(lessonFromJson({ id: 'second-law', steps: [] })).toBeUndefined()
      expect(lessonFromJson('not a lesson')).toBeUndefined()
      expect(rowToRecord({ ...baseRow, lesson_json: { nonsense: true } })).not.toHaveProperty('lesson')
      expect(warn).toHaveBeenCalled()
    } finally {
      warn.mockRestore()
    }
  })
})
