/** The few building blocks the editor's forms are made of. */

import { useId, type ReactNode } from 'react'
import { BlockMath, RichText } from '../components/Math'
import type { LessonProblem } from '../lesson/validate'
import { latexProblem, richTextProblem } from './mathCheck'

type Note = Pick<LessonProblem, 'severity' | 'message'>

const control =
  'mt-1.5 w-full rounded-xl border bg-surface-2/50 px-4 py-2.5 text-[15px] leading-relaxed text-ink outline-none transition placeholder:text-ink-faint focus:bg-surface-2'

export function TextField({
  label,
  value,
  onChange,
  original,
  problems = [],
  hint,
  rows = 1,
  kind = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  /** The built-in wording. When the field differs from it, a dot and a Reset button appear. */
  original?: string
  problems?: LessonProblem[]
  hint?: ReactNode
  /** More than one row makes it a text area. */
  rows?: number
  /** `latex` is a formula, shown as display math; `text` is ordinary text that may contain $inline math$. */
  kind?: 'text' | 'latex'
}) {
  const id = useId()
  const modified = original !== undefined && value !== original
  const mathProblem = kind === 'latex' ? latexProblem(value) : richTextProblem(value)
  const notes: Note[] = [...problems, ...(mathProblem ? [{ severity: 'warning' as const, message: mathProblem }] : [])]
  const border = notes.some((n) => n.severity === 'error') ? 'border-bad' : notes.length > 0 ? 'border-accent/60' : 'border-line-strong focus:border-accent'
  const font = kind === 'latex' ? 'font-mono text-sm' : ''

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="mono-label flex items-center gap-2">
          {label}
          {modified && <span className="h-1.5 w-1.5 rounded-full bg-accent" title="Changed from the original" aria-label="changed" />}
        </label>
        {modified && (
          <button type="button" onClick={() => onChange(original)} className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-dim transition hover:text-ink">
            ↺ Reset
          </button>
        )}
      </div>

      {rows > 1 ? (
        <textarea id={id} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} className={`${control} ${border} ${font} resize-y`} />
      ) : (
        <input id={id} type="text" value={value} onChange={(e) => onChange(e.target.value)} className={`${control} ${border} ${font}`} />
      )}

      {kind === 'latex' && value.trim() !== '' && !mathProblem && (
        <div className="mt-2 overflow-x-auto rounded-xl bg-surface-2/60 px-4 py-1 text-ink">
          <BlockMath latex={value} align="left" />
        </div>
      )}
      {kind === 'text' && value.includes('$') && !mathProblem && (
        <p className="mt-2 rounded-xl bg-surface-2/60 px-4 py-2 text-sm text-ink-dim">
          <RichText text={value} />
        </p>
      )}
      {notes.map((note, index) => (
        <p key={index} className={`mt-1.5 text-xs ${note.severity === 'error' ? 'text-bad' : 'text-accent'}`}>
          {note.severity === 'error' ? '✗' : '⚠'} {note.message}
        </p>
      ))}
      {hint && <p className="mt-1.5 text-xs text-ink-faint">{hint}</p>}
    </div>
  )
}

/** One piece of a slide (or one part of the lesson) in the form. */
export function Card({ title, badge, children }: { title: string; badge?: ReactNode; children: ReactNode }) {
  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-lg font-semibold">{title}</h3>
        {badge && <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-ink-faint">{badge}</span>}
      </div>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  )
}

export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: Array<{ value: T; label: string }>
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex overflow-hidden rounded-xl border border-line-strong">
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.1em] transition ${active ? 'bg-accent text-[#1a1200]' : 'text-ink-dim hover:bg-surface-2 hover:text-ink'}`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
