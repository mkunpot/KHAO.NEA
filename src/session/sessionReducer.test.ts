import { describe, expect, it } from 'vitest'
import { cursorPositions, firstPositionOfStep, positionCount, totalMinutes } from '../lesson/cursor'
import { secondLawLesson as lesson } from '../lesson'
import type { SessionState } from './sessionTypes'
import { initialSessionState, reduceSession } from './sessionReducer'

/** First cursor position of a lesson step (optionally a later reveal stage). */
function cursorOf(stepId: string, reveal = 0): number {
  const index = cursorPositions(lesson).findIndex(
    (p) => lesson.steps[p.stepIndex]?.id === stepId && p.reveal === reveal,
  )
  if (index < 0) throw new Error(`no position for ${stepId}/${reveal}`)
  return index
}

const started = (): SessionState => ({ ...initialSessionState(lesson), started: true })
const at = (stepId: string, reveal = 0): SessionState => ({ ...started(), currentStep: cursorOf(stepId, reveal) })

describe('the canonical lesson as a cursor', () => {
  it('plans exactly 15 minutes', () => {
    expect(totalMinutes(lesson)).toBe(15)
    expect(lesson.metadata.durationMinutes).toBe(15)
  })

  it('flattens steps and reveal stages into 16 positions', () => {
    expect(positionCount(lesson)).toBe(16)
  })
})

describe('navigation', () => {
  it('NEXT_STEP and PREVIOUS_STEP move the cursor and stop at the ends', () => {
    const start = started()
    expect(start.currentStep).toBe(0)
    expect(reduceSession(start, { type: 'PREVIOUS_STEP' }, lesson)).toBe(start)

    const second = reduceSession(start, { type: 'NEXT_STEP' }, lesson)
    expect(second.currentStep).toBe(1)

    const last = { ...start, currentStep: positionCount(lesson) - 1 }
    expect(reduceSession(last, { type: 'NEXT_STEP' }, lesson)).toBe(last)
  })

  it('moving to another step closes the question and hides results and the answer', () => {
    let state = at('prediction')
    state = reduceSession(state, { type: 'OPEN_QUESTION', questionId: 'prediction' }, lesson)
    state = reduceSession(state, { type: 'SHOW_RESULTS', questionId: 'prediction' }, lesson)
    state = reduceSession(state, { type: 'REVEAL_ANSWER', questionId: 'prediction' }, lesson)
    expect(state.resultsVisible && state.answerRevealed).toBe(true)

    const next = reduceSession(state, { type: 'NEXT_STEP' }, lesson)
    expect(next.questionOpen).toBe(false)
    expect(next.activeQuestionId).toBeNull()
    expect(next.resultsVisible).toBe(false)
    expect(next.answerRevealed).toBe(false)
  })

  it('moving to a later reveal stage of the same step keeps the question state', () => {
    let state = at('reverse')
    state = reduceSession(state, { type: 'OPEN_QUESTION', questionId: 'reverse-requirement' }, lesson)
    state = reduceSession(state, { type: 'SHOW_RESULTS', questionId: 'reverse-requirement' }, lesson)
    const revealed = reduceSession(state, { type: 'NEXT_STEP' }, lesson)
    expect(revealed.currentStep).toBe(cursorOf('reverse', 1))
    expect(revealed.activeQuestionId).toBe('reverse-requirement')
    expect(revealed.resultsVisible).toBe(true)
  })
})

