// index-inline-1 08 — addeventlistener
// Lines 1651-1998 of readable/index-inline-1.pretty.js (statement-aligned).
  function octForBake(w) {
    return clamp(
      Math.floor(
        Math.log(0.5 / ((1.7 * P.scale * 6.2832) / w)) / Math.log(2.03),
      ) + 2,
      5,
      12,
    );
  }
  function pushShared(U, oct, time, p, w) {
    p = p || P;
    w = w || W;
    gl.uniform1f(U.uTime, time);
    gl.uniform1f(U.uSea, p.sea);
    gl.uniform1f(U.uScale, p.scale);
    gl.uniform1f(U.uMount, p.mount);
    gl.uniform1f(U.uTemp, p.temp);
    gl.uniform1f(U.uWet, p.wet);
    gl.uniform1f(U.uCloud, p.cloud);
    gl.uniform1f(U.uAtm, p.atm);
    gl.uniform1f(U.uTilt, p.tilt * D2R);
    gl.uniform1f(U.uIce, w.cls.ice);
    gl.uniform1f(U.uEmit, w.cls.emit);
    gl.uniform1f(U.uGas, w.cls.gas ? 1 : 0);
    gl.uniform1f(U.uCity, p.cities ? w.cityAmt : 0);
    gl.uniform1f(U.uOct, oct);
    gl.uniform3fv(U.uOff, w.off);
    gl.uniform3fv(U.uCOff, w.coff);
    for (const k of PAL_KEYS) gl.uniform3fv(U[PAL_U[k]], w.pal[k]);
  }

  /* ================= controls ================= */
  buildPanel();
  (function () {
    const sd = $("ssys").querySelector("details");
    const mkrow = (label, id, opts) => {
      const r = document.createElement("div");
      r.className = "row";
      const l = document.createElement("label");
      l.htmlFor = id;
      l.textContent = label;
      const sel = document.createElement("select");
      sel.id = id;
      opts.forEach(([v, t]) => {
        const o = document.createElement("option");
        o.value = v;
        o.textContent = t;
        sel.appendChild(o);
      });
      r.append(l, sel);
      sd.insertBefore(r, sd.children[1]);
      return sel;
    };
    const ss = mkrow(
      "Star",
      "sys-star",
      [["auto", "From the seed"]].concat(STARS.map((x) => [x.id, x.name])),
    );
    const sp = mkrow("System", "sys-pre", [
      ["random", "Random"],
      ["sol", "Our Solar System"],
    ]);
    const sn = mkrow("Planets", "sys-n", [
      ["0", "From the seed"],
      ["3", "3"],
      ["4", "4"],
      ["5", "5"],
      ["6", "6"],
      ["7", "7"],
      ["8", "8"],
    ]);
    const regen = () => {
      if (SYS) openSystem(SYS.seed, true);
    };
    const lockSol = () => {
      const s = sysOpts.preset === "sol";
      ss.disabled = sn.disabled = s;
    };
    sp.addEventListener("change", () => {
      sysOpts.preset = sp.value;
      lockSol();
      regen();
      hashSoon();
    });
    ss.addEventListener("change", () => {
      sysOpts.star = ss.value;
      regen();
      hashSoon();
    });
    sn.addEventListener("change", () => {
      sysOpts.n = +sn.value;
      regen();
      hashSoon();
    });
    const tg = document.createElement("div");
    tg.className = "tg";
    tg.innerHTML =
      '<label><input type="checkbox" id="sys-lab" checked>Planet names</label>';
    sd.appendChild(tg);
    tg.querySelector("input").addEventListener("change", (e) => {
      S.labels = e.target.checked;
    });
    const bd = $("sgroup").querySelector("details");
    const rb = document.createElement("div");
    rb.className = "tg";
    rb.innerHTML = '<button type="button" id="bg-roll">Reroll sky</button>';
    bd.appendChild(rb);
    $("bg-roll").addEventListener("click", () => {
      bgRoll++;
      genBG();
      hashSoon();
    });
  })();
  $("t-rings").addEventListener("change", (e) => {
    hashSoon();
    P.rings = e.target.checked;
    if (P.rings && S.dist < baseDist(true) * 0.93)
      S.distTarget = baseDist(true);
    updateCls();
  });
  $("t-moon").addEventListener("change", (e) => {
    hashSoon();
    P.moon = e.target.checked;
    if (P.moon && S.dist < baseDist(true) * 1.1)
      S.distTarget = baseDist(true) * 1.15;
  });
  $("t-cities").addEventListener("change", (e) => {
    hashSoon();
    P.cities = e.target.checked;
    if (P.cities && !W.cityAmt) W.cityAmt = 1;
    updateCls();
    schedulePreviews();
  });
  $("type").addEventListener("change", (e) => {
    forcedType = e.target.value;
    applySeed(W.seed);
  });
  const rnd = () => 1 + Math.floor(Math.random() * 99999);
  function newThing() {
    if (mode === "system") {
      openSystem(rnd());
      return;
    }
    if (sysCtx) {
      forcedType = "auto";
      $("type").value = "auto";
    }
    applySeed(rnd());
  }
  $("new").addEventListener("click", newThing);
  $("seed").addEventListener("change", () => {
    if (mode === "system") openSystem(+$("seed").value);
    else {
      if (sysCtx) {
        forcedType = "auto";
        $("type").value = "auto";
      }
      applySeed(+$("seed").value);
    }
  });
  $("sysbtn").addEventListener("click", () => {
    if (sysCtx) backToSystem();
    else openSystem(W.seed);
  });
  const pauseBtn = $("pause");
  function setPaused(v) {
    S.paused = v;
    pauseBtn.textContent = v ? "Resume" : "Pause";
  }
  pauseBtn.addEventListener("click", () => setPaused(!S.paused));
  function setFilm(v) {
    S.film = v;
    stage.classList.toggle("film", v);
    if (v) {
      try {
        const p = stage.requestFullscreen && stage.requestFullscreen();
        if (p && p.catch) p.catch(() => {});
      } catch (e) {}
    } else if (document.fullscreenElement) {
      try {
        document.exitFullscreen().catch(() => {});
      } catch (e) {}
    }
  }
  $("film").addEventListener("click", () => setFilm(true));
  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement && S.film) setFilm(false);
  });
  $("shot").addEventListener("click", () => {
    const v = $("shot-size").value;
    if (v === "screen" || mode === "system" || !bakeProg) {
      S.snap = true;
      return;
    }
    const [w, h] = v.split("x").map(Number);
    hiShot(w, h);
  });
  $("rec").addEventListener("click", () => toggleRec());
  $("copylink").addEventListener("click", async () => {
    setHash();
    const url = location.href;
    let ok = false;
    try {
      await navigator.clipboard.writeText(url);
      ok = true;
    } catch (e) {
      try {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.cssText = "position:fixed;opacity:0;top:0";
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand("copy");
        ta.remove();
      } catch (e2) {}
    }
    const b = $("copylink");
    if (!ok) {
      window.prompt("Copy this link", url);
      return;
    }
    b.textContent = "Link copied \u2713";
    clearTimeout(b._t);
    b._t = setTimeout(() => updateChrome(), 1800);
  });
  const xm = $("export");
  function xopen(v) {
    xm.hidden = !v;
    if (v) $("x-all").focus();
    else $("totex").focus();
  }
  $("totex").addEventListener("click", () => xopen(true));
  $("x-close").addEventListener("click", () => xopen(false));
  xm.addEventListener("pointerdown", (e) => {
    if (e.target === xm) xopen(false);
  });
  function setPanel(o) {
    stage.classList.toggle("popen", o);
    $("panel").classList.toggle("open", o);
    $("ptoggle").setAttribute("aria-expanded", String(o));
    $("ptoggle").textContent = o ? "Hide" : "Controls";
  }
  $("ptoggle").addEventListener("click", () =>
    setPanel(!$("panel").classList.contains("open")),
  );
  const am = $("about");
  function aopen(v) {
    am.hidden = !v;
    if (v) $("a-close").focus();
    else $("abtn").focus();
  }
  $("abtn").addEventListener("click", () => aopen(true));
  $("a-close").addEventListener("click", () => aopen(false));
  am.addEventListener("pointerdown", (e) => {
    if (e.target === am) aopen(false);
  });
  if (window.matchMedia && window.matchMedia("(max-width:700px)").matches)
    setPanel(false);
  window.addEventListener("keydown", (e) => {
    const t = e.target;
    if (
      t &&
      ((t.tagName === "INPUT" && t.type === "number") || t.tagName === "SELECT")
    )
      return;
    const k = e.key.toLowerCase();
    if (k === "escape") {
      if (!xm.hidden) {
        xopen(false);
        return;
      }
      if (!am.hidden) {
        aopen(false);
        return;
      }
    }
    if (!xm.hidden || !am.hidden) return;
    if (k === "h") {
      setPanel(!$("panel").classList.contains("open"));
      return;
    }
    if (k === "g") newThing();
    else if (k === "r") toggleRec();
    else if (k === " " && (t === document.body || t === canvas)) {
      e.preventDefault();
      setPaused(!S.paused);
    } else if (k === "f") setFilm(!S.film);
    else if (k === "escape" && S.film) setFilm(false);
  });
  const ptrs = new Map();
  let pinch0 = 0,
    dist0 = 0,
    zoom0 = 1,
    moved = 0;
  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved = 0;
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      pinch0 = Math.hypot(a.x - b.x, a.y - b.y);
      dist0 = S.dist;
      zoom0 = S.sysZoom;
    }
  });
  canvas.addEventListener("pointermove", (e) => {
    if (mode === "system") {
      const i = hitTest(e);
      hoverI = i;
      stage.classList.toggle("hover", i >= 0);
    }
    const p = ptrs.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x,
      dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    moved += Math.abs(dx) + Math.abs(dy);
    if (mode === "system") {
      if (ptrs.size === 1 && moved >= 4) {
        const k = 2.2 / canvas.clientHeight;
        if (S.sysEl == null) S.sysEl = sysDefEl();
        S.svy = dx * k;
        S.svp = dy * k;
        S.sysYaw += S.svy;
        S.sysEl = clamp(S.sysEl + S.svp, -1.5, 1.5);
      } else if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch0 > 0) S.sysZoom = clamp((zoom0 * d) / pinch0, 0.4, 10);
      }
      return;
    }
    if (ptrs.size === 1) {
      const k = 2.2 / canvas.clientHeight;
      S.vy = -dx * k;
      S.vp = dy * k;
      S.yaw += S.vy;
      S.pitch = clamp(S.pitch + S.vp, -1.3, 1.3);
    } else if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch0 > 0) {
        S.dist = clamp((dist0 * pinch0) / d, 1.25, 60);
        S.distTarget = null;
      }
    }
  });
