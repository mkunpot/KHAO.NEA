/**
 * /edit — the lesson editor. A teacher changes the words of the lesson without touching code:
 * pick a part on the left, edit its fields in the middle, and see on the right exactly what the
 * projector and the phones will show. The edited lesson is a draft in this browser; creating a
 * session copies it into the class.
 *
 * Stage 1 edits wording only (the slides, their pieces and the reveal order are fixed).
 */

import '@fontsource-variable/fraunces'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { fridgeRoomLesson, secondLawLesson } from '../lesson'
import type { LessonDefinition } from '../lesson/types'
import { hasErrors, validateLesson, type LessonProblem } from '../lesson/validate'
import { LessonInfoForm, StepForm, SummaryForm } from './forms'
import { Preview } from './Preview'
import { useLessonDraft } from './useLessonDraft'
import { useSlideFit } from './useSlideFit'

type Selection = { kind: 'info' } | { kind: 'step'; index: number } | { kind: 'summary' }

function selectionFromUrl(): Selection {
  const step = Number(new URLSearchParams(window.location.search).get('step'))
  return Number.isInteger(step) && step > 0 ? { kind: 'step', index: step - 1 } : { kind: 'step', index: 0 }
}

const differs = (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b)

function stepChanged(lesson: LessonDefinition, base: LessonDefinition, index: number): boolean {
  const step = lesson.steps[index]
  if (!step) return false
  if (differs(step, base.steps.find((candidate) => candidate.id === step.id))) return true
  const asked = step.blocks.find((block) => block.type === 'question')
  return asked?.type === 'question' ? differs(lesson.questions[asked.questionId], base.questions[asked.questionId]) : false
}

const infoChanged = (lesson: LessonDefinition, base: LessonDefinition) =>
  differs([lesson.metadata, lesson.objectives, lesson.simulations], [base.metadata, base.objectives, base.simulations])

/** The slide that shows the summary (so the preview has something to show while the summary is edited). */
function summaryStepIndex(lesson: LessonDefinition): number {
  const index = lesson.steps.findIndex((step) => step.blocks.some((block) => block.type === 'summary'))
  return index >= 0 ? index : Math.max(0, lesson.steps.length - 1)
}

/** Which part of the editor a problem belongs to. */
function selectionFor(lesson: LessonDefinition, path: string): Selection {
  const step = /^steps\[(\d+)\]/.exec(path)
  if (step) return { kind: 'step', index: Number(step[1]) }
  const question = /^questions\.([^.]+)/.exec(path)
  if (question) {
    const index = lesson.steps.findIndex((s) => s.blocks.some((b) => b.type === 'question' && b.questionId === question[1]))
    if (index >= 0) return { kind: 'step', index }
  }
  return path.startsWith('summary') ? { kind: 'summary' } : { kind: 'info' }
}

