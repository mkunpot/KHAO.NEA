import { PresentationRenderer } from '../renderers/presentation/PresentationRenderer'
import { ClassroomRoute } from './ClassroomRoute'

/** Projector view: read-only; the teacher controller drives it through the session. */
export default function PresentPage() {
  return (
    <ClassroomRoute role="presenter">
      <PresentationRenderer />
    </ClassroomRoute>
  )
}
