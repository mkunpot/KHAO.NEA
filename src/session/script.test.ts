import { describe, expect, it } from 'vitest'
import { secondLawLesson as lesson } from '../lesson'
import { positionCount } from '../lesson/cursor'
import { autoFinishReason } from './autoFinish'
import { planAfter, planNext, type Beat, type ScriptSettings } from './script'
import { initialSessionState, reduceSession } from './sessionReducer'
import type { SessionState } from './sessionTypes'

const settings: ScriptSettings = { timerS: 30, finishWhenAllAnswered: true }

/** Press the one big button until the lesson is over, applying each command like the real class would. */
function playThrough(options: ScriptSettings = settings) {
  let state: SessionState = initialSessionState(lesson)
  const beats: Beat[] = []
  const states: SessionState[] = [state]
  for (let press = 0; press < 80; press++) {
    const beat = planNext(state, lesson, options)
    if (beat.disabled) break
    beats.push(beat)
    state = beat.events(1_700_000_000_000 + press).reduce((s, event) => reduceSession(s, event, lesson), state)
    states.push(state)
  }
  return { beats, state, states }
}

describe('the guided flow: one button for the whole lesson', () => {
  it('walks the entire lesson with nothing but the big button, and ends', () => {
    const { beats, state } = playThrough()
    expect(beats.length).toBeLessThan(80)
    expect(state.started).toBe(true)
    expect(state.currentStep).toBe(positionCount(lesson) - 1)
    expect(state.answerRevealed).toBe(true) // the exit question was answered
  })

  it('reads as a script: what the teacher is about to do, in order', () => {
    const { beats } = playThrough()
    expect(beats.map((b) => b.label)).toEqual([
      'Start lesson',
      // 1 Prediction
      'Open voting', 'Show results', 'Next: Run the simulation',
      // 2 Run the simulation — connect, show T_f, then the question about the First Law
      'Connect the bodies', 'Reveal next', 'Open voting', 'Show results', 'Next: Entropy decides the direction',
      // 3 Entropy — four reveals
      'Reveal next', 'Reveal next', 'Reveal next', 'Reveal next', 'Next: The reverse direction',
      // 4 Reverse — run it, vote, then the refrigerators line
      'Try the reverse', 'Open voting', 'Show results', 'Reveal next', 'Next: Irreversibility',
      // 5 Irreversibility
      'Open voting', 'Show results', 'Reveal next', 'Next: Connection to heat engines',
      // 6 Heat engines
      'Reveal next', 'Next: Exit question',
      // 7 Exit
      'Open voting', 'Show results', 'Reveal next',
    ])
  })

  it('opens and finishes every question exactly once', () => {
    const { beats } = playThrough()
    const questions = Object.keys(lesson.questions).length
    expect(beats.filter((b) => b.kind === 'open-question')).toHaveLength(questions)
    expect(beats.filter((b) => b.kind === 'finish-question')).toHaveLength(questions)
  })

  it('runs the simulation before the question that depends on it', () => {
    const { beats } = playThrough()
    const kinds = beats.map((b) => b.kind)
    const simulations = kinds.flatMap((k, i) => (k === 'simulate' ? [i] : []))
    expect(simulations).toHaveLength(2) // CONNECT in step 2, TRY REVERSE in step 4
    for (const at of simulations) expect(kinds.indexOf('open-question', at)).toBeGreaterThan(at)
  })

  it('shows T_f on the slide before asking about the First Law, but votes first on the other questions', () => {
    const { states } = playThrough()
    const firstLawOpened = states.find((s) => s.activeQuestionId === 'first-law' && s.questionOpen)!
    const reverseOpened = states.find((s) => s.activeQuestionId === 'reverse-requirement' && s.questionOpen)!
    expect(firstLawOpened.currentStep).toBe(2) // position 2 = simulation step, reveal 1 (T_f is on screen)
    expect(reverseOpened.currentStep).toBe(8) // position 8 = reverse step, reveal 0
  })

  it('hands every question the countdown from the settings', () => {
    const open = planNext({ ...initialSessionState(lesson), started: true }, lesson, { ...settings, timerS: 45 })
    expect(open.kind).toBe('open-question')
    expect(open.events(0)).toEqual([{ type: 'OPEN_QUESTION', questionId: 'prediction', timerS: 45 }])
    expect(open.hint).toContain('45 s')
    expect(planNext({ ...initialSessionState(lesson), started: true }, lesson, { ...settings, timerS: 0 }).hint).toMatch(/no time limit/i)
  })

  it('stamps the simulation start with the moment of the press, not of the render', () => {
    let state = { ...initialSessionState(lesson), started: true }
    for (const kind of ['open-question', 'finish-question', 'next-step']) {
      const beat = planNext(state, lesson, settings)
      expect(beat.kind).toBe(kind)
      state = beat.events(0).reduce((s, e) => reduceSession(s, e, lesson), state)
    }
    const connect = planNext(state, lesson, settings)
    expect(connect.kind).toBe('simulate')
    expect(connect.events(111)[0]).toMatchObject({ type: 'START_SIMULATION', mode: 'forward', startedAt: 111 })
    expect(connect.events(222)[0]).toMatchObject({ startedAt: 222 })
  })

  it('says what comes after, so the teacher can see the next press coming', () => {
    const lobby = initialSessionState(lesson)
    const start = planNext(lobby, lesson, settings)
    expect(planAfter(lobby, start, lesson, settings, 0).label).toBe('Open voting')

    const voting = reduceSession({ ...lobby, started: true }, { type: 'OPEN_QUESTION', questionId: 'prediction', timerS: 30 }, lesson)
    const show = planNext(voting, lesson, settings)
    expect(show.label).toBe('Show results')
    expect(planAfter(voting, show, lesson, settings, 0).label).toBe('Next: Run the simulation')
  })

  it('describes what a reveal will put on the slide', () => {
    const state = { ...initialSessionState(lesson), started: true, currentStep: 3 } // entropy, before the first reveal
    expect(planNext(state, lesson, settings)).toMatchObject({ kind: 'reveal' })
    expect(planNext(state, lesson, settings).hint).toContain('ΔS_hot')
  })

  it('works without a countdown and without auto-finish too', () => {
    const { beats, state } = playThrough({ timerS: 0, finishWhenAllAnswered: false })
    expect(beats.length).toBe(playThrough().beats.length)
    expect(state.currentStep).toBe(positionCount(lesson) - 1)
    expect(beats.find((b) => b.kind === 'finish-question')?.hint).toMatch(/close voting/i)
  })

  it('a question the teacher closed by hand is finished by the same button', () => {
    let state = reduceSession({ ...initialSessionState(lesson), started: true }, { type: 'OPEN_QUESTION', questionId: 'prediction' }, lesson)
    state = reduceSession(state, { type: 'CLOSE_QUESTION', questionId: 'prediction' }, lesson)
    const beat = planNext(state, lesson, settings)
    expect(beat.kind).toBe('finish-question')
    expect(beat.hint).toMatch(/^Show the results/) // voting is already closed: no "closes by itself" promise
    const done = beat.events(0).reduce((s, e) => reduceSession(s, e, lesson), state)
    expect(done).toMatchObject({ resultsVisible: true, answerRevealed: true })
  })
})

