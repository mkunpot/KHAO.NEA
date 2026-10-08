import { Link } from 'react-router'

export default function NotFoundPage() {
  return (
    <main className="bg-instrument grain relative flex min-h-dvh items-center justify-center p-6">
      <div className="panel relative z-10 w-full max-w-md p-8 text-center">
        <p className="mono-label">404</p>
        <h1 className="mt-3 font-display text-3xl font-semibold">Nothing here</h1>
        <p className="mt-3 text-ink-dim">That page does not exist.</p>
        <Link to="/" className="mt-6 inline-block rounded-xl border border-line-strong px-5 py-3 font-mono text-xs font-bold uppercase tracking-[0.14em] transition hover:bg-surface-2">
          Back to start
        </Link>
      </div>
    </main>
  )
}
