(() => {
  // The worker injects this file on each click. Register one listener per page.
  if (globalThis.moctaleLookupLoaded) return;
  globalThis.moctaleLookupLoaded = true;

  const host = document.createElement("div");
  const shadow = host.attachShadow({ mode: "closed" });
  const style = new CSSStyleSheet();
  style.replaceSync(`
    :host {
      all: initial !important;
      position: fixed !important;
      right: 16px !important;
      bottom: 16px !important;
      z-index: 2147483647 !important;
      width: min(400px, calc(100vw - 32px)) !important;
      color-scheme: dark !important;
    }
    * { box-sizing: border-box; }
    .card {
      max-height: calc(100dvh - 32px);
      overflow: auto;
      overscroll-behavior: contain;
      padding: 20px;
      border-radius: 16px;
      background: #151822;
      color: #f5f3ff;
      box-shadow: 0 14px 48px #060812b3;
      font: 14px/1.5 system-ui, sans-serif;
      overflow-wrap: anywhere;
    }
    header, .hero { display: flex; gap: 14px; align-items: flex-start; }
    header { justify-content: space-between; align-items: center; margin-bottom: 14px; }
    header span { color: #c5bbec; font-size: 13px; font-weight: 650; }
    h2 { font-size: 23px; line-height: 1.15; letter-spacing: -.025em; margin: 2px 0 8px; }
    h3 { font-size: 14px; margin: 0 0 8px; }
    p { margin: 0 0 8px; }
    .meta, .muted { color: #c0bed2; }
    .poster { width: 86px; aspect-ratio: 2/3; object-fit: cover; border-radius: 8px; }
    .overview { margin: 14px 0 0; }
    .watch { border-top: 1px solid #38394c; margin: 16px 0; padding-top: 14px; }
    .credit { color: #c0bed2; font-size: 12px; margin-top: 10px; }
    a { color: #d3c4ff; text-underline-offset: 3px; }
    button { font: inherit; cursor: pointer; border: 0; }
    .close { padding: 4px 9px; color: inherit; background: #292c3a; border-radius: 6px; }
    .action {
      display: block; width: 100%; padding: 10px; border-radius: 8px;
      font-weight: 700; color: #21163d; background: #d5c4ff;
    }
    .action:hover { background: #e3d8ff; }
    :focus-visible { outline: 2px solid #f5eaff; outline-offset: 3px; }
    .feedback { margin: 8px 0 0; }
  `);
  shadow.adoptedStyleSheets = [style];

  const labels = {
    flatrate: "Subscription", free: "Free", ads: "With ads", rent: "Rent", buy: "Buy"
  };
  let activeRequest;

  // Use textContent for all selected text and API data.
  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function close() {
    activeRequest = undefined;
    host.remove();
  }

  async function copyTitle(title) {
    // The Clipboard API requires a secure page. Keep a fallback for HTTP pages.
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(title);
        return;
      } catch {
        // Try Chrome's selection-based copy path before showing manual feedback.
      }
    }
    const field = document.createElement("textarea");
    field.value = title;
    field.setAttribute("aria-label", "Title to copy");
    field.style.cssText = "position: fixed; left: -9999px; top: 0";
    shadow.append(field);
    const previousFocus = shadow.activeElement;
    try {
      field.select();
      if (!document.execCommand("copy")) throw new Error("Copy unavailable");
    } finally {
      field.remove();
      previousFocus?.focus();
    }
  }

  function render(message) {
    const card = element("section", "", "card");
    card.setAttribute("aria-label", "Moctale and OTT lookup");
    const header = element("header");
    const dismiss = element("button", "Close", "close");
    dismiss.type = "button";
    dismiss.addEventListener("click", close);
    header.append(element("span", "Moctale & OTT Quick-Lookup"), dismiss);

    const body = element("div");
    body.setAttribute("aria-live", "polite");
    card.append(header, body);
    shadow.replaceChildren(card);
    if (!host.isConnected) document.documentElement.append(host);
    if (message.status === "result") {
      renderResult(body, message.result);
      return;
    }
    body.append(element("h2", message.title), element(
      "p", message.status === "loading" ? "Searching TMDB…" : message.message, "muted"
    ));
  }

  function renderResult(body, result) {
    const hero = element("div", "", "hero");
    if (result.poster) {
      const poster = element("img", "", "poster");
      poster.alt = "";
      poster.referrerPolicy = "no-referrer";
      poster.addEventListener("error", () => poster.remove(), { once: true });
      poster.src = result.poster;
      hero.append(poster);
    }
    const heading = element("div");
    const rating = result.rating === null ? "Unrated" : `TMDB ${result.rating}/10`;
    heading.append(
      element("h2", result.title),
      element("p", [result.kind, result.year || "Year unavailable", rating].join(" · "), "meta")
    );
    hero.append(heading);

    const watch = element("section", "", "watch");
    watch.append(element("h3", "Where to watch in India"));
    for (const group of result.providers) {
      const row = element("p");
      row.append(element("strong", labels[group.type] + " · "), group.names.join(", "));
      watch.append(row);
    }
    if (!result.providers.length) {
      watch.append(element("p", result.providerError
        ? "Availability could not be loaded. Try the lookup again."
        : "TMDB has no India listings for this title.", "muted"));
    }
    const credit = element("p", "Availability data by JustWatch", "credit");
    if (result.watchUrl?.startsWith("https://www.themoviedb.org/")) {
      const link = element("a", "View on TMDB");
      link.href = result.watchUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      credit.append(" · ", link);
    }
    watch.append(credit);

    const open = element("button", "Copy title & open Moctale", "action");
    open.type = "button";
    const feedback = element("p", "", "muted feedback");
    open.addEventListener("click", async () => {
      feedback.textContent = "";
      open.disabled = true;
      try {
        await copyTitle(result.title);
      } catch {
        feedback.textContent = `Copy the title manually: ${result.title}. `;
      }
      try {
        if (!await chrome.runtime.sendMessage({ type: "moctale:open" })) throw new Error();
      } catch {
        feedback.append("Could not open Moctale. Try again.");
      } finally {
        open.disabled = false;
      }
    });
    body.append(hero, element("p", result.overview || "Overview unavailable.", "overview"), watch, open, feedback);
  }

  // Ignore late responses after closing the card or starting another search.
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== "moctale:lookup") return;
    if (message.status === "loading") activeRequest = message.requestId;
    if (message.requestId === activeRequest) render(message);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && host.isConnected) close();
  });
})();
