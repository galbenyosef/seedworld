#!/usr/bin/env node
// boot.mjs — deterministic offline boot test for the seedworld mirror.
//
// Launches the system Chrome with the fleet's offline harness flags:
//   --host-resolver-rules="MAP * 127.0.0.1"  (every host — the live origin and
//       fonts.googleapis.com / fonts.gstatic.com — resolves to loopback, so the
//       boot can only use files that are actually in the mirror)
//   --user-data-dir=.work/boot/boot-seedworld-refresh  (a fresh profile is the
//       boot "session"; it lives in the gitignored .work/ tree)
// then drives the page over the DevTools protocol: navigate to the local
// static server, wait for a sized WebGL canvas, assert the game rendered (the
// #nogl fallback hidden, the control panel and seed readouts present), collect
// console errors and failed same-origin requests, and save a screenshot.
//
// usage: node tools/boot.mjs --url http://127.0.0.1:4783/seedworld/ \
//          --out docs/boot-2026-10-31-refresh.png [--session boot-seedworld-refresh]
//
// The CDP client is ~60 lines of plain WebSocket (Node's global WebSocket); no
// Playwright/puppeteer dependency is vendored into the mirror.

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const proj = path.resolve(here, "..");

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const URL_TO_OPEN = arg("--url", "http://127.0.0.1:4783/seedworld/");
const OUT = path.resolve(proj, arg("--out", "docs/boot-2026-10-31-refresh.png"));
const SESSION = arg("--session", "boot-seedworld-refresh");
const PORT = Number(arg("--port", "4784"));
const PROFILE = path.join(proj, ".work", "boot", SESSION);

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
].filter(Boolean);
const chrome = CHROME_CANDIDATES.find((p) => fs.existsSync(p));
if (!chrome) {
  console.error("boot: no Chrome/Edge executable found (set CHROME_PATH)");
  process.exit(2);
}

fs.rmSync(PROFILE, { recursive: true, force: true });
fs.mkdirSync(PROFILE, { recursive: true });

const args = [
  "--headless=new",
  "--remote-debugging-port=" + PORT,
  "--user-data-dir=" + PROFILE,
  "--host-resolver-rules=MAP * 127.0.0.1",
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-background-networking",
  "--disable-component-update",
  "--disable-sync",
  "--metrics-recording-only",
  "--mute-audio",
  "--enable-unsafe-swiftshader",
  "--use-angle=swiftshader",
  "--window-size=1280,800",
  "about:blank",
];
const child = spawn(chrome, args, { stdio: ["ignore", "ignore", "pipe"] });
let chromeErr = "";
child.stderr.on("data", (d) => (chromeErr += d.toString()));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function debuggerUrl() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (r.ok) return (await r.json()).webSocketDebuggerUrl;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error("chrome DevTools endpoint never came up\n" + chromeErr.slice(0, 2000));
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Set();
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      } else if (msg.method) {
        for (const fn of this.listeners) fn(msg);
      }
    });
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
  on(fn) {
    this.listeners.add(fn);
  }
}

