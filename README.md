# Moctale & OTT Quick-Lookup

A build-free Manifest V3 Chrome extension. Select a movie or TV title on a webpage to see TMDB details and Indian streaming, rental, and purchase listings.

## How it works

1. `manifest.json` registers the service worker and toolbar popup. Chrome's `activeTab` grant lets the extension inject its card when the user chooses the selection menu.
2. `popup.html` loads the settings UI. `popup.js` saves the user's TMDB v3 API key to `chrome.storage.local`. The worker reads the same storage, and restricts access to trusted extension contexts.
3. `background.js` creates the selection menu on installation. On click, it injects `content.js`, sends a loading message, searches TMDB for a movie or TV match, and calls that title's watch-providers endpoint. It reads the `IN` entry and sends the result to the same document using `chrome.tabs.sendMessage`.
4. `content.js` renders the response inside a Shadow DOM root. The Moctale action copies the matched title and asks the worker to open Moctale in a new tab. Paste the title into Moctale's search field. This handoff works with Moctale's homepage and does not depend on an undocumented search URL.

## Source files

```text
Moctale/
├── manifest.json    Chrome permissions and entry points
├── background.js    Selection menu, TMDB calls, and tab messaging
├── content.js       Shadow DOM card and Moctale handoff
├── popup.html       Settings form and attribution
├── popup.css        Popup styling
├── popup.js         Key validation, storage, and removal
├── tmdb-logo.svg    Official TMDB attribution asset
└── README.md        Setup, testing, and troubleshooting
```

## Load in Chrome

1. Sign in to TMDB and request a developer key from [TMDB API settings](https://www.themoviedb.org/settings/api). Copy the **API Key**, the 32-character v3 credential.
2. Open `chrome://extensions`, switch on **Developer mode**, then click **Load unpacked** and select the folder containing `manifest.json`.
3. Open **Moctale & OTT Quick-Lookup** from Chrome's Extensions toolbar menu. Paste the key and click **Save key**.
4. Open a regular HTTPS webpage with selectable text, such as IMDb. Highlight just **Inception**, right-click, and choose **Search OTT & Moctale for 'Inception'**.
5. Check for the poster, year, rating, overview, and India availability. Try **Breaking Bad** to exercise the TV branch. Availability changes over time, so check the category labels and allow for empty listings.
6. Click **Copy title & open Moctale** and paste the copied title in Moctale's search field. Use **Close** or **Esc** to dismiss the overlay. Run a lookup after removing the key to exercise the setup error.

## Debug common errors

| Symptom | What to check |
| --- | --- |
| Chrome won't load the extension | Select the folder that contains `manifest.json`. Chrome reports manifest errors on the Extensions page. |
| The context menu is missing | Select actual text on a regular HTTP(S) webpage. Chrome restricts extension injection on pages such as `chrome://extensions` and the Chrome Web Store. Reload the extension and refresh the webpage after changing files. |
| The card never appears | On `chrome://extensions`, open the extension's **Service worker** inspector for injection or message errors. Use the webpage's DevTools for rendering errors. If the tab navigates mid-search, rerun the lookup in the new document. |
| TMDB rejects the key | Use the v3 **API Key** from TMDB's settings. The **API Read Access Token** is a different credential. **Save key** validates the format locally. A lookup verifies it with TMDB. |
| Wrong movie or show | Highlight the full title. The lookup prefers an exact title on TMDB's first page and uses TMDB's ranking to break ties. Check the year and media type on the card. |
| Missing poster or India listings | TMDB may lack an image or regional listing. A site's image policy may also block the TMDB CDN. The card keeps the text visible if the image fails and distinguishes missing provider listings from a failed provider request. |
| The popup will not save | Right-click inside the popup and choose **Inspect** to check its console. Reopen the popup after reloading the extension. |

TMDB's watch-provider data is powered by JustWatch. The card links to TMDB's provider page when the API supplies a link. [Movie providers](https://developer.themoviedb.org/reference/movie-watch-providers) · [TV providers](https://developer.themoviedb.org/reference/tv-series-watch-providers) · [TMDB credits and logo](https://www.themoviedb.org/about/logos-attribution)