export default function EditPage() {
  const base = new URLSearchParams(window.location.search).get('lesson') === fridgeRoomLesson.id ? fridgeRoomLesson : secondLawLesson
  const { lesson, edited, update, reset, saveNow, pending, savedAt } = useLessonDraft(base)
  const [selection, setSelection] = useState<Selection>(selectionFromUrl)
  const problems = useMemo(() => validateLesson(lesson), [lesson])
  const broken = hasErrors(problems)

  // The projector slide is always 16:9, so longer wording cannot make it grow: what does not fit is cut off.
  // That is found by laying the slides out (see useSlideFit), so it joins the checks as one more warning.
  const { fit, probe } = useSlideFit(lesson)
  const checks = useMemo<LessonProblem[]>(() => {
    const tooFull = broken
      ? []
      : [...fit].map(([index, overflow]): LessonProblem => ({
          severity: 'warning',
          path: `steps[${index}]`,
          message: `Slide ${index + 1} is too full: ${overflow.kind === 'cut-off' ? 'some text is cut off on the projector' : 'the text squeezes the simulation too small'}`,
        }))
    return [...problems, ...tooFull]
  }, [problems, fit, broken])

  const stepIndex = selection.kind === 'step' ? Math.min(selection.index, lesson.steps.length - 1) : selection.kind === 'summary' ? summaryStepIndex(lesson) : 0
  const form = { lesson, base, update, problems }

  /** Slides that have something wrong in them — marked in the list so the teacher can find them. */
  const flaggedSteps = useMemo(() => {
    const flagged = new Set<number>()
    for (const problem of checks) {
      const where = selectionFor(lesson, problem.path)
      if (where.kind === 'step') flagged.add(where.index)
    }
    return flagged
  }, [checks, lesson])

  function resetAll() {
    if (window.confirm('Throw away all your changes and go back to the original lesson?')) reset()
  }

  // Everyone presses Ctrl/⌘ + S out of habit; here it saves the draft at once instead of "saving the web page".
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        saveNow()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [saveNow])

  const saveStatus = !edited
    ? 'Original lesson'
    : pending
      ? '✎ Edited · saving…'
      : `✎ Edited · ✓ saved${savedAt ? ` ${savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : ''}`

  return (
    <div className="bg-instrument grain relative min-h-dvh pb-20">
      <div className="relative z-10 mx-auto max-w-[1600px] px-5 pt-6">
        <header className="editor-header flex flex-wrap items-end justify-between gap-5">
          <div>
            <Link to="/lessons" className="inline-flex items-center rounded-lg border border-line-strong px-3 py-1.5 text-xs font-semibold text-ink-dim transition hover:bg-surface-2 hover:text-ink">
              ← Lessons
            </Link>
            <p className="mono-label mt-6 text-accent">Lesson editor</p>
            <h1 className="mt-1 font-display text-4xl font-semibold leading-tight">Edit the lesson</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-dim">
              Change the words below. The preview shows what the projector and the phones will display. Changes are saved automatically on this computer as you type — the Save button (or Ctrl/⌘ + S) just does it right now — and are copied into every class you create from here.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`rounded-full border px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.12em] ${edited ? 'border-accent/60 bg-accent/10 text-accent' : 'border-line-strong text-ink-dim'}`}
              role="status"
              title={edited ? 'Saved automatically in this browser, on this computer. Another browser or computer starts from the original lesson.' : undefined}
            >
              {saveStatus}
            </span>
            {edited && (
              <button type="button" onClick={saveNow} className={ghost} title="Changes are saved automatically; this saves right now (Ctrl/⌘ + S)">
                Save
              </button>
            )}
            {edited && (
              <button type="button" onClick={resetAll} className={ghost}>
                Reset all changes
              </button>
            )}
            {import.meta.env.DEV && (
              <a href="/__harness?view=try" target="_blank" rel="noopener" className={ghost}>
                Practice room ↗
              </a>
            )}
            <Link to="/create-session" className="rounded-xl bg-accent px-5 py-3 font-mono text-xs font-bold uppercase tracking-[0.12em] text-[#1a1200] transition hover:brightness-110 active:scale-[0.97]">
              Create a session →
            </Link>
          </div>
        </header>

        <div className="editor-workspace mt-8 grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)_minmax(0,1.2fr)]">
          <nav aria-label="Parts of the lesson" className="editor-nav xl:sticky xl:top-5 xl:self-start">
            <ul className="flex flex-wrap gap-2 xl:flex-col xl:gap-1.5">
              <NavItem active={selection.kind === 'info'} changed={infoChanged(lesson, base)} onClick={() => setSelection({ kind: 'info' })}>
                Lesson info
              </NavItem>
              <li className="mono-label hidden px-3 pb-1 pt-4 xl:block">Slides</li>
              {lesson.steps.map((step, index) => (
                <NavItem
                  key={step.id}
                  number={index + 1}
                  active={selection.kind === 'step' && selection.index === index}
                  changed={stepChanged(lesson, base, index)}
                  flagged={flaggedSteps.has(index)}
                  onClick={() => setSelection({ kind: 'step', index })}
                >
                  {step.title.trim() || '(untitled)'}
                </NavItem>
              ))}
              <NavItem active={selection.kind === 'summary'} changed={differs(lesson.summary, base.summary)} onClick={() => setSelection({ kind: 'summary' })}>
                Summary
              </NavItem>
            </ul>
            <Checks problems={checks} onJump={(path) => setSelection(selectionFor(lesson, path))} />
          </nav>

          <main className="editor-form min-w-0 xl:order-none">
            {broken && (
              <p className="mb-5 rounded-2xl border border-bad/50 bg-bad/10 px-5 py-4 text-sm text-bad" role="alert">
                This lesson has a problem that has to be fixed before it can be used in a class (see Checks). Use “Reset all changes” to go back to the original.
              </p>
            )}
            {selection.kind === 'info' && <LessonInfoForm {...form} />}
            {selection.kind === 'step' && <StepForm key={stepIndex} {...form} stepIndex={stepIndex} onJumpToSummary={() => setSelection({ kind: 'summary' })} />}
            {selection.kind === 'summary' && <SummaryForm {...form} />}
          </main>

          {/* Pinned beside the form; when it is taller than the window it scrolls by itself instead of hanging off the bottom. */}
          <aside className="editor-preview min-w-0 xl:sticky xl:top-5 xl:max-h-[calc(100dvh-2.5rem)] xl:self-start xl:overflow-y-auto xl:overscroll-contain">
            {!broken && <Preview key={stepIndex} lesson={lesson} stepIndex={stepIndex} tooFull={fit.get(stepIndex)} />}
          </aside>
        </div>
      </div>
      {!broken && probe}
    </div>
  )
}

const ghost =
  'rounded-xl border border-line-strong px-5 py-3 font-mono text-xs font-bold uppercase tracking-[0.12em] text-ink transition hover:bg-surface-2 active:scale-[0.97]'

function NavItem({
  number,
  active,
  changed,
  flagged,
  onClick,
  children,
}: {
  number?: number
  active: boolean
  changed: boolean
  flagged?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? 'page' : undefined}
        className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition ${active ? 'border-accent bg-accent/10 text-ink' : 'border-transparent text-ink-dim hover:bg-surface-2 hover:text-ink'}`}
      >
        {number !== undefined && <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-surface-3 font-mono text-[11px] font-bold text-ink-dim">{number}</span>}
        <span className="min-w-0 flex-1 truncate">{children}</span>
        {flagged && <span className="text-accent" title="Something on this slide needs a look" aria-label="needs a look">⚠</span>}
        {changed && <span className="h-2 w-2 shrink-0 rounded-full bg-accent" title="Changed from the original" aria-label="changed" />}
      </button>
    </li>
  )
}

function Checks({ problems, onJump }: { problems: LessonProblem[]; onJump: (path: string) => void }) {
  return (
    <section className="panel mt-5 p-4" aria-label="Checks">
      <p className="mono-label">Checks</p>
      {problems.length === 0 ? (
        <p className="mt-2 text-sm text-good">✓ Nothing is empty or broken.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {problems.slice(0, 6).map((problem, index) => (
            <li key={index}>
              <button type="button" onClick={() => onJump(problem.path)} className={`text-left text-sm hover:underline ${problem.severity === 'error' ? 'text-bad' : 'text-accent'}`}>
                {problem.severity === 'error' ? '✗' : '⚠'} {problem.message}
              </button>
            </li>
          ))}
          {problems.length > 6 && <li className="text-xs text-ink-faint">…and {problems.length - 6} more</li>}
        </ul>
      )}
    </section>
  )
}
