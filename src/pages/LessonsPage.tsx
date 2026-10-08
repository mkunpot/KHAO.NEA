import { Link } from 'react-router'
import { currentLesson } from '../lesson/draft'

const action = 'inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent active:scale-[0.98]'

export default function LessonsPage() {
  const { lesson, edited } = currentLesson()
  const questionCount = Object.keys(lesson.questions).length

  return (
    <main className="bg-instrument grain min-h-dvh px-6 py-7 sm:px-10 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between border-b border-line pb-5">
          <Link to="/" className="font-display text-xl font-semibold tracking-tight text-ink">Heat / Order</Link>
          <p className="text-sm text-ink-dim">Lesson library</p>
        </header>
        <section className="py-14 lg:py-20">
          <div className="max-w-xl">
            <p className="text-sm font-semibold text-accent">Your teaching materials</p>
            <h1 className="mt-4 max-w-md font-display text-5xl font-semibold leading-[0.96] tracking-[-0.045em] sm:text-6xl">Lessons, ready for the room.</h1>
            <p className="mt-6 max-w-md text-base leading-7 text-ink-dim">Lead it live, rehearse it with a simulated class, or edit each slide before the room opens.</p>
          </div>
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <article className="relative overflow-hidden rounded-[1.7rem] border border-line-strong bg-surface p-6 shadow-[0_26px_75px_rgb(0_0_0_/_0.16)] sm:p-8">
            <div className="absolute inset-y-0 left-0 w-1 bg-[linear-gradient(var(--hot),var(--accent)_48%,var(--cold))]" />
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <p className="text-sm font-semibold text-cold">Physics · thermodynamics{edited && <span className="ml-2 text-entropy">Edited draft</span>}</p>
                <h2 className="mt-3 max-w-2xl font-display text-4xl font-semibold leading-[1] tracking-[-0.035em] sm:text-5xl">{lesson.metadata.title}</h2>
                <p className="mt-4 max-w-xl text-base text-ink-dim">{lesson.metadata.subtitle}</p>
              </div>
              <div className="grid min-w-20 place-items-center rounded-2xl border border-line-strong bg-surface-2 px-4 py-3"><strong className="font-display text-4xl leading-none">{lesson.metadata.durationMinutes}</strong><span className="mt-1 text-xs text-ink-dim">minutes</span></div>
            </div>
            <div className="mt-9 grid gap-3 border-y border-line py-5 text-sm text-ink-dim sm:grid-cols-3"><p><span className="font-display text-xl font-semibold text-ink">{lesson.steps.length}</span> teaching sections</p><p><span className="font-display text-xl font-semibold text-ink">{questionCount}</span> live questions</p><p><span className="font-display text-xl font-semibold text-ink">1</span> interactive simulation</p></div>
            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              <Link to="/create-session" className={`${action} bg-accent text-[#201500] hover:brightness-110`}>Start presentation</Link>
              <Link to="/__harness?view=try" className={`${action} border border-cold/50 text-cold hover:bg-cold/10`}>Practice</Link>
              <Link to="/edit" className={`${action} border border-entropy/50 text-entropy hover:bg-entropy/10`}>Edit lesson</Link>
            </div>
          </article>
          <article className="relative overflow-hidden rounded-[1.7rem] border border-hot/40 bg-surface p-6 shadow-[0_26px_75px_rgb(0_0_0_/_0.16)] sm:p-8">
            <div className="absolute inset-y-0 left-0 w-1 bg-hot" />
            <p className="text-sm font-semibold text-hot">Physics · heat &amp; energy</p>
            <h2 className="mt-3 font-display text-4xl font-semibold leading-[1] tracking-[-0.035em]">เปิดตู้เย็นแล้วห้องจะเย็นลงไหม?</h2>
            <p className="mt-4 max-w-xl text-base text-ink-dim">2 สไลด์: ให้ตอบก่อน แล้วเฉลยพร้อมผลรวมของทั้งห้องในหน้าสุดท้าย</p>
            <div className="mt-9 grid gap-3 border-y border-line py-5 text-sm text-ink-dim sm:grid-cols-3"><p><span className="font-display text-xl font-semibold text-ink">2</span> teaching sections</p><p><span className="font-display text-xl font-semibold text-ink">1</span> deferred quiz</p><p><span className="font-display text-xl font-semibold text-ink">1</span> answer review</p></div>
            <div className="mt-9 grid gap-3 sm:grid-cols-3">
              <Link to="/create-session?lesson=fridge-room" className={`${action} bg-hot text-[#2b0a00] hover:brightness-110`}>Start presentation</Link>
              <Link to="/__harness?view=try&lesson=fridge-room" className={`${action} border border-cold/50 text-cold hover:bg-cold/10`}>Practice</Link>
              <Link to="/edit?lesson=fridge-room" className={`${action} border border-entropy/50 text-entropy hover:bg-entropy/10`}>Edit lesson</Link>
            </div>
          </article>
          </div>
        </section>
      </div>
    </main>
  )
}