describe('question flow', () => {
  it('OPEN_QUESTION opens the current step’s question only', () => {
    const state = at('prediction')
    expect(reduceSession(state, { type: 'OPEN_QUESTION', questionId: 'exit' }, lesson)).toBe(state)

    const opened = reduceSession(state, { type: 'OPEN_QUESTION', questionId: 'prediction' }, lesson)
    expect(opened.questionOpen).toBe(true)
    expect(opened.activeQuestionId).toBe('prediction')
    expect(opened.resultsVisible).toBe(false)
  })

  it('does nothing on a step that has no question', () => {
    const state = at('entropy')
    expect(reduceSession(state, { type: 'OPEN_QUESTION', questionId: 'prediction' }, lesson)).toBe(state)
  })

  it('CLOSE_QUESTION, SHOW_RESULTS and REVEAL_ANSWER only affect the active question', () => {
    const opened = reduceSession(at('prediction'), { type: 'OPEN_QUESTION', questionId: 'prediction' }, lesson)
    expect(reduceSession(opened, { type: 'CLOSE_QUESTION', questionId: 'exit' }, lesson)).toBe(opened)
    expect(reduceSession(opened, { type: 'SHOW_RESULTS', questionId: 'exit' }, lesson)).toBe(opened)

    const closed = reduceSession(opened, { type: 'CLOSE_QUESTION', questionId: 'prediction' }, lesson)
    expect(closed.questionOpen).toBe(false)
    expect(closed.activeQuestionId).toBe('prediction')

    const shown = reduceSession(closed, { type: 'SHOW_RESULTS', questionId: 'prediction' }, lesson)
    expect(shown.resultsVisible).toBe(true)
  })

  it('REVEAL_ANSWER ends voting', () => {
    const opened = reduceSession(at('prediction'), { type: 'OPEN_QUESTION', questionId: 'prediction' }, lesson)
    const revealed = reduceSession(opened, { type: 'REVEAL_ANSWER', questionId: 'prediction' }, lesson)
    expect(revealed.answerRevealed).toBe(true)
    expect(revealed.questionOpen).toBe(false)
  })

  it('re-opening a question clears its previous results and answer', () => {
    let state = reduceSession(at('prediction'), { type: 'OPEN_QUESTION', questionId: 'prediction' }, lesson)
    state = reduceSession(state, { type: 'REVEAL_ANSWER', questionId: 'prediction' }, lesson)
    state = reduceSession(state, { type: 'SHOW_RESULTS', questionId: 'prediction' }, lesson)
    const again = reduceSession(state, { type: 'OPEN_QUESTION', questionId: 'prediction' }, lesson)
    expect(again.questionOpen).toBe(true)
    expect(again.resultsVisible).toBe(false)
    expect(again.answerRevealed).toBe(false)
  })
})

describe('simulation commands', () => {
  const params = { hotK: 400, coldK: 300, heatCapacityJPerK: 1000, timeConstantS: 2 }

  it('START_SIMULATION shares the semantic start, never animation frames', () => {
    const state = reduceSession(
      at('simulation'),
      { type: 'START_SIMULATION', simulationId: 'thermal-contact', mode: 'forward', startedAt: 1234, params },
      lesson,
    )
    expect(state.sim).toEqual({ mode: 'forward', runId: 1234, params })
  })

  it('RESET_SIMULATION returns to idle', () => {
    const running = reduceSession(
      at('simulation'),
      { type: 'START_SIMULATION', simulationId: 'thermal-contact', mode: 'forward', startedAt: 1, params },
      lesson,
    )
    expect(reduceSession(running, { type: 'RESET_SIMULATION', simulationId: 'thermal-contact' }, lesson).sim.mode).toBe('idle')
  })

  it('entering a step with the live simulation starts it un-connected', () => {
    const running = reduceSession(
      at('simulation'),
      { type: 'START_SIMULATION', simulationId: 'thermal-contact', mode: 'forward', startedAt: 1, params },
      lesson,
    )
    // simulation → entropy (static): keeps the finished run; entropy → reverse (live): clean slate.
    const entropy = { ...running, currentStep: cursorOf('entropy', 4) }
    const reverse = reduceSession(entropy, { type: 'NEXT_STEP' }, lesson)
    expect(lesson.steps[cursorOfStep(reverse.currentStep)]?.id).toBe('reverse')
    expect(reverse.sim.mode).toBe('idle')
  })

  it('leaves the simulation alone when entering a static step', () => {
    const running = reduceSession(
      at('simulation', 1),
      { type: 'START_SIMULATION', simulationId: 'thermal-contact', mode: 'forward', startedAt: 7, params },
      lesson,
    )
    const entropy = reduceSession(running, { type: 'NEXT_STEP' }, lesson)
    expect(entropy.sim.mode).toBe('forward')
    expect(entropy.sim.runId).toBe(7)
  })
})

