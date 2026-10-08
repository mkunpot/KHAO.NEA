import { useEffect, useReducer } from 'react'

export interface Countdown {
  /** Seconds since this browser first saw voting open (0 when not running). */
  elapsedS: number
  /** Seconds left on the question's countdown (0 when untimed or not running). */
  remainingS: number
  /** 1 → 0 across the countdown, for progress bars and rings. */
  fraction: number
  running: boolean
}

/**
 * Local countdown measured from `startedAtMs` (performance.now() timeline of THIS browser).
 * Nothing is shared over the network but the length of the countdown: each screen starts counting
 * when it sees voting open, so no clock-sync is needed and a few hundred ms of skew is invisible.
 */
export function useCountdown(timerS: number, startedAtMs: number | null): Countdown {
  const [, redraw] = useReducer((n: number) => n + 1, 0)
  const running = timerS > 0 && startedAtMs !== null

  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(redraw, 200)
    return () => window.clearInterval(timer)
  }, [running, startedAtMs])

  const elapsedS = running && startedAtMs !== null ? Math.max(0, (performance.now() - startedAtMs) / 1000) : 0
  const remainingS = running ? Math.max(0, timerS - elapsedS) : 0
  return { elapsedS, remainingS, fraction: running ? remainingS / timerS : 0, running }
}
