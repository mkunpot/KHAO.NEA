/**
 * Types for the thermal-contact simulation (two identical finite bodies, constant heat capacity).
 * Plain data only — no React in this file or in model.ts.
 */

export interface ThermalParams {
  /** Initial temperature of the hotter body, in kelvin. */
  hotK: number
  /** Initial temperature of the colder body, in kelvin. */
  coldK: number
  /** Heat capacity C of EACH body, J/K. Identical and constant for both bodies. */
  heatCapacityJPerK: number
  /**
   * Time constant of the animation, in seconds. This is a presentation knob (how fast the demo
   * relaxes toward equilibrium), not part of the thermodynamics.
   */
  timeConstantS: number
}

/** idle = bodies isolated from each other; forward = spontaneous hot → cold; reverse = hypothetical cold → hot. */
export type ThermalMode = 'idle' | 'forward' | 'reverse'

export type SimulationControl = 'connect' | 'reverse' | 'reset'

export type ReadoutKey = 'tHot' | 'tCold' | 'heat' | 'dSHot' | 'dSCold' | 'dSTotal'

export interface BodyTemperatures {
  t1: number
  t2: number
}

/** Everything a view needs to draw the simulation at one instant. Entropy values are relative to the initial state. */
export interface ThermalSnapshot {
  mode: ThermalMode
  tHotK: number
  tColdK: number
  /** Magnitude of the heat moved so far, J. */
  heatJ: number
  direction: 'none' | 'hot-to-cold' | 'cold-to-hot'
  dSHotJPerK: number
  dSColdJPerK: number
  dSTotalJPerK: number
  /** 0..1 — fraction of the final heat transfer completed. */
  progress: number
  /** 0..1 — instantaneous heat-flow rate relative to its initial value (drives the arrow). */
  rateFraction: number
  settled: boolean
}
