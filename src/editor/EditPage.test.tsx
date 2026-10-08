import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { secondLawLesson } from '../lesson'
import { DRAFT_STORAGE_KEY, loadDraft, saveDraft } from '../lesson/draft'
import EditPage from './EditPage'
import type { Overflow } from './measureOverflow'

// jsdom has no layout engine, so "is this slide too full?" is answered by a stand-in; measureOverflow.test.ts covers the real one.
const measure = vi.hoisted(() => vi.fn<(host: HTMLElement) => Overflow | null>(() => null))
vi.mock('./measureOverflow', () => ({ measureOverflow: measure, MIN_MEDIA_PX: 270 }))

const open = () =>
  render(
    <MemoryRouter>
      <EditPage />
    </MemoryRouter>,
  )

/** Types into a field, then lets the editor's autosave delay pass. */
function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
  act(() => void vi.advanceTimersByTime(400))
}

const preview = () => screen.getByRole('region', { name: 'Preview' })
const checks = () => screen.getByRole('region', { name: 'Checks' })

beforeEach(() => {
  window.localStorage.clear()
  measure.mockReset()
  measure.mockImplementation(() => null)
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('the lesson editor', () => {
  it('starts on the original lesson: nothing marked as changed, nothing to reset', () => {
    open()
    expect(screen.getByRole('status').textContent).toBe('Original lesson')
    expect(screen.queryByRole('button', { name: 'Reset all changes' })).toBeNull()
    expect(screen.getByLabelText('Slide title')).toHaveProperty('value', 'Prediction')
    expect(checks().textContent).toContain('Nothing is empty or broken')
  })

  it('shows the slide as the projector will draw it, and changes it as the teacher types', () => {
    open()
    expect(within(preview()).getByText('Prediction')).toBeTruthy()
    type('Slide title', 'What will happen?')
    expect(within(preview()).getByText('What will happen?')).toBeTruthy()
    expect(within(preview()).queryByText('Prediction')).toBeNull()
  })

  it('saves what was typed as a draft in this browser, and says so', () => {
    open()
    fireEvent.change(screen.getByLabelText('Slide title'), { target: { value: 'What will happen?' } })
    expect(screen.getByRole('status').textContent).toContain('saving')
    expect(loadDraft()).toBeNull() // still waiting for the pause in typing
    act(() => void vi.advanceTimersByTime(400))
    expect(screen.getByRole('status').textContent).toMatch(/Edited · ✓ saved \d/) // with the time it was saved
    expect(loadDraft()?.steps[0]?.title).toBe('What will happen?')
    // the list on the left shows the new title and a "changed" dot
    expect(within(screen.getByRole('navigation')).getByRole('button', { name: /What will happen\?/ })).toBeTruthy()
    expect(within(screen.getByRole('navigation')).getAllByLabelText('changed').length).toBe(1)
  })

  it('opens again on the saved draft', () => {
    const draft = structuredClone(secondLawLesson)
    draft.steps[0]!.title = 'From last time'
    saveDraft(draft)
    open()
    expect(screen.getByLabelText('Slide title')).toHaveProperty('value', 'From last time')
    expect(screen.getByRole('status').textContent).toContain('Edited')
  })

  it('a field can be put back to the original wording on its own', () => {
    open()
    type('Slide title', 'Something else')
    fireEvent.click(within(screen.getByLabelText('Slide title').closest('div')!.parentElement!).getByRole('button', { name: /Reset/ }))
    act(() => void vi.advanceTimersByTime(400))
    expect(screen.getByLabelText('Slide title')).toHaveProperty('value', 'Prediction')
    expect(screen.getByRole('status').textContent).toBe('Original lesson')
    expect(window.localStorage.getItem(DRAFT_STORAGE_KEY)).toBeNull() // back to the original = no draft at all
  })

  it('“Reset all changes” asks first, then returns to the built-in lesson', () => {
    open()
    type('Slide title', 'Something else')

    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    fireEvent.click(screen.getByRole('button', { name: 'Reset all changes' }))
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('Slide title')).toHaveProperty('value', 'Something else')

    confirm.mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: 'Reset all changes' }))
    expect(screen.getByLabelText('Slide title')).toHaveProperty('value', 'Prediction')
    expect(window.localStorage.getItem(DRAFT_STORAGE_KEY)).toBeNull()
  })

  it('edits the question and which answer is correct', () => {
    open()
    type('Answer choice 2', 'Heat climbs from cold to hot')
    fireEvent.click(screen.getByLabelText('Answer choice 2 is correct'))
    act(() => void vi.advanceTimersByTime(400))
    const saved = loadDraft()!.questions.prediction!
    expect(saved.options[1]?.text).toBe('Heat climbs from cold to hot')
    expect(saved.correctOptionId).toBe(saved.options[1]?.id)
    // both the projector slide and the phone in the preview show the new wording
    expect(within(preview()).getAllByText('Heat climbs from cold to hot').length).toBe(2)
  })

  it('warns about an empty field in the field itself and in the list of checks — and jumps to it', () => {
    open()
    type('Slide title', '')
    expect(screen.getAllByText('⚠ The slide title is empty')).toHaveLength(2) // under the field, and in the checks
    const message = within(checks()).getByRole('button', { name: /The slide title is empty/ })
    // go to another slide, then follow the check back
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: /Run the simulation/ }))
    expect(screen.getByLabelText('Slide title')).toHaveProperty('value', 'Run the simulation')
    fireEvent.click(message)
    expect(screen.getByLabelText('Slide title')).toHaveProperty('value', '')
  })

  it('shows a formula that does not parse, instead of silently printing a broken one', () => {
    open()
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: /Run the simulation/ }))
    type('Equation (LaTeX)', '\\frac{T_1 + T_2}{')
    expect(screen.getAllByText(/⚠/).length).toBeGreaterThan(0)
  })

  it('lesson info and summary have their own forms', () => {
    open()
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: 'Lesson info' }))
    type('Lesson title', 'Entropy in 15 minutes')
    expect(loadDraft()?.metadata.title).toBe('Entropy in 15 minutes')

    fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: 'Summary' }))
    type('Summary heading', 'Take-away')
    expect(loadDraft()?.summary.heading).toBe('Take-away')
  })

  it('never writes a broken lesson on its own: only fields change, never the shape of the lesson', () => {
    open()
    type('Slide title', 'x')
    const draft = loadDraft()!
    expect(draft.steps.map((s) => s.id)).toEqual(secondLawLesson.steps.map((s) => s.id))
    expect(Object.keys(draft.questions)).toEqual(Object.keys(secondLawLesson.questions))
  })
})

