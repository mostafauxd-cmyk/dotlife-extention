/**
 * Moving between the slides with the wheel or the trackpad: one flick goes to the next slide (or the
 * one before), eased, and the page settles exactly on it. The browser's own scroll-snap does this
 * stiffly — it stalls on the slides' inner scrolling cards and fights a trackpad's momentum — so the
 * slides are paged here instead. A card that can still scroll takes the wheel first; the page moves
 * only once the card is at its edge (and a gesture that began inside a card stays with it). Anything
 * that leaves the page between slides (touch, keys, the scrollbar) is eased to the nearest slide.
 *
 * Every wheel event over the slides is either left to a card that can still use it or stopped here:
 * none reaches the page itself, or the browser would chain a card's leftover momentum into the page
 * and carry it over two or three slides at once.
 */

const reduced = (): boolean => matchMedia("(prefers-reduced-motion: reduce)").matches;
const ease = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Pixels one wheel event moves, whatever unit the device reports it in. */
export function wheelPixels(
  e: Pick<WheelEvent, "deltaY" | "deltaMode">,
  pageHeight: number,
): number {
  if (e.deltaMode === 1) return e.deltaY * 16; // lines
  if (e.deltaMode === 2) return e.deltaY * pageHeight; // pages
  return e.deltaY;
}

/** What to do with one wheel event: leave it to the card under the pointer, stop it, or turn the page. */
export type WheelVerdict = "native" | "hold" | 1 | -1;

/** A gap longer than this between events is a pause: the next event starts a new gesture. */
const PAUSE_MS = 100;
/** Trackpad events come every ~16 ms; a mouse wheel's notches come further apart than this. */
const NOTCH_MS = 48;
/** How far a gesture must travel before it turns the page. */
const THRESHOLD = 24;

/**
 * The decision half of the paging, with no DOM: fed each event's distance, time, whether the page is
 * moving and whether a card under the pointer can still scroll that way. One gesture turns one page.
 * A trackpad's fading momentum belongs to the gesture before it; a new flick is told from it by a
 * pause, a change of direction, or a push clearly stronger than the tail's weakest point. A mouse
 * wheel's notches each count once the page has settled.
 */
export function createWheelGate(): (
  dy: number,
  now: number,
  animating: boolean,
  cardCanScroll: boolean,
) => WheelVerdict {
  let lastAt = -Infinity;
  let lastDir = 0;
  let floor = Infinity; // the weakest event since this gesture turned its page
  let acc = 0;
  let spent = false; // this gesture has already turned a page
  let inner = false; // this gesture began inside a card that was scrolling

  return (dy, now, animating, cardCanScroll) => {
    const gap = now - lastAt;
    lastAt = now;
    const mag = Math.abs(dy);
    const dir = Math.sign(dy);
    if (spent) floor = Math.min(floor, mag);
    const fresh =
      gap > PAUSE_MS ||
      (spent &&
        !animating &&
        (gap > NOTCH_MS || (dir !== lastDir && mag > 10) || mag > floor * 2 + 20));
    lastDir = dir;
    if (fresh) {
      acc = 0;
      spent = false;
      inner = false;
      floor = Infinity;
    }
    // the page is moving: nothing else may move it, and a card on its way past must not scroll
    if (animating) return "hold";
    if (inner || cardCanScroll) {
      // the card keeps this gesture to its end, edge or not; at its edge the event is only stopped
      inner = true;
      return cardCanScroll ? "native" : "hold";
    }
    if (spent) return "hold";
    acc += dy;
    if (Math.abs(acc) < THRESHOLD) return "hold";
    spent = true;
    floor = mag;
    return acc > 0 ? 1 : -1;
  };
}

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

/** A sideways-scrolling element under the pointer (the page itself has no sideways scroll to chain to). */
function sideScroller(from: EventTarget | null, root: HTMLElement): boolean {
  for (
    let el = from instanceof Element ? from : null;
    el !== null && el !== root;
    el = el.parentElement
  ) {
    const o = getComputedStyle(el).overflowX;
    if ((o === "auto" || o === "scroll") && el.scrollWidth > el.clientWidth + 1) return true;
  }
  return false;
}

export function installPaging(root: HTMLElement): () => void {
  let raf = 0;
  let animating = false;
  let lastWheel = 0;
  let idle: ReturnType<typeof setTimeout> | undefined;
  const gate = createWheelGate();

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
    if (e.ctrlKey) return; // a pinch-zoom
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      // sideways: only a card that scrolls sideways may have it; the page must not drift
      if (!sideScroller(e.target, root)) e.preventDefault();
      return;
    }
    if (e.deltaY === 0) return;
    const now = performance.now();
    lastWheel = now;
    const dy = wheelPixels(e, root.clientHeight);
    const v = gate(dy, now, animating, innerCanScroll(e.target, root, dy));
    if (v === "native") return;
    e.preventDefault();
    if (v !== "hold") goTo(at() + v);
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
