/**
 * Moving between the slides with the wheel or the trackpad: one flick goes to the next slide (or the
 * one before), eased, and the page settles exactly on it. The browser's own scroll-snap does this
 * stiffly — it stalls on the slides' inner scrolling cards and fights a trackpad's momentum — so the
 * slides are paged here instead. A card that can still scroll takes the wheel first; the page moves
 * only once the card is at its edge (and a gesture that began inside a card stays with it). Anything
 * that leaves the page between slides (touch, keys, the scrollbar) is eased to the nearest slide.
 */

const reduced = (): boolean => matchMedia("(prefers-reduced-motion: reduce)").matches;
const ease = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** A scrolling element under the pointer that can still move in this direction (up to the root). */
function innerCanScroll(from: EventTarget | null, root: HTMLElement, dy: number): boolean {
  for (
    let el = from instanceof Element ? from : null;
    el !== null && el !== root;
    el = el.parentElement
  ) {
    const o = getComputedStyle(el).overflowY;
    if ((o === "auto" || o === "scroll") && el.scrollHeight > el.clientHeight + 1) {
      if (dy > 0 && el.scrollTop + el.clientHeight < el.scrollHeight - 1) return true;
      if (dy < 0 && el.scrollTop > 0) return true;
    }
  }
  return false;
}

export function installPaging(root: HTMLElement): () => void {
  let raf = 0;
  let animating = false;
  let lastWheel = 0;
  let lastMag = 0;
  let acc = 0;
  let spent = false; // this gesture has already turned a page
  let inner = false; // this gesture began inside a card that was scrolling
  let idle: ReturnType<typeof setTimeout> | undefined;

  const count = (): number => root.children.length;
  const at = (): number => Math.round(root.scrollTop / Math.max(1, root.clientHeight));

  const goTo = (i: number): void => {
    const to = Math.min(count() - 1, Math.max(0, i)) * root.clientHeight;
    const from = root.scrollTop;
    cancelAnimationFrame(raf);
    if (reduced() || Math.abs(to - from) < 1) {
      root.scrollTop = to;
      animating = false;
      return;
    }
    animating = true;
    const dur = Math.min(720, 360 + (Math.abs(to - from) / root.clientHeight) * 140);
    const t0 = performance.now();
    const step = (now: number): void => {
      const k = Math.min(1, (now - t0) / dur);
      root.scrollTop = from + (to - from) * ease(k);
      if (k < 1) raf = requestAnimationFrame(step);
      else animating = false;
    };
    raf = requestAnimationFrame(step);
  };

  const onWheel = (e: WheelEvent): void => {
    if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.deltaY === 0) return;
    const now = performance.now();
    const mag = Math.abs(e.deltaY);
    // a new gesture: a pause since the last event, or a flick stronger than the fading tail before it
    const fresh = now - lastWheel > 160 || (spent && mag > lastMag + 8 && mag > 30);
    lastWheel = now;
    lastMag = mag;
    if (fresh) {
      acc = 0;
      spent = false;
      inner = false;
    }
    if (inner || innerCanScroll(e.target, root, e.deltaY)) {
      // the card keeps this gesture to its end, edge or not
      inner = true;
      return;
    }
    e.preventDefault();
    if (animating || spent) return;
    acc += e.deltaY;
    if (Math.abs(acc) < 24) return;
    spent = true;
    goTo(at() + (acc > 0 ? 1 : -1));
  };

  const onScroll = (): void => {
    clearTimeout(idle);
    idle = setTimeout(() => {
      const near = at();
      if (!animating && performance.now() - lastWheel > 200) {
        if (Math.abs(root.scrollTop - near * root.clientHeight) > 2) goTo(near);
      }
    }, 140);
  };

  root.addEventListener("wheel", onWheel, { passive: false });
  root.addEventListener("scroll", onScroll, { passive: true });
  return () => {
    cancelAnimationFrame(raf);
    clearTimeout(idle);
    root.removeEventListener("wheel", onWheel);
    root.removeEventListener("scroll", onScroll);
  };
}
