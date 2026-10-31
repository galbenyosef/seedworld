# SEEDWORLD — offline mirror

Full mirror of **SEEDWORLD** (https://openbench.fun/seedworld/).

Source: https://openbench.fun/seedworld/

![SEEDWORLD](docs/cover.png)

## Stack

- **Single-document HTML5 game** — the entire game ships in one 97,504-byte
  `index.html`: zero external scripts of its own, zero build output, zero
  modules. (Its only external resource references are Google Fonts —
  preconnects + stylesheet — a CDN dependency that stays CDN, PLAN §1 socker
  precedent.)
- **Raw WebGL 1, hand-written** — no engine, no framework, no three.js: the
  renderer draws one full-screen triangle whose fragment shader raymarches the
  planet, and the GLSL sources (VS/COMMON/VIEW_FS/BAKE_FS) live inline as
  template literals. A companion **2D canvas** pass draws the solar-system
  view and the star/nebula background.
- **Everything is procedural** — no image textures, no models, no audio
  files: terrain is stacked 3D noise (fbm + ridged noise + domain warp),
  climate is latitude/altitude fields, clouds/city lights/rings/atmosphere are
  shader terms. A single number (the seed) drives a `mulberry32` PRNG
  throughout, so the same seed always grows the same world.
- **Browser-native exporters** — the "Textures" dialog bakes albedo / height
  (16-bit) / normal / roughness / clouds / emissive / ocean maps on the GPU
  (tiled FBO strips), encodes PNG by hand (zlib via `CompressionStream`) and
  packs a ZIP with a hand-rolled crc32; video capture uses `MediaRecorder`.
  The UI mentions Unity/Blender/Godot only as normal-map-format labels in the
  export dialog's "OpenGL / DirectX" dropdown — **there is no Unity, Godot or
  engine payload here at all**.
- **Openbench platform shell** — the page is a platform page (visit counter,
  "← Openbench" link) but the game itself is fully self-contained.

## What this is

SEEDWORLD (openbench.fun/seedworld/) — "Grow a planet from one number, tune
it, and export it as game-ready texture maps: albedo, height, normal,
roughness, clouds": an interactive procedural planet generator and texture
tool. Type a seed, and a world grows — temperate, ocean, desert, frozen,
exotic, lava or gas giant — that you can rotate, zoom, tune with sliders
(sea level, continents, mountains, warmth, moisture, clouds, atmosphere, sun,
tilt, spin), grow a solar system from the same seed, and export as
equirectangular texture maps (up to 8192×4096) or a video flythrough.

Captured whole (refreshed 2026-10-31): **3 files, 274,220 bytes** — the entry
document (97,504 B, carrying the entire game and stylesheet inline), its
current social card `share-v2.jpg` (116,734 B, 1200×630, referenced by
`og:image` / `twitter:image`), and the previous social card `og.jpg`
(59,982 B, byte-identical to capture, still served at its old path — a
still-served byte is never dropped from the capture just because the new
document stopped referencing it). The full runtime closure was taken from the
browser network log (see below) and re-walked from the new entry document on
refresh; there are no other assets.

The 2026-10-31 refresh changed the entry document's `<head>` only — new
Openbench SEO/social meta (`og:type`, `og:site_name`, `og:image:width/height/
type/alt`, `twitter:*`) and the social card moved from `og.jpg` to
`share-v2.jpg`. The inline game script (74,708 B) and inline stylesheet
(11,232 B) are byte-identical across the refresh (same sha256), so the derived
layers' text is unchanged; only the inline byte ranges moved.

The entry document preserved under `seedworld/` is byte-exact as served to a
plain fetch. Caveat recorded: Cloudflare (the origin's front) injects one
extra `<script src="https://static.cloudflareinsights.com/beacon.min.js/…">`
tag into browser-served responses; a plain fetch receives the pristine
document, and `tools/update.mjs` normalizes the beacon away so a
browser-saved copy can never be misread as drift.

External at runtime (documented gaps, not captured — PLAN §1/§4):

- **Google Fonts** — `fonts.googleapis.com/css2?family=Instrument+Serif…`
  plus 4 `fonts.gstatic.com` `.woff2` files (Instrument Serif ×2, Figtree,
  JetBrains Mono); the page falls back to system fonts offline. A CDN
  dependency that stays CDN — never backfilled (PLAN §1).
- **Openbench platform analytics** — `POST /api/hit?p=seedworld&…` (fire-and-
  forget visit counter) and `GET /api/stats` (returned "40 visits" during
  capture); dynamic POST/GET endpoints, not static files.
- **Cloudflare infra** — the injected insights beacon and `POST /cdn-cgi/rum`.

Genuine 404s (re-probed 2026-10-31, documented gaps): `seedworld/favicon.ico`,
`favicon.ico` (origin root), `seedworld/favicon.svg`,
`seedworld/apple-touch-icon.png`, `seedworld/site.webmanifest`,
`seedworld/manifest.json` — the page declares no icons and has no manifest.

## Layout

- `seedworld/` — the capture, at the origin's own sub-path: serving this repo
  root as site root reproduces `https://openbench.fun/seedworld/` exactly
  (`seedworld/index.html` is the entry; `seedworld/share-v2.jpg` the current
  social card, `seedworld/og.jpg` the previous one, still served upstream)
- `.upstream/manifest.json` — sha256 for every captured file (Gen-A)
- `legacy/2026-10-31/seedworld/index.html` — the pre-refresh capture this
  refresh replaced (rollback path; nothing is deleted without its bytes
  remaining reachable in `legacy/` or history)
- `readable/` — prettified derived layer (pinned prettier 3.9.6): the inline
  game script (`index-inline-1.pretty.js`, 3,409 lines) and the inline
  stylesheet (`index-inline-1.pretty.css`, 793 lines), plus
  `index-inline-map.json` (inline byte ranges + sha256)
- `src/` + `split-spec.json` — 13 statement-aligned slices of the game script
  with the recorded derivation spec
- `tools/derive.mjs` — rebuild `readable/` + `src/` + `split-spec.json`
- `tools/update.mjs` — drift probe against the live origin (`--pull` runs the
  gated refresh)
- `tools/capture.mjs` — byte-exact capture + runtime-closure walk with the
  fail-closed trust gate (`--dry-run`) and the gated refresh (`--apply`)
- `tools/boot.mjs` — offline boot test: drives Chrome over CDP with
  `--host-resolver-rules=MAP * 127.0.0.1`, asserts the render, saves docs/ evidence
- `tools/verify.mjs` — re-hash the capture against the manifest
- `tools/audit.js` — integrity gate for the derived layers (`AUDIT PASS`)
- `tools/vendor/prettier/` — the pinned prettier 3.9.6 renderer, vendored into
  this mirror (module API, all 13 language plugins; provenance and integrity
  hash in `VENDOR-README.md`) so `derive`/`audit` resolve it from this tree and
  never from a sibling mirror's gitignored `node_modules/`
- `docs/cover.png` — cover (gameplay: a ringed exotic world grown in the
  mirror, mid-tune), `docs/boot-2026-10-13.png`, `docs/boot-2026-10-27.png` and
  `docs/boot-2026-10-31-refresh.png` — boot evidence,
  `docs/network-log-2026-10-13.jsonl` — the raw browser network log (the
  runtime closure record)

## Assets

- **models** — none: the planet, rings, moon, star and background galaxies are
  all procedural (no mesh files, no glTF)
- **textures/images** — none in the game: every surface is GLSL. The only
  images in the repo are the two platform social cards — `seedworld/share-v2.jpg`
  (current, 1200×630, referenced by `og:image`/`twitter:image`) and
  `seedworld/og.jpg` (previous card, still served upstream); neither is fetched
  at runtime
- **audio** — none
- **fonts** — none captured: fonts come from the Google Fonts CDN at runtime
  (4 woff2 files — external, documented gap)
- **data** — none: worlds are generated from the seed, nothing is loaded

## Run

Serve this repo root with any static file server that supports directory
indexes (`/seedworld/` → `seedworld/index.html`), then open
`http://localhost:<port>/seedworld/` — the sub-path matters, exactly as on the
origin:

```
npx serve .
```

## Verify

```
node tools/verify.mjs          # re-hash the capture against the manifest
node tools/derive.mjs --check  # committed derived layers match a fresh re-derivation (writes nothing)
node tools/audit.js            # derived-layer integrity gate (AUDIT PASS)
node tools/check-exports.mjs   # public-export-name gate
```

The public-export-name gate reports `0 export table(s) checked` here, and that
is the honest count rather than a blind spot: the whole game is one inline
`<script>` wrapped in a single top-level IIFE, so the script declares **no
`export` statements at all** — there is no public export surface to compare.
The gate still runs, reports no name lost, and would go red if an export table
ever appeared unaccounted for.

## Boot test (2026-10-31, post-refresh build)

- Entry: `http://127.0.0.1:4783/seedworld/` served by `tools/serve.mjs` (repo
  root as site root), in system Chrome driven over CDP by `tools/boot.mjs` with
  `--host-resolver-rules=MAP * 127.0.0.1` and software GL (SwiftShader), so no
  hostname could leave the machine. Session profile:
  `.work/boot/boot-seedworld-refresh` (gitignored), session
  `boot-seedworld-refresh`.
- Outcome: **rendered** — the page booted into a live world ("Ashrae", a frozen
  world; seed 4417) with the full control panel (World / Climate / Sky / Light
  and motion / Space background), seed field, OCEAN 46% / CLOUD 49% / DAY 18 H /
  TILT 13° readouts and a shaded WebGL planet over the starfield.
- Evidence: body 785 chars; main canvas 1262×704 (plus 1 hidden background
  canvas and 7 offscreen bake canvases); `webgl true`; the `#nogl` fallback
  hidden; 0 console errors; 0 failed same-origin static requests; the only
  blocked request is the documented Google Fonts stylesheet
  (`ERR_CONNECTION_REFUSED` under `MAP * 127.0.0.1`); screenshot
  `docs/boot-2026-10-31-refresh.png`.
- Gaps seen: `/api/hit` (platform visit-counter POST) and `/favicon.ico` are the
  documented same-origin 404s, filtered from the static-failure count; the game
  depends on neither.
- Confirms the self-contained claim on the refreshed capture: nothing
  same-origin beyond the entry document was needed to boot and render, and the
  new `share-v2.jpg` card is not fetched at runtime (meta-only, as before).
- Listener killed, port 4783 closed (netstat showed no LISTENING entry), Chrome
  session terminated by the boot harness.

## Boot test (2026-10-27)

- Entry: `http://127.0.0.1:4940/seedworld/` served by `tools/serve.mjs` with the
  network blocked (`MAP * 127.0.0.1`).
- Outcome: **rendered** — the page booted straight into a live world ("Ashrae",
  a frozen planet) with the full control panel, seed field, ocean/cloud/day/tilt
  readouts and a shaded WebGL planet on the starfield.
- Evidence: body 785 chars; canvas 1262×568 (plus 1 hidden background canvas and
  7 offscreen bake canvases); 0 console errors; 2 failed same-origin requests,
  1 blocked cross-origin; screenshot `docs/boot-2026-10-27.png`.
- Gaps seen: `/api/hit` (platform visit-counter POST) 404 and `/favicon.ico` 404
  — both same-origin and documented; the game does not depend on either.
- This confirms the self-contained claim above: nothing same-origin was needed
  to boot and render beyond the entry document. No "playable build absent"
  claim existed to test.

## Updating from upstream

```
node tools/update.mjs                    # read-only drift probe: what changed upstream
node tools/capture.mjs --dry-run         # TRUST GATE: fetch live, compare with the capture, write nothing
node tools/update.mjs --pull --date 2026-10-31 \
     --expect "changed:<rel>,new:<rel>"  # gated refresh (delegates to tools/capture.mjs --apply)
node tools/derive.mjs                    # re-cut readable/ + src/ + split-spec.json on the new capture
node tools/audit.js && node tools/verify.mjs
```

The probe never rewrites the capture — a mirror is a point-in-time snapshot.
A refresh goes through this mirror's own `tools/capture.mjs`, whose trust gate
passes only when the live origin reproduces every still-served captured file
byte-for-byte (and every fetch is byte-stable on a second request); only then
does `--apply` write: the bytes it replaces or drops are archived under
`legacy/<date>/` first, the runtime closure is re-walked from the new entry
document (including URLs that live only in `<meta content>`), the manifest is
re-cut, upstream-gone files (404 again) are removed and recorded, and every
written file is re-hashed on disk. `/api/*` endpoints and cross-origin refs
are recorded but never captured or vendored.

### 2026-10-31 refresh record

- Drift: `tools/update.mjs` → `DRIFT: 1 changed, 0 live-missing (of 2 captured)`
  — `seedworld/index.html` (96,705 B → 97,504 B) changed in its `<head>`
  social/SEO meta only. Diff reviewed: new `og:type`, `og:site_name`,
  `og:image:width/height/type/alt`, `twitter:*` tags and `og:image` moved from
  `og.jpg` to the new `share-v2.jpg`; `<title>`, description, game script and
  inline stylesheet bytes unchanged (script `1c7ace58…`, style `3615c6e7…`).
- Trust gate (`node tools/capture.mjs --dry-run`, before any write): **PASS** —
  `1 identical, 1 changed, 0 upstream-gone, 1 new (of 2 captured)`.
  `seedworld/og.jpg` was reproduced byte-for-byte (`297c7fcd…`) and its disk
  copy re-hashed identically; the entry is the reviewed drift; every fetch
  (including the new card) was byte-stable across two requests, and the new
  card's sha (`26d3bc1f…`) matched an independent `curl` fetch. A first gate
  run exposed a bug (absolute same-origin `<meta content>` URLs were not
  resolved to a path, so `share-v2.jpg` was silently missed); the tool was
  fixed, not the expectation, and the gate re-run.
- Refresh: `--apply --date 2026-10-31
  --expect "changed:seedworld/index.html,new:seedworld/share-v2.jpg"` — wrote 3
  files, archived the replaced entry to `legacy/2026-10-31/seedworld/index.html`
  (sha `ccf347cd…`), removed 0 upstream-gone (`og.jpg` is still served, so it
  stays in the capture), post-write verification PASS (3/3 re-hashed).
- Upstream-gone: none. Upstream 404s recorded, not invented: `favicon.ico`,
  `favicon.svg`, `apple-touch-icon.png`, `site.webmanifest`, `manifest.json`
  (this page declares none), plus generated-filename string literals the game
  code mentions (`video.mp4`, `video.webm`, `-view.png`, `README.txt`,
  `info.json`) — all 404, none captured.
- Derive (re-cut from the new capture): `readable/` pretties and all 13 `src/`
  slices are textually unchanged (the script bytes did not move); the inline
  byte ranges moved (style 1127-12359 → 1926-13158, script 21971-96679 →
  22770-97478) and `split-spec.json` gained `share-v2.jpg` as a second
  `notRendered` payload. `derive --check` reports a fresh re-derivation matches
  exactly.
- Gates (2026-10-31): `node tools/verify.mjs` → `3 files checked, 0 problems`;
  `node tools/derive.mjs --check` → `the committed derived layers match a fresh
  re-derivation exactly (nothing written)`; `node tools/audit.js` → `AUDIT
  PASS` (13/13 round-trips, 2/2 pretties re-render byte-exact, 2 inline blocks
  with byte-range twins, 4/4 skipped sections re-verified);
  `node tools/check-exports.mjs` → `0 export table(s) checked`, `no public
  export name lost`; `node tools/update.mjs` → `up to date: 3 captured files
  identical upstream`.
- No `/api/*` captured, no vendor-CDN file vendored (Google Fonts stays CDN).

### 2026-10-13 derivation note

Both derived layers are in place, cut from the recorded capture (capture bytes
untouched — `node tools/verify.mjs` re-hashes both files):

- `readable/` — pinned prettier 3.9.6 (module API, default options, single
  pass verified idempotent — never the CLI, it respects `.gitignore` and can
  silently echo its input), vendored in this mirror at `tools/vendor/prettier`
  and resolved from there, rendered the entry's **inline `<script>`** to
  `readable/index-inline-1.pretty.js` (3,409 lines) and its **inline
  `<style>`** to `readable/index-inline-1.pretty.css` (793 lines); both
  pretties are provably not a byte copy of their capture source and re-render
  byte-exact under the pinned version. Twin names follow the fleet convention:
  capture-root-relative with the `seedworld/` prefix stripped, nested dirs
  flattened with `__` (`index-inline-1…`).
- `src/` — 13 statement-aligned slices (`src/index-inline-1-NN.js`, exact
  2-line provenance header) of the game script, sliced one level deeper than
  usual: the script is a **single top-level IIFE**, so slices cut at the
  **IIFE body's** top-level statement boundaries (recorded as
  `slicingContext` in `split-spec.json`). 13/13 parse standalone
  (`node --input-type=module --check -`) and round-trip byte-exact to their
  readable line ranges. Windows target ~250-350 lines; the giant GLSL shader
  constants stay whole, so most windows land at 261-350 lines with three
  smaller residue windows (9/13/150 lines) where an oversized shader
  declaration closed the preceding window. 4 sections
  are indexed, never sliced, because they cannot stand alone: the IIFE wrapper
  head (`(function () {` + the `"use strict";` directive prologue) and tail
  (`})();`), and the two early-return guards (`if (!gl) {…return;}`,
  `if (!prog) {…return;}`).
- **Not minified** — the entry script is authored source: identifiers are the
  game's own names (`$`, `P`, `W`, `S`, `CLASSES`, `material()`, …), so the
  identifier-rename campaign (PLAN §5) does not apply to this mirror; that is
  recorded here rather than silently skipped.
- Non-code payload rule — `seedworld/og.jpg` is recorded in split-spec
  `notRendered` with size + sha256, no render pass.
- §0.4 fork-over-mirror checked 2026-10-13: openbench.fun publishes
  deployments, not sources, and no public upstream repo exists for Seedworld
  (the platform's own site has no source links; a GitHub search finds only
  this mirror), so the mirror stands.
- Network-log-led closure: the runtime graph was recorded from a full browser
  session (`network --all --follow`) through load and gameplay — the complete
  first-party closure is the entry document plus `og.jpg`; everything else the
  page touches is CDN/platform infra listed above. A static scan of the
  captured HTML (script/link refs, `fetch(`/`new URL`/`import(`, path
  literals) confirms it: the only URL literals in the game code are the OG
  meta, the Google Fonts link and the two platform endpoints.
- Derivation-day gates (2026-10-13): `node tools/verify.mjs` → `2 files
  checked, 0 problems`; `node tools/update.mjs` → `up to date: 2 captured
  files identical upstream` (at capture time; the probe is read-only and a
  later upstream change is drift, never a rewrite of the snapshot);
  `node tools/audit.js` → `AUDIT PASS` (13/13 round-trips, 2/2 pretties
  re-render byte-exact, 2 inline blocks with byte-range twins, 4/4 skipped
  wrapper/guard sections re-verified, capture manifest free of derived
  layers); serve probe — repo root served on loopback, `/seedworld/` and
  `/seedworld/og.jpg` over HTTP 200 with capture-identical sizes, gameplay
  verified in-browser (New world → new seed; Solar system → 6 planets; Textures
  → 6 maps baked live), listener killed, port closed (netstat). Rebuild with
  `node tools/derive.mjs`.
- Re-check (2026-10-27): `node tools/verify.mjs` → `2 files checked, 0
  problems`; `node tools/derive.mjs --check` → `the committed derived layers
  match a fresh re-derivation exactly (nothing written)`; `node tools/audit.js`
  → `AUDIT PASS`; `node tools/check-exports.mjs` → `0 export table(s) checked`,
  `no public export name lost`; `node tools/update.mjs` → `DRIFT: 1 changed,
  0 live-missing (of 2 captured)` — `seedworld/index.html` has changed upstream
  since capture; the snapshot is left untouched (a mirror is point-in-time).

## Mirror conventions

- **Capture layer** — the captured files are byte-exact copies of what the
  origin served; nothing in them is edited.
- **Readable layer** — `readable/` is derived (prettified) and never shipped
  to a browser; it exists so the game script can actually be read.
- **Provenance** — `.upstream/manifest.json` records sha256 for each captured
  artifact, and `tools/verify.mjs` re-checks it.
- **Drift** — `tools/update.mjs` is read-only by default: it reports what
  changed upstream and never rewrites the capture. `--pull` delegates to
  `tools/capture.mjs --apply`, which writes only after its trust gate has
  reproduced every still-served captured file byte-for-byte, and archives the
  bytes it replaces or drops under `legacy/<date>/` first.

## Fleet status

<!-- mirror-status:start — feeds _standard/REPO-INDEX.md. Update ONLY your own mirror's block; never edit the shared index (PLAN §8). Rebuild: node _standard/build-index.mjs -->
<!-- cols: cls=classification · ver=verify 0 problems · upd=drift probe · man=manifest · rdbl=readable re-derived · src=reversed src · boot=boot test · top=offline-mirror topic · tag=backup tag · staged=staged not committed -->
| # | repo | cls | ver | upd | man | rdbl | src | boot | top | tag | staged |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 307 | seedworld | mirror | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
<!-- mirror-status:end -->
