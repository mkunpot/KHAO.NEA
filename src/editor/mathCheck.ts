/**
 * Does the math in a field parse? (The lesson text may contain $inline math$; equations are plain LaTeX.)
 * Kept apart from lesson/validate.ts so that file stays free of KaTeX and phones never load this one.
 */

import katex from 'katex'

/** null when the LaTeX is fine, otherwise KaTeX's own words for what is wrong. */
export function latexProblem(latex: string): string | null {
  if (latex.trim() === '') return null
  try {
    katex.renderToString(latex, { throwOnError: true, strict: 'ignore' })
    return null
  } catch (error) {
    const message = error instanceof Error ? error.message : 'This formula cannot be shown'
    return message.replace(/^KaTeX parse error:\s*/, '')
  }
}

/** Ordinary text with $inline math$. An odd number of $ signs makes the whole line plain text, which is rarely what was meant. */
export function richTextProblem(text: string): string | null {
  const parts = text.split('$')
  if (parts.length % 2 === 0) return 'There is a $ without its partner, so the formulas will show as plain text'
  for (let index = 1; index < parts.length; index += 2) {
    const problem = latexProblem(parts[index]!)
    if (problem) return problem
  }
  return null
}
