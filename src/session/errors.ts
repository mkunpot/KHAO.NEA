export class TeacherOnlyError extends Error {
  constructor() {
    super('Only the teacher can change the classroom state.')
    this.name = 'TeacherOnlyError'
  }
}

export class StudentOnlyError extends Error {
  constructor() {
    super('Only a student can submit an answer.')
    this.name = 'StudentOnlyError'
  }
}