async function main() {
  const wsUrl = await debuggerUrl();
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => {
    ws.addEventListener("open", res, { once: true });
    ws.addEventListener("error", rej, { once: true });
  });
  const cdp = new CDP(ws);

  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  const send = (m, p) => cdp.send(m, p, sessionId);

  const consoleErrors = [];
  const networkConsole = [];
  const failedRequests = [];
  const sameOriginFailures = [];
  const requestUrls = new Map();
  cdp.on((msg) => {
    if (msg.sessionId !== sessionId) return;
    if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") {
      const t = msg.params.entry.text;
      // "Failed to load resource: …" is the browser's network line, not a page
      // error: seedworld's are the Google Fonts stylesheet (blocked by MAP *)
      // and the documented live /api/* + /favicon.ico probes. Keep them separate.
      if (/Failed to load resource/i.test(t)) networkConsole.push(t);
      else consoleErrors.push(t);
    }
    if (msg.method === "Runtime.exceptionThrown")
      consoleErrors.push(msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text || "exception");
    if (msg.method === "Network.requestWillBeSent") requestUrls.set(msg.params.requestId, msg.params.request.url);
    if (msg.method === "Network.responseReceived") {
      const { url, status } = msg.params.response;
      if (status >= 400 && url.startsWith(URL_TO_OPEN.replace(/\/$/, "")) && !/\/api\//.test(url))
        sameOriginFailures.push(`${status} ${url}`);
    }
    if (msg.method === "Network.loadingFailed") {
      const url = requestUrls.get(msg.params.requestId) || "";
      if (/ERR_ABORTED/.test(msg.params.errorText || "")) return; // cancelled, not failed
      failedRequests.push({ url, err: msg.params.errorText });
      if (url.startsWith(URL_TO_OPEN.replace(/\/$/, "")) && !/\/api\//.test(url)) sameOriginFailures.push(url);
    }
  });

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Log.enable");
  await send("Network.enable");

  await send("Page.navigate", { url: URL_TO_OPEN });
  await sleep(2000);
  // Wait for the render, not a fixed guess: poll for a sized canvas.
  let canvases = [];
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    const probe = await send("Runtime.evaluate", {
      expression: `[...document.querySelectorAll('canvas')].map((c) => ({ w: c.width, h: c.height, cw: c.clientWidth, ch: c.clientHeight }))`,
      returnByValue: true,
    });
    canvases = probe.result.value || [];
    if (canvases.some((c) => c.cw > 100 && c.ch > 100)) break;
  }
  await sleep(2500); // let the first procedural world grow and paint

  const state = await send("Runtime.evaluate", {
    expression: `(() => {
      const cs = [...document.querySelectorAll('canvas')].map((c) => ({ w: c.width, h: c.height, cw: c.clientWidth, ch: c.clientHeight }));
      const txt = (document.body.innerText || '').replace(/\\s+/g, ' ').trim();
      const nogl = document.getElementById('nogl');
      const gl = (() => { try { return !!document.querySelector('#c').getContext('webgl'); } catch { return false; } })();
      return {
        title: document.title,
        bodyText: txt.slice(0, 1400),
        bodyChars: txt.length,
        canvases: cs,
        hasCanvas: cs.some((c) => c.cw > 100 && c.ch > 100),
        webgl: gl,
        noGlVisible: nogl ? !nogl.hidden : null,
        hasSeed: /seed/i.test(txt),
        hasPanel: /ocean|cloud|tilt|textures/i.test(txt),
      };
    })()`,
    returnByValue: true,
  });

  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, Buffer.from(shot.data, "base64"));

  const s = state.result.value;
  console.log(`boot: session ${SESSION}  chrome ${path.basename(chrome)}`);
  console.log(`boot: url ${URL_TO_OPEN}`);
  console.log(`boot: title ${JSON.stringify(s.title)}`);
  console.log(`boot: canvases ${JSON.stringify(s.canvases)}`);
  console.log(`boot: body (${s.bodyChars} chars) ${JSON.stringify(s.bodyText.slice(0, 260))}`);
  console.log(`boot: webgl ${s.webgl}  no-gl fallback visible ${s.noGlVisible}  seed ${s.hasSeed}  panel ${s.hasPanel}`);
  console.log(`boot: console errors ${consoleErrors.length}${consoleErrors.length ? " " + JSON.stringify(consoleErrors.slice(0, 3)) : ""}`);
  console.log(`boot: network console lines ${networkConsole.length} (documented gaps only)`);
  console.log(`boot: failed requests ${failedRequests.length} (same-origin static ${sameOriginFailures.length})`);
  for (const f of failedRequests.slice(0, 10)) console.log(`  blocked ${f.url} (${f.err})`);
  for (const f of sameOriginFailures.slice(0, 10)) console.log(`  same-origin ${f}`);
  console.log(`boot: screenshot ${path.relative(proj, OUT).split(path.sep).join("/")} (${fs.statSync(OUT).size} B)`);

  const ok =
    s.hasCanvas &&
    s.webgl &&
    s.noGlVisible === false &&
    s.bodyChars > 200 &&
    s.hasSeed &&
    consoleErrors.length === 0 &&
    sameOriginFailures.length === 0;
  console.log(`boot: RESULT ${ok ? "RENDERED" : "FAILED"}`);
  ws.close();
  child.kill();
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error("boot: FAILED — " + e.message);
  child.kill();
  process.exit(1);
});
