import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { secondLawLesson as lesson } from '../lesson'
import { TeacherConsole } from '../pages/TeacherPage'
import { SessionProvider } from '../session/SessionProvider'
import { createClassroomSession } from '../session/sessionService'
import { MemoryRealtimeAdapter } from '../test/MemoryRealtimeAdapter'
import { PresentationRenderer } from './presentation/PresentationRenderer'
import { StudentRenderer } from './student/StudentRenderer'

const prediction = lesson.questions['prediction']!
const correct = prediction.options.find((o) => o.id === prediction.correctOptionId)!
const wrong = prediction.options.find((o) => o.id !== prediction.correctOptionId)!
const SETTINGS_KEY = 'second-law-demo:teacher-settings'
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('the Kahoot-style flow: teacher, projector and a student phone on one session', () => {
  let adapter: MemoryRealtimeAdapter
  let code: string

  beforeEach(async () => {
    window.localStorage.clear()
    adapter = new MemoryRealtimeAdapter()
    code = (await createClassroomSession(adapter, lesson)).sessionCode
  })

  const inSession = (role: 'teacher' | 'presenter' | 'student', child: React.ReactNode) => (
    <SessionProvider code={code} role={role} lesson={lesson} adapter={adapter}>
      {child}
    </SessionProvider>
  )
  const classroom = () =>
    render(
      <MemoryRouter>
        {inSession('teacher', <TeacherConsole />)}
        {inSession('presenter', <PresentationRenderer />)}
        {inSession('student', <StudentRenderer />)}
      </MemoryRouter>,
    )
  const press = async (label: RegExp) => fireEvent.click(await screen.findByRole('button', { name: label }))

  it('LOBBY: a joined student is on the projector and the teacher screen; "Start lesson" moves everyone to the first slide', async () => {
    classroom()

    const youAreIn = await screen.findByText('You’re in!')
    const name = youAreIn.nextElementSibling?.textContent ?? ''
    expect(name).not.toBe('')
    await waitFor(() => expect(screen.getAllByText(name).length).toBeGreaterThanOrEqual(3)) // phone, projector, teacher
    expect(screen.getByText(/Waiting for the teacher to start/)).toBeTruthy() // the projector's waiting room
    expect(screen.getAllByText(code).length).toBeGreaterThanOrEqual(2)

    await press(/^Start lesson/)
    await waitFor(() => expect(screen.queryByText('You’re in!')).toBeNull())
    expect((await screen.findAllByText(lesson.steps[0]!.title)).length).toBeGreaterThan(0)
    expect(screen.queryByText(/Waiting for the teacher to start/)).toBeNull()
  })

  it.each([
    ['right', correct, 'Correct!'],
    ['wrong', wrong, 'Not quite'],
  ])('QUESTION: a %s answer → coloured tiles → "Answer sent" → the result, with nothing pressed once everyone has answered', async (_kind, option, headline) => {
    classroom()
    await press(/^Start lesson/)
    await pause(500) // the big button ignores a double tap for a moment
    await press(/^Open voting/)

    fireEvent.click(await screen.findByRole('button', { name: option.text }))
    expect(await screen.findByText('Answer sent')).toBeTruthy()

    // The only student has answered, so voting finishes by itself.
    expect(await screen.findByText(headline, {}, { timeout: 4000 })).toBeTruthy()
    expect(screen.getByText('The answer')).toBeTruthy()
    expect(await screen.findByRole('button', { name: /^Next: / })).toBeTruthy()
  })

  it('COUNTDOWN: when time runs out the question closes by itself and a silent student sees "Time’s up"', async () => {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ timerS: 1, finishWhenAllAnswered: false }))
    classroom()
    await press(/^Start lesson/)
    await pause(500)
    await press(/^Open voting/)
    expect(await screen.findByRole('button', { name: correct.text })).toBeTruthy() // tiles are up

    expect(await screen.findByText('Time’s up', {}, { timeout: 4000 })).toBeTruthy()
    expect(screen.getByText('The answer')).toBeTruthy()
  })
})
