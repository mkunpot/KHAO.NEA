/**
 * A read-only classroom that exists only on this screen, for the lesson editor's previews. The slide and
 * the phone are drawn by the real renderers from a made-up class frozen at one moment (a given slide,
 * reveal stage and question state), so what the teacher sees is what the projector and phones will show.
 * There is no backend: nothing can be published and nothing can be submitted.
 */

import { useMemo, type ReactNode } from 'react'
import { cursorPositions, questionBlockOf, stepRevealStages } from '../lesson/cursor'
import type { LessonDefinition, Question } from '../lesson/types'
import { DEFAULT_THERMAL_PARAMS } from '../simulations/thermal-contact/model'
import { StudentOnlyError, TeacherOnlyError } from './errors'
import { SessionContext, type SessionContextValue } from './SessionProvider'
import type { ParticipantRecord, ResponseRecord, SessionRecord } from './sessionTypes'

/** none = the slide before voting; voting = phones are answering; results = results and the answer are shown. */
export type PreviewQuestionState = 'none' | 'voting' | 'results'

export interface PreviewSpec {
  lesson: LessonDefinition
  stepIndex: number
  reveal: number
  question: PreviewQuestionState
  /** presenter = the projector; student = a phone. */
  role: 'presenter' | 'student'
}

const CLASS_SIZE = 20
const ANSWERED_WHILE_VOTING = 12
const THEN = '2026-01-01T00:00:00.000Z'

/** Sample answers, the same every time: three in five right, the rest spread over the wrong choices. */
function sampleResponses(question: Question, count: number): ResponseRecord[] {
  const wrong = question.options.filter((option) => option.id !== question.correctOptionId)
  return Array.from({ length: count }, (_, index) => {
    const right = index % 5 < 3 || wrong.length === 0
    return {
      id: `sample-${index}`,
      sessionId: 'preview',
      participantId: `student-${index}`,
      questionId: question.id,
      answer: right ? question.correctOptionId : wrong[index % wrong.length]!.id,
      submittedAt: THEN,
    }
  })
}

export function previewContext({ lesson, stepIndex, reveal, question: state, role }: PreviewSpec): SessionContextValue {
  const index = Math.min(Math.max(stepIndex, 0), lesson.steps.length - 1)
  const step = lesson.steps[index]!
  const shownReveal = Math.min(Math.max(reveal, 0), stepRevealStages(step))
  const cursor = Math.max(0, cursorPositions(lesson).findIndex((p) => p.stepIndex === index && p.reveal === shownReveal))

  const questionId = questionBlockOf(step)?.questionId
  const question = questionId ? lesson.questions[questionId] : undefined
  const asking = question !== undefined && state !== 'none'
  const results = asking && state === 'results'

  const session: SessionRecord = {
    id: 'preview',
    sessionCode: 'ABC234',
    lessonId: lesson.id,
    status: 'active',
    version: 1,
    createdAt: THEN,
    updatedAt: THEN,
    started: true,
    currentStep: cursor,
    questionOpen: asking && state === 'voting',
    questionTimerS: 0,
    activeQuestionId: asking ? question.id : null,
    answerRevealed: results,
    resultsVisible: results,
    sim: { mode: 'idle', runId: 0, params: Object.values(lesson.simulations)[0]?.params ?? DEFAULT_THERMAL_PARAMS },
  }

  const onProjector = role === 'presenter'
  const participants: ParticipantRecord[] = onProjector
    ? Array.from({ length: CLASS_SIZE }, (_, i) => ({ id: `student-${i}`, name: `Student ${i + 1}`, joinedAt: THEN }))
    : []
  const responses = onProjector && asking ? sampleResponses(question, results ? CLASS_SIZE : ANSWERED_WHILE_VOTING) : []

  return {
    role,
    code: session.sessionCode,
    lesson,
    phase: 'ready',
    errorMessage: null,
    connection: 'connected',
    session,
    simClock: null,
    questionClock: null,
    dispatch: async () => {
      throw new TeacherOnlyError()
    },
    responses,
    participants,
    participantCount: participants.length,
    participant: onProjector ? null : { id: 'preview-student', name: 'Quiet Lynx' },
    myAnswers: !onProjector && results ? { [question.id]: question.correctOptionId } : {},
    submitAnswer: async () => {
      throw new StudentOnlyError()
    },
    refresh: async () => {},
  }
}

export function PreviewSession({ children, ...spec }: PreviewSpec & { children: ReactNode }) {
  const { lesson, stepIndex, reveal, question, role } = spec
  const value = useMemo(() => previewContext({ lesson, stepIndex, reveal, question, role }), [lesson, stepIndex, reveal, question, role])
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