describe('the lobby', () => {
  it('starts un-started: nothing but START_LESSON does anything', () => {
    const lobby = initialSessionState(lesson)
    expect(lobby.started).toBe(false)
    for (const event of [
      { type: 'NEXT_STEP' },
      { type: 'OPEN_QUESTION', questionId: 'prediction' },
      { type: 'FINISH_QUESTION', questionId: 'prediction' },
      { type: 'GO_TO_STEP', stepIndex: 3 },
    ] as const) {
      expect(reduceSession(lobby, event, lesson)).toBe(lobby)
    }
  })

  it('START_LESSON leaves the lobby and stays on the first slide', () => {
    const next = reduceSession(initialSessionState(lesson), { type: 'START_LESSON' }, lesson)
    expect(next.started).toBe(true)
    expect(next.currentStep).toBe(0)
  })

  it('START_LESSON again is harmless', () => {
    const running = at('entropy', 2)
    expect(reduceSession(running, { type: 'START_LESSON' }, lesson)).toBe(running)
  })
})

describe('jumping to a step', () => {
  it('GO_TO_STEP lands on the first position of that step', () => {
    const jumped = reduceSession(at('prediction'), { type: 'GO_TO_STEP', stepIndex: 2 }, lesson)
    expect(jumped.currentStep).toBe(firstPositionOfStep(lesson, 2))
    expect(jumped.currentStep).toBe(cursorOf('entropy', 0))
  })

  it('ignores steps that do not exist', () => {
    const state = at('simulation')
    for (const stepIndex of [-1, 99, 1.5]) expect(reduceSession(state, { type: 'GO_TO_STEP', stepIndex }, lesson)).toBe(state)
  })

  it('drops the question and its timer, like any change of step', () => {
    let state = reduceSession(at('prediction'), { type: 'OPEN_QUESTION', questionId: 'prediction', timerS: 30 }, lesson)
    state = reduceSession(state, { type: 'GO_TO_STEP', stepIndex: 1 }, lesson)
    expect(state.questionOpen).toBe(false)
    expect(state.questionTimerS).toBe(0)
    expect(state.activeQuestionId).toBeNull()
  })
})

describe('timed questions', () => {
  it('OPEN_QUESTION stores the countdown, clamped to something sane', () => {
    const open = (timerS?: number) =>
      reduceSession(at('prediction'), { type: 'OPEN_QUESTION', questionId: 'prediction', timerS }, lesson).questionTimerS
    expect(open(30)).toBe(30)
    expect(open(undefined)).toBe(0)
    expect(open(-5)).toBe(0)
    expect(open(99_999)).toBe(600)
    expect(open(12.6)).toBe(13)
  })

  it('FINISH_QUESTION closes voting, shows the results and reveals the answer in one change', () => {
    const open = reduceSession(at('prediction'), { type: 'OPEN_QUESTION', questionId: 'prediction', timerS: 30 }, lesson)
    const done = reduceSession(open, { type: 'FINISH_QUESTION', questionId: 'prediction' }, lesson)
    expect(done).toMatchObject({ questionOpen: false, resultsVisible: true, answerRevealed: true, activeQuestionId: 'prediction' })
  })

  it('FINISH_QUESTION for some other question does nothing', () => {
    const open = reduceSession(at('prediction'), { type: 'OPEN_QUESTION', questionId: 'prediction' }, lesson)
    expect(reduceSession(open, { type: 'FINISH_QUESTION', questionId: 'exit' }, lesson)).toBe(open)
  })
})

function cursorOfStep(cursor: number): number {
  return cursorPositions(lesson)[cursor]?.stepIndex ?? -1
}
