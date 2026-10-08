import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { isValidSessionCode, normalizeSessionCode } from '../session/sessionService'

/** Type a 6-character class code and go to `${target}/${code}`. */
export function JoinForm({ target, label = 'Go' }: { target: '/student' | '/teacher' | '/present'; label?: string }) {
  const navigate = useNavigate()
  const [value, setValue] = useState('')
  const code = normalizeSessionCode(value)
  const valid = isValidSessionCode(code)

  function submit(event: FormEvent) {
    event.preventDefault()
    if (valid) navigate(`${target}/${code}`)
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value.slice(0, 9))}
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder="F7K3Q2"
        aria-label="Class code"
        className="w-0 min-w-0 flex-1 rounded-xl border border-line-strong bg-surface-2/70 px-4 py-3 text-center font-mono text-lg font-bold uppercase tracking-[0.3em] text-ink outline-none transition placeholder:text-ink-faint/60 focus:border-accent"
      />
      <button
        type="submit"
        disabled={!valid}
        className="rounded-xl bg-accent px-5 py-3 font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#1a1200] transition enabled:hover:brightness-110 enabled:active:scale-[0.97] disabled:opacity-40"
      >
        {label}
      </button>
    </form>
  )
}
