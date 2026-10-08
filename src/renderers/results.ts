import type { Question } from '../lesson/types'
import type { ResponseRecord } from '../session/sessionTypes'

export interface Tally {
  counts: Record<string, number>
  total: number
}

/** Anonymous aggregate for one question: how many picked each option. Answers outside the option list are ignored. */
export function tallyResponses(responses: ResponseRecord[], question: Question): Tally {
  const counts: Record<string, number> = Object.fromEntries(question.options.map((o) => [o.id, 0]))
  let total = 0
  for (const response of responses) {
    if (response.questionId !== question.id || !(response.answer in counts)) continue
    counts[response.answer] = (counts[response.answer] ?? 0) + 1
    total++
  }
  return { counts, total }
}

export function percentOf(count: number, total: number): number {
  return total === 0 ? 0 : Math.round((count / total) * 100)
}

/** Short badge text for an option: A–D stay as they are, yes/no become Y/N. */
export function optionBadge(optionId: string): string {
  return optionId.length <= 1 ? optionId : (optionId[0] ?? '?').toUpperCase()
}
