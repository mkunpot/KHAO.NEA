/** Circular countdown (Kahoot-style): the ring drains, the number counts down, the last 5 seconds turn red. */
export function CountdownRing({ remainingS, totalS, size = 72 }: { remainingS: number; totalS: number; size?: number }) {
  const stroke = Math.max(5, Math.round(size / 9))
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const fraction = totalS > 0 ? Math.min(1, remainingS / totalS) : 0
  const urgent = remainingS <= 5
  const color = urgent ? 'var(--bad)' : 'var(--accent)'
  const seconds = Math.ceil(remainingS)

  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }} role="timer" aria-label={`${seconds} seconds left`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--line-strong)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          style={{ transition: 'stroke-dashoffset 0.25s linear, stroke 0.3s' }}
        />
      </svg>
      <span className={`absolute font-mono font-bold tabular-nums ${urgent ? 'animate-breathe' : ''}`} style={{ fontSize: size * 0.38, color: urgent ? 'var(--bad)' : 'var(--ink)' }}>
        {seconds}
      </span>
    </div>
  )
}

/** Thin bar version for phones: a strip across the top that shrinks. */
export function CountdownBar({ fraction, urgent }: { fraction: number; urgent: boolean }) {
  return (
    <div className="h-2.5 w-full overflow-hidden bg-surface-3" aria-hidden>
      <div
        className="h-full"
        style={{ width: `${Math.max(0, Math.min(1, fraction)) * 100}%`, background: urgent ? 'var(--bad)' : 'var(--accent)', transition: 'width 0.2s linear, background 0.3s' }}
      />
    </div>
  )
}
