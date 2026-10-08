import { clampCursor, firstPositionOfStep, positionAt, questionBlockOf, questionIdOf, simulationBlockOf, stepAt } from '../lesson/cursor'
import type { LessonDefinition, SimulationSpec } from '../lesson/types'
import type { ClassroomEvent } from '../realtime/events'
import type { SessionState, SimState } from './sessionTypes'

/** The simulation the lesson uses (the first one its steps reference). */
export function primarySimulation(lesson: LessonDefinition): SimulationSpec {
  for (const step of lesson.steps) {
    const block = simulationBlockOf(step)
    const spec = block && lesson.simulations[block.simulationId]
    if (spec) return spec
  }
  const first = Object.values(lesson.simulations)[0]
  if (!first) throw new Error(`Lesson "${lesson.id}" defines no simulation`)
  return first
}

export function initialSessionState(lesson: LessonDefinition): SessionState {
  return {
    started: false,
    currentStep: 0,
    questionOpen: false,
    questionTimerS: 0,
    activeQuestionId: null,
    answerRevealed: false,
    resultsVisible: false,
    sim: { mode: 'idle', runId: 0, params: primarySimulation(lesson).params },
  }
}

export const MAX_QUESTION_TIMER_S = 600

function idle(sim: SimState): SimState {
  return { ...sim, mode: 'idle' }
}

function moveTo(state: SessionState, target: number, lesson: LessonDefinition): SessionState {
  const cursor = clampCursor(lesson, target)
  if (cursor === state.currentStep) return state

  const from = positionAt(lesson, state.currentStep)
  const to = positionAt(lesson, cursor)
  if (from.stepIndex === to.stepIndex) return { ...state, currentStep: cursor }

  // Entering a different step: question flags belong to the step you left. A step that runs the
  // live simulation starts from a clean, un-connected state.
  const leavingQuestion = questionBlockOf(stepAt(lesson, state.currentStep))
  const keepDeferredQuestion =
    leavingQuestion?.answerTiming === 'deferred' && state.activeQuestionId === leavingQuestion.questionId && !state.questionOpen && !state.answerRevealed
  const next: SessionState = {
    ...state,
    currentStep: cursor,
    ...(keepDeferredQuestion
      ? {}
      : { questionOpen: false, questionTimerS: 0, activeQuestionId: null, answerRevealed: false, resultsVisible: false }),
  }
  const entered = simulationBlockOf(stepAt(lesson, cursor))
  return entered?.display === 'live' ? { ...next, sim: idle(state.sim) } : next
}

/** Pure: (state, event) → next state. Events that make no sense in the current state return `state` unchanged. */
export function reduceSession(state: SessionState, event: ClassroomEvent, lesson: LessonDefinition): SessionState {
  // Until the teacher starts the lesson only "start" means anything.
  if (!state.started) return event.type === 'START_LESSON' ? { ...state, started: true } : state

  switch (event.type) {
    case 'START_LESSON':
      return state

    case 'NEXT_STEP':
      return moveTo(state, state.currentStep + 1, lesson)

    case 'PREVIOUS_STEP':
      return moveTo(state, state.currentStep - 1, lesson)

    case 'GO_TO_STEP':
      if (!Number.isInteger(event.stepIndex) || event.stepIndex < 0 || event.stepIndex >= lesson.steps.length) return state
      return moveTo(state, firstPositionOfStep(lesson, event.stepIndex), lesson)

    case 'OPEN_QUESTION': {
      if (questionIdOf(stepAt(lesson, state.currentStep)) !== event.questionId) return state
      const timerS = Math.min(MAX_QUESTION_TIMER_S, Math.max(0, Math.round(event.timerS ?? 0)))
      return {
        ...state,
        questionOpen: true,
        questionTimerS: timerS,
        activeQuestionId: event.questionId,
        answerRevealed: false,
        resultsVisible: false,
      }
    }

    case 'CLOSE_QUESTION':
      return state.activeQuestionId === event.questionId ? { ...state, questionOpen: false } : state

    case 'SHOW_RESULTS':
      return state.activeQuestionId === event.questionId ? { ...state, resultsVisible: true } : state

    case 'REVEAL_ANSWER':
      // Revealing the answer ends voting.
      return state.activeQuestionId === event.questionId
        ? { ...state, answerRevealed: true, questionOpen: false }
        : state

    case 'FINISH_QUESTION':
      return state.activeQuestionId === event.questionId
        ? { ...state, questionOpen: false, resultsVisible: true, answerRevealed: true }
        : state

    case 'START_SIMULATION':
      return { ...state, sim: { mode: event.mode, runId: event.startedAt, params: event.params } }

    case 'RESET_SIMULATION':
      return { ...state, sim: idle(state.sim) }
  }
}

export function sameState(a: SessionState, b: SessionState): boolean {
  return (
    a.started === b.started &&
    a.currentStep === b.currentStep &&
    a.questionOpen === b.questionOpen &&
    a.questionTimerS === b.questionTimerS &&
    a.activeQuestionId === b.activeQuestionId &&
    a.answerRevealed === b.answerRevealed &&
    a.resultsVisible === b.resultsVisible &&
    a.sim.mode === b.sim.mode &&
    a.sim.runId === b.sim.runId
  )
}