describe('when voting closes by itself', () => {
  const base = { open: true, timerS: 30, elapsedS: 5, answered: 3, joined: 10, finishWhenAllAnswered: true }

  it('keeps going while there is time and someone has not answered', () => {
    expect(autoFinishReason(base)).toBeNull()
  })

  it('closes when time is up', () => {
    expect(autoFinishReason({ ...base, elapsedS: 30 })).toBe('time')
    expect(autoFinishReason({ ...base, elapsedS: 41 })).toBe('time')
  })

  it('closes when everyone who joined has answered', () => {
    expect(autoFinishReason({ ...base, answered: 10 })).toBe('everyone')
    expect(autoFinishReason({ ...base, answered: 11 })).toBe('everyone')
  })

  it('respects the teacher turning "when everyone has answered" off', () => {
    expect(autoFinishReason({ ...base, answered: 10, finishWhenAllAnswered: false })).toBeNull()
  })

  it('an untimed question never times out', () => {
    expect(autoFinishReason({ ...base, timerS: 0, elapsedS: 9999 })).toBeNull()
  })

  it('never fires for an empty room (0 joined is not "everyone")', () => {
    expect(autoFinishReason({ ...base, joined: 0, answered: 0 })).toBeNull()
  })

  it('never fires when voting is not open', () => {
    expect(autoFinishReason({ ...base, open: false, elapsedS: 999, answered: 10 })).toBeNull()
  })
})
