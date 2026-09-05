# Browser storage and local developer output

`ra2-sw.js` is application source: the build emits it explicitly. Vite's normal public-directory copying is disabled so original game data never enters a hosted build.

When complete originals are already present here, the loopback-only local preview reads them directly and opens the lobby. Otherwise, the first-run flow downloads original resources directly from Internet Archive after the player's consent, converts them in a Web Worker, and saves them in browser CacheStorage. The service worker answers `/assets/` and `/maps/` requests from that storage; on a deployed site it does not fetch originals from the application host. On localhost it first accepts files marked by the local preview middleware.

The `assets/` and `maps/` directories that may exist here are optional output from the offline developer command `npm run assets:setup`. Their original images, audio, maps, palettes and derived metadata are ignored by Git and excluded from builds. They are not automatically imported into browser storage. Do not force-add them or include them in source releases.
