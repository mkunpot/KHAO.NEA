import type { ReactNode } from 'react'
import '@fontsource-variable/fraunces'
import { Link } from 'react-router'
import { JoinForm } from '../components/JoinForm'
import { isSupabaseConfigured } from '../config'
import { secondLawLesson as lesson } from '../lesson'

function Card({ index, title, children }: { index: string; title: string; children: ReactNode }) {
  return (
    <div className="panel flex min-w-0 flex-col p-6 transition duration-300 hover:-translate-y-1 hover:border-line-strong">
      <span className="font-mono text-xs font-bold tracking-[0.2em] text-accent">{index}</span>
      <h2 className="mt-4 font-display text-2xl font-semibold leading-tight">{title}</h2>
      {children}
    </div>
  )
}

const cta =
  'mt-auto inline-flex items-center justify-center rounded-xl px-5 py-3 font-mono text-xs font-bold uppercase tracking-[0.14em] transition active:scale-[0.97]'

export default function Landing() {
  return (
    <div className="bg-instrument grain relative min-h-dvh overflow-hidden">
      <div className="pointer-events-none absolute -left-28 top-24 h-80 w-80 animate-drift rounded-full bg-hot/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-16 h-96 w-96 animate-drift rounded-full bg-cold/20 blur-3xl" style={{ animationDelay: '2.5s' }} />

      <main className="relative z-10 mx-auto flex min-h-dvh max-w-5xl flex-col justify-center px-6 py-16">
        <p className="mono-label animate-rise text-accent">
          {lesson.metadata.level} · {lesson.metadata.durationMinutes} min
        </p>
        <h1 className="animate-rise mt-5 max-w-3xl font-display text-[2.5rem] font-semibold leading-[1] tracking-tight sm:text-7xl md:text-8xl" style={{ animationDelay: '60ms' }}>
          {lesson.metadata.title}
        </h1>
        <p className="animate-rise mt-6 max-w-xl text-lg text-ink-dim" style={{ animationDelay: '120ms' }}>
          One lesson, three ways to meet it: on the projector, on your phone, and on your own.
        </p>

        <div className="animate-rise mt-12 grid gap-4 md:grid-cols-3" style={{ animationDelay: '200ms' }}>
          <Card index="01" title="Teach a live class">
            <p className="mt-2 text-sm leading-relaxed text-ink-dim">Create a session, put the presentation on the projector, and let students answer on their phones.</p>
            <div className="mt-6 flex flex-1 flex-col">
              <Link to="/create-session" className={`${cta} bg-accent text-[#1a1200] hover:brightness-110`}>
                Create session
              </Link>
            </div>
          </Card>

          <Card index="02" title="Join a class">
            <p className="mt-2 text-sm leading-relaxed text-ink-dim">Enter the six-character code shown on the projector (or just scan its QR code).</p>
            <div className="mt-6 flex flex-1 flex-col justify-end">
              <JoinForm target="/student" label="Join" />
            </div>
          </Card>

          <Card index="03" title="Study on your own">
            <p className="mt-2 text-sm leading-relaxed text-ink-dim">The same lesson as a reading page, with a simulation you can push around. No class needed.</p>
            <div className="mt-6 flex flex-1 flex-col">
              <Link to="/study" className={`${cta} border border-line-strong text-ink hover:bg-surface-2`}>
                Open Self-Study
              </Link>
            </div>
          </Card>
        </div>

        <p className="animate-rise mt-6 text-sm text-ink-dim" style={{ animationDelay: '260ms' }}>
          Want different wording?{' '}
          <Link to="/edit" className="font-semibold text-accent hover:underline">
            Edit the lesson
          </Link>
        </p>

        {!isSupabaseConfigured && (
          <p className="mt-8 max-w-2xl rounded-2xl border border-accent/40 bg-accent/10 px-5 py-4 text-sm leading-relaxed text-ink-dim">
            <span className="font-semibold text-accent">Live classes are not set up yet.</span> They need a free Supabase project — see the README
            (create the project, run <code className="font-mono text-ink [overflow-wrap:anywhere]">supabase/migrations/001_classroom_demo.sql</code>, fill in <code className="font-mono text-ink">.env.local</code>). Self-Study works without it.
          </p>
        )}
      </main>
    </div>
  )
}
