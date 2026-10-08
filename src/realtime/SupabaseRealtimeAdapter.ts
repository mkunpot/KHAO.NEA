/**
 * RealtimeAdapter backed by Supabase. This (and supabase/client.ts) is the only code that knows Supabase exists.
 *
 * Why Postgres Changes and nothing else?
 *  - The class state is ONE row in classroom_sessions. The teacher updates it; every browser
 *    subscribes to that row. The database is the single source of truth, so a phone that
 *    reconnects or joins late simply re-reads the row — there is no event log to replay.
 *  - Answers are INSERTs into `responses`; the teacher/presentation subscribe to those inserts.
 *  - Broadcast and Presence are deliberately not used in this demo: at <= ~40 people the
 *    row-change fan-out is tiny (see README → Free-tier notes), and one mechanism is much easier
 *    to reason about. If latency or scale ever matter, add Broadcast *inside this class*.
 *  - Animation frames never travel over the network: only semantic state transitions are written.
 */

import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import type { LessonDefinition } from '../lesson/types'
import type { Database, Json, ParticipantRow, ResponseRow, SessionRow } from '../supabase/types'
import type {
  ConnectionStatus,
  Participant,
  ParticipantRecord,
  ResponseRecord,
  SessionRecord,
  SessionState,
} from '../session/sessionTypes'
import {
  SessionCodeTakenError,
  type RealtimeAdapter,
  type SubmitResult,
  type Unsubscribe,
} from './RealtimeAdapter'
import { rowToParticipant, rowToRecord, rowToResponse, stateToColumns } from './supabaseMapping'

const UNIQUE_VIOLATION = '23505'
const RLS_VIOLATION = '42501'

function fail(error: { message: string; code?: string }): never {
  throw new Error(error.message)
}

export class SupabaseRealtimeAdapter implements RealtimeAdapter {
  private readonly client: SupabaseClient<Database>
  private readonly channels = new Map<string, Set<RealtimeChannel>>()
  private channelCounter = 0

  constructor(client: SupabaseClient<Database>) {
    this.client = client
  }

  async createSession(input: { sessionCode: string; lessonId: string; initialState: SessionState; lesson?: LessonDefinition }) {
    const { data, error } = await this.client
      .from('classroom_sessions')
      .insert({
        session_code: input.sessionCode,
        lesson_id: input.lessonId,
        ...stateToColumns(input.initialState, 0),
        // Only an edited lesson is written, so sessions with the built-in lesson work on a database without migration 003.
        ...(input.lesson ? { lesson_json: input.lesson as unknown as Json } : {}),
      })
      .select()
      .single()
    if (error) {
      if (error.code === UNIQUE_VIOLATION) throw new SessionCodeTakenError(input.sessionCode)
      fail(error)
    }
    return rowToRecord(data)
  }

  async findSession(sessionCode: string) {
    const { data, error } = await this.client
      .from('classroom_sessions')
      .select('*')
      .eq('session_code', sessionCode.toUpperCase())
      .maybeSingle()
    if (error) fail(error)
    return data ? rowToRecord(data) : null
  }

  private async fetchSession(sessionId: string) {
    const { data, error } = await this.client.from('classroom_sessions').select('*').eq('id', sessionId).maybeSingle()
    if (error) fail(error)
    return data ? rowToRecord(data) : null
  }

  async joinSession(input: { sessionId: string; participant: Participant }) {
    const { error } = await this.client.from('participants').upsert(
      { id: input.participant.id, session_id: input.sessionId, anonymous_name: input.participant.name },
      { onConflict: 'id', ignoreDuplicates: true },
    )
    if (error) fail(error)
  }

  leaveSession(sessionId: string) {
    const set = this.channels.get(sessionId)
    if (!set) return
    this.channels.delete(sessionId)
    for (const channel of set) void this.client.removeChannel(channel)
  }

