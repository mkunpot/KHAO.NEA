/**
 * Everything the teacher, presentation and student screens know about the live classroom comes
 * from here. Components never touch a realtime backend: they call useSession(), which talks to
 * the RealtimeAdapter.
 *
 *  - The session row is the source of truth. We load it, then follow it through the adapter.
 *  - `version` makes ordering trivial: anything older than what we hold is ignored.
 *  - The teacher applies each command locally first (instant UI), then publishes it. Publishes are
 *    queued so they reach the backend in the order they were made.
 *  - Role rules live here, in one place: a student/presenter context cannot publish state.
 *  - Countdowns are local: a browser starts measuring when it first sees voting open, exactly
 *    like the simulation clock, so no clock-sync is needed.
 *  - The lesson normally ships with the app. When the teacher edited it, a copy travels inside the
 *    session record and every screen runs that copy, so a class never mixes old and new wording.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { lessonById } from '../lesson'
import type { LessonDefinition } from '../lesson/types'
import type { ClassroomEvent } from '../realtime/events'
import type { RealtimeAdapter, SubmitResult } from '../realtime/RealtimeAdapter'
import { StudentOnlyError, TeacherOnlyError } from './errors'
import { loadAnswers, loadParticipant, saveAnswer } from './identity'
import { reduceSession, sameState } from './sessionReducer'
import {
  stateOf,
  type ConnectionStatus,
  type Participant,
  type ParticipantRecord,
  type QuestionClock,
  type ResponseRecord,
  type SessionRecord,
  type SessionRole,
  type SimClock,
  type SimState,
} from './sessionTypes'

export type SessionPhase = 'loading' | 'ready' | 'not-found' | 'error'

export interface SessionContextValue {
  role: SessionRole
  code: string
  lesson: LessonDefinition
  phase: SessionPhase
  errorMessage: string | null
  connection: ConnectionStatus
  /** The live session (null until loaded). Everything the class follows is in here. */
  session: SessionRecord | null
  /** When this browser first saw the current simulation run; the local animation clock starts here. */
  simClock: SimClock | null
  /** When this browser first saw voting open; the question countdown is measured from here. */
  questionClock: QuestionClock | null

  /** Teacher only: apply a command to the class. Rejects with TeacherOnlyError for any other role. */
  dispatch: (event: ClassroomEvent) => Promise<void>
  /** Teacher and presenter: all answers received so far. Empty for students. */
  responses: ResponseRecord[]
  /** Teacher and presenter: everyone who has joined (the lobby). Empty for students. */
  participants: ParticipantRecord[]
  /** How many have joined (teacher and presenter). */
  participantCount: number

  /** Student only. */
  participant: Participant | null
  myAnswers: Record<string, string>
  /** Student only: rejects with StudentOnlyError for any other role. */
  submitAnswer: (questionId: string, answer: string) => Promise<SubmitResult>

  refresh: () => Promise<void>
}

export const SessionContext = createContext<SessionContextValue | null>(null)

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession must be used inside <SessionProvider>')
  return value
}

function nextClock(previous: SimClock | null, sim: SimState): SimClock | null {
  if (sim.mode === 'idle') return null
  if (previous && previous.runId === sim.runId) return previous
  return { runId: sim.runId, startedAtMs: performance.now() }
}

