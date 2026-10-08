/**
 * Pure mapping between database rows (snake_case, see supabase/migrations/001_classroom_demo.sql)
 * and the app's records. Kept free of the Supabase client so it can be tested on its own.
 */

import type { LessonDefinition } from '../lesson/types'
import { isUsableLesson } from '../lesson/validate'
import { DEFAULT_THERMAL_PARAMS, isThermalParams } from '../simulations/thermal-contact/model'
import type { ParticipantRecord, ResponseRecord, SessionRecord, SessionState, SimState } from '../session/sessionTypes'
import type { Json, ParticipantRow, ResponseRow, SessionRow, SessionUpdate } from '../supabase/types'

/**
 * The lesson an editing teacher copied into the session row. It is JSON from outside, so it is checked
 * before anything renders it; null, absent or unusable all mean "use the lesson bundled with the app".
 */
export function lessonFromJson(json: Json | null | undefined): LessonDefinition | undefined {
  if (json === null || json === undefined) return undefined
  const candidate: unknown = json
  if (isUsableLesson(candidate)) return candidate
  console.warn('The lesson stored with this session is not usable; showing the built-in lesson instead.')
  return undefined
}

export function parseSim(json: Json): SimState {
  const obj: { [key: string]: Json | undefined } =
    typeof json === 'object' && json !== null && !Array.isArray(json) ? json : {}
  return {
    mode: obj.mode === 'forward' || obj.mode === 'reverse' ? obj.mode : 'idle',
    runId: typeof obj.runId === 'number' ? obj.runId : 0,
    params: isThermalParams(obj.params) ? obj.params : DEFAULT_THERMAL_PARAMS,
  }
}

export function simToJson(sim: SimState): Json {
  return {
    mode: sim.mode,
    runId: sim.runId,
    params: {
      hotK: sim.params.hotK,
      coldK: sim.params.coldK,
      heatCapacityJPerK: sim.params.heatCapacityJPerK,
      timeConstantS: sim.params.timeConstantS,
    },
  }
}

export function stateToColumns(state: SessionState, version: number): SessionUpdate {
  return {
    started: state.started,
    current_step: state.currentStep,
    question_open: state.questionOpen,
    question_timer_s: state.questionTimerS,
    active_question_id: state.activeQuestionId,
    answer_revealed: state.answerRevealed,
    results_visible: state.resultsVisible,
    sim: simToJson(state.sim),
    version,
  }
}

export function rowToRecord(row: SessionRow): SessionRecord {
  const lesson = lessonFromJson(row.lesson_json)
  return {
    id: row.id,
    sessionCode: row.session_code,
    lessonId: row.lesson_id,
    ...(lesson ? { lesson } : {}),
    status: row.status,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    started: row.started,
    currentStep: row.current_step,
    questionOpen: row.question_open,
    questionTimerS: row.question_timer_s,
    activeQuestionId: row.active_question_id,
    answerRevealed: row.answer_revealed,
    resultsVisible: row.results_visible,
    sim: parseSim(row.sim),
  }
}

export function rowToParticipant(row: ParticipantRow): ParticipantRecord {
  return { id: row.id, name: row.anonymous_name, joinedAt: row.joined_at }
}

export function rowToResponse(row: ResponseRow): ResponseRecord {
  return {
    id: row.id,
    sessionId: row.session_id,
    participantId: row.participant_id,
    questionId: row.question_id,
    answer: row.answer,
    submittedAt: row.submitted_at,
  }
}
