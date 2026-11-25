const MENU_ID = "moctale-lookup";
const TMDB_API = "https://api.themoviedb.org/3";

// Keep the credential available only to extension pages and this worker.
const storageReady = chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Search OTT & Moctale for '%s'",
    contexts: ["selection"],
    documentUrlPatterns: ["http://*/*", "https://*/*"]
  }, () => {
    if (chrome.runtime.lastError) console.warn(chrome.runtime.lastError.message);
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID || tab?.id == null) return;
  const title = info.selectionText?.trim().replace(/\s+/g, " ");
  if (title) runLookup(tab.id, title).catch(() => {
    console.warn("Moctale could not display the lookup. The tab may have navigated or blocked injection.");
  });
});

// Open only the fixed Moctale destination, never a URL supplied by the page.
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type !== "moctale:open" || sender.id !== chrome.runtime.id || !sender.tab) return;
  chrome.tabs.create({ url: "https://www.moctale.in/" }).then(
    () => respond(true), () => respond(false)
  );
  return true;
});

async function runLookup(tabId, title) {
  // Inject into the top frame. Bind later messages to this exact document.
  const [{ documentId }] = await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"]
  });
  const requestId = crypto.randomUUID();
  const send = (state) => chrome.tabs.sendMessage(
    tabId, { type: "moctale:lookup", requestId, ...state }, { documentId }
  );
  await send({ status: "loading", title });

  let state;
  try {
    await storageReady;
    const { tmdbKey } = await chrome.storage.local.get("tmdbKey");
    if (!tmdbKey) throw new Error("Open the extension popup and save your TMDB API key first.");
    if (title.length > 200) throw new Error("Select just the title (up to 200 characters) and try again.");
    state = { status: "result", result: await lookupTitle(title, tmdbKey) };
  } catch (error) {
    state = { status: "error", title, message: error.message };
  }
  await send(state);
}

async function tmdb(path, key, params = {}) {
  const url = new URL(TMDB_API + path);
  url.search = new URLSearchParams({ ...params, api_key: key }).toString();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if ([401, 403].includes(response.status)) {
      throw new Error("TMDB rejected the key. Save your v3 API key in the extension popup.");
    }
    if (response.status === 429) throw new Error("TMDB is rate limiting requests. Try again in a minute.");
    if (!response.ok) throw new Error(`TMDB returned HTTP ${response.status}. Try again shortly.`);
    return await response.json();
  } catch (error) {
    // Avoid surfacing raw fetch errors that could contain the credential URL.
    if (error.name === "TimeoutError") throw new Error("TMDB took too long to respond. Try again.");
    if (error instanceof TypeError || error instanceof SyntaxError) {
      throw new Error("Could not read TMDB’s response. Check your connection and try again.");
    }
    throw error;
  }
}

async function lookupTitle(query, key) {
  const search = await tmdb("/search/multi", key, { query, include_adult: "false" });
  const matches = (search.results ?? []).filter(({ media_type }) => ["movie", "tv"].includes(media_type));
  const nameOf = (item) => item.title || item.name;
  // Prefer an exact title, keeping TMDB's ranking when multiple results tie.
  const match = matches.find((item) => nameOf(item)?.toLowerCase() === query.toLowerCase()) ?? matches[0];
  if (!match) throw new Error("No movie or TV show found. Try highlighting just the title.");

  let india = null;
  let providerError = false;
  try {
    const providers = await tmdb(`/${match.media_type}/${match.id}/watch/providers`, key);
    india = providers.results?.IN ?? null;
  } catch {
    // Keep the title details visible even if the availability request fails.
    providerError = true;
  }

  return {
    title: nameOf(match),
    kind: match.media_type === "movie" ? "Movie" : "TV show",
    year: (match.release_date || match.first_air_date || "").slice(0, 4),
    rating: match.vote_count > 0 ? match.vote_average.toFixed(1) : null,
    overview: match.overview,
    poster: match.poster_path ? `https://image.tmdb.org/t/p/w342${match.poster_path}` : null,
    providers: ["flatrate", "free", "ads", "rent", "buy"].map((type) => ({
      type,
      names: [...new Set((india?.[type] ?? []).map((item) => item.provider_name))]
    })).filter(({ names }) => names.length),
    providerError,
    watchUrl: india?.link ?? null
  };
}
