// index-inline-1 06 — num
// Lines 1040-1300 of readable/index-inline-1.pretty.js (statement-aligned).
  function makeWorld(seed, forceId) {
    seed = clamp(Math.floor(seed) || 1, 1, 99999);
    const r = mulberry32((seed * 2654435761) >>> 0);
    const tot = CLASSES.reduce((s, c) => s + c.w, 0);
    let q = r() * tot;
    let cls = CLASSES[0];
    for (const c of CLASSES) {
      if ((q -= c.w) <= 0) {
        cls = c;
        break;
      }
    }
    if (forceId && forceId !== "auto")
      cls = CLASSES.find((c) => c.id === forceId) || cls;
    const p = { relief: 1, sunAz: 100, sunEl: 19, spin: 1, moon: false },
      w = { cls, seed };
    w.off = [r() * 40, r() * 40, r() * 40];
    w.coff = [r() * 40, r() * 40, r() * 40];
    p.sea = +clamp(cls.p.sea + (r() - 0.5) * 0.06, 0.3, 0.7).toFixed(3);
    p.scale = +(cls.p.scale * (0.85 + r() * 0.3)).toFixed(2);
    p.mount = +(cls.p.mount * (0.8 + r() * 0.4)).toFixed(2);
    p.temp = cls.p.temp;
    p.wet = +clamp(cls.p.wet + (r() - 0.5) * 0.12, 0, 1).toFixed(2);
    p.cloud = +clamp(cls.p.cloud + (r() - 0.5) * 0.2, 0, 1).toFixed(2);
    p.atm = cls.p.atm;
    p.tilt = Math.round(4 + r() * 26);
    p.rings = r() < cls.ringP;
    w.cityAmt = cls.cityP > 0 && r() < cls.cityP ? 1 : 0;
    p.cities = w.cityAmt > 0;
    w.dayH = Math.round(cls.day[0] + r() * (cls.day[1] - cls.day[0]));
    w.pal = {};
    PAL_KEYS.slice(0, 10).forEach((k) => {
      const keep = k === "snow" || k === "cloud" || k === "atm";
      w.pal[k] = jitterColor(r, cls.c[k], keep ? 0.02 : 0.1);
    });
    w.ringIn = 1.32 + r() * 0.3;
    w.ringOut = w.ringIn + 0.45 + r() * 0.55;
    w.pal.ringA = w.pal.sand.map((v) => clamp(v * 1.1 + 0.06, 0, 1));
    w.pal.ringB = w.pal.dry.map((v) => clamp(v * 0.75, 0, 1));
    let nm = pick(r, PRE) + pick(r, MID) + pick(r, END);
    nm = nm.charAt(0).toUpperCase() + nm.slice(1);
    w.name = nm;
    w.rot0 = r() * 6.28;
    return { p, w };
  }
  function showWorld(g) {
    const h = W.hdata;
    Object.assign(P, g.p);
    Object.assign(W, g.w);
    W.hdata = h;
    $("seed").value = W.seed;
    S.rot = W.rot0;
    S.crot = S.rot;
    if (P.rings) S.pitch = 0.5;
    if (mode === "planet") {
      bgRoll = 0;
      genBG();
    }
    syncUI();
    updateCls();
    updateHud();
    updateChrome();
    schedulePreviews();
  }
  const SKEYS = {
    sea: "sea",
    scale: "sc",
    mount: "mt",
    relief: "rl",
    temp: "tp",
    wet: "wt",
    cloud: "cl",
    atm: "am",
    sunAz: "sa",
    sunEl: "se",
    tilt: "tl",
    spin: "sp",
  };
  const BKEYS = { neb: "nb", gal: "gl", stars: "st", far: "fp" };
  function stateHash() {
    const q = new URLSearchParams();
    const f = (v) => +(+v).toFixed(3);
    if (mode === "system" && SYS) {
      q.set("sys", SYS.seed);
      if (sysOpts.preset === "sol") q.set("pre", "sol");
      if (sysOpts.n) q.set("n", sysOpts.n);
      if (sysOpts.star !== "auto") q.set("star", sysOpts.star);
      q.set("z", f(S.sysZoom));
      if (S.orb !== 1) q.set("or", f(S.orb));
      if (S.sysYaw) q.set("ay", f(S.sysYaw));
      if (S.sysEl != null) q.set("ae", f(S.sysEl));
    } else {
      q.set("seed", W.seed);
      if (sysCtx && SYS) {
        q.set("sys", sysCtx.seed);
        q.set("v", sysCtx.i);
        if (sysOpts.preset === "sol") q.set("pre", "sol");
        if (sysOpts.n) q.set("n", sysOpts.n);
        if (sysOpts.star !== "auto") q.set("star", sysOpts.star);
      } else if (forcedType !== "auto") q.set("type", forcedType);
      for (const k in SKEYS) q.set(SKEYS[k], f(P[k]));
      q.set("rg", P.rings ? 1 : 0);
      q.set("mn", P.moon ? 1 : 0);
      q.set("ct", P.cities ? 1 : 0);
      q.set("d", f(S.dist));
      q.set("yw", f(S.yaw));
      q.set("pt", f(S.pitch));
    }
    for (const k in BKEYS) q.set(BKEYS[k], f(P[k]));
    if (bgRoll) q.set("br", bgRoll);
    return q.toString();
  }
  function setHash() {
    try {
      history.replaceState(null, "", "#" + stateHash());
    } catch (e) {}
  }
  let hashTimer = 0;
  function hashSoon() {
    clearTimeout(hashTimer);
    hashTimer = setTimeout(setHash, 450);
  }
  function loadFromHash() {
    const h = (location.hash || "").slice(1);
    const hm = h.match(/^sys(\d+)(?:-(\d+))?$/);
    if (hm) {
      openSystem(+hm[1]);
      if (hm[2] != null) visit(+hm[2]);
      return;
    }
    if (h.indexOf("=") < 0) {
      const n = parseInt(h, 10);
      applySeed(n > 0 ? n : 4417);
      return;
    }
    const q = new URLSearchParams(h);
    const num = (k, d) => (q.has(k) && isFinite(+q.get(k)) ? +q.get(k) : d);
    sysOpts.n = clamp(Math.round(num("n", 0)), 0, 8);
    sysOpts.star = q.get("star") || "auto";
    sysOpts.preset = q.get("pre") === "sol" ? "sol" : "random";
    if ($("sys-pre")) {
      $("sys-pre").value = sysOpts.preset;
      $("sys-n").disabled = $("sys-star").disabled = sysOpts.preset === "sol";
    }
    if ($("sys-n")) $("sys-n").value = String(sysOpts.n);
    if ($("sys-star")) $("sys-star").value = sysOpts.star;
    for (const k in BKEYS) P[k] = num(BKEYS[k], P[k]);
    const br = Math.round(num("br", 0));
    if (q.has("sys") && !q.has("seed")) {
      bgRoll = br;
      openSystem(num("sys", 4417), true);
      S.sysZoom = clamp(num("z", 1), 0.4, 10);
      S.orb = clamp(num("or", 1), 0, 4);
      S.sysYaw = num("ay", 0);
      S.sysEl = q.has("ae") ? clamp(num("ae", 0.39), -1.5, 1.5) : null;
      syncUI();
      setHash();
      return;
    }
    if (q.has("sys")) {
      openSystem(num("sys", 4417));
      visit(num("v", 0));
    } else {
      forcedType = q.get("type") || "auto";
      if ($("type")) $("type").value = forcedType;
      applySeed(num("seed", 4417));
    }
    for (const k in SKEYS) P[k] = num(SKEYS[k], P[k]);
    P.rings = num("rg", P.rings ? 1 : 0) > 0;
    P.moon = num("mn", P.moon ? 1 : 0) > 0;
    P.cities = num("ct", P.cities ? 1 : 0) > 0;
    if (P.cities && !W.cityAmt) W.cityAmt = 1;
    for (const k in BKEYS) P[k] = num(BKEYS[k], P[k]);
    bgRoll = br;
    genBG();
    S.dist = q.has("d")
      ? clamp(num("d", S.dist), 1.25, 60)
      : baseDist(P.rings || P.moon);
    S.yaw = num("yw", S.yaw);
    S.pitch = clamp(num("pt", S.pitch), -1.3, 1.3);
    S.distTarget = null;
    syncUI();
    updateCls();
    updateHud();
    schedulePreviews();
    setHash();
  }
  function applySeed(seed) {
    sysCtx = null;
    const g = makeWorld(seed, forcedType);
    mode = "planet";
    showWorld(g);
    setHash(W.seed);
  }

  /* ---------- solar systems ---------- */
  const STARS = [
    {
      id: "yellow",
      name: "Yellow dwarf",
      c: [1, 0.86, 0.58],
      w: 3,
      hz: 0.45,
      size: 1,
    },
    {
      id: "orange",
      name: "Orange dwarf",
      c: [1, 0.66, 0.36],
      w: 2,
      hz: 0.32,
      size: 0.9,
    },
    {
      id: "red",
      name: "Red dwarf",
      c: [1, 0.42, 0.26],
      w: 2,
      hz: 0.2,
      size: 0.75,
    },
    {
      id: "white",
      name: "White star",
      c: [0.86, 0.92, 1],
      w: 1.3,
      hz: 0.62,
      size: 1.2,
    },
    {
      id: "blue",
      name: "Blue giant",
      c: [0.62, 0.76, 1],
      w: 0.7,
      hz: 0.85,
      size: 1.6,
    },
  ];
  const ZONES = [
    [0.5, { lava: 0.6, desert: 0.4 }],
    [0.8, { desert: 0.5, lava: 0.2, temperate: 0.2, exotic: 0.1 }],
    [
      1.25,
      { temperate: 0.35, ocean: 0.3, desert: 0.15, exotic: 0.1, frozen: 0.1 },
    ],
    [
      1.8,
      { frozen: 0.35, ocean: 0.15, exotic: 0.3, desert: 0.1, temperate: 0.1 },
    ],
    [99, { frozen: 0.6, exotic: 0.4 }],
  ];
  function wpick(r, o) {
    const ks = Object.keys(o);
    let t = 0;
    ks.forEach((k) => (t += o[k]));
    let q = r() * t;
    for (const k of ks) {
      if ((q -= o[k]) <= 0) return k;
    }
    return ks[0];
  }
