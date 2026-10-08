import { describe, expect, it } from 'vitest'
import {
  calculateEntropyChange,
  calculateEquilibriumEntropyChange,
  calculateEquilibriumTemperature,
  calculateHeatTransferred,
  calculateTotalEntropyChange,
  finalSnapshot,
  settleSeconds,
  snapshotAt,
} from './model'
import type { ThermalParams } from './types'

const C = 1000 // J/K
const params: ThermalParams = { hotK: 400, coldK: 300, heatCapacityJPerK: C, timeConstantS: 2 }

describe('equilibrium temperature', () => {
  it('T1 = 400 K and T2 = 300 K give Tf = 350 K', () => {
    expect(calculateEquilibriumTemperature(400, 300)).toBe(350)
  })

  it('swapping the bodies gives the same equilibrium temperature', () => {
    expect(calculateEquilibriumTemperature(300, 400)).toBe(calculateEquilibriumTemperature(400, 300))
  })

  it('swapping the bodies gives the same total entropy change', () => {
    expect(calculateEquilibriumEntropyChange(C, 300, 400)).toBeCloseTo(calculateEquilibriumEntropyChange(C, 400, 300), 9)
  })

  it('rejects temperatures that are not positive kelvin values', () => {
    expect(() => calculateEquilibriumTemperature(0, 300)).toThrow(RangeError)
    expect(() => calculateEquilibriumTemperature(-5, 300)).toThrow(RangeError)
    expect(() => calculateEquilibriumTemperature(Number.NaN, 300)).toThrow(RangeError)
  })
})

describe('entropy change of the isolated pair', () => {
  it('ΔS_total > 0 when the temperatures differ', () => {
    expect(calculateEquilibriumEntropyChange(C, 400, 300)).toBeGreaterThan(0)
  })

  it('matches the hand calculation for 400 K / 300 K (C = 1 kJ/K)', () => {
    expect(calculateEntropyChange(C, 400, 350)).toBeCloseTo(-133.5314, 3)
    expect(calculateEntropyChange(C, 300, 350)).toBeCloseTo(154.1507, 3)
    expect(calculateEquilibriumEntropyChange(C, 400, 300)).toBeCloseTo(20.6193, 3)
  })

  it('the hot body loses entropy, the cold body gains more than the hot body loses', () => {
    const dHot = calculateEntropyChange(C, 400, 350)
    const dCold = calculateEntropyChange(C, 300, 350)
    expect(dHot).toBeLessThan(0)
    expect(dCold).toBeGreaterThan(0)
    expect(dCold).toBeGreaterThan(Math.abs(dHot))
  })

  it('ΔS_total = 0 when T1 = T2', () => {
    expect(calculateEquilibriumEntropyChange(C, 300, 300)).toBe(0)
    expect(calculateEquilibriumEntropyChange(C, 512.5, 512.5)).toBe(0)
  })

  it('equals the closed form C ln((T1+T2)² / (4 T1 T2))', () => {
    for (const [t1, t2] of [[400, 300], [600, 100], [310, 300], [1000, 10]] as const) {
      const closedForm = C * Math.log(((t1 + t2) ** 2) / (4 * t1 * t2))
      expect(calculateEquilibriumEntropyChange(C, t1, t2)).toBeCloseTo(closedForm, 8)
    }
  })

  it('is never negative and is zero only for equal temperatures (grid search)', () => {
    for (let t1 = 50; t1 <= 800; t1 += 37.5) {
      for (let t2 = 50; t2 <= 800; t2 += 41.25) {
        const dS = calculateEquilibriumEntropyChange(C, t1, t2)
        expect(dS).toBeGreaterThanOrEqual(-1e-9)
        if (Math.abs(t1 - t2) > 1) expect(dS).toBeGreaterThan(0)
      }
    }
  })

  it('a hypothetical cold → hot transfer has ΔS_total < 0', () => {
    const q = 10_000 // J moved from the cold body to the hot body
    const dS = calculateTotalEntropyChange(C, { t1: 400, t2: 300 }, { t1: 400 + q / C, t2: 300 - q / C })
    expect(dS).toBeLessThan(0)
  })

  it('heat transferred is C·ΔT, signed from the body’s point of view', () => {
    expect(calculateHeatTransferred(C, 400, 350)).toBe(-50_000)
    expect(calculateHeatTransferred(C, 300, 350)).toBe(50_000)
  })
})

