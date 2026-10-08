import { describe, expect, it } from 'vitest'
import sql from '../../supabase/migrations/001_classroom_demo.sql?raw'
import sql002 from '../../supabase/migrations/002_lobby_and_timer.sql?raw'
import sql003 from '../../supabase/migrations/003_lesson_snapshot.sql?raw'
import { secondLawLesson } from '../lesson'
import { initialSessionState } from '../session/sessionReducer'
import type { SessionRow } from '../supabase/types'
import { parseSim, rowToRecord, rowToResponse, stateToColumns } from './supabaseMapping'

/** Column names declared by `create table if not exists public.<table> ( … )` in 001, plus the `add column`s of 002 and 003. */
function sqlColumns(table: string): string[] {
  const block = sql.match(new RegExp(`create table if not exists public\\.${table} \\(([\\s\\S]*?)\\n\\);`))?.[1] ?? ''
  const created = block
    .split('\n')
    .map((line) => line.match(/^ {2}([a-z_]+)\s+(?:uuid|text|integer|boolean|jsonb|timestamptz)\b/)?.[1])
    .filter((name): name is string => Boolean(name))
  const added =
    table === 'classroom_sessions' ? [...sql002.matchAll(/add column if not exists ([a-z_]+)/g), ...sql003.matchAll(/add column if not exists ([a-z_]+)/g)].map((m) => m[1]!) : []
  return [...created, ...added]
}

describe('Supabase adapter ↔ SQL contract', () => {
  const sessionColumns = sqlColumns('classroom_sessions')

  it('the migration declares the columns the app relies on', () => {
    expect(sessionColumns).toEqual(
      expect.arrayContaining([
        'id', 'session_code', 'lesson_id', 'current_step', 'question_open', 'active_question_id',
        'answer_revealed', 'results_visible', 'sim', 'version', 'status', 'created_at', 'updated_at',
        'started', 'question_timer_s', 'lesson_json',
      ]),
    )
    expect(sqlColumns('participants')).toEqual(expect.arrayContaining(['id', 'session_id', 'anonymous_name']))
    expect(sqlColumns('responses')).toEqual(
      expect.arrayContaining(['session_id', 'participant_id', 'question_id', 'answer']),
    )
  })

  it('every column the teacher writes exists in classroom_sessions', () => {
    const written = Object.keys(stateToColumns(initialSessionState(secondLawLesson), 1))
    for (const column of written) expect(sessionColumns).toContain(column)
  })

  it('a row with exactly the SQL columns maps to a fully populated record', () => {
    const row = Object.fromEntries(
      sessionColumns.map((c) => [c, c === 'sim' ? { mode: 'idle' } : c === 'status' ? 'active' : c.endsWith('_at') ? '2026-10-07T00:00:00Z' : c === 'active_question_id' ? null : 'x']),
    )
    // lesson_json is null for a class that runs the built-in lesson, so the record simply has no `lesson`.
    Object.assign(row, { current_step: 3, version: 2, started: true, question_timer_s: 30, question_open: false, answer_revealed: false, results_visible: false, lesson_json: null })
    const record = rowToRecord(row as unknown as SessionRow)
    expect(record).not.toHaveProperty('lesson')
    for (const [key, value] of Object.entries(record)) {
      if (key === 'activeQuestionId') continue // legitimately null
      expect(value, `record.${key}`).not.toBeUndefined()
    }
  })

  it('response rows map field by field', () => {
    expect(
      rowToResponse({ id: 'r', session_id: 's', participant_id: 'p', question_id: 'q', answer: 'A', submitted_at: 't' }),
    ).toEqual({ id: 'r', sessionId: 's', participantId: 'p', questionId: 'q', answer: 'A', submittedAt: 't' })
  })
})

describe('state ↔ row round trip', () => {
  it('what the teacher writes is what every screen reads back', () => {
    const state = {
      ...initialSessionState(secondLawLesson),
      started: true,
      currentStep: 7,
      questionOpen: true,
      questionTimerS: 45,
      activeQuestionId: 'first-law',
      resultsVisible: true,
      answerRevealed: false,
      sim: { mode: 'reverse' as const, runId: 1_700_000_000_000, params: { hotK: 400, coldK: 300, heatCapacityJPerK: 1000, timeConstantS: 2 } },
    }
    const columns = stateToColumns(state, 9)
    const record = rowToRecord({
      id: 'id', session_code: 'ABCDEF', lesson_id: 'second-law', status: 'active', created_at: 'a', updated_at: 'b',
      started: columns.started!, question_timer_s: columns.question_timer_s!,
      current_step: columns.current_step!, question_open: columns.question_open!, active_question_id: columns.active_question_id!,
      answer_revealed: columns.answer_revealed!, results_visible: columns.results_visible!, sim: columns.sim!, version: columns.version!,
    })
    expect(record).toMatchObject(state)
    expect(record.version).toBe(9)
  })

  it('tolerates a session row that was not created by the app', () => {
    expect(parseSim({ mode: 'idle' }).params.hotK).toBe(400)
    expect(parseSim(null).mode).toBe('idle')
    expect(parseSim({ mode: 'sideways', runId: 'x', params: { hotK: -5 } })).toMatchObject({ mode: 'idle', runId: 0 })
  })
})
