// index-inline-1 07 — sys
// Lines 1301-1650 of readable/index-inline-1.pretty.js (statement-aligned).
  const SOL = [
    [
      "Mercury",
      "desert",
      11,
      0.55,
      0.24,
      0.39,
      {
        sand: [0.55, 0.53, 0.5],
        dry: [0.42, 0.4, 0.38],
        grass: [0.45, 0.43, 0.4],
        green: [0.4, 0.38, 0.36],
        rock: [0.3, 0.29, 0.28],
        snow: [0.7, 0.7, 0.7],
      },
      { sea: 0, cloud: 0, atm: 0.12, tilt: 0 },
    ],
    [
      "Venus",
      "desert",
      22,
      0.9,
      0.33,
      0.72,
      {
        sand: [0.9, 0.8, 0.55],
        dry: [0.85, 0.7, 0.45],
        grass: [0.8, 0.66, 0.42],
        green: [0.7, 0.58, 0.38],
        rock: [0.6, 0.5, 0.35],
        snow: [0.95, 0.9, 0.8],
        atm: [0.95, 0.8, 0.5],
        cloud: [0.98, 0.92, 0.75],
      },
      { sea: 0, cloud: 0.95, atm: 1.4, tilt: 3 },
    ],
    [
      "Earth",
      "temperate",
      3,
      1,
      0.43,
      1,
      {},
      { sea: 0.55, cloud: 0.45, atm: 1, tilt: 23, moon: true },
    ],
    [
      "Mars",
      "desert",
      44,
      0.65,
      0.53,
      1.52,
      {
        sand: [0.8, 0.45, 0.28],
        dry: [0.72, 0.38, 0.22],
        grass: [0.65, 0.36, 0.22],
        green: [0.55, 0.32, 0.2],
        rock: [0.42, 0.27, 0.2],
        snow: [0.95, 0.93, 0.92],
        atm: [0.85, 0.6, 0.45],
        cloud: [0.95, 0.88, 0.8],
      },
      { sea: 0, cloud: 0.06, atm: 0.35, tilt: 25 },
    ],
    [
      "Jupiter",
      "gas",
      55,
      2.6,
      0.64,
      5.2,
      {
        sand: [0.88, 0.8, 0.66],
        dry: [0.72, 0.45, 0.3],
        rock: [0.55, 0.36, 0.26],
        snow: [0.95, 0.92, 0.86],
      },
      { scale: 1, cloud: 0.1, atm: 1.2, tilt: 3 },
    ],
    [
      "Saturn",
      "gas",
      66,
      2.2,
      0.76,
      9.58,
      {
        sand: [0.9, 0.82, 0.62],
        dry: [0.8, 0.7, 0.5],
        rock: [0.62, 0.52, 0.4],
        snow: [0.95, 0.92, 0.82],
      },
      { scale: 0.8, cloud: 0.1, atm: 1.2, tilt: 27, rings: true },
    ],
    [
      "Uranus",
      "gas",
      77,
      1.55,
      0.88,
      19.2,
      {
        sand: [0.7, 0.88, 0.9],
        dry: [0.6, 0.82, 0.88],
        rock: [0.55, 0.75, 0.85],
        snow: [0.85, 0.95, 0.97],
        atm: [0.5, 0.8, 0.95],
      },
      { scale: 0.35, mount: 0, cloud: 0.05, atm: 1.3, tilt: 30 },
    ],
    [
      "Neptune",
      "gas",
      88,
      1.5,
      1,
      30,
      {
        sand: [0.32, 0.5, 0.92],
        dry: [0.2, 0.34, 0.8],
        rock: [0.16, 0.26, 0.7],
        snow: [0.6, 0.75, 1],
        atm: [0.3, 0.5, 1],
      },
      { scale: 0.5, mount: 0.8, cloud: 0.1, atm: 1.3, tilt: 28 },
    ],
  ];
  function makeSol() {
    const star = Object.assign(
      {},
      STARS.find((c) => c.id === "yellow"),
      { name: "The Sun" },
    );
    const planets = SOL.map(([name, cls, sd, size, a, au, pal, pp], i) => {
      const g = makeWorld(sd, cls);
      Object.assign(g.w.pal, pal);
      if (pal.sand && cls === "gas") {
        g.w.pal.ringA = g.w.pal.sand.map((v) => Math.min(1, v * 1.05));
        g.w.pal.ringB = g.w.pal.dry.map((v) => v * 0.8);
      }
      const { moon, rings, tilt, ...rest } = pp;
      Object.assign(g.p, rest);
      g.p.rings = !!rings;
      g.p.moon = !!moon;
      g.p.tilt = tilt == null ? g.p.tilt : tilt;
      g.p.cities = name === "Earth";
      g.w.cityAmt = name === "Earth" ? 1 : 0;
      g.w.name = name;
      return {
        g,
        clsId: cls,
        seed: sd,
        a,
        ang: i * 0.9 + 0.3,
        om: 0.05 * Math.pow(0.3 / au, 1.5),
        size,
        name,
        sx: 0,
        sy: 0,
        sr: 0,
      };
    });
    const rn = mulberry32(4242);
    const stars = [];
    for (let i = 0; i < 600; i++)
      stars.push([rn(), rn(), 0.3 + rn() * 1.1, 0.25 + rn() * 0.75]);
    return { seed: 1, star, planets, name: "Solar System", stars, sol: true };
  }
  function makeSystem(seed, opts) {
    opts = opts || {};
    seed = clamp(Math.floor(seed) || 1, 1, 99999);
    const r = mulberry32((seed * 40503 + 7919) >>> 0);
    let q = r() * STARS.reduce((s, c) => s + c.w, 0),
      star = STARS[0];
    for (const c of STARS) {
      if ((q -= c.w) <= 0) {
        star = c;
        break;
      }
    }
    if (opts.star && opts.star !== "auto")
      star = STARS.find((c) => c.id === opts.star) || star;
    if (opts.preset === "sol") return makeSol();
    const n0 = 4 + Math.floor(r() * 4),
      n = opts.n || n0;
    const raw = [];
    let a = 0.16;
    for (let i = 0; i < n; i++) {
      raw.push(a);
      a *= 1.3 + r() * 0.22;
    }
    const mx = raw[n - 1];
    const planets = raw.map((au, i) => {
      const t = au / star.hz;
      let zone = ZONES[ZONES.length - 1][1];
      for (const [lim, z] of ZONES) {
        if (t < lim) {
          zone = z;
          break;
        }
      }
      const clsId = wpick(r, zone),
        ps = 1 + Math.floor(r() * 99999);
      const g = makeWorld(ps, clsId);
      return {
        g,
        clsId,
        seed: ps,
        a: 0.24 + 0.76 * ((au - raw[0]) / (mx - raw[0])),
        ang: i * 2.4 + r() * 0.8,
        om: 0.05 * Math.pow(0.3 / au, 1.5),
        size: 0.7 + r() * 0.8 + i * 0.03,
        name: g.w.name,
        sx: 0,
        sy: 0,
        sr: 0,
      };
    });
    const rn = mulberry32(seed * 977 + 13);
    let nm = pick(rn, PRE) + pick(rn, MID) + pick(rn, END);
    nm = nm.charAt(0).toUpperCase() + nm.slice(1);
    const stars = [];
    for (let i = 0; i < 600; i++)
      stars.push([rn(), rn(), 0.3 + rn() * 1.1, 0.25 + rn() * 0.75]);
    return { seed, star, planets, name: nm, stars };
  }
  function openSystem(seed, keepBG) {
    SYS = makeSystem(seed, sysOpts);
    mode = "system";
    S.sysZoom = 1;
    S.sysYaw = 0;
    S.sysEl = null;
    S.svy = 0;
    S.svp = 0;
    sysCtx = null;
    if (!keepBG) bgRoll = 0;
    genBG();
    $("seed").value = SYS.seed;
    setHash("sys" + SYS.seed);
    updateChrome();
  }
  function visit(i) {
    if (!SYS) return;
    i = clamp(i | 0, 0, SYS.planets.length - 1);
    const pl = SYS.planets[i];
    sysCtx = { seed: SYS.seed, i };
    forcedType = pl.clsId;
    $("type").value = pl.clsId;
    mode = "planet";
    showWorld(pl.g);
    S.dist = baseDist(P.rings);
    S.distTarget = null;
    setHash("sys" + SYS.seed + "-" + i);
  }
  function backToSystem() {
    if (!SYS) return;
    mode = "system";
    sysCtx = null;
    $("seed").value = SYS.seed;
    setHash("sys" + SYS.seed);
    updateChrome();
  }
  function updateChrome() {
    const sys = mode === "system";
    stage.classList.toggle("sys", sys);
    $("new").textContent = sys ? "New system" : "New world";
    $("copylink").textContent = sys
      ? "Copy link to this system"
      : "Copy link to this world";
    $("sysbtn").textContent = sysCtx ? "\u2190 System" : "Solar system";
    if (sys && SYS) {
      $("eyel").textContent = "Star system";
      $("cat").textContent = "SY-" + String(SYS.seed).padStart(5, "0");
      $("name").textContent = SYS.name;
      $("cls").textContent =
        SYS.star.name + " \u00b7 " + SYS.planets.length + " planets";
      $("hint").innerHTML =
        "drag to look around \u00b7 click a planet to visit \u00b7 scroll to zoom<br><kbd>G</kbd> new system \u00b7 <kbd>F</kbd> film \u00b7 <kbd>R</kbd> record";
    } else {
      $("eyel").textContent =
        sysCtx && SYS
          ? "Planet " +
            (sysCtx.i + 1) +
            " of " +
            SYS.planets.length +
            " \u00b7 " +
            SYS.name
          : "Catalog entry";
      $("cat").textContent = "SW-" + String(W.seed).padStart(5, "0");
      $("name").textContent = W.name;
      $("hint").innerHTML =
        "drag to turn \u00b7 scroll to zoom<br><kbd>G</kbd> new world \u00b7 <kbd>Space</kbd> pause \u00b7 <kbd>F</kbd> film \u00b7 <kbd>R</kbd> record";
    }
  }
  function updateCls() {
    $("cls").textContent =
      W.cls.name +
      (P.cities && W.cityAmt ? " · inhabited" : "") +
      (P.rings ? " · ringed" : "");
  }
  function oceanFraction() {
    const d = W.hdata;
    if (!d) return null;
    let wsum = 0,
      ws = 0;
    const w = 512,
      h = 256,
      sea = P.sea;
    for (let y = 0; y < h; y++) {
      const wt = Math.cos(((y + 0.5) / h - 0.5) * Math.PI);
      for (let x = 0; x < w; x += 2) {
        const i = (y * w + x) * 4;
        const v = (d[i] * 256 + d[i + 1]) / 65535;
        const hh = 0.15 + v * 1.2;
        wsum += wt;
        if (hh < sea) ws += wt;
      }
    }
    return ws / wsum;
  }
  function updateHud() {
    const o = oceanFraction();
    $("st-ocean").textContent =
      o == null || W.cls.gas ? "—" : Math.round(o * 100) + "%";
    $("st-cloud").textContent = Math.round(P.cloud * 100) + "%";
    $("st-day").textContent = W.dayH + " h";
    $("st-tilt").textContent = Math.round(P.tilt) + "°";
  }
  function onParam(k) {
    hashSoon();
    if (k === "gal" || k === "far") genBG();
    updateHud();
    if (MAP_KEYS[k]) schedulePreviews();
  }

  /* ================= uniforms ================= */
  const D2R = Math.PI / 180;
  function octForView(dist, sc, hpx) {
    dist = dist || S.dist;
    sc = sc || P.scale;
    hpx = hpx || canvas.height;
    const radPerPx = (1 / (1.7 * hpx)) * Math.max(dist - 1, 0.08);
    return clamp(
      Math.floor(Math.log(6.2832 / (5.1 * sc * radPerPx)) / Math.log(2.03)),
      6,
      12,
    );
  }
