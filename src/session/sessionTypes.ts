import type { LessonDefinition } from '../lesson/types'
import type { ThermalMode, ThermalParams } from '../simulations/thermal-contact/types'

/** teacher = controls the class; presenter = projector (read-only); student = a phone/tablet. */
export type SessionRole = 'teacher' | 'presenter' | 'student'

export type SessionStatus = 'active' | 'ended'

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

/**
 * Semantic simulation state shared by the class. Animation frames are never shared:
 * every browser animates locally from (params, mode, the moment it saw this runId).
 */
export interface SimState {
  mode: ThermalMode
  /** Identifies one run (the teacher's Date.now() at the click). A new runId makes every browser restart its clock. */
  runId: number
  params: ThermalParams
}

/** The teacher-controlled part of a session — what every other screen follows. */
export interface SessionState {
  /** False until the teacher presses "Start lesson": the projector shows the lobby, phones say "You're in". */
  started: boolean
  /** Flat cursor over (lesson step, reveal stage); see lesson/cursor.ts. */
  currentStep: number
  questionOpen: boolean
  /** Length of the open question in seconds; 0 = untimed. Shown as a countdown on every screen. */
  questionTimerS: number
  activeQuestionId: string | null
  answerRevealed: boolean
  resultsVisible: boolean
  sim: SimState
}

export interface SessionRecord extends SessionState {
  id: string
  sessionCode: string
  lessonId: string
  /**
   * The lesson this class runs, when the teacher edited it: a copy taken when the session was created, so
   * every screen shows the same words. Absent = the lesson that ships with the app (looked up by `lessonId`).
   */
  lesson?: LessonDefinition
  status: SessionStatus
  /** Bumped by the teacher on every change; clients ignore records older than the one they hold. */
  version: number
  createdAt: string
  updatedAt: string
}

export interface ResponseRecord {
  id: string
  sessionId: string
  participantId: string
  questionId: string
  answer: string
  submittedAt: string
}

export interface Participant {
  id: string
  name: string
}

/** A participant as the lobby sees it (the projector and the teacher read these). */
export interface ParticipantRecord extends Participant {
  joinedAt: string
}

/** The moment this browser first saw the current simulation run (performance.now() timeline). */
export interface SimClock {
  runId: number
  startedAtMs: number
}

/** The moment this browser first saw voting open on a question; the countdown is measured from here. */
export interface QuestionClock {
  questionId: string
  startedAtMs: number
}

export function stateOf(record: SessionRecord): SessionState {
  return {
    started: record.started,
    currentStep: record.currentStep,
    questionOpen: record.questionOpen,
    questionTimerS: record.questionTimerS,
    activeQuestionId: record.activeQuestionId,
    answerRevealed: record.answerRevealed,
    resultsVisible: record.resultsVisible,
    sim: record.sim,
  }
}

export type { ThermalParams }
