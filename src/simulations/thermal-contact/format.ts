const MINUS = '−'

export function formatKelvin(kelvin: number): string {
  return kelvin.toFixed(1)
}

export function formatKiloJoules(joules: number): string {
  return (Math.abs(joules) / 1000).toFixed(1)
}

/** Entropy change in J/K with an explicit sign and a true minus; never prints "-0.0". */
export function formatEntropy(jPerK: number): string {
  const rounded = Math.round(jPerK * 10) / 10
  if (rounded === 0) return '0.0'
  return `${rounded < 0 ? MINUS : '+'}${Math.abs(rounded).toFixed(1)}`
}

export function entropySign(jPerK: number): 'negative' | 'positive' | 'zero' {
  const rounded = Math.round(jPerK * 10) / 10
  return rounded === 0 ? 'zero' : rounded < 0 ? 'negative' : 'positive'
}
