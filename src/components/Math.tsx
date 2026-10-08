import katex from 'katex'
import 'katex/dist/katex.min.css'
import { Fragment, useMemo, type ReactNode } from 'react'

function render(latex: string, displayMode: boolean): string {
  // The lesson is trusted, bundled content, but keep KaTeX's defaults (no \href / trust) anyway.
  return katex.renderToString(latex, { displayMode, throwOnError: false, strict: 'ignore' })
}

export function InlineMath({ latex }: { latex: string }) {
  const html = useMemo(() => render(latex, false), [latex])
  return <span dangerouslySetInnerHTML={{ __html: html }} />
}

export function BlockMath({ latex, className = '', align = 'center' }: { latex: string; className?: string; align?: 'left' | 'center' }) {
  const html = useMemo(() => render(latex, true), [latex])
  return <div className={`math-block ${align === 'left' ? 'math-left' : ''} ${className}`} dangerouslySetInnerHTML={{ __html: html }} />
}

/** Text with inline math between $...$ (an unbalanced $ is treated as plain text). */
export function RichText({ text }: { text: string }) {
  const parts = text.split('$')
  if (parts.length % 2 === 0) return <>{text}</>
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? <InlineMath key={index} latex={part} /> : <Fragment key={index}>{part}</Fragment>,
      )}
    </>
  )
}

/** Rich text with literal highlighted words (or whole `$…$` inline equations). */
export function HighlightedRichText({ text, highlights = [] }: { text: string; highlights?: string[] }) {
  const terms = highlights.filter(Boolean).sort((a, b) => b.length - a.length)
  const mark = (content: ReactNode, key: string | number) => (
    <mark key={key} className="rounded bg-accent/25 px-[0.12em] text-inherit">{content}</mark>
  )
  const plain = (content: string, key: number) => {
    if (terms.length === 0) return <Fragment key={key}>{content}</Fragment>
    const pattern = new RegExp(`(${terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g')
    return (
      <Fragment key={key}>
        {content.split(pattern).map((part, index) => (terms.includes(part) ? mark(part, index) : <Fragment key={index}>{part}</Fragment>))}
      </Fragment>
    )
  }
  const parts = text.split('$')
  if (parts.length % 2 === 0) return plain(text, 0)
  return <>{parts.map((part, index) => index % 2 === 1 ? (terms.includes(`$${part}$`) ? mark(<InlineMath latex={part} />, index) : <InlineMath key={index} latex={part} />) : plain(part, index))}</>
}
