import type { ReactNode } from 'react'
import { useParams } from 'react-router'
import { SessionGate } from '../components/SessionGate'
import { SetupNotice } from '../components/SetupNotice'
import { secondLawLesson } from '../lesson'
import { getRealtimeAdapter } from '../realtime'
import { SessionProvider } from '../session/SessionProvider'
import { normalizeSessionCode } from '../session/sessionService'
import type { SessionRole } from '../session/sessionTypes'

/**
 * Shared wrapper of the live screens (/teacher, /present, /student): it picks the code out of
 * the URL, hands the app-wide realtime adapter and THE canonical lesson to a SessionProvider,
 * and shows a status screen until the session has loaded.
 */
export function ClassroomRoute({ role, children }: { role: SessionRole; children: ReactNode }) {
  const { code = '' } = useParams()
  const adapter = getRealtimeAdapter()
  if (!adapter) return <SetupNotice />
  return (
    <SessionProvider code={normalizeSessionCode(code)} role={role} lesson={secondLawLesson} adapter={adapter}>
      <SessionGate>{children}</SessionGate>
    </SessionProvider>
  )
}
