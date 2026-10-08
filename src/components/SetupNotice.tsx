import { Link } from 'react-router'

/** Shown instead of a classroom screen while no Supabase project is configured. */
export function SetupNotice() {
  return (
    <main className="bg-instrument grain relative flex min-h-dvh items-center justify-center p-6">
      <div className="panel relative z-10 w-full max-w-xl p-8">
        <p className="mono-label text-accent">Setup needed</p>
        <h1 className="mt-3 font-display text-3xl font-semibold leading-tight">Connect a Supabase project to run a live class</h1>
        <p className="mt-4 text-ink-dim">
          Classroom sessions use Supabase for realtime sync. This build has no project configured yet. Self-Study works without one.
        </p>
        <ol className="mt-6 space-y-3 text-sm text-ink-dim">
          <li>
            <span className="font-mono text-accent">1</span> · Create a free project at supabase.com and run{' '}
            <code className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[12px] text-ink [overflow-wrap:anywhere]">supabase/migrations/001_classroom_demo.sql</code> in the SQL Editor.
          </li>
          <li>
            <span className="font-mono text-accent">2</span> · Copy <code className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[12px] text-ink">.env.example</code> to{' '}
            <code className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[12px] text-ink">.env.local</code> and fill in the project URL and publishable key.
          </li>
          <li>
            <span className="font-mono text-accent">3</span> · Restart <code className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[12px] text-ink">npm run dev</code>.
          </li>
        </ol>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/study" className="rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-[#1a1200] transition hover:brightness-110">
            Open Self-Study
          </Link>
          <Link to="/" className="rounded-xl border border-line-strong px-5 py-3 text-sm font-semibold text-ink transition hover:bg-surface-2">
            Back to start
          </Link>
        </div>
      </div>
    </main>
  )
}
