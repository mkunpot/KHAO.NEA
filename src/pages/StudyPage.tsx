import { secondLawLesson } from '../lesson'
import { StudyRenderer } from '../renderers/study/StudyRenderer'

/** Self-Study: works on its own — no session, no Supabase. */
export default function StudyPage() {
  return <StudyRenderer lesson={secondLawLesson} />
}
