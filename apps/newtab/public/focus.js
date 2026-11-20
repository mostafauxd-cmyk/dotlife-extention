/*
 * The keyboard on our search box the moment a new tab opens (2026-11-20, the user: «وقتی کاربر نیوتب
 * میزنه بجای سرچ بار بالا سرچ بار خود افزونه فعال باشه … سرعت باز کردن کیبورد … باید بره بالاتر»).
 *
 * Chrome keeps the keyboard in its address bar on a new tab an extension draws, and the page cannot
 * take it back. Opening the same page once more by its own address (not as «the new tab») puts the
 * keyboard on the page. The cost: the address bar shows the page's address instead of staying empty.
 *
 * - The first load only moves on: it stops loading at once (the page's script and styles are never
 *   fetched), so no work is thrown away before the second one.
 * - On the second load, whatever is typed before the search box exists is kept (`__noghteTyped`) and
 *   handed to it when it appears (home/SearchBox.tsx), so the first letters are never lost.
 *
 * A plain script in <head>, so it runs before the page's own code.
 */
(function () {
  var w = window;
  var moving =
    typeof chrome !== "undefined" && chrome.tabs && location.search.indexOf("focus") === -1;
  if (moving) {
    w.__noghteMoving = true;
    chrome.tabs.getCurrent(function (tab) {
      if (tab && tab.id !== undefined) {
        chrome.tabs.update(tab.id, { url: chrome.runtime.getURL("index.html?focus") });
        return;
      }
      // not in a tab of its own: the page is drawn after all, at the address that does not move on
      location.replace(chrome.runtime.getURL("index.html?focus"));
    });
    // nothing more of this load is needed: not the page's script, not its styles
    w.stop();
    return;
  }
  w.__noghteTyped = "";
  addEventListener(
    "keydown",
    function keep(e) {
      if (w.__noghteTaken) {
        removeEventListener("keydown", keep, true);
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
      if (e.key.length === 1) {
        w.__noghteTyped += e.key;
        e.preventDefault();
      } else if (e.key === "Backspace") {
        w.__noghteTyped = w.__noghteTyped.slice(0, -1);
        e.preventDefault();
      }
    },
    true,
  );
})();