describe('saving by hand', () => {
  it('has a Save button once something is edited, and it saves at once', () => {
    open()
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull() // nothing to save yet
    fireEvent.change(screen.getByLabelText('Slide title'), { target: { value: 'Typed a moment ago' } })
    expect(loadDraft()).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(loadDraft()?.steps[0]?.title).toBe('Typed a moment ago') // no waiting for the autosave
    expect(screen.getByRole('status').textContent).toContain('✓ saved')
  })

  it('Ctrl+S and ⌘+S save at once — and the browser does not offer to "save this web page"', () => {
    for (const modifier of [{ ctrlKey: true }, { metaKey: true }]) {
      window.localStorage.clear()
      const { unmount } = open()
      fireEvent.change(screen.getByLabelText('Slide title'), { target: { value: 'Typed by hand' } })
      const notPrevented = fireEvent.keyDown(window, { key: 's', ...modifier })
      expect(notPrevented).toBe(false) // preventDefault was called
      expect(loadDraft()?.steps[0]?.title).toBe('Typed by hand')
      unmount()
    }
  })

  it('a plain "s" is just a letter', () => {
    open()
    expect(fireEvent.keyDown(window, { key: 's' })).toBe(true)
  })
})

describe('"too full" warnings — the projector slide is always 16:9, so too much text is a problem on its own', () => {
  const entropyCutOff = (host: HTMLElement): Overflow | null =>
    host.dataset.fitStep === '2' ? { kind: 'cut-off', px: 120, sample: 'The cold body gains more entropy than the hot body loses.' } : null
  const nav = () => within(screen.getByRole('navigation'))

  it('says nothing about slides that fit', () => {
    open()
    expect(checks().textContent).toContain('Nothing is empty or broken')
    expect(screen.queryByText(/too full/)).toBeNull()
    expect(screen.getAllByText(/always 16:9/).length).toBeGreaterThan(0) // the preview says the ratio is fixed
  })

  it('flags a slide whose text is cut off — in the list of slides, in the checks, and above that slide’s preview', () => {
    measure.mockImplementation(entropyCutOff)
    open()
    expect(checks().textContent).toContain('Slide 3 is too full: some text is cut off on the projector')
    expect(within(nav().getByRole('button', { name: /Entropy decides the direction/ })).getByLabelText('needs a look')).toBeTruthy()
    expect(screen.queryByText(/This slide is too full/)).toBeNull() // slide 1 is open, and it fits

    fireEvent.click(nav().getByRole('button', { name: /Entropy decides the direction/ }))
    const banner = screen.getByText(/This slide is too full/).closest('p')!
    expect(banner.textContent).toContain('cut off')
    expect(banner.textContent).toContain('The cold body gains more entropy')
  })

  it('tells "squeezed" from "cut off": the long text left the simulation too small', () => {
    measure.mockImplementation((host) => (host.dataset.fitStep === '0' ? { kind: 'squeezed', px: 124, sample: 'the simulation or diagram' } : null))
    open()
    expect(checks().textContent).toContain('Slide 1 is too full: the text squeezes the simulation too small')
    expect(screen.getByText(/This slide is too full/).closest('p')?.textContent).toContain('squeezes the simulation')
  })

  it('following a warning in the checks goes to that slide', () => {
    measure.mockImplementation(entropyCutOff)
    open()
    fireEvent.click(within(checks()).getByRole('button', { name: /Slide 3 is too full/ }))
    expect(screen.getByLabelText('Slide title')).toHaveProperty('value', 'Entropy decides the direction')
  })

  it('measures after a pause in typing — not on every keystroke — and the warning goes when the wording is shortened', () => {
    open()
    measure.mockClear()
    measure.mockImplementation((host) => (host.textContent?.includes('A far too long title') ? { kind: 'cut-off', px: 30, sample: 'A far too long title' } : null))

    fireEvent.change(screen.getByLabelText('Slide title'), { target: { value: 'A far too long title' } })
    expect(measure).not.toHaveBeenCalled()
    act(() => void vi.advanceTimersByTime(450))
    expect(measure).toHaveBeenCalledTimes(7) // one pause → every slide measured once
    expect(checks().textContent).toContain('Slide 1 is too full')

    type('Slide title', 'Short')
    act(() => void vi.advanceTimersByTime(450))
    expect(checks().textContent).not.toContain('too full')
    expect(checks().textContent).toContain('Nothing is empty or broken')
  })

  it('a too-full slide is a warning, not a blocker: the lesson can still be used', () => {
    measure.mockImplementation(entropyCutOff)
    open()
    expect(screen.queryByRole('alert')).toBeNull() // the red "has to be fixed" banner is for real errors only
    expect(screen.getByRole('link', { name: /Create a session/ })).toBeTruthy()
  })
})
