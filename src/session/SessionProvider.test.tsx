import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { secondLawLesson as lesson } from '../lesson'
import { positionAt, positionCount } from '../lesson/cursor'
import type { LessonDefinition } from '../lesson/types'
import { MemoryRealtimeAdapter } from '../test/MemoryRealtimeAdapter'
import { StudentOnlyError, TeacherOnlyError } from './errors'
import { SessionProvider, useSession, type SessionContextValue } from './SessionProvider'
import { createClassroomSession } from './sessionService'
import type { SessionRole } from './sessionTypes'

/** Mounts a SessionProvider for one role and hands back its live context value. */
function mount(adapter: MemoryRealtimeAdapter, code: string, role: SessionRole) {
  const ref: { current: SessionContextValue | null } = { current: null }
  function Probe() {
    ref.current = useSession()
    return null
  }
  render(
    <SessionProvider code={code} role={role} lesson={lesson} adapter={adapter}>
      <Probe />
    </SessionProvider>,
  )
  const value = () => {
    if (!ref.current) throw new Error('provider not mounted')
    return ref.current
  }
  return { value, ready: () => waitFor(() => expect(value().phase).toBe('ready')) }
}

describe('classroom session roles', () => {
  let adapter: MemoryRealtimeAdapter
  let code: string

  beforeEach(async () => {
    window.localStorage.clear()
    adapter = new MemoryRealtimeAdapter()
    code = (await createClassroomSession(adapter, lesson)).sessionCode
  })

  it('a student cannot change teacher-controlled session state through the frontend', async () => {
    const student = mount(adapter, code, 'student')
    await student.ready()
    const before = student.value().session

    for (const event of [
      { type: 'START_LESSON' },
      { type: 'NEXT_STEP' },
      { type: 'PREVIOUS_STEP' },
      { type: 'OPEN_QUESTION', questionId: 'prediction' },
      { type: 'SHOW_RESULTS', questionId: 'prediction' },
      { type: 'REVEAL_ANSWER', questionId: 'prediction' },
      { type: 'FINISH_QUESTION', questionId: 'prediction' },
      { type: 'RESET_SIMULATION', simulationId: 'thermal-contact' },
    ] as const) {
      await expect(student.value().dispatch(event)).rejects.toBeInstanceOf(TeacherOnlyError)
    }

    expect(adapter.publishCalls).toHaveLength(0)
    expect(student.value().session).toBe(before)
    expect([...adapter.sessions.values()][0]?.currentStep).toBe(0)
  })

  it('the projector (presenter) is read-only as well', async () => {
    const presenter = mount(adapter, code, 'presenter')
    await presenter.ready()
    await expect(presenter.value().dispatch({ type: 'START_LESSON' })).rejects.toBeInstanceOf(TeacherOnlyError)
    expect(adapter.publishCalls).toHaveLength(0)
  })

  it('only students can submit answers', async () => {
    const teacher = mount(adapter, code, 'teacher')
    await teacher.ready()
    await expect(teacher.value().submitAnswer('prediction', 'A')).rejects.toBeInstanceOf(StudentOnlyError)
  })

  it('the teacher’s commands reach the students and the projector', async () => {
    const teacher = mount(adapter, code, 'teacher')
    const student = mount(adapter, code, 'student')
    const presenter = mount(adapter, code, 'presenter')
    await Promise.all([teacher.ready(), student.ready(), presenter.ready()])

    // Nothing moves until the lesson is started: the lobby comes first.
    await act(async () => {
      await teacher.value().dispatch({ type: 'NEXT_STEP' })
    })
    expect(adapter.publishCalls).toHaveLength(0)
    expect(student.value().session?.started).toBe(false)

    await act(async () => {
      await teacher.value().dispatch({ type: 'START_LESSON' })
      await teacher.value().dispatch({ type: 'NEXT_STEP' })
    })

    expect(adapter.publishCalls).toHaveLength(2)
    expect(adapter.publishCalls[1]?.version).toBe(2)
    await waitFor(() => expect(student.value().session?.started).toBe(true))
    await waitFor(() => expect(student.value().session?.currentStep).toBe(1))
    await waitFor(() => expect(presenter.value().session?.currentStep).toBe(1))
    expect(teacher.value().session?.currentStep).toBe(1)
  })

  it('answers flow student → backend → teacher, first answer wins, and a closed question rejects late answers', async () => {
    const teacher = mount(adapter, code, 'teacher')
    const student = mount(adapter, code, 'student')
    await Promise.all([teacher.ready(), student.ready()])

    // Not open yet.
    await act(async () => {
      expect(await student.value().submitAnswer('prediction', 'A')).toBe('closed')
    })

    await act(async () => {
      await teacher.value().dispatch({ type: 'START_LESSON' })
      await teacher.value().dispatch({ type: 'OPEN_QUESTION', questionId: 'prediction' })
    })
    await waitFor(() => expect(student.value().session?.questionOpen).toBe(true))

    await act(async () => {
      expect(await student.value().submitAnswer('prediction', 'A')).toBe('accepted')
      expect(await student.value().submitAnswer('prediction', 'B')).toBe('accepted') // ignored: first wins
    })
    expect(student.value().myAnswers).toEqual({ prediction: 'A' })
    await waitFor(() => expect(teacher.value().responses).toHaveLength(1))
    expect(teacher.value().responses[0]?.answer).toBe('A')

    await act(async () => {
      await teacher.value().dispatch({ type: 'CLOSE_QUESTION', questionId: 'prediction' })
    })
    // A different participant answering after the question closed is turned away.
    expect(
      await adapter.submitResponse({
        sessionId: student.value().session!.id,
        participantId: 'someone-else',
        questionId: 'prediction',
        answer: 'C',
      }),
    ).toBe('closed')
    expect(adapter.responses).toHaveLength(1)
  })

  it('a fast double-tap on two different options keeps the first answer on screen and in the backend', async () => {
    const teacher = mount(adapter, code, 'teacher')
    const student = mount(adapter, code, 'student')
    await Promise.all([teacher.ready(), student.ready()])
    await act(async () => {
      await teacher.value().dispatch({ type: 'START_LESSON' })
      await teacher.value().dispatch({ type: 'OPEN_QUESTION', questionId: 'prediction' })
    })

    await act(async () => {
      await Promise.all([
        student.value().submitAnswer('prediction', 'A'),
        student.value().submitAnswer('prediction', 'B'),
      ])
    })

    expect(student.value().myAnswers).toEqual({ prediction: 'A' })
    expect(adapter.responses.map((r) => r.answer)).toEqual(['A'])
  })

  it('the lobby: teacher and projector see who has joined, as they join; phones do not subscribe', async () => {
    const teacher = mount(adapter, code, 'teacher')
    const presenter = mount(adapter, code, 'presenter')
    const student = mount(adapter, code, 'student')
    await Promise.all([teacher.ready(), presenter.ready(), student.ready()])

    await waitFor(() => expect(teacher.value().participantCount).toBe(1))
    expect(presenter.value().participants.map((p) => p.name)).toEqual([student.value().participant?.name])
    expect(student.value().participants).toEqual([])

    await act(async () => {
      await adapter.joinSession({ sessionId: student.value().session!.id, participant: { id: 'late-joiner', name: 'Amber Owl' } })
    })
    await waitFor(() => expect(teacher.value().participantCount).toBe(2))
    expect(presenter.value().participants.map((p) => p.name)).toContain('Amber Owl')
  })

  it('counts a question down from the moment each screen first sees voting open', async () => {
    const teacher = mount(adapter, code, 'teacher')
    const student = mount(adapter, code, 'student')
    await Promise.all([teacher.ready(), student.ready()])
    expect(student.value().questionClock).toBeNull()

    await act(async () => {
      await teacher.value().dispatch({ type: 'START_LESSON' })
      await teacher.value().dispatch({ type: 'OPEN_QUESTION', questionId: 'prediction', timerS: 20 })
    })
    await waitFor(() => expect(student.value().questionClock?.questionId).toBe('prediction'))
    expect(student.value().session?.questionTimerS).toBe(20)

    await act(async () => {
      await teacher.value().dispatch({ type: 'FINISH_QUESTION', questionId: 'prediction' })
    })
    await waitFor(() => expect(student.value().questionClock).toBeNull())
  })

  it('reports an unknown code as not-found', async () => {
    const stranger = mount(adapter, 'ZZZZZZ', 'student')
    await waitFor(() => expect(stranger.value().phase).toBe('not-found'))
  })
})

