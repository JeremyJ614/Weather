/**
 * Test setup.
 *
 * Registers jest-dom's DOM matchers so assertions read as what they check —
 * `toHaveAttribute("rel", "noopener noreferrer")` rather than a string compare
 * against `getAttribute`, which passes just as happily when the attribute is
 * absent and the expected value is null.
 */
import "@testing-library/jest-dom/vitest";

/**
 * `window.matchMedia`, which jsdom does not implement.
 *
 * Several components read a media query as external state through
 * `useSyncExternalStore`, which is the correct way to read one: it is a value
 * the browser owns and changes without asking. jsdom having no implementation
 * would make every one of those components throw on mount in a test and
 * nowhere else, which is the worst kind of gap in a test environment.
 *
 * Nothing matches by default, which is what jsdom reports for every other
 * layout question, and a test that cares spies on this and says otherwise.
 */
if (typeof window !== "undefined" && !window.matchMedia) {
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
