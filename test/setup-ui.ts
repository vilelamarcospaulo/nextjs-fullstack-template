// Setup for the "ui" Vitest project (jsdom). Registers jest-dom matchers,
// auto-cleans the DOM between tests, and polyfills the browser APIs that
// base-ui's Menu/popover relies on to open — jsdom ships none of them, and
// without these the avatar dropdown never opens (the regression we now guard).
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as typeof ResizeObserver;

// jsdom has no PointerEvent; base-ui dispatches pointerdown to open the menu.
if (typeof globalThis.PointerEvent === "undefined") {
  globalThis.PointerEvent = class PointerEvent extends MouseEvent {
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
    }
  } as unknown as typeof PointerEvent;
}

// Pointer capture + scrollIntoView are called by base-ui menus; no-op them.
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.setPointerCapture ??= () => {};
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};

// next-themes reads window.matchMedia.
if (typeof window.matchMedia === "undefined") {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
