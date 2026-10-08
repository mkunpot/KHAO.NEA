import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { secondLawLesson } from '../lesson'
import { saveDraft } from '../lesson/draft'
import { MemoryRealtimeAdapter } from '../test/MemoryRealtimeAdapter'
import CreateSessionPage from './CreateSessionPage'

function open(adapter: MemoryRealtimeAdapter) {
  render(
    <MemoryRouter>
      <CreateSessionPage adapter={adapter} />
    </MemoryRouter>,
  )
}

const editedLesson = () => {
  const lesson = structuredClone(secondLawLesson)
  lesson.metadata.title = 'My Second Law'
  return lesson
}

beforeEach(() => window.localStorage.clear())

describe('creating a session', () => {
  it('without an edited lesson it creates a session for the built-in lesson and stores no copy', async () => {
    const adapter = new MemoryRealtimeAdapter()
    open(adapter)
    expect(screen.getByText('The Second Law of Thermodynamics')).toBeTruthy()
    expect(screen.queryByLabelText(/Use my edited lesson/)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Create session' }))
    await waitFor(() => expect(adapter.sessions.size).toBe(1))
    expect([...adapter.sessions.values()][0]?.lesson).toBeUndefined()
  })

  it('with an edited lesson it offers to use it — on by default — and copies it into the session', async () => {
    saveDraft(editedLesson())
    const adapter = new MemoryRealtimeAdapter()
    open(adapter)
    expect(screen.getByText('My Second Law')).toBeTruthy()
    expect(screen.getByLabelText(/Use my edited lesson/)).toHaveProperty('checked', true)

    fireEvent.click(screen.getByRole('button', { name: 'Create session' }))
    await waitFor(() => expect(adapter.sessions.size).toBe(1))
    expect([...adapter.sessions.values()][0]?.lesson?.metadata.title).toBe('My Second Law')
    expect(await screen.findByText(/This class runs your edited lesson/)).toBeTruthy()
  })

  it('the teacher can leave the edit out of this class without losing it', async () => {
    saveDraft(editedLesson())
    const adapter = new MemoryRealtimeAdapter()
    open(adapter)
    fireEvent.click(screen.getByLabelText(/Use my edited lesson/))
    expect(screen.getByText('The Second Law of Thermodynamics')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Create session' }))
    await waitFor(() => expect(adapter.sessions.size).toBe(1))
    expect([...adapter.sessions.values()][0]?.lesson).toBeUndefined()
    expect(window.localStorage.getItem('khao-nea:lesson-draft:v1')).not.toBeNull() // the draft is still there
  })

  it('says how many fields are empty in the edited lesson, before the class starts', () => {
    const lesson = editedLesson()
    lesson.steps[0]!.title = ''
    lesson.objectives[0] = ''
    saveDraft(lesson)
    open(new MemoryRealtimeAdapter())
    expect(screen.getByText(/2 fields are empty/)).toBeTruthy()
  })
})
