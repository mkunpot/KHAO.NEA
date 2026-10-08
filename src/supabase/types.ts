/**
 * Hand-written types for supabase/migrations/001_classroom_demo.sql — just enough for a typed client.
 * (`type` aliases, not interfaces: supabase-js needs them assignable to Record<string, unknown>.)
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type SessionRow = {
  id: string
  session_code: string
  lesson_id: string
  started: boolean
  current_step: number
  question_open: boolean
  question_timer_s: number
  active_question_id: string | null
  answer_revealed: boolean
  results_visible: boolean
  sim: Json
  version: number
  status: 'active' | 'ended'
  created_at: string
  updated_at: string
  /** supabase/migrations/003_lesson_snapshot.sql — null/absent = the lesson bundled with the app. */
  lesson_json?: Json | null
}

export type SessionInsert = {
  id?: string
  session_code: string
  lesson_id: string
  started?: boolean
  current_step?: number
  question_open?: boolean
  question_timer_s?: number
  active_question_id?: string | null
  answer_revealed?: boolean
  results_visible?: boolean
  sim?: Json
  version?: number
  status?: 'active' | 'ended'
  lesson_json?: Json | null
}

export type SessionUpdate = Partial<SessionInsert>

export type ParticipantRow = {
  id: string
  session_id: string
  anonymous_name: string
  joined_at: string
}

export type ParticipantInsert = {
  id: string
  session_id: string
  anonymous_name: string
}

export type ResponseRow = {
  id: string
  session_id: string
  participant_id: string
  question_id: string
  answer: string
  submitted_at: string
}

export type ResponseInsert = {
  session_id: string
  participant_id: string
  question_id: string
  answer: string
}

export type Database = {
  public: {
    Tables: {
      classroom_sessions: {
        Row: SessionRow
        Insert: SessionInsert
        Update: SessionUpdate
        Relationships: []
      }
      participants: {
        Row: ParticipantRow
        Insert: ParticipantInsert
        Update: Partial<ParticipantInsert>
        Relationships: []
      }
      responses: {
        Row: ResponseRow
        Insert: ResponseInsert
        Update: Partial<ResponseInsert>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}
