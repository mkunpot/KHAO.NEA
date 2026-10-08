/**
 * Is a slide too full? Run it on a slide laid out at its real 1920×1080 size (not scaled).
 *
 * The projector slide is always 16:9, so longer wording cannot make it grow. A slide that is too full
 * fails in one of two ways, and both are measured on the real layout (not guessed from character
 * counts, so it is right for any font, any wording and any mix of formulas):
 *
 *   cut-off   a piece of text (or a picture) sticks out of a box that clips it — the slide itself, or a
 *             panel with `overflow: hidden`. That is exactly what the projector would not show.
 *   squeezed  the slide stays inside its edges only because the simulation / diagram gave way: long text
 *             shrank it below a size anyone could read from the back of a room.
 */

export interface Overflow {
  kind: 'cut-off' | 'squeezed'
  /** cut-off: how far the worst piece sticks out. squeezed: how far the picture is below its minimum. Slide pixels. */
  px: number
  /** cut-off: words from the part that is cut off. squeezed: what was squeezed. */
  sample: string
}

/** A glyph's box pokes out a hair past its line; that is not "cut off". */
const TOLERANCE_PX = 3
/**
 * A quarter of the slide's height. The bundled lesson never gives a simulation less than ~400 px next to a
 * question (the least is the Irreversibility slide); at 150 px its labels cannot be read from the back.
 */
export const MIN_MEDIA_PX = 270
const PICTURES = new Set(['img', 'canvas'])
const CLIPPING = new Set(['hidden', 'clip', 'scroll', 'auto'])

/** Does this box hide whatever sticks out of it? (`overflow` may be one word or an x/y pair.) */
const clipsContent = (style: CSSStyleDeclaration) =>
  [style.overflow, style.overflowX, style.overflowY].some((value) => value.split(/\s+/).some((word) => CLIPPING.has(word)))

/** `host` holds one slide (its first child is the slide's root element). Returns null when the slide is not too full. */
export function measureOverflow(host: HTMLElement): Overflow | null {
  const root = host.firstElementChild
  const view = host.ownerDocument.defaultView
  if (!root || !view) return null
  // Not laid out (not in the page, or no layout engine): there is nothing to measure.
  if (root.getBoundingClientRect().width === 0) return null

  const clips = new Map<Element, DOMRect | null>()
  const clipOf = (element: Element): DOMRect | null => {
    let rect = clips.get(element)
    if (rect === undefined) {
      rect = clipsContent(view.getComputedStyle(element)) ? element.getBoundingClientRect() : null
      clips.set(element, rect)
    }
    return rect
  }

  let worst: { px: number; leaf: Element } | null = null
  for (const leaf of root.querySelectorAll('*')) {
    // KaTeX also writes every formula once more for screen readers, visually hidden on purpose.
    if (leaf.childElementCount > 0 || leaf.closest('.katex-mathml')) continue
    if ((leaf.textContent ?? '').trim() === '' && !PICTURES.has(leaf.localName)) continue
    const box = leaf.getBoundingClientRect()
    if (box.width === 0 && box.height === 0) continue

    // A piece can be cut by any box around it, not only the nearest one.
    for (let ancestor = leaf.parentElement; ancestor; ancestor = ancestor.parentElement) {
      const clip = clipOf(ancestor)
      if (clip) {
        const px = Math.max(box.bottom - clip.bottom, box.right - clip.right, clip.top - box.top, clip.left - box.left)
        if (px > TOLERANCE_PX && (!worst || px > worst.px)) worst = { px, leaf }
      }
      if (ancestor === root) break
    }
  }
  if (worst) return { kind: 'cut-off', px: Math.round(worst.px), sample: sampleAround(worst.leaf, root) }

  const media = root.querySelector('[data-slide-media]')
  const height = media?.getBoundingClientRect().height ?? Infinity
  if (media && height < MIN_MEDIA_PX) return { kind: 'squeezed', px: Math.round(MIN_MEDIA_PX - height), sample: 'the simulation or diagram' }
  return null
}

/** The nearest enclosing piece of text with some words in it (a formula's single glyph says nothing). */
function sampleAround(leaf: Element, root: Element): string {
  let element: Element | null = leaf
  while (element && element !== root && (element.textContent ?? '').trim().length < 12) element = element.parentElement
  const text = ((element ?? leaf).textContent ?? '').replace(/\s+/g, ' ').trim()
  if (text === '') return 'a picture'
  return text.length > 48 ? `${text.slice(0, 47)}…` : text
}
