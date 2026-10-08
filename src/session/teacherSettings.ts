import { useCallback, useState } from 'react'
import { DEFAULT_SCRIPT_SETTINGS, type ScriptSettings } from './script'

/** The teacher's preferences. They live in this browser only — they shape what the teacher's screen does. */
const KEY = 'second-law-demo:teacher-settings'

export const TIMER_CHOICES = [0, 15, 30, 60, 90] as const

function load(): ScriptSettings {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? 'null') as Partial<ScriptSettings> | null
    return {
      timerS: typeof parsed?.timerS === 'number' && parsed.timerS >= 0 && parsed.timerS <= 600 ? parsed.timerS : DEFAULT_SCRIPT_SETTINGS.timerS,
      finishWhenAllAnswered:
        typeof parsed?.finishWhenAllAnswered === 'boolean' ? parsed.finishWhenAllAnswered : DEFAULT_SCRIPT_SETTINGS.finishWhenAllAnswered,
    }
  } catch {
    return DEFAULT_SCRIPT_SETTINGS
  }
}

export function useTeacherSettings(): [ScriptSettings, (patch: Partial<ScriptSettings>) => void] {
  const [settings, setSettings] = useState<ScriptSettings>(load)
  const update = useCallback((patch: Partial<ScriptSettings>) => {
    setSettings((previous) => {
      const next = { ...previous, ...patch }
      try {
        window.localStorage.setItem(KEY, JSON.stringify(next))
      } catch {
        // private mode: the choice still applies for this visit
      }
      return next
    })
  }, [])
  return [settings, update]
}
