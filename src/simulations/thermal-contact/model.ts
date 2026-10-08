/**
 * Pure thermodynamics for two identical finite bodies in thermal contact. No React here.
 *
 * Assumptions (also documented in the README):
 *  - Each body has the same constant heat capacity C (J/K).
 *  - The pair is isolated from its surroundings, so energy is conserved and heat only moves
 *    between the two bodies.
 *  - Temperatures are kelvin throughout (never °C).
 *
 * With those assumptions the final (equilibrium) temperature is T_f = (T1 + T2) / 2 and
 *   ΔS_i      = C ln(T_f / T_i)
 *   ΔS_total  = C ln( (T1 + T2)² / (4 T1 T2) )  ≥ 0, with equality only when T1 = T2.
 */

import type { BodyTemperatures, ThermalMode, ThermalParams, ThermalSnapshot } from './types'

/** Fallback for a session row that carries no (or malformed) simulation parameters. The lesson supplies the real ones. */
export const DEFAULT_THERMAL_PARAMS: ThermalParams = {
  hotK: 400,
  coldK: 300,
  heatCapacityJPerK: 1000,
  timeConstantS: 2,
}

export function isThermalParams(value: unknown): value is ThermalParams {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.hotK === 'number' &&
    typeof v.coldK === 'number' &&
    typeof v.heatCapacityJPerK === 'number' &&
    typeof v.timeConstantS === 'number' &&
    v.hotK > 0 &&
    v.coldK > 0 &&
    v.timeConstantS > 0
  )
}

/** In the hypothetical reverse process the cold body is never driven below this fraction of its initial kelvin temperature. */
const MAX_REVERSE_COLD_DROP = 0.5

/** The demo snaps to its final state after this many time constants. */
export const SETTLE_TIME_CONSTANTS = 6

function assertKelvin(...temperatures: number[]): void {
  for (const t of temperatures) {
    if (!Number.isFinite(t) || t <= 0) {
      throw new RangeError(`Temperatures must be positive, finite kelvin values (got ${t}).`)
    }
  }
}

/** Final common temperature of two identical bodies brought into thermal contact. */
export function calculateEquilibriumTemperature(t1: number, t2: number): number {
  assertKelvin(t1, t2)
  return (t1 + t2) / 2
}

/** Heat absorbed (+) or released (−) by a body of constant heat capacity going from tInitial to tFinal: Q = C (T_f − T_i). */
export function calculateHeatTransferred(heatCapacity: number, tInitial: number, tFinal: number): number {
  assertKelvin(tInitial, tFinal)
  return heatCapacity * (tFinal - tInitial)
}

/** Entropy change of one body of constant heat capacity: ΔS = C ln(T_f / T_i), in J/K. */
export function calculateEntropyChange(heatCapacity: number, tInitial: number, tFinal: number): number {
  assertKelvin(tInitial, tFinal)
  return heatCapacity * Math.log(tFinal / tInitial)
}

/** ΔS_total = ΔS_1 + ΔS_2 for the isolated pair, between two arbitrary states of the bodies. */
export function calculateTotalEntropyChange(
  heatCapacity: number,
  initial: BodyTemperatures,
  final: BodyTemperatures,
): number {
  return (
    calculateEntropyChange(heatCapacity, initial.t1, final.t1) +
    calculateEntropyChange(heatCapacity, initial.t2, final.t2)
  )
}

/** ΔS_total for the complete spontaneous process: both bodies go from (T1, T2) to the equilibrium temperature. */
export function calculateEquilibriumEntropyChange(heatCapacity: number, t1: number, t2: number): number {
  const tf = calculateEquilibriumTemperature(t1, t2)
  return calculateTotalEntropyChange(heatCapacity, { t1, t2 }, { t1: tf, t2: tf })
}

/** Total time (s) after which the animation is treated as finished. */
export function settleSeconds(params: ThermalParams): number {
  return SETTLE_TIME_CONSTANTS * params.timeConstantS
}

/** Magnitude of heat moved once the process has run to completion, J. */
function fullTransferJ(params: ThermalParams, mode: ThermalMode): number {
  const { hotK, coldK, heatCapacityJPerK: c } = params
  if (mode === 'idle') return 0
  const toEquilibrium = Math.max(0, c * (hotK - calculateEquilibriumTemperature(hotK, coldK)))
  if (mode === 'forward') return toEquilibrium
  return Math.min(toEquilibrium, c * coldK * MAX_REVERSE_COLD_DROP)
}

/**
 * State of the simulation `elapsedS` seconds after it started — a pure function of (params, mode, time).
 *
 * The heat moved follows Newton-style relaxation, Q(t) = Q_full (1 − e^(−t/τ)), which is the exact
 * solution for two bodies exchanging heat through a fixed thermal conductance. Because it is a closed
 * form, every browser that knows (params, mode, start time) computes the identical state without any
 * frame-by-frame communication.
 */
export function snapshotAt(params: ThermalParams, mode: ThermalMode, elapsedS: number): ThermalSnapshot {
  const { hotK, coldK, heatCapacityJPerK: c, timeConstantS: tau } = params
  const running = mode !== 'idle'
  const t = running ? Math.max(0, elapsedS) : 0
  const settled = running && t >= settleSeconds(params)
  const progress = !running ? 0 : settled ? 1 : 1 - Math.exp(-t / tau)

  const heatJ = fullTransferJ(params, mode) * progress
  const deltaT = heatJ / c
  const tHotK = mode === 'reverse' ? hotK + deltaT : hotK - deltaT
  const tColdK = mode === 'reverse' ? coldK - deltaT : coldK + deltaT

  const dSHotJPerK = calculateEntropyChange(c, hotK, tHotK)
  const dSColdJPerK = calculateEntropyChange(c, coldK, tColdK)

  return {
    mode,
    tHotK,
    tColdK,
    heatJ,
    direction: !running || heatJ === 0 ? 'none' : mode === 'forward' ? 'hot-to-cold' : 'cold-to-hot',
    dSHotJPerK,
    dSColdJPerK,
    dSTotalJPerK: dSHotJPerK + dSColdJPerK,
    progress,
    rateFraction: !running || settled ? 0 : Math.exp(-t / tau),
    settled,
  }
}

/** The state the demo ends in once it has fully relaxed. */
export function finalSnapshot(params: ThermalParams, mode: ThermalMode = 'forward'): ThermalSnapshot {
  return snapshotAt(params, mode, settleSeconds(params))
}
