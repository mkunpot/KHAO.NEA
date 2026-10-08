import { useMemo } from 'react'
import { isReadoutVisible } from '../lesson/cursor'
import type { SimulationBlock } from '../lesson/types'
import { useSession } from '../session/SessionProvider'
import { DEFAULT_THERMAL_PARAMS, finalSnapshot, snapshotAt } from '../simulations/thermal-contact/model'
import { useThermalSnapshot } from '../simulations/thermal-contact/useThermalContact'
import type { ReadoutKey, ThermalParams, ThermalSnapshot } from '../simulations/thermal-contact/types'

export interface SessionSimulationView {
  snapshot: ThermalSnapshot
  params: ThermalParams
  declared: ReadoutKey[]
  visible: ReadonlySet<ReadoutKey>
}

/**
 * The simulation block as the class sees it. `live` follows the shared session (the semantic
 * start event), animated locally in this browser; `initial` / `settled` are static snapshots of
 * the same model, so they look right even if the teacher skipped the run.
 */
export function useSessionSimulation(block: SimulationBlock, reveal: number): SessionSimulationView {
  const { session, lesson, simClock } = useSession()
  const spec = lesson.simulations[block.simulationId]
  const live = block.display === 'live'
  const params = live && session ? session.sim.params : (spec?.params ?? DEFAULT_THERMAL_PARAMS)

  const animated = useThermalSnapshot(params, live && session ? session.sim.mode : 'idle', live ? (simClock?.startedAtMs ?? null) : null)
  const snapshot = useMemo(() => {
    if (live) return animated
    return block.display === 'settled' ? finalSnapshot(params, 'forward') : snapshotAt(params, 'idle', 0)
  }, [live, animated, block.display, params])

  const declared = Object.keys(block.readouts) as ReadoutKey[]
  const visible = useMemo(
    () => new Set((Object.keys(block.readouts) as ReadoutKey[]).filter((key) => isReadoutVisible(block, key, reveal))),
    [block, reveal],
  )
  return { snapshot, params, declared, visible }
}
