# Verification record

The project was developed independently in this workspace. No existing Red Alert 2 implementation on the user's computer or at `github.com/xinbenlv` was consulted.

## Browser-only end-to-end acceptance

On 2026-09-04, `scripts/browser_setup.py` passed against the production preview using a fresh persistent Chromium profile:

- The consent page appeared, with zero Internet Archive requests before selecting **Agree & download**.
- The browser downloaded the full 207 MB original installer directly from `cors.archive.org`, verified SHA-256, extracted it with 7-Zip WASM, and completed all Pyodide conversion stages.
- Original PNG graphics, PCM WAV audio and native map data were stored in browser CacheStorage. The app automatically entered the lobby with 130 sprite entries and no failed image loads.
- A normal reload reused the installation without another Internet Archive request.
- With the browser set offline, a reload still reached the lobby; Arctic Circle started and the MCV deployed. No browser JavaScript errors were recorded.
- The integrated source test suite passed 38/38, including locale, browser-cache integrity and publication checks. The full build was approximately 2 MB and contained no original `assets/` or `maps/` trees.

A subsequent `scripts/browser_locale_audit.mjs` run verified English in the lobby, controls, battle HUD and pause screen; Chinese persisted across reloads, and live switching preserved the current match. Removing cached music returned to the consent prompt without downloading; restoring it and checking the cache recovered the game. The final laptop layout was checked at 1366×768.

A source-only checkout also built successfully and ran 32 tests, with the six native-map integration tests explicitly skipped because originals were absent.

Reproduce the browser-only test with `RA2_LOCAL_ASSETS=0 npm run preview` running (local originals are otherwise preferred). Use a new profile directory to include first-run consent and a real download; a reused profile tests the cached path:

```sh
RA2_BROWSER_URL=http://127.0.0.1:4173 \
RA2_BROWSER_PROFILE=.cache/browser-acceptance-fresh \
uv run --with playwright python scripts/browser_setup.py
```

The acceptance profile and screenshots remain in ignored `.cache/` storage. This run verifies Chromium on the tested desktop; other browsers and storage limits were not established by that run.

## Browser archive component evidence

Verified on 2026-09-04 using `scripts/probe-browser-archive.mjs` in real Chromium:

- A cross-origin browser fetch of the canonical `archive.org/download` installer URL failed because the response lacked CORS headers.
- Internet Archive's own `cors.archive.org/cors` URL succeeded with a readable CORS response, a 206,530,229-byte content length and the expected MZ header. The probe canceled the response after its first chunk; it did not redownload the complete installer.
- A Range request received a complete `200` stream rather than `206`. The browser installer therefore uses full streaming download.
- The exact existing original installer was separately served as a static local fixture. `7z-wasm` extracted it entirely inside a browser module Worker using a Blob mounted with WORKERFS, without native 7-Zip or running the EXE. It identified NSIS/LZMA and returned success in approximately 7.1 seconds.
- Extracted files: `language.mix` 53,116,040 bytes; `multi.mix` 25,856,283 bytes; `ra2.mix` 281,895,456 bytes; `theme.mix` 76,862,662 bytes. No extracted files were written back to the host filesystem by this probe.

These component checks isolate CORS and extraction behavior; the separate acceptance test above covers full preparation, consent and offline gameplay.

## Earlier gameplay and native-converter baseline

The following results were measured on 2026-09-04 before the browser-only preparation architecture replaced local file serving:

- TypeScript checking and the Vite production build passed; the original suite had 31 passing tests and no failures.
- The original map catalog contained 83 entries and 112 native map files: 79 ordinary maps, two playable MegaWealth maps and two annotated unfinished variants. All 335 playable starting positions could deploy an MCV and establish a base using real neutral-building footprints.
- Every ordinary start had an A* path to native resources; the farthest nearest resource was 34 cardinal cells away. MegaWealth maps retained their 68 original oil derricks.
- The native resource export contained 130 unit/building/effect atlases, 8,434 terrain frames and 497 scenery sprites. Referenced sprites, remap masks, direction/animation frames and audio paths were checked.
- `scripts/browser_smoke.py` covered nine countries, eight seats, Arctic Circle, MCV deployment and production.
- `scripts/browser_flow.py` used actual mouse input to place a power plant, refinery, barracks and war factory, produce infantry/tanks and move a selected tank. Pause, surrender, results and return to the lobby passed.
- `scripts/browser_final.py` covered Soviet deployment, native neutral buildings, engineer capture of an oil derrick and a $1,000 income increase, Escape from results, and layouts at 1440/1024/760 pixels. The measured gameplay session had no browser JavaScript errors or external network requests; first-run preparation now intentionally requires external downloads.
- The native installer pipeline subsequently rebuilt 3,043 output files, with generated images matching the existing export pixel for pixel. Browser PCM WAV audio uses a different output format from native MP3 exports.

The Python browser scripts open fresh browser profiles and predate browser storage installation. Their historical results remain useful as a gameplay baseline; they must be paired with browser-cache setup before being used as end-to-end tests of the current site.

Local screenshots contain original artwork and are excluded from Git: `docs/screenshots/lobby.png`, `arctic-circle.png` and `oil-capture.png`. They are not available in fresh clones.

## Publication boundary

The source no longer imports extracted original JSON at build time. Both Git originals and native developer output are excluded; Vite's normal public-directory copying is disabled even if originals already exist locally. The publication checker rejects raw originals, generated material in reserved resource directories, caches and screenshots.

CI runs the source tests without originals. Before building, it creates synthetic files in the ignored original-resource directories, then checks that none of those directories or known original file types appears in `dist/`. This verifies the build boundary with local resource files present, rather than assuming a clean filesystem is sufficient.

These checks do not establish frame-for-frame compatibility with the Westwood engine. Gameplay simplifications and unsupported mechanisms are documented in the main README.

## Restored local startup

The local preview now prefers the complete original files already extracted into the project. Both a fresh Chromium profile (without a service worker) and the earlier browser-cache profile (with its existing worker) reached the lobby, loaded native MP3 audio and all images without failures, and deployed on Arctic Circle. Neither test contacted Internet Archive or downloaded conversion tools. Existing browser data was preserved. The integrated 38-test suite and production asset-exclusion check passed.
