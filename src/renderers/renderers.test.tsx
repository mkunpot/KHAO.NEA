import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { secondLawLesson } from '../lesson'
import type { LessonDefinition } from '../lesson/types'
import { SessionProvider } from '../session/SessionProvider'
import { initialSessionState } from '../session/sessionReducer'
import { createClassroomSession } from '../session/sessionService'
import { MemoryRealtimeAdapter } from '../test/MemoryRealtimeAdapter'
import { PresentationRenderer } from './presentation/PresentationRenderer'
import { percentOf, tallyResponses } from './results'
import { StudentRenderer } from './student/StudentRenderer'
import { StudyRenderer } from './study/StudyRenderer'

/**
 * A tiny lesson whose every string is a unique sentinel. If a renderer shows a sentinel, that
 * text came from the LessonDefinition it was handed — not from the renderer's own source.
 */
const fixture: LessonDefinition = {
  id: 'fixture',
  metadata: {
    title: 'ZXQ Lesson Title',
    subtitle: 'ZXQ subtitle',
    level: 'ZXQ level',
    durationMinutes: 3,
    prerequisites: ['ZXQ prerequisite'],
  },
  objectives: ['ZXQ objective'],
  simulations: {
    'thermal-contact': {
      id: 'thermal-contact',
      kind: 'thermal-contact',
      title: 'ZXQ simulation title',
      params: { hotK: 400, coldK: 300, heatCapacityJPerK: 1000, timeConstantS: 2 },
      assumptions: ['ZXQ assumption'],
    },
  },
  questions: {
    q1: {
      id: 'q1',
      kind: 'concept-check',
      prompt: 'ZXQ question prompt',
      options: [
        { id: 'A', text: 'ZXQ option A' },
        { id: 'B', text: 'ZXQ option B' },
      ],
      correctOptionId: 'A',
      explanation: 'ZXQ question explanation',
    },
  },
  steps: [
    {
      id: 'step-one',
      title: 'ZXQ Step One',
      minutes: 3,
      blocks: [
        { id: 'concept', type: 'concept', text: 'ZXQ concept text' },
        { id: 'explain', type: 'explanation', title: 'ZXQ in depth', paragraphs: ['ZXQ long explanation'] },
        { id: 'sim', type: 'simulation', simulationId: 'thermal-contact', display: 'live', controls: ['connect'], readouts: { tHot: 0, tCold: 0 } },
        { id: 'question', type: 'question', questionId: 'q1' },
      ],
    },
  ],
  summary: { heading: 'ZXQ summary', rows: [{ law: 'ZXQ law', question: 'ZXQ row question' }] },
}

describe('one canonical lesson drives all three rendering states', () => {
  let adapter: MemoryRealtimeAdapter
  let code: string

  beforeEach(async () => {
    window.localStorage.clear()
    adapter = new MemoryRealtimeAdapter()
    const record = await createClassroomSession(adapter, fixture)
    code = record.sessionCode
    // The teacher has opened the question.
    await adapter.publishSessionState(record.id, { ...initialSessionState(fixture), started: true, activeQuestionId: 'q1', questionOpen: true }, 1)
  })

  const inSession = (role: 'presenter' | 'student', child: React.ReactNode) => (
    <MemoryRouter>
      <SessionProvider code={code} role={role} lesson={fixture} adapter={adapter}>
        {child}
      </SessionProvider>
    </MemoryRouter>
  )

  it('PRESENTATION: slides are generated from the definition (and skip the long-form prose)', async () => {
    render(inSession('presenter', <PresentationRenderer />))
    expect(await screen.findByText('ZXQ Step One')).toBeTruthy()
    expect(screen.getByText('ZXQ concept text')).toBeTruthy()
    expect(screen.getByText('ZXQ question prompt')).toBeTruthy()
    expect(screen.getByText('ZXQ option A')).toBeTruthy()
    expect(screen.queryByText('ZXQ long explanation')).toBeNull()
  })

  it('LIVE STUDENT: shows the open question from the definition — and does not mirror the slide', async () => {
    render(inSession('student', <StudentRenderer />))
    expect(await screen.findByText('ZXQ question prompt')).toBeTruthy()
    expect(screen.getByText('ZXQ option A')).toBeTruthy()
    expect(screen.getByText('ZXQ option B')).toBeTruthy()
    expect(screen.queryByText('ZXQ concept text')).toBeNull()
    expect(screen.queryByText('ZXQ Step One', { exact: false })?.textContent ?? '').not.toContain('ZXQ concept text')
  })

  it('SELF-STUDY: renders everything in the definition, with no session at all', () => {
    render(
      <MemoryRouter>
        <StudyRenderer lesson={fixture} />
      </MemoryRouter>,
    )
    for (const text of [
      'ZXQ Lesson Title', 'ZXQ subtitle', 'ZXQ level', 'ZXQ objective', 'ZXQ prerequisite', 'ZXQ Step One',
      'ZXQ concept text', 'ZXQ in depth', 'ZXQ long explanation', 'ZXQ question prompt', 'ZXQ option A', 'ZXQ assumption',
    ]) {
      expect(screen.getAllByText(text, { exact: false }).length, text).toBeGreaterThan(0)
    }
  })
})

