/**
 * The projector before the lesson starts (Kahoot's lobby): the join code and QR code big enough to read
 * from the back of the room, a live count of who has joined, and every name as it appears.
 * The teacher's "Start lesson" button replaces it with the first slide.
 */

import '@fontsource-variable/fraunces'
import { useEffect, useState } from 'react'
import { QRCodeBlock } from '../../components/QRCodeBlock'
import { useSession } from '../../session/SessionProvider'
import { studentJoinUrl } from '../../session/sessionService'

function useViewportMin(): number {
  const [min, setMin] = useState(() => Math.min(window.innerWidth, window.innerHeight))
  useEffect(() => {
    const onResize = () => setMin(Math.min(window.innerWidth, window.innerHeight))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return min
}

export function PresentationLobby() {
  const { lesson, code, participants } = useSession()
  const url = studentJoinUrl(code)
  const vmin = useViewportMin()
  // Name chips shrink as the room fills so up to ~40 names always fit beside the code.
  const crowded = participants.length > 36 ? 1.9 : participants.length > 24 ? 2.3 : participants.length > 14 ? 2.8 : 3.2

  return (
    <div className="bg-instrument grain fixed inset-0 overflow-hidden text-ink">
      <div className="relative z-10 grid h-full grid-cols-[auto_minmax(0,1fr)] items-center gap-[7vmin] p-[6vmin]">
        <section className="flex flex-col items-center gap-[2.6vmin]">
          <p className="mono-label" style={{ fontSize: '2vmin' }}>
            Join on your phone
          </p>
          <QRCodeBlock value={url} size={Math.round(vmin * 0.42)} />
          <div className="font-mono font-bold text-accent" style={{ fontSize: '11vmin', lineHeight: 1, letterSpacing: '0.16em' }}>
            {code}
          </div>
          <p className="max-w-[40vmin] break-all text-center font-mono text-ink-faint" style={{ fontSize: '1.8vmin' }}>
            {url.replace(/^https?:\/\//, '')}
          </p>
        </section>

        <section className="flex h-full min-h-0 flex-col justify-center gap-[3vmin]">
          <div>
            <p className="mono-label" style={{ fontSize: '2vmin' }}>
              {lesson.metadata.level}
            </p>
            <h1 className="mt-[1.4vmin] font-display font-semibold tracking-tight" style={{ fontSize: '7.2vmin', lineHeight: 1.04 }}>
              {lesson.metadata.title}
            </h1>
          </div>

          <div className="flex items-center gap-[1.4vmin] font-mono text-ink-dim" style={{ fontSize: '2.3vmin' }}>
            <span className="inline-block animate-ring rounded-full bg-good" style={{ width: '1.6vmin', height: '1.6vmin' }} />
            Waiting for the teacher to start…
          </div>

          <div className="flex items-end gap-[2vmin]">
            <span className="font-mono font-bold tabular-nums text-accent" style={{ fontSize: '17vmin', lineHeight: 0.85 }}>
              {participants.length}
            </span>
            <span className="mono-label pb-[1vmin]" style={{ fontSize: '2.6vmin' }}>
              {participants.length === 1 ? 'student joined' : 'students joined'}
            </span>
          </div>

          <ul className="flex min-h-0 flex-1 flex-wrap content-start gap-[1.3vmin] overflow-hidden">
            {participants.map((p) => (
              <li
                key={p.id}
                className="animate-rise rounded-full border border-line-strong bg-surface-2/80 font-semibold"
                style={{ fontSize: `${crowded}vmin`, padding: `${crowded * 0.28}vmin ${crowded * 0.7}vmin` }}
              >
                {p.name}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
