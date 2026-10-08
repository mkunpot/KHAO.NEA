import type { ConnectionStatus } from '../session/sessionTypes'

const LOOK: Record<ConnectionStatus, { label: string; dot: string; text: string; ring: boolean }> = {
  connected: { label: 'Live', dot: 'bg-good', text: 'text-good', ring: true },
  connecting: { label: 'Connecting', dot: 'bg-accent', text: 'text-accent', ring: false },
  disconnected: { label: 'Offline · retrying', dot: 'bg-bad', text: 'text-bad', ring: false },
}

export function ConnectionBadge({ status, className = '' }: { status: ConnectionStatus; className?: string }) {
  const look = LOOK[status]
  return (
    <span className={`inline-flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] ${look.text} ${className}`} role="status">
      <span className={`h-2.5 w-2.5 rounded-full ${look.dot} ${look.ring ? 'animate-ring' : ''}`} />
      {look.label}
    </span>
  )
}