describe('the real lesson is the only place lesson text lives', () => {
  const leafStrings = (value: unknown, out: string[] = []): string[] => {
    if (typeof value === 'string') out.push(value)
    else if (Array.isArray(value)) value.forEach((v) => leafStrings(v, out))
    else if (value && typeof value === 'object') Object.values(value).forEach((v) => leafStrings(v, out))
    return out
  }
  // Prose-sized strings only: skip identifiers, short labels and LaTeX.
  const phrases = [...new Set(leafStrings(secondLawLesson))].filter((s) => s.length >= 24 && !s.includes('\\') && !s.startsWith('thermal'))

  const sources = import.meta.glob('/src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
  const isLessonFile = (path: string) => path.endsWith('/lesson/secondLaw.ts')
  const isTestOrDev = (path: string) => /\.test\.tsx?$/.test(path) || path.includes('/dev/')

  it('the lesson file contains the lesson text', () => {
    expect(phrases.length).toBeGreaterThan(20)
    const lessonSource = Object.entries(sources).find(([path]) => isLessonFile(path))?.[1] ?? ''
    expect(phrases.filter((p) => lessonSource.includes(p.slice(0, 24))).length).toBeGreaterThan(20)
  })

  it('no renderer, page or component repeats a sentence from the lesson', () => {
    const offenders: string[] = []
    for (const [path, source] of Object.entries(sources)) {
      if (isLessonFile(path) || isTestOrDev(path)) continue
      for (const phrase of phrases) if (source.includes(phrase)) offenders.push(`${path}: “${phrase.slice(0, 50)}…”`)
    }
    expect(offenders).toEqual([])
  })

  it('every renderer and page gets its lesson from the shared lesson module', () => {
    for (const [path, source] of Object.entries(sources)) {
      if (isTestOrDev(path)) continue
      // Nobody may import the lesson file directly (the barrel '../lesson' is the single entry point)…
      if (!isLessonFile(path) && !path.endsWith('/lesson/index.ts')) expect(source, path).not.toMatch(/lesson\/secondLaw/)
    }
  })
})

describe('anonymous results', () => {
  const question = secondLawLesson.questions['prediction']!
  const response = (participantId: string, answer: string, questionId = 'prediction') => ({
    id: `${participantId}-${questionId}`, sessionId: 's', participantId, questionId, answer, submittedAt: '',
  })

  it('tallies one question, ignoring other questions and unknown answers', () => {
    const tally = tallyResponses(
      [response('a', 'A'), response('b', 'A'), response('c', 'B'), response('d', 'Z'), response('e', 'A', 'exit')],
      question,
    )
    expect(tally.total).toBe(3)
    expect(tally.counts).toEqual({ A: 2, B: 1, C: 0, D: 0 })
  })

  it('percentages never divide by zero', () => {
    expect(percentOf(0, 0)).toBe(0)
    expect(percentOf(1, 3)).toBe(33)
  })
})