describe('an edited lesson travels with the session', () => {
  /** The built-in lesson with new words, and one extra reveal stage on the first slide (so the cursor has one more position). */
  function editedLesson(): LessonDefinition {
    const edited = structuredClone(lesson)
    edited.steps[0]!.title = 'My own first slide'
    edited.steps[0]!.blocks.push({ id: 'extra', type: 'concept', text: 'Appears later', reveal: 1 })
    return edited
  }

  beforeEach(() => window.localStorage.clear())

  it('projector, phones and teacher all run the copy stored in the session — not the lesson handed to the provider', async () => {
    const adapter = new MemoryRealtimeAdapter()
    const { sessionCode } = await createClassroomSession(adapter, editedLesson(), { snapshot: true })

    for (const role of ['teacher', 'presenter', 'student'] as const) {
      const screen = mount(adapter, sessionCode, role)
      await screen.ready()
      expect(screen.value().lesson.steps[0]?.title, role).toBe('My own first slide')
    }
  })

  it('without a snapshot every screen uses the lesson that ships with the app', async () => {
    const adapter = new MemoryRealtimeAdapter()
    const { sessionCode } = await createClassroomSession(adapter, editedLesson()) // edited, but not snapshotted
    const student = mount(adapter, sessionCode, 'student')
    await student.ready()
    expect(student.value().lesson).toBe(lesson)
  })

  it('the teacher’s commands are worked out against the session lesson (it has one more position than the built-in one)', async () => {
    const adapter = new MemoryRealtimeAdapter()
    const edited = editedLesson()
    const { sessionCode } = await createClassroomSession(adapter, edited, { snapshot: true })
    const teacher = mount(adapter, sessionCode, 'teacher')
    await teacher.ready()
    expect(positionCount(edited)).toBe(positionCount(lesson) + 1)

    await act(async () => {
      await teacher.value().dispatch({ type: 'START_LESSON' })
      for (let i = 0; i < positionCount(edited) + 5; i++) await teacher.value().dispatch({ type: 'NEXT_STEP' })
    })

    // It stops at the last position of the EDITED lesson, one past where the built-in lesson would stop.
    expect(teacher.value().session?.currentStep).toBe(positionCount(edited) - 1)
    expect(positionAt(teacher.value().lesson, 1)).toEqual({ stepIndex: 0, reveal: 1 })
  })

  it('stores a copy, not the caller’s live object — later edits in the editor cannot leak into a running class', async () => {
    const adapter = new MemoryRealtimeAdapter()
    const edited = editedLesson()
    const { sessionCode } = await createClassroomSession(adapter, edited, { snapshot: true })
    edited.steps[0]!.title = 'Changed after the class started'
    const student = mount(adapter, sessionCode, 'student')
    await student.ready()
    expect(student.value().lesson.steps[0]?.title).toBe('My own first slide')
  })
})
