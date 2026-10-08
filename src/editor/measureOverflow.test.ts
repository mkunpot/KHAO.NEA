import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { measureOverflow, MIN_MEDIA_PX } from './measureOverflow'

/**
 * jsdom has no layout engine, so each test says where the boxes are: `place(element, [x, y, width, height])`.
 * The slide is 1920×1080; its root clips (`overflow: hidden`), like the real one.
 */
type Box = [number, number, number, number]

let boxes: Map<Element, Box>
let host: HTMLElement

beforeEach(() => {
  boxes = new Map()
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const [x, y, width, height] = boxes.get(this) ?? [0, 0, 0, 0]
    return { x, y, width, height, left: x, top: y, right: x + width, bottom: y + height, toJSON: () => ({}) } as DOMRect
  })
  host = document.createElement('div')
  document.body.append(host)
})
afterEach(() => {
  host.remove()
  vi.restoreAllMocks()
})

const place = (element: Element | null, box: Box) => void boxes.set(element!, box)
const slide = (html: string) => {
  host.innerHTML = `<div style="overflow: hidden">${html}</div>`
  const root = host.firstElementChild!
  place(root, [0, 0, 1920, 1080])
  return root
}

describe('measureOverflow — is the slide too full?', () => {
  it('finds nothing when everything sits inside the slide', () => {
    const root = slide('<h1>Prediction</h1><p>Two identical bodies, isolated from everything else.</p>')
    place(root.querySelector('h1'), [96, 52, 600, 90])
    place(root.querySelector('p'), [96, 300, 800, 120])
    expect(measureOverflow(host)).toBeNull()
  })

  it('finds text that sticks out below the slide — what the projector would not show', () => {
    const root = slide('<p>The cold body gains more entropy than the hot body loses.</p>')
    place(root.querySelector('p'), [96, 1040, 800, 80]) // bottom at 1120, the slide ends at 1080
    const found = measureOverflow(host)
    expect(found).toMatchObject({ kind: 'cut-off', px: 40 })
    expect(found?.sample).toMatch(/^The cold body gains more entropy.*…$/) // long text is shortened to a recognisable start
  })

  it('does not count the hair of overhang that a glyph box has past its line', () => {
    const root = slide('<p>A line of text that just fits.</p>')
    place(root.querySelector('p'), [96, 1000, 800, 82]) // 2 px over
    expect(measureOverflow(host)).toBeNull()
  })

  it('finds text cut off by a panel inside the slide (an answer choice that is too long for its row)', () => {
    const root = slide('<section style="overflow: hidden"><p>For an isolated system, spontaneous processes do not decrease total entropy.</p></section>')
    place(root.querySelector('section'), [960, 400, 800, 100])
    place(root.querySelector('p'), [980, 420, 760, 160]) // inside the slide, but 80 px below its row
    const found = measureOverflow(host)
    expect(found).toMatchObject({ kind: 'cut-off', px: 80 })
    expect(found?.sample).toContain('For an isolated system')
  })

  it('checks every box around a piece of text, not only the nearest one', () => {
    const root = slide('<section style="overflow: hidden"><div><p>Long explanation that runs on and on.</p></div></section>')
    place(root.querySelector('section'), [960, 800, 800, 400]) // the panel itself hangs 120 px off the slide…
    place(root.querySelector('p'), [980, 1100, 700, 60]) // …and the text is inside the panel, but outside the slide
    expect(measureOverflow(host)).toMatchObject({ kind: 'cut-off', px: 80 })
  })

  it('ignores the copy of every formula that KaTeX hides for screen readers', () => {
    const root = slide('<span class="katex-mathml"><math><mi>T</mi></math></span><p>Visible</p>')
    place(root.querySelector('mi'), [-9000, 2000, 10, 10])
    place(root.querySelector('p'), [96, 100, 100, 40])
    expect(measureOverflow(host)).toBeNull()
  })

  it('treats a picture that sticks out like text that sticks out', () => {
    const root = slide('<img alt="">')
    place(root.querySelector('img'), [1700, 900, 400, 100]) // right edge at 2100
    expect(measureOverflow(host)).toEqual({ kind: 'cut-off', px: 180, sample: 'a picture' })
  })

  it('says "squeezed" when the simulation had to give way to long text, even though nothing sticks out', () => {
    const root = slide('<p>Long text.</p><div data-slide-media><svg></svg></div>')
    place(root.querySelector('p'), [96, 230, 836, 624])
    place(root.querySelector('[data-slide-media]'), [96, 878, 836, 146]) // 146 px tall
    expect(measureOverflow(host)).toEqual({ kind: 'squeezed', px: MIN_MEDIA_PX - 146, sample: 'the simulation or diagram' })
  })

  it('leaves a simulation alone that has room — the least the bundled lesson gives it is about 400 px', () => {
    const root = slide('<p>Short text.</p><div data-slide-media><svg></svg></div>')
    place(root.querySelector('p'), [96, 230, 836, 60])
    place(root.querySelector('[data-slide-media]'), [96, 600, 836, 396])
    expect(measureOverflow(host)).toBeNull()
  })

  it('reports text that is cut off before a squeezed picture — it is the worse of the two', () => {
    const root = slide('<p>Text that hangs off the slide.</p><div data-slide-media><svg></svg></div>')
    place(root.querySelector('p'), [96, 1000, 800, 120])
    place(root.querySelector('[data-slide-media]'), [96, 900, 836, 100])
    expect(measureOverflow(host)?.kind).toBe('cut-off')
  })

  it('has nothing to measure when the slide is not laid out (not on the page, or no layout engine)', () => {
    slide('<p>Whatever</p>')
    boxes.clear()
    expect(measureOverflow(host)).toBeNull()
  })
})
