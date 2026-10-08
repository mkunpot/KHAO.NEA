import type { CSSProperties } from 'react'
import { formatKelvin } from './format'
import type { ThermalParams, ThermalSnapshot } from './types'

const HEAT_MIN_K = 275
const HEAT_MAX_K = 425

/** 0 (cold) … 1 (hot): drives the thermal-camera colour of a body. */
export const heatOf = (kelvin: number) => Math.min(1, Math.max(0, (kelvin - HEAT_MIN_K) / (HEAT_MAX_K - HEAT_MIN_K)))

const BODY = { width: 400, height: 280, y: 70, radius: 30 }
const HOT_X = 30
const COLD_X = 570
const CLOSE_BY = 70 // each body slides this far toward the other when thermal contact is made
const FACE_X = 500
const MID_Y = BODY.y + BODY.height / 2

interface Props {
  snapshot: ThermalSnapshot
  params: ThermalParams
  /** Small phone version: no caption under the numbers. */
  compact?: boolean
  /** Whether each body prints its temperature (a lesson step can hold it back until revealed). */
  showHotTemperature?: boolean
  showColdTemperature?: boolean
  className?: string
}

function heatStyle(kelvin: number): CSSProperties {
  return { ['--heat' as string]: heatOf(kelvin) }
}

export function ThermalBodiesView({
  snapshot,
  params,
  compact = false,
  showHotTemperature = true,
  showColdTemperature = true,
  className,
}: Props) {
  const connected = snapshot.mode !== 'idle'
  const reverse = snapshot.direction === 'cold-to-hot'
  const flowing = connected && snapshot.rateFraction > 0.02
  const flowSeconds = 1.15
  const capacity = `C = ${(params.heatCapacityJPerK / 1000).toFixed(1)} kJ/K`

  const body = (side: 'hot' | 'cold') => {
    const kelvin = side === 'hot' ? snapshot.tHotK : snapshot.tColdK
    const showTemperature = side === 'hot' ? showHotTemperature : showColdTemperature
    const x = side === 'hot' ? HOT_X : COLD_X
    const shift = connected ? (side === 'hot' ? CLOSE_BY : -CLOSE_BY) : 0
    return (
      <g
        style={{ transform: `translateX(${shift}px)`, transition: 'transform 0.9s cubic-bezier(0.65, 0, 0.35, 1)' }}
      >
        <ellipse
          className="heat-fill"
          style={heatStyle(kelvin)}
          cx={x + BODY.width / 2}
          cy={MID_Y}
          rx={BODY.width / 2 + 34}
          ry={BODY.height / 2 + 30}
          opacity={0.42}
          filter="url(#body-glow)"
        />
        <rect className="heat-fill" style={heatStyle(kelvin)} x={x} y={BODY.y} width={BODY.width} height={BODY.height} rx={BODY.radius} />
        <rect x={x} y={BODY.y} width={BODY.width} height={BODY.height} rx={BODY.radius} fill="url(#body-gloss)" />
        <rect
          x={x + 1.5}
          y={BODY.y + 1.5}
          width={BODY.width - 3}
          height={BODY.height - 3}
          rx={BODY.radius - 1.5}
          fill="none"
          stroke="rgb(255 255 255 / 0.28)"
          strokeWidth={3}
        />
        <text x={x + 30} y={BODY.y + 52} fill="#09101e" fillOpacity={0.78} fontFamily="var(--font-mono)" fontSize={21} fontWeight={600} letterSpacing={4}>
          {side === 'hot' ? 'HOT BODY' : 'COLD BODY'}
        </text>
        <text x={x + BODY.width / 2} y={MID_Y + 36} textAnchor="middle" fill="#09101e" fontFamily="var(--font-mono)" fontSize={92} fontWeight={700}>
          {showTemperature ? formatKelvin(kelvin) : '—'}
          {showTemperature && (
            <tspan fontSize={32} fontWeight={600} dx={10}>
              K
            </tspan>
          )}
        </text>
        {!compact && (
          <text x={x + BODY.width / 2} y={BODY.y + BODY.height - 30} textAnchor="middle" fill="#09101e" fillOpacity={0.62} fontFamily="var(--font-mono)" fontSize={20} letterSpacing={2}>
            {capacity}
          </text>
        )}
      </g>
    )
  }

  const label = connected
    ? `Hot body at ${formatKelvin(snapshot.tHotK)} kelvin and cold body at ${formatKelvin(snapshot.tColdK)} kelvin in thermal contact`
    : `Hot body at ${formatKelvin(snapshot.tHotK)} kelvin and cold body at ${formatKelvin(snapshot.tColdK)} kelvin, isolated from each other`

  return (
    <svg viewBox="0 0 1000 420" role="img" aria-label={label} className={className} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="body-gloss" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity={0.3} />
          <stop offset="0.55" stopColor="#fff" stopOpacity={0.03} />
          <stop offset="1" stopColor="#000" stopOpacity={0.16} />
        </linearGradient>
        <filter id="body-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation={34} />
        </filter>
        <linearGradient id="face-glow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--accent)" stopOpacity={0} />
          <stop offset="0.5" stopColor="var(--accent)" stopOpacity={0.95} />
          <stop offset="1" stopColor="var(--accent)" stopOpacity={0} />
        </linearGradient>
      </defs>

      {body('hot')}
      {body('cold')}

      {/* Between the bodies: an insulating gap before contact, a glowing contact face after. */}
      {!connected && (
        <g opacity={0.9}>
          <line x1={FACE_X} y1={BODY.y + 24} x2={FACE_X} y2={BODY.y + BODY.height - 24} stroke="var(--ink-faint)" strokeWidth={3} strokeDasharray="4 12" strokeLinecap="round" />
          <text x={FACE_X} y={BODY.y + BODY.height + 56} textAnchor="middle" fill="var(--ink-faint)" fontFamily="var(--font-mono)" fontSize={18} letterSpacing={5}>
            ISOLATED
          </text>
        </g>
      )}
      {connected && (
        <g>
          <rect x={FACE_X - 3} y={BODY.y} width={6} height={BODY.height} fill="url(#face-glow)" />
          {flowing && (
            <g
              transform={`translate(${FACE_X} ${MID_Y}) scale(${reverse ? -1 : 1} 1)`}
              style={{ opacity: 0.35 + 0.65 * snapshot.rateFraction, color: reverse ? 'var(--bad)' : 'var(--accent)' }}
            >
              {[0, 1, 2, 3].map((i) => (
                <g key={i} style={{ animation: `flow ${flowSeconds}s linear infinite`, animationDelay: `${-(i * flowSeconds) / 4}s` }}>
                  <path d="M-12 -28 L12 0 L-12 28" fill="none" stroke="currentColor" strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" />
                </g>
              ))}
            </g>
          )}
          <text x={FACE_X} y={BODY.y + BODY.height + 56} textAnchor="middle" fill="var(--ink-dim)" fontFamily="var(--font-mono)" fontSize={18} letterSpacing={5}>
            {snapshot.settled ? 'EQUILIBRIUM' : reverse ? 'COLD → HOT' : 'HOT → COLD'}
          </text>
        </g>
      )}

      {reverse && (
        <g transform={`translate(${FACE_X} 28) rotate(-3)`}>
          <rect x={-164} y={-24} width={328} height={48} rx={8} fill="none" stroke="var(--bad)" strokeWidth={3} strokeDasharray="10 6" />
          <text textAnchor="middle" y={9} fill="var(--bad)" fontFamily="var(--font-mono)" fontSize={25} fontWeight={700} letterSpacing={5}>
            HYPOTHETICAL
          </text>
        </g>
      )}
    </svg>
  )
}
