import { EntropyPanel, type PanelVariant } from './EntropyPanel'
import { ThermalBodiesView } from './ThermalBodiesView'
import type { ReadoutKey, ThermalParams, ThermalSnapshot } from './types'

interface Props {
  snapshot: ThermalSnapshot
  params: ThermalParams
  declared: ReadoutKey[]
  visible: ReadonlySet<ReadoutKey>
  variant: PanelVariant
  className?: string
}

/**
 * Presentational only: give it a snapshot and it draws it. Who produces the snapshot differs by
 * rendering state — the classroom session (Presentation, Student) or the learner (Self-Study).
 */
export function ThermalContactSimulation({ snapshot, params, declared, visible, variant, className }: Props) {
  return (
    <div className={className}>
      <ThermalBodiesView
        snapshot={snapshot}
        params={params}
        compact={variant === 'student'}
        showHotTemperature={visible.has('tHot')}
        showColdTemperature={visible.has('tCold')}
        className={variant === 'presentation' ? 'mb-5 min-h-0 w-full flex-1' : 'mb-3 w-full'}
      />
      <div className="shrink-0">
        <EntropyPanel snapshot={snapshot} declared={declared} visible={visible} variant={variant} />
      </div>
    </div>
  )
}