describe('simulation state as a function of time', () => {
  it('starts at the initial state with no heat moved', () => {
    const s = snapshotAt(params, 'forward', 0)
    expect(s.tHotK).toBe(400)
    expect(s.tColdK).toBe(300)
    expect(s.heatJ).toBe(0)
    expect(s.dSTotalJPerK).toBe(0)
  })

  it('stays put while idle, whatever the clock says', () => {
    const s = snapshotAt(params, 'idle', 123)
    expect(s.tHotK).toBe(400)
    expect(s.tColdK).toBe(300)
    expect(s.direction).toBe('none')
  })

  it('ends at equilibrium after the settle time', () => {
    const s = finalSnapshot(params)
    expect(s.settled).toBe(true)
    expect(s.tHotK).toBe(350)
    expect(s.tColdK).toBe(350)
    expect(s.heatJ).toBeCloseTo(50_000, 6)
    expect(s.dSTotalJPerK).toBeCloseTo(calculateEquilibriumEntropyChange(C, 400, 300), 9)
  })

  it('conserves energy at every instant (identical C ⇒ T_hot + T_cold is constant)', () => {
    for (let t = 0; t <= settleSeconds(params); t += 0.7) {
      const s = snapshotAt(params, 'forward', t)
      expect(s.tHotK + s.tColdK).toBeCloseTo(700, 9)
    }
  })

  it('moves heat hot → cold and never overshoots equilibrium', () => {
    let previousGap = Infinity
    for (let t = 0; t <= settleSeconds(params); t += 0.5) {
      const s = snapshotAt(params, 'forward', t)
      expect(s.direction).toBe(t === 0 ? 'none' : 'hot-to-cold')
      expect(s.tHotK).toBeGreaterThanOrEqual(350 - 1e-9)
      expect(s.tColdK).toBeLessThanOrEqual(350 + 1e-9)
      const gap = s.tHotK - s.tColdK
      expect(gap).toBeLessThanOrEqual(previousGap + 1e-9)
      previousGap = gap
    }
  })

  it('total entropy never decreases during the spontaneous process', () => {
    let previous = -Infinity
    for (let t = 0; t <= settleSeconds(params); t += 0.25) {
      const { dSTotalJPerK } = snapshotAt(params, 'forward', t)
      expect(dSTotalJPerK).toBeGreaterThanOrEqual(previous - 1e-9)
      previous = dSTotalJPerK
    }
  })

  it('the reverse process moves the same heat cold → hot and drives ΔS_total negative', () => {
    const forward = finalSnapshot(params, 'forward')
    const reverse = finalSnapshot(params, 'reverse')
    expect(reverse.direction).toBe('cold-to-hot')
    expect(reverse.heatJ).toBeCloseTo(forward.heatJ, 6)
    expect(reverse.tHotK).toBeCloseTo(450, 9)
    expect(reverse.tColdK).toBeCloseTo(250, 9)
    expect(reverse.dSTotalJPerK).toBeLessThan(0)
    expect(reverse.dSTotalJPerK).toBeCloseTo(-64.5385, 3)
  })

  it('keeps temperatures positive even for extreme slider settings in the reverse process', () => {
    const extreme: ThermalParams = { hotK: 600, coldK: 100, heatCapacityJPerK: C, timeConstantS: 2 }
    const reverse = finalSnapshot(extreme, 'reverse')
    expect(reverse.tColdK).toBeGreaterThan(0)
    expect(reverse.dSTotalJPerK).toBeLessThan(0)
  })

  it('no heat flows when the bodies start at the same temperature', () => {
    const equal: ThermalParams = { ...params, hotK: 300, coldK: 300 }
    const s = finalSnapshot(equal)
    expect(s.heatJ).toBe(0)
    expect(s.dSTotalJPerK).toBe(0)
    expect(s.direction).toBe('none')
  })
})