function nextQuestionClock(previous: QuestionClock | null, record: SessionRecord): QuestionClock | null {
  if (!record.questionOpen || !record.activeQuestionId) return null
  if (previous && previous.questionId === record.activeQuestionId) return previous
  return { questionId: record.activeQuestionId, startedAtMs: performance.now() }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

interface SessionProviderProps {
  code: string
  role: SessionRole
  /** The lesson that ships with the app; used unless the session carries an edited copy of its own. */
  lesson: LessonDefinition
  adapter: RealtimeAdapter
  children: ReactNode
}

export function SessionProvider({ code, role, lesson, adapter, children }: SessionProviderProps) {
  const [phase, setPhase] = useState<SessionPhase>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [connection, setConnection] = useState<ConnectionStatus>('connecting')
  const [view, setView] = useState<{
    record: SessionRecord | null
    clock: SimClock | null
    questionClock: QuestionClock | null
  }>({ record: null, clock: null, questionClock: null })
  const [responses, setResponses] = useState<ResponseRecord[]>([])
  const [participants, setParticipants] = useState<ParticipantRecord[]>([])
  // Taken once, when the session loads: a lesson never changes under a running class.
  const [sessionLesson, setSessionLesson] = useState<LessonDefinition | null>(null)
  const activeLesson = sessionLesson ?? lesson

  const participant = useMemo(() => (role === 'student' ? loadParticipant(code) : null), [role, code])
  const [myAnswers, setMyAnswers] = useState<Record<string, string>>(() => (role === 'student' ? loadAnswers(code) : {}))

  const recordRef = useRef<SessionRecord | null>(null)
  const publishQueue = useRef<Promise<unknown>>(Promise.resolve())
  const joinPromise = useRef<Promise<void> | null>(null)
  // Source of truth for "what did I answer", updated synchronously so a fast double-tap on two
  // different options can never show an answer the backend did not keep.
  const answersRef = useRef(myAnswers)
  const answersInFlight = useRef(new Set<string>())

  const applyRecord = useCallback((incoming: SessionRecord, force = false) => {
    const current = recordRef.current
    if (!force && current && current.id === incoming.id && incoming.version < current.version) return
    recordRef.current = incoming
    setView((previous) => ({
      record: incoming,
      clock: nextClock(previous.clock, incoming.sim),
      questionClock: nextQuestionClock(previous.questionClock, incoming),
    }))
  }, [])

  // 1. Load the session by its code (and, for students, register as a participant).
  useEffect(() => {
    let cancelled = false
    setPhase('loading')
    setErrorMessage(null)
    adapter
      .findSession(code)
      .then((record) => {
        if (cancelled) return
        if (!record) {
          setPhase('not-found')
          return
        }
        applyRecord(record, true)
        setSessionLesson(record.lesson ?? lessonById(record.lessonId) ?? null)
        setPhase('ready')
        if (role === 'student' && participant) {
          joinPromise.current = adapter.joinSession({ sessionId: record.id, participant })
          joinPromise.current.catch((error: unknown) => {
            if (cancelled) return
            setErrorMessage(`Could not join the session: ${messageOf(error)}`)
            setPhase('error')
          })
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setErrorMessage(messageOf(error))
        setPhase('error')
      })
    return () => {
      cancelled = true
    }
  }, [adapter, code, role, participant, applyRecord])

  // 2. Follow the session row (everyone) and the incoming answers (teacher / presenter).
  const sessionId = view.record?.id
  useEffect(() => {
    if (!sessionId) return
    setConnection('connecting')
    const stopState = adapter.subscribeToSessionState(sessionId, {
      onState: (record) => applyRecord(record),
      onConnection: setConnection,
    })
    // Students never subscribe to answers or to the lobby: with ~40 phones that would be N² messages.
    const stopResponses =
      role === 'student'
        ? undefined
        : adapter.subscribeToResponses(sessionId, (response) =>
            setResponses((previous) => (previous.some((r) => r.id === response.id) ? previous : [...previous, response])),
          )
    const stopParticipants =
      role === 'student'
        ? undefined
        : adapter.subscribeToParticipants(sessionId, (joined) =>
            setParticipants((previous) => (previous.some((p) => p.id === joined.id) ? previous : [...previous, joined])),
          )
    return () => {
      stopState()
      stopResponses?.()
      stopParticipants?.()
      adapter.leaveSession(sessionId)
    }
  }, [adapter, sessionId, role, applyRecord])

  // 3. Phones sleep and Wi-Fi drops: when the page comes back, re-read the row.
  const refresh = useCallback(async () => {
    try {
      const record = await adapter.findSession(code)
      if (record) applyRecord(record)
    } catch {
      // still offline — the connection badge already says so
    }
  }, [adapter, code, applyRecord])

  useEffect(() => {
    const onReturn = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onReturn)
    window.addEventListener('online', onReturn)
    return () => {
      document.removeEventListener('visibilitychange', onReturn)
      window.removeEventListener('online', onReturn)
    }
  }, [refresh])

  const dispatch = useCallback(
    async (event: ClassroomEvent) => {
      if (role !== 'teacher') throw new TeacherOnlyError()
      const current = recordRef.current
      if (!current) throw new Error('The session has not loaded yet.')

      const nextState = reduceSession(stateOf(current), event, activeLesson)
      if (sameState(nextState, stateOf(current))) return

      const next: SessionRecord = { ...current, ...nextState, version: current.version + 1 }
      applyRecord(next) // instant local feedback; the backend echo is ignored as "not newer"

      const publish = publishQueue.current.then(() => adapter.publishSessionState(next.id, nextState, next.version))
      publishQueue.current = publish.catch(() => undefined)
      try {
        await publish
      } catch (error) {
        // The class did not receive it: fall back to what the backend actually holds.
        try {
          const server = await adapter.findSession(code)
          if (server) applyRecord(server, true)
        } catch {
          // offline: keep the local state, surface the original error
        }
        throw error
      }
    },
    [role, activeLesson, adapter, code, applyRecord],
  )

  const submitAnswer = useCallback(
    async (questionId: string, answer: string): Promise<SubmitResult> => {
      if (role !== 'student' || !participant) throw new StudentOnlyError()
      const current = recordRef.current
      if (!current) throw new Error('The session has not loaded yet.')
      // First answer wins: ignore anything once an answer exists or is already on its way.
      if (answersRef.current[questionId] || answersInFlight.current.has(questionId)) return 'accepted'

      answersInFlight.current.add(questionId)
      try {
        await joinPromise.current
        const result = await adapter.submitResponse({
          sessionId: current.id,
          participantId: participant.id,
          questionId,
          answer,
        })
        if (result === 'accepted') {
          answersRef.current = { ...answersRef.current, [questionId]: answer }
          saveAnswer(code, questionId, answer)
          setMyAnswers(answersRef.current)
        }
        return result
      } finally {
        answersInFlight.current.delete(questionId)
      }
    },
    [role, participant, adapter, code],
  )

  const value = useMemo<SessionContextValue>(
    () => ({
      role,
      code,
      lesson: activeLesson,
      phase,
      errorMessage,
      connection,
      session: view.record,
      simClock: view.clock,
      questionClock: view.questionClock,
      dispatch,
      responses,
      participants,
      participantCount: participants.length,
      participant,
      myAnswers,
      submitAnswer,
      refresh,
    }),
    [role, code, activeLesson, phase, errorMessage, connection, view, dispatch, responses, participants, participant, myAnswers, submitAnswer, refresh],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
