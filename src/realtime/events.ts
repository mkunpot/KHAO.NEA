import type { ThermalParams } from '../simulations/thermal-contact/types'

/**
 * Semantic commands the teacher issues. They describe intent ("start the simulation with these
 * parameters"), never UI details and never animation frames. The session reducer turns an event
 * into the next SessionState, which is what actually gets synchronised.
 */
export type ClassroomEvent =
  /** Leave the lobby: the projector shows the first slide. */
  | { type: 'START_LESSON' }
  | { type: 'NEXT_STEP' }
  | { type: 'PREVIOUS_STEP' }
  /** Jump to the first position of a step (skip ahead, or recover from a misclick). */
  | { type: 'GO_TO_STEP'; stepIndex: number }
  /** Open voting. `timerS` > 0 starts a countdown on every screen. */
  | { type: 'OPEN_QUESTION'; questionId: string; timerS?: number }
  | { type: 'CLOSE_QUESTION'; questionId: string }
  | { type: 'SHOW_RESULTS'; questionId: string }
  | { type: 'REVEAL_ANSWER'; questionId: string }
  /** Close voting, show the results and reveal the answer in one change (what "time's up" does). */
  | { type: 'FINISH_QUESTION'; questionId: string }
  | {
      type: 'START_SIMULATION'
      simulationId: string
      /** CONNECT = forward (spontaneous hot → cold); TRY REVERSE = reverse (hypothetical cold → hot). */
      mode: 'forward' | 'reverse'
      /** Teacher's clock at the click. Used only to identify the run, never to time the animation. */
      startedAt: number
      params: ThermalParams
    }
  | { type: 'RESET_SIMULATION'; simulationId: string }

export type ClassroomEventType = ClassroomEvent['type']
