# Original Red Alert 2 asset conversion

The TypeScript game uses the same project-owned format decoders in two environments: Pyodide in a browser worker for players, and native Python for optional developer tooling. Both extract data; neither executes the Windows installer or game.

## Original source

- [Internet Archive item](https://archive.org/details/red-alert-2-multiplayer)
- [Canonical XWIS original installer](https://archive.org/download/red-alert-2-multiplayer/Red-Alert-2-Multiplayer.exe)
- [Internet Archive browser CORS endpoint](https://cors.archive.org/cors/red-alert-2-multiplayer/Red-Alert-2-Multiplayer.exe)
- Size: 206,530,229 bytes; SHA-256: `5388c54d7d7b73060083563ff1926bca0d2663a76678b807e23e9a8d491441ce`
- Original game content: Westwood Studios / Electronic Arts, 2000.

The installer, extracted originals and all converted media/maps are excluded from Git and static builds. No existing implementation on the user's computer or at `github.com/xinbenlv` was read or used.

## Browser preparation

The first-run page asks for explicit permission to download and store originals. Once accepted:

1. A module Web Worker downloads the original installer directly from Internet Archive's own CORS endpoint, streams it into browser CacheStorage and verifies SHA-256. No application endpoint or proxy handles those bytes.
2. `7z-wasm` mounts the downloaded Blob with WORKERFS and reads the NSIS archive. Only the required MIX data archives are extracted.
3. Pyodide 0.29.4 loads Pillow, PyCryptodome and audioop-lts. This runtime and its packages come from the Pyodide CDN; they contain conversion tools, not RA2 assets. The project's Python converter source is part of the application bundle.
4. The worker decodes nested MIX directories and original INI/CSF data, exports maps and TMP metadata, and converts SHP/VXL/sidebar/scenery/terrain artwork to PNG. Browser audio is decoded to PCM WAV, so native FFmpeg is not needed.
5. Original PreviewPack pixels are encoded into PNG with OffscreenCanvas. Generated files and a final readiness marker are written to CacheStorage. The worker verifies that every listed output is present before marking preparation complete.
6. The service worker serves `/assets/` and `/maps/` from browser storage, and the lobby opens automatically. The downloaded installer remains cached for local retries or reconstruction. Production application files are cached separately for offline revisits.

Service Worker storage requires HTTPS or localhost. Clearing the site's browser data removes the installation. Conversion runs in a worker and can require substantial temporary memory; using WORKERFS avoids duplicating the complete downloaded installer in the 7-Zip virtual filesystem. The current IA CORS endpoint returns a full `200` stream even when a Range header is supplied, so byte-range download resumption is not assumed.

`src/browser-storage.ts`, `src/asset-worker.ts`, `src/asset-setup.ts` and `public/ra2-sw.js` implement this flow. Browser files do not become project filesystem files, and deployed builds never serve original media. The loopback-only preview can read existing developer extracts in `public/` directly, bypassing browser preparation. Set `RA2_LOCAL_ASSETS=0` to test browser-only setup.

## Optional native developer pipeline

These commands are for conversion development and original-map integration tests, not the player setup flow:

```sh
npm ci
npm run assets:setup
npm run assets:check
```

Requires Python 3.10+, native 7-Zip (`7zz` or `7z`) and FFmpeg with MP3 support. Python dependencies are pinned and installed in a cache-local virtual environment. `scripts/setup-assets.ts` downloads and verifies the same installer, extracts nested archives and runs the complete converter pipeline.

The default cache is `.cache/ra2-assets/`; output is `public/assets/` and `public/maps/`. `RA2_ASSET_CACHE` and `RA2_PUBLIC_DIR` override these locations for isolated verification. `--force` reconstructs assets; `--check` validates without downloading. Conversion occurs in staging, referenced files are checked, and `assets/ready.json` is published last. All output is ignored by Git and excluded from production builds.

## Browser archive feasibility probe

With dependencies installed, this optional probe uses Playwright Chromium. Supply a locally downloaded copy of the original installer; it creates a temporary static test server and emits no original files:

```sh
npx playwright install chromium
node scripts/probe-browser-archive.mjs /path/to/Red-Alert-2-Multiplayer.exe
```

The probe checks real browser CORS behavior with a canceled download stream and extracts four MIX archives inside a module Worker using WebAssembly. The extraction fixture is served locally solely to avoid downloading the entire archive again during this component test. It does not prove the entire browser conversion or consent flow; those need their own end-to-end verification.

## Runtime attribution

[7z-wasm 1.2.0](https://github.com/use-strict/7z-wasm) packages 7-Zip by Igor Pavlov for browser and Node runtimes. Its JavaScript/WASM uses GNU LGPL 2.1-or-later plus the unRAR restriction; see [License.txt](https://github.com/use-strict/7z-wasm/blob/master/License.txt) and [unRarLicense.txt](https://github.com/use-strict/7z-wasm/blob/master/unRarLicense.txt). The package includes upstream source and build references. [Pyodide](https://pyodide.org/) and its loaded packages retain their respective licenses.

## Export schema

The generated `/assets/manifest.json` lists `sprites`, `cameos`, `ui`, `sounds`, and `music`. Each graphic includes its original filename. Sprite entries include:

```ts
interface OriginalSprite {
  src: string;
  width: number;
  height: number;
  frameWidth: number;
  frameHeight: number;
  frames: number;
  columns: number;
  anchorX: number;
  anchorY: number;
  remapMaskSrc?: string;
  foundation?: [number, number];
  facings?: number;
  sequences?: Record<string, number[]>;
  originalFile: string;
}
```

- Frame `i` starts at `(i % columns * frameWidth, floor(i / columns) * frameHeight)`.
- Anchors are pixel coordinates of the ground/footprint center within each frame.
- `-snow` suffixes select original snow theater structure graphics.
- SHP palettes remain in their original colors. Palette indices 16–31 become the optional grayscale-alpha house-color mask. Shadow frames are composited below their original graphic.
- Infantry sequences preserve the original art.ini `[start, count, facingStride]` values. All gameplay frames, including walking, firing, crawling, and deployment where present, are included.
- Buildings include original idle/active machinery and closed roof layers. Their footprints come directly from original art.ini.
- VXL atlases contain 32 facings, starting with model +X pointing screen southeast, rotating counterclockwise in world XY as frame index increases. The converter preserves original voxel geometry, palette, and HVA transforms; lighting approximates the original engine using voxel surfaces.
- Sound/music entries have `{src, originalFile, text?}`. EVA keys use `allied_` and `soviet_` plus original event names in lowercase. Other sound keys retain original BAG identifiers. `soundEvents` maps original sound.ini event names to their clip IDs, and `unitVoices` maps original rules.ini unit IDs to selection/movement/attack events. The full original BAG is converted. Music includes `hm2`, `grinder`, and `industro`.

## Format references

- MIX directory layout and RSA public modulus: https://github.com/OpenRA/OpenRA/blob/bleed/OpenRA.Mods.Cnc/FileSystem/MixFile.cs and the associated `BlowfishKeyProvider.cs` (format reference; no game/simulation code imported).
- SHP TS format: https://moddingwiki.shikadi.net/wiki/Westwood_SHP_Format_(TS)
- VXL/HVA binary structure: https://github.com/sh4faq/Red-Alert-2--Modding-Guide/blob/master/01-VXL-HVA-Format.md
- Audio IDX/BAG structure: https://ppmforums.com/topic-46489/audioidxbag-format/

## Original developer-pipeline validation

- Every playable unit/building definition resolves to an original sprite and cameo.
- Every manifest image/audio path exists.
- Construction yard, snow factory, original menu map, loading artwork, and 32-facing Grizzly tank atlas inspected visually.
- Native CLI audio conversions completed successfully; FFprobe verified the construction-complete voice and Hell March 2 track. The browser pipeline emits PCM WAV instead of MP3; its current verification status is recorded in `docs/verification.md`.

The main `overlays` collection contains original resources, bridges, walls and tree art for each theater. Numeric aliases such as `snow:102` use the native map overlay ID. Preserve `overlayFrame` when drawing bridge segments: frames 0 and 2 can deliberately be blank. Ore/gems use original resource palettes (`snow.pal`, `temperat.pal`, `urban.pal`); trees/bridges use isometric palettes.

Original sidebar pieces use `sidec01-*` (Allied blue/silver) and `sidec02-*` (Soviet gold/silver). The menu contour map is `ui.mnscrnl`; the original Kirov loading artwork is `ui.glsl`. Other legacy PCX files in the original distribution include Tiberian Sun leftovers and are not suitable substitutes for RA2 menu art.
