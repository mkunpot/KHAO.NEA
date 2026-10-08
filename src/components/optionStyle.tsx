import type { CSSProperties } from 'react'

/**
 * Every answer option has a colour AND a shape (like Kahoot's ▲ ◆ ● ■). The same pairing appears on
 * the projector, on phones and on the teacher's screen, so "the blue diamond" means one thing everywhere —
 * and it works for colour-blind students because the shape differs too.
 */
export type ShapeKind = 'triangle' | 'diamond' | 'circle' | 'square'

export interface OptionStyle {
  shape: ShapeKind
  /** Background of the option's tile / badge. */
  bg: string
  /** Text and icon colour that reads on `bg`. */
  ink: string
}

const RED: OptionStyle = { shape: 'triangle', bg: '#ff5b79', ink: '#2b0710' }
const BLUE: OptionStyle = { shape: 'diamond', bg: '#4f8cff', ink: '#06142e' }
const AMBER: OptionStyle = { shape: 'circle', bg: '#ffcb52', ink: '#2b2000' }
const GREEN: OptionStyle = { shape: 'square', bg: '#3fdc98', ink: '#04281a' }

/** Two options (Yes / No) use blue and red, like a true/false question; four use all four. */
export function optionStyle(index: number, count: number): OptionStyle {
  const palette = count === 2 ? [BLUE, RED] : [RED, BLUE, AMBER, GREEN]
  return palette[index % palette.length] ?? RED
}

export function Shape({ kind, className, style }: { kind: ShapeKind; className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className} style={style}>
      {kind === 'triangle' && <path d="M12 3 L22 20.5 H2 Z" strokeLinejoin="round" />}
      {kind === 'diamond' && <path d="M12 1.5 L22.5 12 L12 22.5 L1.5 12 Z" strokeLinejoin="round" />}
      {kind === 'circle' && <circle cx="12" cy="12" r="10" />}
      {kind === 'square' && <rect x="3" y="3" width="18" height="18" rx="2.5" />}
    </svg>
  )
}
