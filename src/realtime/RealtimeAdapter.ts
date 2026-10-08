/**
 * The only door between the lesson/session code and a realtime backend.
 *
 * Components never talk to Supabase (or anything else) directly: they go through session hooks,
 * which go through this interface. Swapping in WebSocket / Socket.IO / Ably / Firebase means
 * writing another implementation of this file — the lesson model and renderers do not change.
 *
 * Contract for the subscribe* methods: after the subscription is (re)established the adapter
 * delivers the *current* data first and then live changes, so callers never need their own
 * "initial fetch + patch" logic. Callbacks may repeat data; callers de-duplicate by id/version.
 */

import type { LessonDefinition } from '../lesson/types'
import type {
  ConnectionStatus,
  Participant,
  ParticipantRecord,
  ResponseRecord,
  SessionRecord,
  SessionState,
} from '../session/sessionTypes'

export type Unsubscribe = () => void

/** accepted = stored (or already stored: first answer wins); closed = the question is not open. */
export type SubmitResult = 'accepted' | 'closed'

export class SessionCodeTakenError extends Error {
  constructor(code: string) {
    super(`Session code ${code} is already in use`)
    this.name = 'SessionCodeTakenError'
  }
}

export interface RealtimeAdapter {
  /** `lesson` is stored with the session only when the teacher edited it; findSession hands it back to every screen. */
  createSession(input: { sessionCode: string; lessonId: string; initialState: SessionState; lesson?: LessonDefinition }): Promise<SessionRecord>
  findSession(sessionCode: string): Promise<SessionRecord | null>

  /** Register an anonymous participant. Idempotent for the same participant id. */
  joinSession(input: { sessionId: string; participant: Participant }): Promise<void>
  /** Tear down every subscription this adapter holds for the session. */
  leaveSession(sessionId: string): void

  /** Teacher only. Writes the full semantic state; the backend fans it out to everyone. */
  publishSessionState(sessionId: string, state: SessionState, version: number): Promise<void>
  subscribeToSessionState(
    sessionId: string,
    handlers: { onState: (record: SessionRecord) => void; onConnection?: (status: ConnectionStatus) => void },
  ): Unsubscribe

  submitResponse(input: {
    sessionId: string
    participantId: string
    questionId: string
    answer: string
  }): Promise<SubmitResult>
  subscribeToResponses(sessionId: string, onResponse: (response: ResponseRecord) => void): Unsubscribe

  /** The lobby: everyone who has joined (delivered one by one), then each new arrival. Teacher and projector only. */
  subscribeToParticipants(sessionId: string, onParticipant: (participant: ParticipantRecord) => void): Unsubscribe
}
