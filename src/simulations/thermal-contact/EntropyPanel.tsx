import type { ReactNode } from 'react'
import { entropySign, formatEntropy, formatKiloJoules } from './format'
import type { ReadoutKey, ThermalSnapshot } from './types'

export type PanelVariant = 'presentation' | 'student' | 'study'

interface Tile {
  key: ReadoutKey
  label: ReactNode
  unit: string
  value: (s: ThermalSnapshot) => string
  tone: (s: ThermalSnapshot) => string
  arrow?: (s: ThermalSnapshot) => string | null
}

const arrowFor = (jPerK: number) => {
  const sign = entropySign(jPerK)
  return sign === 'negative' ? '↓' : sign === 'positive' ? '↑' : null
}

const totalTone = (s: ThermalSnapshot) => {
  if (s.mode === 'idle') return 'text-ink-dim'
  const sign = entropySign(s.dSTotalJPerK)
  return sign === 'negative' ? 'text-bad' : sign === 'positive' ? 'text-good' : 'text-ink-dim'
}

const TILES: Tile[] = [
  { key: 'heat', label: <>Q moved</>, unit: 'kJ', value: (s) => formatKiloJoules(s.heatJ), tone: () => 'text-ink' },
  {
    key: 'dSHot',
    label: <>ΔS<sub>hot</sub></>,
    unit: 'J/K',
    value: (s) => formatEntropy(s.dSHotJPerK),
    tone: () => 'text-entropy',
    arrow: (s) => arrowFor(s.dSHotJPerK),
  },
  {
    key: 'dSCold',
    label: <>ΔS<sub>cold</sub></>,
    unit: 'J/K',
    value: (s) => formatEntropy(s.dSColdJPerK),
    tone: () => 'text-entropy',
    arrow: (s) => arrowFor(s.dSColdJPerK),
  },
  {
    key: 'dSTotal',
    label: <>ΔS<sub>total</sub></>,
    unit: 'J/K',
    value: (s) => formatEntropy(s.dSTotalJPerK),
    tone: totalTone,
    arrow: (s) => arrowFor(s.dSTotalJPerK),
  },
]

const SIZES: Record<PanelVariant, { grid: string; tile: string; label: string; value: string; unit: string; chip: string }> = {
  presentation: {
    grid: 'gap-5',
    tile: 'rounded-3xl px-7 py-5',
    label: 'text-[22px]',
    value: 'text-[56px] leading-none',
    unit: 'text-[22px]',
    chip: 'mt-4 rounded-2xl px-7 py-3 text-[24px]',
  },
  student: {
    grid: 'gap-2',
    tile: 'rounded-xl p-3',
    label: 'text-[11px]',
    value: 'text-[22px] leading-none',
    unit: 'text-[10px]',
    chip: 'mt-2 rounded-xl px-3 py-2 text-[11px]',
  },
  study: {
    grid: 'gap-3',
    tile: 'rounded-2xl p-3 sm:p-4',
    label: 'text-xs',
    value: 'text-[22px] leading-none sm:text-[30px]',
    unit: 'text-[10px] sm:text-xs',
    chip: 'mt-3 rounded-xl px-4 py-3 text-sm',
  },
}

interface Props {
  snapshot: ThermalSnapshot
  /** Read-outs this step uses at all. */
  declared: ReadoutKey[]
  /** Read-outs revealed so far (the rest show a dim placeholder and fade in). */
  visible: ReadonlySet<ReadoutKey>
  variant: PanelVariant
}

export function EntropyPanel({ snapshot, declared, visible, variant }: Props) {
  const size = SIZES[variant]
  // Temperatures are printed inside the bodies; this panel holds the energy and entropy read-outs.
  const tiles = TILES.filter((t) => declared.includes(t.key))
  const columns = tiles.length === 1 ? 'grid-cols-1' : tiles.length === 3 ? 'grid-cols-3' : 'grid-cols-2'
  const showVerdict = declared.includes('dSTotal') && visible.has('dSTotal') && snapshot.mode !== 'idle'
  const verdict = entropySign(snapshot.dSTotalJPerK)

  return (
    <div>
      {tiles.length > 0 && (
        <div className={`grid ${columns} ${size.grid}`}>
          {tiles.map((tile) => {
            const shown = visible.has(tile.key)
            const arrow = shown ? tile.arrow?.(snapshot) : null
            return (
              <div key={tile.key} className={`panel reveal font-mono ${size.tile}`} data-shown={shown ? 'true' : 'placeholder'} style={shown ? undefined : { opacity: 0.35 }}>
                <div className={`${size.label} tracking-wide text-ink-dim`}>{tile.label}</div>
                <div className={`mt-2 flex items-baseline gap-2 whitespace-nowrap font-semibold tabular-nums ${tile.tone(snapshot)}`}>
                  <span className={size.value}>{shown ? tile.value(snapshot) : '—'}</span>
                  {shown && <span className={`${size.unit} font-medium text-ink-dim`}>{tile.unit}</span>}
                  {arrow && <span className={`${size.unit} ml-auto`}>{arrow}</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showVerdict && verdict !== 'zero' && (
        <div
          className={`reveal font-mono font-semibold tracking-wide ${size.chip} ${
            verdict === 'positive' ? 'bg-good/15 text-good' : 'bg-bad/15 text-bad'
          }`}
          style={{ border: `1px solid color-mix(in oklab, var(${verdict === 'positive' ? '--good' : '--bad'}) 45%, transparent)` }}
        >
          {verdict === 'positive' ? (
            <>SPONTANEOUS · ΔS<sub>total</sub> &gt; 0</>
          ) : (
            <>NOT SPONTANEOUS · ΔS<sub>total</sub> &lt; 0 for an isolated macroscopic system</>
          )}
        </div>
      )}
    </div>
  )
}
