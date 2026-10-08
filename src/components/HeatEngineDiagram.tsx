/** Schematic heat engine: HOT RESERVOIR —Q_H→ [ENGINE] —W→, —Q_C→ COLD RESERVOIR. */
export function HeatEngineDiagram({ className }: { className?: string }) {
  const sub = (letter: string) => (
    <tspan dy={9} fontSize="0.66em">
      {letter}
    </tspan>
  )
  return (
    <svg
      viewBox="0 0 720 620"
      role="img"
      aria-label="Heat engine: heat Q_H flows from the hot reservoir into the engine, work W leaves, heat Q_C flows to the cold reservoir"
      className={className}
    >
      <defs>
        <marker id="engine-arrow" viewBox="0 0 12 12" refX="8" refY="6" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M1 1 L10 6 L1 11 z" fill="currentColor" />
        </marker>
      </defs>

      {/* hot reservoir */}
      <rect x="150" y="10" width="420" height="120" rx="26" fill="var(--hot)" fillOpacity="0.92" />
      <rect x="150" y="10" width="420" height="120" rx="26" fill="none" stroke="rgb(255 255 255 / 0.3)" strokeWidth="3" />
      <text x="360" y="62" textAnchor="middle" fill="#09101e" fontFamily="var(--font-mono)" fontSize="26" fontWeight="700" letterSpacing="5">
        HOT RESERVOIR
      </text>
      <text x="360" y="104" textAnchor="middle" fill="#09101e" fillOpacity="0.75" fontFamily="var(--font-mono)" fontSize="26" fontWeight="600">
        T{sub('H')}
      </text>

      {/* Q_H */}
      <g style={{ color: 'var(--accent)' }}>
        <line x1="360" y1="140" x2="360" y2="238" stroke="currentColor" strokeWidth="9" strokeLinecap="round" markerEnd="url(#engine-arrow)" />
      </g>
      <text x="386" y="196" fill="var(--accent)" fontFamily="var(--font-mono)" fontSize="34" fontWeight="700">
        Q{sub('H')}
      </text>

      {/* engine */}
      <rect x="230" y="246" width="260" height="130" rx="65" fill="var(--surface-3)" stroke="var(--line-strong)" strokeWidth="3" />
      <text x="360" y="323" textAnchor="middle" fill="var(--ink)" fontFamily="var(--font-mono)" fontSize="28" fontWeight="700" letterSpacing="6">
        ENGINE
      </text>

      {/* W */}
      <g style={{ color: 'var(--good)' }}>
        <line x1="494" y1="311" x2="650" y2="311" stroke="currentColor" strokeWidth="9" strokeLinecap="round" markerEnd="url(#engine-arrow)" />
      </g>
      <text x="580" y="290" textAnchor="middle" fill="var(--good)" fontFamily="var(--font-mono)" fontSize="36" fontWeight="700">
        W
      </text>

      {/* Q_C */}
      <g style={{ color: 'var(--cold)' }}>
        <line x1="360" y1="384" x2="360" y2="482" stroke="currentColor" strokeWidth="9" strokeLinecap="round" markerEnd="url(#engine-arrow)" />
      </g>
      <text x="386" y="440" fill="var(--cold)" fontFamily="var(--font-mono)" fontSize="34" fontWeight="700">
        Q{sub('C')}
      </text>

      {/* cold reservoir */}
      <rect x="150" y="490" width="420" height="120" rx="26" fill="var(--cold)" fillOpacity="0.92" />
      <rect x="150" y="490" width="420" height="120" rx="26" fill="none" stroke="rgb(255 255 255 / 0.3)" strokeWidth="3" />
      <text x="360" y="542" textAnchor="middle" fill="#09101e" fontFamily="var(--font-mono)" fontSize="26" fontWeight="700" letterSpacing="5">
        COLD RESERVOIR
      </text>
      <text x="360" y="584" textAnchor="middle" fill="#09101e" fillOpacity="0.75" fontFamily="var(--font-mono)" fontSize="26" fontWeight="600">
        T{sub('C')}
      </text>
    </svg>
  )
}
