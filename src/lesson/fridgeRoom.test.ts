import { describe, expect, it } from 'vitest'
import { fridgeRoomLesson } from './fridgeRoom'
import { isUsableLesson } from './validate'
import { initialSessionState, reduceSession } from '../session/sessionReducer'
import { planNext } from '../session/script'

const settings = { timerS: 30, finishWhenAllAnswered: true }

describe('the fridge-room prediction lesson', () => {
  it('is a usable two-slide lesson', () => {
    expect(isUsableLesson(fridgeRoomLesson)).toBe(true)
    expect(fridgeRoomLesson.steps).toHaveLength(2)
  })

  it('keeps the vote hidden until its review slide', () => {
    let state = { ...initialSessionState(fridgeRoomLesson), started: true }
    expect(planNext(state, fridgeRoomLesson, settings).label).toBe('Open voting')

    state = reduceSession(state, { type: 'OPEN_QUESTION', questionId: 'open-fridge', timerS: 30 }, fridgeRoomLesson)
    expect(planNext(state, fridgeRoomLesson, settings).label).toBe('Close voting')

    state = reduceSession(state, { type: 'CLOSE_QUESTION', questionId: 'open-fridge' }, fridgeRoomLesson)
    state = reduceSession(state, { type: 'NEXT_STEP' }, fridgeRoomLesson)
    expect(state.activeQuestionId).toBe('open-fridge')
    expect(state.answerRevealed).toBe(false)
    expect(planNext(state, fridgeRoomLesson, settings).label).toBe('Reveal answer')

    state = reduceSession(state, { type: 'FINISH_QUESTION', questionId: 'open-fridge' }, fridgeRoomLesson)
    expect(state.answerRevealed).toBe(true)
    expect(state.resultsVisible).toBe(true)
  })
})
