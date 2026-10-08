import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => cleanup())

// jsdom has no layout engine. Spectacle sizes its 1920×1080 canvas with use-resize-observer and
// getClientRects(), so give it just enough of a browser to mount.
if (typeof window !== 'undefined') {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  const g = globalThis as { ResizeObserver?: unknown }
  g.ResizeObserver ??= ResizeObserverStub

  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia
  }

  Element.prototype.getClientRects = function getClientRects() {
    return [
      { width: 1920, height: 1080, x: 0, y: 0, top: 0, left: 0, right: 1920, bottom: 1080 },
    ] as unknown as DOMRectList
  }
}
