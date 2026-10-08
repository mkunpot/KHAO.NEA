import { StudentRenderer } from '../renderers/student/StudentRenderer'
import { ClassroomRoute } from './ClassroomRoute'

/** Phone view: what a student scans their way into. No account, no login. */
export default function StudentPage() {
  return (
    <ClassroomRoute role="student">
      <StudentRenderer />
    </ClassroomRoute>
  )
}
