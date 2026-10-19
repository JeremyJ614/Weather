import { useCallback, useRef, useState } from "react";

/**
 * An element's height, kept current, for CSS to clear it with.
 *
 * Three boxes on the map are as tall as their contents and all three change
 * while the replay runs, so anything that has to stay clear of them has to
 * measure rather than assume. That part was already understood; what was
 * wrong was the wiring.
 *
 * The first version put the ResizeObserver in an effect keyed on the loaded
 * chase. But the info-card stack does not exist until a tornado is on the
 * ground — minutes after the chase loads — so when that effect ran the ref
 * was null, it returned early, and nothing ever attached it. `--cards-h`
 * stayed 0 for the entire session, and on a phone the countdown card sat
 * under the cards it was supposed to be clearing.
 *
 * A callback ref cannot miss: React calls it with the node the moment the
 * node appears, and with null the moment it goes, so the observer follows the
 * element rather than a guess about when the element will exist.
 */
export function useMeasuredHeight(
  initial = 0,
): [(el: HTMLElement | null) => void, number] {
  const [height, setHeight] = useState(initial);
  const observer = useRef<ResizeObserver | null>(null);

  const ref = useCallback((el: HTMLElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!el) {
      // Gone, so nothing needs to clear it any more.
      setHeight(0);
      return;
    }
    // offsetHeight, not contentRect: contentRect is the *content* box and
    // excludes the element's own padding, which on a phone is 16px top and
    // bottom. Using it put the info cards 24px inside the HUD.
    setHeight(el.offsetHeight);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight));
    ro.observe(el);
    observer.current = ro;
  }, []);

  return [ref, height];
}