  async publishSessionState(sessionId: string, state: SessionState, version: number) {
    const { error } = await this.client
      .from('classroom_sessions')
      .update(stateToColumns(state, version))
      .eq('id', sessionId)
    if (error) fail(error)
  }

  subscribeToSessionState(
    sessionId: string,
    handlers: { onState: (record: SessionRecord) => void; onConnection?: (status: ConnectionStatus) => void },
  ): Unsubscribe {
    let disposed = false
    const channel = this.client
      .channel(`session-state:${sessionId}:${++this.channelCounter}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'classroom_sessions', filter: `id=eq.${sessionId}` },
        (payload) => {
          if (!disposed) handlers.onState(rowToRecord(payload.new as SessionRow))
        },
      )
      .subscribe((status) => {
        if (disposed) return
        if (status === 'SUBSCRIBED') {
          handlers.onConnection?.('connected')
          // (Re)connected: re-read the row so nothing sent while we were away is missed.
          this.fetchSession(sessionId)
            .then((record) => {
              if (record && !disposed) handlers.onState(record)
            })
            .catch(() => {})
        } else {
          handlers.onConnection?.('disconnected')
        }
      })
    return this.track(sessionId, channel, () => {
      disposed = true
    })
  }

  async submitResponse(input: {
    sessionId: string
    participantId: string
    questionId: string
    answer: string
  }): Promise<SubmitResult> {
    const { error } = await this.client.from('responses').upsert(
      {
        session_id: input.sessionId,
        participant_id: input.participantId,
        question_id: input.questionId,
        answer: input.answer,
      },
      // ON CONFLICT DO NOTHING: a repeated tap never overwrites or errors — the first answer wins.
      { onConflict: 'session_id,participant_id,question_id', ignoreDuplicates: true },
    )
    if (error) {
      if (error.code === RLS_VIOLATION) return 'closed'
      fail(error)
    }
    return 'accepted'
  }

  private async fetchResponses(sessionId: string) {
    const { data, error } = await this.client.from('responses').select('*').eq('session_id', sessionId)
    if (error) fail(error)
    return data.map(rowToResponse)
  }

  subscribeToResponses(sessionId: string, onResponse: (response: ResponseRecord) => void): Unsubscribe {
    let disposed = false
    const channel = this.client
      .channel(`responses:${sessionId}:${++this.channelCounter}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'responses', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          if (!disposed) onResponse(rowToResponse(payload.new as ResponseRow))
        },
      )
      .subscribe((status) => {
        if (disposed || status !== 'SUBSCRIBED') return
        this.fetchResponses(sessionId)
          .then((all) => {
            if (!disposed) all.forEach(onResponse)
          })
          .catch(() => {})
      })
    return this.track(sessionId, channel, () => {
      disposed = true
    })
  }

  private async fetchParticipants(sessionId: string) {
    const { data, error } = await this.client.from('participants').select('*').eq('session_id', sessionId)
    if (error) fail(error)
    return data.map(rowToParticipant)
  }

  subscribeToParticipants(sessionId: string, onParticipant: (participant: ParticipantRecord) => void): Unsubscribe {
    let disposed = false
    const channel = this.client
      .channel(`participants:${sessionId}:${++this.channelCounter}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'participants', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          if (!disposed) onParticipant(rowToParticipant(payload.new as ParticipantRow))
        },
      )
      .subscribe((status) => {
        if (disposed || status !== 'SUBSCRIBED') return
        this.fetchParticipants(sessionId)
          .then((all) => {
            if (!disposed) all.forEach(onParticipant)
          })
          .catch(() => {})
      })
    return this.track(sessionId, channel, () => {
      disposed = true
    })
  }

  private track(sessionId: string, channel: RealtimeChannel, onDispose: () => void): Unsubscribe {
    const set = this.channels.get(sessionId) ?? new Set<RealtimeChannel>()
    set.add(channel)
    this.channels.set(sessionId, set)
    return () => {
      onDispose()
      set.delete(channel)
      void this.client.removeChannel(channel)
    }
  }
}
