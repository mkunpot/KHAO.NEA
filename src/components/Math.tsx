import katex from 'katex'
import 'katex/dist/katex.min.css'
import { Fragment, useMemo } from 'react'

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
