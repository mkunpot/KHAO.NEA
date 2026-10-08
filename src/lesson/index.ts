import { fridgeRoomLesson } from './fridgeRoom'
import { secondLawLesson } from './secondLaw'

export { secondLawLesson, fridgeRoomLesson }
export { fridgeRoomLesson as defaultLesson } from './fridgeRoom'
export * from './cursor'
export type * from './types'

/** Built-in lessons can be reopened by a student or projector without storing a duplicate in every session row. */
export function lessonById(id: string) {
  return [secondLawLesson, fridgeRoomLesson].find((lesson) => lesson.id === id)
}
