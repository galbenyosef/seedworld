// index-inline-1 05 — inp
// Lines 722-1039 of readable/index-inline-1.pretty.js (statement-aligned).
  const PRE = [
    "Ka",
    "Ve",
    "Or",
    "Tha",
    "Zu",
    "Mi",
    "Ash",
    "Co",
    "Ny",
    "Se",
    "I",
    "Be",
    "Quo",
    "Te",
    "Dra",
    "Lu",
    "Hal",
    "Ere",
  ];
  const MID = [
    "ra",
    "lo",
    "the",
    "ven",
    "dri",
    "sa",
    "mi",
    "ko",
    "re",
    "na",
    "",
    "",
  ];
  const END = [
    "th",
    "n",
    "ris",
    "x",
    "ra",
    "mor",
    "lia",
    "dor",
    "sus",
    "on",
    "e",
    "is",
    "ae",
  ];
  const pick = (r, a) => a[Math.floor(r() * a.length)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* adjustable parameters, mirrored by the sliders */
  const P = {
    sea: 0.52,
    scale: 1,
    mount: 0.7,
    relief: 1,
    temp: 0,
    wet: 0.5,
    cloud: 0.5,
    atm: 1,
    sunAz: 100,
    sunEl: 19,
    tilt: 12,
    spin: 1,
    rings: false,
    moon: false,
    cities: false,
    neb: 0.55,
    gal: 0.7,
    stars: 1,
    far: 1,
  };
  let W = {
    cls: CLASSES[0],
    pal: {},
    off: [0, 0, 0],
    coff: [0, 0, 0],
    cityAmt: 0,
    ringIn: 1.5,
    ringOut: 2.1,
    dayH: 24,
    name: "",
    seed: 4417,
    hdata: null,
  };
  const S = {
    sysYaw: 0,
    sysEl: null,
    svy: 0,
    svp: 0,
    shx: 0,
    shy: 0,
    orb: 1,
    labels: true,
    sysZoom: 1,
    yaw: 0.55,
    pitch: 0.18,
    dist: 10.4,
    distTarget: null,
    vy: 0,
    vp: 0,
    rot: 0,
    crot: 0,
    time: 0,
    moonA: 1.2,
    paused: false,
    film: false,
    snap: false,
  };
  let forcedType = "auto";
  let SYS = null,
    mode = "planet",
    sysCtx = null,
    hoverI = -1,
    sysOpts = { n: 0, star: "auto", preset: "random" },
    bgRoll = 0,
    BG = null;

  const GROUPS = [
    [
      "World",
      true,
      [
        ["sea", "Sea level", 0.3, 0.7, 0.005, 2],
        ["scale", "Continents", 0.6, 2.2, 0.01, 2],
        ["mount", "Mountains", 0, 1.6, 0.01, 2],
        ["relief", "Relief shading", 0, 2, 0.01, 2],
      ],
    ],
    [
      "Climate",
      false,
      [
        ["temp", "Warmth", -0.4, 0.4, 0.01, 2],
        ["wet", "Moisture", 0, 1, 0.01, 2],
      ],
    ],
    [
      "Sky",
      false,
      [
        ["cloud", "Clouds", 0, 1, 0.01, 2],
        ["atm", "Atmosphere", 0, 2, 0.01, 2],
      ],
    ],
    [
      "Light and motion",
      false,
      [
        ["sunAz", "Sun direction", 0, 360, 1, 0],
        ["sunEl", "Sun height", -30, 70, 1, 0],
        ["tilt", "Axial tilt", 0, 45, 1, 0],
        ["spin", "Spin", 0, 4, 0.05, 2],
      ],
    ],
    [
      "Space background",
      false,
      [
        ["neb", "Nebulae", 0, 1.5, 0.01, 2],
        ["gal", "Galaxies", 0, 1, 0.01, 2],
        ["stars", "Stars", 0, 2, 0.01, 2],
        ["far", "Far planets", 0, 3, 1, 0],
      ],
      "sgroup",
    ],
    ["System", true, [["orb", "Orbit speed", 0, 4, 0.05, 2]], "ssys"],
  ];
  const MAP_KEYS = { sea: 1, scale: 1, mount: 1, temp: 1, wet: 1, cloud: 1 };
  const uiRefs = {};
  function buildPanel() {
    GROUPS.forEach(([title, open, items, target]) => {
      const root = $(target || "groups");
      const d = document.createElement("details");
      if (open) d.open = true;
      const s = document.createElement("summary");
      s.textContent = title;
      d.appendChild(s);
      items.forEach(([k, label, min, max, step, dec]) => {
        const row = document.createElement("div");
        row.className = "sl";
        const l = document.createElement("label");
        l.htmlFor = "s-" + k;
        l.textContent = label;
        const inp = document.createElement("input");
        inp.type = "range";
        inp.id = "s-" + k;
        inp.min = min;
        inp.max = max;
        inp.step = step;
        inp.value = k === "orb" ? S.orb : P[k];
        const out = document.createElement("output");
        out.htmlFor = "s-" + k;
        inp.addEventListener("input", () => {
          if (k === "orb") S.orb = +inp.value;
          else P[k] = +inp.value;
          out.textContent = (+inp.value).toFixed(dec);
          onParam(k);
        });
        row.append(l, inp, out);
        d.appendChild(row);
        uiRefs[k] = { inp, out, dec };
      });
      root.appendChild(d);
    });
  }
  function syncUI() {
    for (const k in uiRefs) {
      const u = uiRefs[k];
      u.inp.value = k === "orb" ? S.orb : P[k];
      u.out.textContent = (+(k === "orb" ? S.orb : P[k])).toFixed(u.dec);
    }
    $("t-rings").checked = P.rings;
    $("t-moon").checked = P.moon;
    $("t-cities").checked = P.cities;
  }

  const NEBS = [
    [
      [0.55, 0.16, 0.78],
      [0.12, 0.4, 0.85],
    ],
    [
      [0.85, 0.26, 0.2],
      [0.95, 0.62, 0.2],
    ],
    [
      [0.1, 0.62, 0.56],
      [0.32, 0.2, 0.75],
    ],
    [
      [0.85, 0.3, 0.62],
      [0.2, 0.32, 0.92],
    ],
    [
      [0.2, 0.45, 0.9],
      [0.75, 0.9, 1],
    ],
  ];
  const GALT = [
    [1, 0.86, 0.66],
    [0.72, 0.82, 1],
    [0.95, 0.7, 0.9],
  ];
  const FARC = [
    [0.8, 0.55, 0.3],
    [0.4, 0.6, 0.9],
    [0.75, 0.35, 0.28],
    [0.55, 0.75, 0.5],
    [0.85, 0.8, 0.65],
    [0.6, 0.45, 0.8],
  ];
  function genBG() {
    const base =
      (mode === "system" && SYS ? SYS.seed * 3 + 11 : W.seed * 7 + 3) +
      bgRoll * 977;
    const r = mulberry32(base >>> 0);
    const dir = () => {
      const z = r() * 2 - 1,
        a = r() * 6.2832,
        q = Math.sqrt(1 - z * z);
      return [q * Math.cos(a), z, q * Math.sin(a)];
    };
    const nb = NEBS[Math.floor(r() * NEBS.length)];
    const gal = [],
      far = [];
    const ng = Math.ceil(P.gal * 3 - 1e-6),
      nf = Math.round(P.far);
    for (let i = 0; i < 3; i++) {
      const d = dir(),
        sz = 0.05 + r() * 0.09,
        t = GALT[Math.floor(r() * GALT.length)];
      gal.push({ d, sz: i < ng ? sz : 0, t, x: r(), y: r(), rot: r() * 3.14 });
      const d2 = dir(),
        rad = 0.035 + r() * 0.07,
        c = FARC[Math.floor(r() * FARC.length)];
      far.push({
        d: d2,
        rad: i < nf ? rad : 0,
        c,
        x: r(),
        y: r(),
        ring: r() < 0.3,
      });
    }
    const blobs = [];
    for (let i = 0; i < 7; i++)
      blobs.push({ x: r(), y: r(), rad: 0.2 + r() * 0.3, k: r() });
    BG = { nebA: nb[0], nebB: nb[1], gal, far, blobs };
  }
  function pushBG() {
    if (!BG) genBG();
    gl.uniform1f(UV.uNeb, P.neb);
    gl.uniform1f(UV.uStarD, P.stars);
    gl.uniform3fv(UV.uNebA, BG.nebA);
    gl.uniform3fv(UV.uNebB, BG.nebB);
    const gd = [],
      fd = [],
      gc = [],
      fc = [];
    for (let i = 0; i < 3; i++) {
      gd.push(...BG.gal[i].d, BG.gal[i].sz);
      fd.push(...BG.far[i].d, BG.far[i].rad);
      gc.push(...BG.gal[i].t.map((v) => v * 0.55));
      fc.push(...BG.far[i].c);
    }
    gl.uniform4fv(UV["uGal[0]"], gd);
    gl.uniform4fv(UV["uFar[0]"], fd);
    gl.uniform3fv(UV["uGalC[0]"], gc);
    gl.uniform3fv(UV["uFarC[0]"], fc);
  }
  function jitterColor(r, c, amt) {
    const s = 1 + (r() - 0.5) * amt * 2;
    return c.map((v) => clamp(v * s + (r() - 0.5) * amt * 0.3, 0, 1));
  }

