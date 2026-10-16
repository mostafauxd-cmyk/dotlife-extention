/**
 * The morphing tab pill, as in the design: in any bar marked `.morph`, one pill sits under the chosen
 * item (aria-selected / aria-pressed / aria-checked = true). On a change it stretches over both the
 * old and the new item, squeezes a little, and settles on the new one (~0.5s; still for «reduce
 * motion»). The pill is the bar's own `::before`, placed by CSS variables, so nothing is added to the
 * page's elements. `installMorph()` watches the page once and picks up every bar as it appears.
 */

type Box = { l: number; w: number };
const placed = new WeakMap<HTMLElement, Box>();
const watched = new WeakSet<HTMLElement>();

const isOn = (c: Element): boolean =>
  c.getAttribute("aria-selected") === "true" ||
  c.getAttribute("aria-pressed") === "true" ||
  c.getAttribute("aria-checked") === "true";

const reduced = (): boolean => matchMedia("(prefers-reduced-motion: reduce)").matches;

function place(bar: HTMLElement, animate: boolean): void {
  const on = [...bar.children].find((c): c is HTMLElement => c instanceof HTMLElement && isOn(c));
  if (on === undefined || on.offsetWidth === 0) {
    bar.style.setProperty("--mo", "0");
    return;
  }
  const next: Box = { l: on.offsetLeft, w: on.offsetWidth };
  const cur = placed.get(bar);
  bar.style.setProperty("--mt", `${String(on.offsetTop)}px`);
  bar.style.setProperty("--mh", `${String(on.offsetHeight)}px`);
  bar.style.setProperty("--ml", `${String(next.l)}px`);
  bar.style.setProperty("--mw", `${String(next.w)}px`);
  bar.style.setProperty("--mo", "1");
  if (animate && cur !== undefined && (cur.l !== next.l || cur.w !== next.w) && !reduced()) {
    const l = Math.min(cur.l, next.l);
    const w = Math.max(cur.l + cur.w, next.l + next.w) - l;
    bar.animate(
      [
        { left: `${String(cur.l)}px`, width: `${String(cur.w)}px`, transform: "scale(1)" },
        {
          left: `${String(l)}px`,
          width: `${String(w)}px`,
          transform: "scale(1, 0.84)",
          offset: 0.42,
        },
        { left: `${String(next.l)}px`, width: `${String(next.w)}px`, transform: "scale(1)" },
      ],
      { duration: 480, easing: "cubic-bezier(.3,.75,.25,1)", pseudoElement: "::before" },
    );
  }
  placed.set(bar, next);
}

function watch(bar: HTMLElement): void {
  if (watched.has(bar)) return;
  watched.add(bar);
  new MutationObserver(() => {
    place(bar, true);
  }).observe(bar, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["aria-selected", "aria-pressed", "aria-checked"],
  });
  new ResizeObserver(() => {
    place(bar, false);
  }).observe(bar);
  place(bar, false);
}

let installed = false;
export function installMorph(): void {
  if (installed) return;
  installed = true;
  const scan = (): void => {
    for (const el of document.querySelectorAll<HTMLElement>(".morph")) watch(el);
  };
  scan();
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
}
