import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useSession } from '../session/SessionProvider'

function Centered({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <main className="bg-instrument grain relative flex min-h-dvh items-center justify-center p-6">
      <div className="panel relative z-10 w-full max-w-md p-8 text-center">
        <p className="mono-label">{eyebrow}</p>
        <h1 className="mt-3 font-display text-3xl font-semibold leading-tight">{title}</h1>
        {children}
      </div>
    </main>
  )
}

/** Renders children once the session has loaded; otherwise a plain status screen. */
export function SessionGate({ children }: { children: ReactNode }) {
  const { phase, code, errorMessage } = useSession()

  if (phase === 'loading') {
    return (
      <Centered eyebrow="Connecting" title={`Joining ${code}…`}>
        <div className="mx-auto mt-6 flex w-24 justify-between">
          <span className="h-5 w-5 animate-breathe rounded-full bg-hot" />
          <span className="h-5 w-5 animate-breathe rounded-full bg-cold" style={{ animationDelay: '0.5s' }} />
        </div>
      </Centered>
    )
  }
  if (phase === 'not-found') {
    return (
      <Centered eyebrow="Session not found" title={`No class with code ${code}`}>
        <p className="mt-3 text-ink-dim">Check the code on the projector, or ask your teacher to create a new session.</p>
        <Link to="/" className="mt-6 inline-block rounded-xl border border-line-strong px-5 py-3 text-sm font-semibold transition hover:bg-surface-2">
          Back to start
        </Link>
      </Centered>
    )
  }
  if (phase === 'error') {
    return (
      <Centered eyebrow="Something went wrong" title="Could not reach the class">
        <p className="mt-3 break-words text-sm text-ink-dim">{errorMessage}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-[#1a1200] transition hover:brightness-110"
        >
          Try again
        </button>
      </Centered>
    )
  }
  return <>{children}</>
}
