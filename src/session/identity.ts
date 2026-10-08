/**
 * Anonymous participant identity, generated in the browser. No account, no login.
 * A refresh keeps the same identity (and the same answers) via localStorage.
 */

import type { Participant } from './sessionTypes'

const ADJECTIVES = ['Blue', 'Amber', 'Quiet', 'Swift', 'Bright', 'Calm', 'Lucky', 'Brave', 'Silver', 'Misty', 'Cosmic', 'Nimble']
const ANIMALS = ['Fox', 'Owl', 'Otter', 'Heron', 'Lynx', 'Panda', 'Gecko', 'Falcon', 'Koala', 'Marten', 'Ibis', 'Orca']

/**
 * RFC 4122 v4 UUID. crypto.randomUUID() only exists in secure contexts (https / localhost), and a
 * phone opening the LAN address of a dev server over plain http is not one — so fall back to
 * getRandomValues(), which is always available.
 */
export function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function randomDisplayName(): string {
  const pick = (list: string[]) => list[Math.floor(Math.random() * list.length)] ?? list[0]!
  return `${pick(ADJECTIVES)} ${pick(ANIMALS)}`
}

// localStorage can throw (private mode, blocked site data); fall back to memory so the page still works.
const memory = new Map<string, string>()

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return memory.get(key) ?? null
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    memory.set(key, value)
  }
}

const participantKey = (code: string) => `second-law-demo:participant:${code}`
const answersKey = (code: string) => `second-law-demo:answers:${code}`

export function loadParticipant(code: string): Participant {
  const stored = read(participantKey(code))
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as Partial<Participant>
      if (typeof parsed.id === 'string' && typeof parsed.name === 'string') return { id: parsed.id, name: parsed.name }
    } catch {
      // fall through and create a fresh identity
    }
  }
  const participant = { id: uuid(), name: randomDisplayName() }
  write(participantKey(code), JSON.stringify(participant))
  return participant
}

export function loadAnswers(code: string): Record<string, string> {
  const stored = read(answersKey(code))
  if (!stored) return {}
  try {
    const parsed: unknown = JSON.parse(stored)
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, string>) : {}
  } catch {
    return {}
  }
}

export function saveAnswer(code: string, questionId: string, answer: string): void {
  write(answersKey(code), JSON.stringify({ ...loadAnswers(code), [questionId]: answer }))
}
