import { useCallback, useEffect, useReducer, useState } from 'react'
import { settleSeconds, snapshotAt } from './model'
import type { ThermalMode, ThermalParams, ThermalSnapshot } from './types'

/**
 * The simulation as seen by one browser. State is a pure function of (params, mode, time since
 * `startedAtMs`), so the only thing a hook needs to do is re-render while the process runs.
 * `startedAtMs` is on the performance.now() timeline of THIS browser.
 */
export function useThermalSnapshot(
  params: ThermalParams,
  mode: ThermalMode,
  startedAtMs: number | null,
): ThermalSnapshot {
  const [, redraw] = useReducer((n: number) => n + 1, 0)
  const running = mode !== 'idle' && startedAtMs !== null

  useEffect(() => {
    if (!running || startedAtMs === null) return
    const totalMs = settleSeconds(params) * 1000
    let frame = 0
    const tick = () => {
      redraw()
      if (performance.now() - startedAtMs < totalMs) frame = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(frame)
  }, [running, startedAtMs, params])

  // Computed during render (not stored), so a restarted run never flashes the previous run's end state.
  const elapsedS = running && startedAtMs !== null ? (performance.now() - startedAtMs) / 1000 : 0
  return snapshotAt(params, mode, elapsedS)
}

const HOT_RANGE = { min: 310, max: 600 }
const COLD_RANGE = { min: 100, max: 390 }
const MIN_GAP_K = 10

/** Self-Study: the learner owns the simulation (sliders + buttons), nothing is shared. */
export function useLocalThermalController(initial: ThermalParams) {
  const [params, setParams] = useState(initial)
  const [run, setRun] = useState<{ mode: ThermalMode; startedAtMs: number | null }>({ mode: 'idle', startedAtMs: null })
  const snapshot = useThermalSnapshot(params, run.mode, run.startedAtMs)

  const start = useCallback((mode: 'forward' | 'reverse') => setRun({ mode, startedAtMs: performance.now() }), [])
  const reset = useCallback(() => setRun({ mode: 'idle', startedAtMs: null }), [])

  const setHot = useCallback((hotK: number) => {
    setParams((p) => ({ ...p, hotK: Math.min(HOT_RANGE.max, Math.max(hotK, p.coldK + MIN_GAP_K)) }))
    setRun({ mode: 'idle', startedAtMs: null })
  }, [])
  const setCold = useCallback((coldK: number) => {
    setParams((p) => ({ ...p, coldK: Math.max(COLD_RANGE.min, Math.min(coldK, p.hotK - MIN_GAP_K)) }))
    setRun({ mode: 'idle', startedAtMs: null })
  }, [])

  return { params, snapshot, mode: run.mode, start, reset, setHot, setCold, hotRange: HOT_RANGE, coldRange: COLD_RANGE }
}
