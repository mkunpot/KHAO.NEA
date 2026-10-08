/**
 * In-memory RealtimeAdapter used by tests (and nothing in production). It mimics what the
 * Supabase policies enforce — an answer is only accepted while its question is open and the
 * first answer wins — so session logic can be exercised without a backend.
 */

import type { LessonDefinition } from '../lesson/types'
import type { RealtimeAdapter, SubmitResult, Unsubscribe } from '../realtime/RealtimeAdapter'
import { SessionCodeTakenError } from '../realtime/RealtimeAdapter'
import type {
  ConnectionStatus,
  Participant,
  ParticipantRecord,
  ResponseRecord,
  SessionRecord,
  SessionState,
} from '../session/sessionTypes'

export class MemoryRealtimeAdapter implements RealtimeAdapter {
  readonly sessions = new Map<string, SessionRecord>()
  readonly participants = new Map<string, Participant & { sessionId: string }>()
  readonly responses: ResponseRecord[] = []
  /** Every publishSessionState call, so tests can assert that a role never published. */
  readonly publishCalls: Array<{ sessionId: string; state: SessionState; version: number }> = []

  private readonly stateListeners = new Map<string, Set<(record: SessionRecord) => void>>()
  private readonly responseListeners = new Map<string, Set<(response: ResponseRecord) => void>>()
  private readonly participantListeners = new Map<string, Set<(participant: ParticipantRecord) => void>>()
  private counter = 0

  async createSession(input: { sessionCode: string; lessonId: string; initialState: SessionState; lesson?: LessonDefinition }) {
    for (const s of this.sessions.values()) if (s.sessionCode === input.sessionCode) throw new SessionCodeTakenError(input.sessionCode)
    const now = new Date().toISOString()
    const record: SessionRecord = {
      ...input.initialState,
      id: `session-${++this.counter}`,
      sessionCode: input.sessionCode,
      lessonId: input.lessonId,
      // a JSON round trip, like a database: the stored copy is not the caller's live object
      ...(input.lesson ? { lesson: JSON.parse(JSON.stringify(input.lesson)) as LessonDefinition } : {}),
      status: 'active',
      version: 0,
      createdAt: now,
      updatedAt: now,
    }
    this.sessions.set(record.id, record)
    return record
  }

  async findSession(sessionCode: string) {
    for (const s of this.sessions.values()) if (s.sessionCode === sessionCode.toUpperCase()) return s
    return null
  }

  async joinSession(input: { sessionId: string; participant: Participant }) {
    const known = this.participants.has(input.participant.id)
    this.participants.set(input.participant.id, { ...input.participant, sessionId: input.sessionId })
    if (!known) {
      const record: ParticipantRecord = { ...input.participant, joinedAt: new Date().toISOString() }
      this.participantListeners.get(input.sessionId)?.forEach((listener) => listener(record))
    }
  }

  leaveSession(sessionId: string) {
    this.stateListeners.delete(sessionId)
    this.responseListeners.delete(sessionId)
    this.participantListeners.delete(sessionId)
  }

  async publishSessionState(sessionId: string, state: SessionState, version: number) {
    this.publishCalls.push({ sessionId, state, version })
    const current = this.sessions.get(sessionId)
    if (!current) throw new Error('unknown session')
    const next: SessionRecord = { ...current, ...state, version, updatedAt: new Date().toISOString() }
    this.sessions.set(sessionId, next)
    this.stateListeners.get(sessionId)?.forEach((listener) => listener(next))
  }

  subscribeToSessionState(
    sessionId: string,
    handlers: { onState: (record: SessionRecord) => void; onConnection?: (status: ConnectionStatus) => void },
  ): Unsubscribe {
    const set = this.stateListeners.get(sessionId) ?? new Set()
    set.add(handlers.onState)
    this.stateListeners.set(sessionId, set)
    handlers.onConnection?.('connected')
    const current = this.sessions.get(sessionId)
    if (current) handlers.onState(current)
    return () => {
      set.delete(handlers.onState)
    }
  }

  async submitResponse(input: { sessionId: string; participantId: string; questionId: string; answer: string }): Promise<SubmitResult> {
    const session = this.sessions.get(input.sessionId)
    if (!session || !session.questionOpen || session.activeQuestionId !== input.questionId) return 'closed'
    const duplicate = this.responses.some(
      (r) => r.sessionId === input.sessionId && r.participantId === input.participantId && r.questionId === input.questionId,
    )
    if (duplicate) return 'accepted'
    const response: ResponseRecord = {
      id: `response-${++this.counter}`,
      submittedAt: new Date().toISOString(),
      ...input,
    }
    this.responses.push(response)
    this.responseListeners.get(input.sessionId)?.forEach((listener) => listener(response))
    return 'accepted'
  }

  subscribeToResponses(sessionId: string, onResponse: (response: ResponseRecord) => void): Unsubscribe {
    const set = this.responseListeners.get(sessionId) ?? new Set()
    set.add(onResponse)
    this.responseListeners.set(sessionId, set)
    this.responses.filter((r) => r.sessionId === sessionId).forEach(onResponse)
    return () => {
      set.delete(onResponse)
    }
  }

  subscribeToParticipants(sessionId: string, onParticipant: (participant: ParticipantRecord) => void): Unsubscribe {
    const set = this.participantListeners.get(sessionId) ?? new Set()
    set.add(onParticipant)
    this.participantListeners.set(sessionId, set)
    for (const p of this.participants.values()) {
      if (p.sessionId === sessionId) onParticipant({ id: p.id, name: p.name, joinedAt: new Date().toISOString() })
    }
    return () => {
      set.delete(onParticipant)
    }
  }
}
