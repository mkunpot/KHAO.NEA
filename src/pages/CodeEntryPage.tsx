import { Link } from 'react-router'
import { JoinForm } from '../components/JoinForm'

const COPY = {
  '/student': { eyebrow: 'Join a class', title: 'Enter your class code', hint: 'It is shown on the projector, next to the QR code.' },
  '/teacher': { eyebrow: 'Teacher control', title: 'Open a session', hint: 'Enter the code of a session you created.' },
  '/present': { eyebrow: 'Presentation', title: 'Open a session', hint: 'Enter the code of a session you created.' },
} as const

export default function CodeEntryPage({ target }: { target: keyof typeof COPY }) {
  const copy = COPY[target]
  return (
    <main className="bg-instrument grain relative flex min-h-dvh items-center justify-center p-6">
      <div className="panel relative z-10 w-full max-w-sm p-8">
        <p className="mono-label text-accent">{copy.eyebrow}</p>
        <h1 className="mt-3 font-display text-3xl font-semibold leading-tight">{copy.title}</h1>
        <p className="mt-2 text-sm text-ink-dim">{copy.hint}</p>
        <div className="mt-6">
          <JoinForm target={target} label="Open" />
        </div>
        <Link to="/" className="mt-6 inline-block font-mono text-xs uppercase tracking-[0.14em] text-ink-dim hover:text-ink">
          ← Back to start
        </Link>
      </div>
    </main>
  )
}
