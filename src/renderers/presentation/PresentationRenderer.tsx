/**
 * PRESENTATION rendering state: the projector.
 *
 *   LessonDefinition → PresentationRenderer → Spectacle
 *
 * Spectacle is only the 1920×1080 slide canvas (scaling, transitions). The slides are generated
 * from the lesson; nothing here contains lesson text. Which slide and which reveal stage is on
 * screen is not decided by Spectacle's own keys/clicks but by the teacher, through the session.
 */

import '@fontsource-variable/fraunces'
import { Deck, DeckContext, Slide, fadeTransition } from 'spectacle'
import { useContext, useEffect } from 'react'
import { positionAt } from '../../lesson/cursor'
import { useSession } from '../../session/SessionProvider'
import { PresentationLobby } from './Lobby'
import { StepSlide } from './StepSlide'

const THEME = {
  size: { width: 1920, height: 1080 },
  colors: { primary: '#e8eefc', secondary: '#9eacca', tertiary: '#060a12', quaternary: '#3dc7f4' },
  fonts: { header: 'var(--font-display)', text: 'var(--font-sans)', monospace: 'var(--font-mono)' },
  // A theme `backdropStyle` REPLACES Spectacle's default backdrop (a fixed, full-viewport box). Spectacle measures
  // that box to fit the 16:9 canvas into it — centred, with black bars when the window is not 16:9 — so this must
  // still pin it to the viewport. Without a position and size the box is as tall as the 1080 px canvas, the slide is
  // centred in *that*, and it ends up pushed down and cut off in any window shorter than 1080 px.
  backdropStyle: { position: 'absolute' as const, inset: 0, background: '#03060c' },
}

/**
 * Spectacle reads the keyboard (arrows, alt+p presenter mode, alt+o overview…) on `document` and
 * mirrors the slide into the URL. On the projector none of that is wanted — the teacher decides —
 * so swallow key events before Spectacle sees them. (Browser shortcuts such as F11 still work:
 * we only stop propagation, never preventDefault.)
 */
function useBlockSpectacleKeys() {
  useEffect(() => {
    const stop = (event: KeyboardEvent) => event.stopPropagation()
    window.addEventListener('keydown', stop, true)
    window.addEventListener('keyup', stop, true)
    return () => {
      window.removeEventListener('keydown', stop, true)
      window.removeEventListener('keyup', stop, true)
    }
  }, [])
}

// `disableInteractivity` is honoured by Spectacle's deck (it is what its own preview pane uses) but
// is not part of the public DeckProps type: no arrow-key navigation, no URL / history writes.
const FOLLOWER_DECK_PROPS = { disableInteractivity: true } as object

export function PresentationRenderer() {
  const { lesson, session } = useSession()
  useBlockSpectacleKeys()
  if (!session) return null
  if (!session.started) return <PresentationLobby />
  const position = positionAt(lesson, session.currentStep)

  return (
    <div className="fixed inset-0 bg-[#03060c]">
      <Deck theme={THEME} template={() => null} transition={fadeTransition} {...FOLLOWER_DECK_PROPS}>
        <DeckSync slideIndex={position.stepIndex} />
        {lesson.steps.map((step, index) => (
          <Slide key={step.id} backgroundColor="transparent" padding="0px">
            <StepSlide step={step} index={index} total={lesson.steps.length} />
          </Slide>
        ))}
      </Deck>
    </div>
  )
}

/**
 * Keeps Spectacle on the teacher's slide. If anything else (a stray key press on the projector
 * laptop, a click) moves it, snap straight back.
 */
function DeckSync({ slideIndex }: { slideIndex: number }) {
  const { skipTo, activeView, initialized } = useContext(DeckContext)
  useEffect(() => {
    if (!initialized) return
    if (activeView.slideIndex !== slideIndex || activeView.stepIndex !== 0) skipTo({ slideIndex, stepIndex: 0 })
  }, [initialized, slideIndex, activeView.slideIndex, activeView.stepIndex, skipTo])
  return null
}
