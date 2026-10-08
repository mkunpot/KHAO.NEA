import { useState } from 'react'

/** Read-only text with a Copy button. (navigator.clipboard needs https; over plain http the text is selected for Ctrl/Cmd+C.) */
export function CopyField({ value, className = '' }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false)

  async function copy(input?: HTMLInputElement | null) {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      input?.select()
    }
  }

  return (
    <div className={`flex gap-2 ${className}`}>
      <input
        readOnly
        value={value}
        onFocus={(e) => e.currentTarget.select()}
        aria-label="Student join link"
        className="min-w-0 flex-1 rounded-xl border border-line bg-surface-2/60 px-3 py-2.5 font-mono text-xs text-ink-dim outline-none focus:border-accent"
      />
      <button
        type="button"
        onClick={(e) => void copy(e.currentTarget.previousElementSibling as HTMLInputElement | null)}
        className="rounded-xl border border-line-strong px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-[0.12em] transition hover:bg-surface-2"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}
