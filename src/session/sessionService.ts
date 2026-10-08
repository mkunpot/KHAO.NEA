import type { LessonDefinition } from '../lesson/types'
import { SessionCodeTakenError, type RealtimeAdapter } from '../realtime/RealtimeAdapter'
import { initialSessionState } from './sessionReducer'
import type { SessionRecord } from './sessionTypes'

/** No 0/O/1/I/L: easy to read aloud and to type from a projector. 32 symbols = exactly 5 random bits each. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 6

export function generateSessionCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH))
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
}

/** Accepts what people actually type: lower case, spaces, dashes. */
export function normalizeSessionCode(input: string): string {
  return input.replace(/[\s-]/g, '').toUpperCase()
}

export function isValidSessionCode(code: string): boolean {
  return /^[A-Z0-9]{6}$/.test(code)
}

/**
 * Creates a session for the lesson, retrying with a new code in the (very unlikely) event of a collision.
 * With `snapshot`, the lesson itself is stored in the session (the teacher edited it), so projector and
 * phones run exactly these words; without it they use the lesson bundled with the app.
 */
export async function createClassroomSession(
  adapter: RealtimeAdapter,
  lesson: LessonDefinition,
  options: { snapshot?: boolean } = {},
): Promise<SessionRecord> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await adapter.createSession({
        sessionCode: generateSessionCode(),
        lessonId: lesson.id,
        initialState: initialSessionState(lesson),
        ...(options.snapshot ? { lesson } : {}),
      })
    } catch (error) {
      if (!(error instanceof SessionCodeTakenError)) throw error
    }
  }
  throw new Error('Could not find a free session code. Please try again.')
}

/**
 * Origin that student phones must be able to reach. On a deployed site that is simply the page's
 * origin; when the teacher view runs on localhost, set VITE_PUBLIC_BASE_URL to the laptop's LAN address.
 */
export function publicBaseUrl(): string {
  const configured = import.meta.env.VITE_PUBLIC_BASE_URL?.trim()
  return (configured || window.location.origin).replace(/\/+$/, '')
}

export const studentJoinUrl = (code: string) => `${publicBaseUrl()}/student/${code}`
export const teacherPath = (code: string) => `/teacher/${code}`
export const presentPath = (code: string) => `/present/${code}`
