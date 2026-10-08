/**
 * When should voting close by itself? Pure, so the rule is easy to read and test.
 * The teacher's screen is the one that acts on it (only the teacher may change the class state).
 */

export interface AutoFinishInput {
  /** Is voting open right now? */
  open: boolean
  /** Countdown given to the question in seconds (0 = untimed). */
  timerS: number
  /** Seconds since this browser first saw voting open. */
  elapsedS: number
  /** Answers received for this question. */
  answered: number
  /** People who have joined. */
  joined: number
  /** The teacher's switch: finish as soon as everyone has answered. */
  finishWhenAllAnswered: boolean
}

export type AutoFinishReason = 'time' | 'everyone'

/** Pause after the last answer so the final "23 / 23 answered" is visible before the results replace it. */
export const EVERYONE_ANSWERED_DELAY_MS = 800

export function autoFinishReason(input: AutoFinishInput): AutoFinishReason | null {
  if (!input.open) return null
  if (input.timerS > 0 && input.elapsedS >= input.timerS) return 'time'
  if (input.finishWhenAllAnswered && input.joined > 0 && input.answered >= input.joined) return 'everyone'
  return null
}

export function remainingSeconds(timerS: number, elapsedS: number): number {
  return Math.max(0, timerS - elapsedS)
}
