/*
 * Chrome keeps the keyboard in its address bar on a new tab an extension draws, and the page cannot
 * take it back. Opening the same page once more by its own address (not as «the new tab») puts the
 * keyboard on the page, so the search box takes typing straight away. The cost: the address bar
 * shows the page's address instead of staying empty.
 *
 * A plain script in <head>, so it runs before the page's own code and the switch happens before
 * anything is drawn.
 */
(function () {
  if (typeof chrome === "undefined" || !chrome.tabs || location.search.indexOf("focus") !== -1) return;
  chrome.tabs.getCurrent(function (tab) {
    if (tab && tab.id !== undefined)
      chrome.tabs.update(tab.id, { url: chrome.runtime.getURL("index.html?focus") });
  });
})();
