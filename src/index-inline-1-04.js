// index-inline-1 04 — atm
// Lines 384-721 of readable/index-inline-1.pretty.js (statement-aligned).
  const bakeProg = link(BAKE_FS);
  const sunProg = link(
    "precision mediump float;uniform vec2 uC;uniform float uR;uniform vec3 uCol;void main(){float t=length(gl_FragCoord.xy-uC)/uR;float a=clamp((1.-t)*uR+.5,0.,1.);vec3 c=t<.55?mix(vec3(1.),uCol,t/.55):mix(uCol,uCol*.85,(t-.55)/.45);gl_FragColor=vec4(c*a,a);}",
  );
  const sunU = sunProg
    ? {
        c: gl.getUniformLocation(sunProg, "uC"),
        r: gl.getUniformLocation(sunProg, "uR"),
        col: gl.getUniformLocation(sunProg, "uCol"),
      }
    : null;
  gl.useProgram(prog);
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const PAL_KEYS = [
    "deep",
    "shallow",
    "sand",
    "dry",
    "grass",
    "green",
    "rock",
    "snow",
    "atm",
    "cloud",
    "ringA",
    "ringB",
  ];
  const PAL_U = {
    deep: "cDeep",
    shallow: "cShallow",
    sand: "cSand",
    dry: "cDry",
    grass: "cGrass",
    green: "cGreen",
    rock: "cRock",
    snow: "cSnow",
    atm: "cAtm",
    cloud: "cCloud",
    ringA: "cRingA",
    ringB: "cRingB",
  };
  const SHARED_U = [
    "uTime",
    "uSea",
    "uScale",
    "uMount",
    "uTemp",
    "uWet",
    "uCloud",
    "uAtm",
    "uTilt",
    "uIce",
    "uEmit",
    "uCity",
    "uOct",
    "uGas",
    "uOff",
    "uCOff",
  ].concat(PAL_KEYS.map((k) => PAL_U[k]));
  function locs(p, names) {
    const o = {};
    names.forEach((n) => (o[n] = gl.getUniformLocation(p, n)));
    return o;
  }
  const UV = locs(
    prog,
    SHARED_U.concat([
      "uRes",
      "uOrig",
      "uShift",
      "uSys",
      "uRot",
      "uCloudRot",
      "uDist",
      "uRelief",
      "uRing",
      "uRingIn",
      "uRingOut",
      "uMoon",
      "uCam",
      "uSun",
      "uMoonPos",
      "uNeb",
      "uStarD",
      "uNebA",
      "uNebB",
      "uGal[0]",
      "uFar[0]",
      "uGalC[0]",
      "uFarC[0]",
    ]),
  );
  const UB = bakeProg
    ? locs(
        bakeProg,
        SHARED_U.concat(["uSize", "uRow0", "uMode", "uStrength", "uFlip"]),
      )
    : null;

  /* ================= worlds ================= */
  const CLASSES = [
    {
      id: "temperate",
      name: "Temperate world",
      w: 3,
      ice: 0.14,
      emit: 0,
      cityP: 0.7,
      ringP: 0.1,
      day: [18, 30],
      p: {
        sea: 0.52,
        scale: 1,
        mount: 0.7,
        temp: 0,
        wet: 0.5,
        cloud: 0.5,
        atm: 1,
      },
      c: {
        deep: [0.02, 0.07, 0.2],
        shallow: [0.05, 0.34, 0.46],
        sand: [0.76, 0.68, 0.5],
        dry: [0.55, 0.45, 0.28],
        grass: [0.36, 0.5, 0.17],
        green: [0.12, 0.3, 0.1],
        rock: [0.4, 0.35, 0.31],
        snow: [0.93, 0.95, 0.98],
        atm: [0.35, 0.6, 1],
        cloud: [1, 1, 1],
      },
    },
    {
      id: "ocean",
      name: "Ocean world",
      w: 2,
      ice: 0.1,
      emit: 0,
      cityP: 0.3,
      ringP: 0.1,
      day: [14, 26],
      p: {
        sea: 0.62,
        scale: 1.1,
        mount: 0.55,
        temp: 0,
        wet: 0.6,
        cloud: 0.62,
        atm: 1.1,
      },
      c: {
        deep: [0.01, 0.05, 0.18],
        shallow: [0.03, 0.4, 0.5],
        sand: [0.8, 0.74, 0.58],
        dry: [0.45, 0.5, 0.3],
        grass: [0.28, 0.5, 0.22],
        green: [0.1, 0.34, 0.14],
        rock: [0.35, 0.34, 0.32],
        snow: [0.93, 0.96, 1],
        atm: [0.3, 0.58, 1],
        cloud: [1, 1, 1],
      },
    },
    {
      id: "desert",
      name: "Desert world",
      w: 2,
      ice: 0.02,
      emit: 0,
      cityP: 0,
      ringP: 0.12,
      day: [20, 48],
      p: {
        sea: 0.36,
        scale: 1,
        mount: 0.8,
        temp: 0.1,
        wet: 0.18,
        cloud: 0.16,
        atm: 0.9,
      },
      c: {
        deep: [0.05, 0.12, 0.18],
        shallow: [0.15, 0.4, 0.42],
        sand: [0.85, 0.66, 0.4],
        dry: [0.78, 0.5, 0.3],
        grass: [0.62, 0.5, 0.28],
        green: [0.42, 0.38, 0.2],
        rock: [0.5, 0.32, 0.22],
        snow: [0.95, 0.9, 0.85],
        atm: [0.95, 0.7, 0.45],
        cloud: [1, 0.94, 0.88],
      },
    },
    {
      id: "frozen",
      name: "Frozen world",
      w: 1.5,
      ice: 0.5,
      emit: 0,
      cityP: 0,
      ringP: 0.2,
      day: [10, 40],
      p: {
        sea: 0.5,
        scale: 1,
        mount: 0.8,
        temp: -0.05,
        wet: 0.4,
        cloud: 0.42,
        atm: 1,
      },
      c: {
        deep: [0.03, 0.08, 0.16],
        shallow: [0.25, 0.5, 0.6],
        sand: [0.7, 0.75, 0.8],
        dry: [0.6, 0.65, 0.7],
        grass: [0.5, 0.6, 0.58],
        green: [0.35, 0.5, 0.5],
        rock: [0.35, 0.38, 0.42],
        snow: [0.92, 0.96, 1],
        atm: [0.6, 0.8, 1],
        cloud: [0.96, 0.98, 1],
      },
    },
    {
      id: "exotic",
      name: "Exotic biosphere",
      w: 1.5,
      ice: 0.1,
      emit: 0,
      cityP: 0,
      ringP: 0.4,
      day: [8, 22],
      p: {
        sea: 0.5,
        scale: 1.15,
        mount: 0.9,
        temp: 0,
        wet: 0.55,
        cloud: 0.45,
        atm: 1.2,
      },
      c: {
        deep: [0.08, 0.02, 0.15],
        shallow: [0.1, 0.35, 0.35],
        sand: [0.7, 0.6, 0.75],
        dry: [0.35, 0.5, 0.45],
        grass: [0.6, 0.35, 0.55],
        green: [0.45, 0.15, 0.4],
        rock: [0.25, 0.22, 0.3],
        snow: [0.85, 0.95, 0.9],
        atm: [0.75, 0.45, 1],
        cloud: [0.95, 0.92, 1],
      },
    },
    {
      id: "gas",
      name: "Gas giant",
      w: 0,
      gas: 1,
      ice: -2,
      emit: 0,
      cityP: 0,
      ringP: 0.35,
      day: [9, 18],
      p: {
        sea: 0.5,
        scale: 1,
        mount: 0.5,
        temp: 0,
        wet: 0.3,
        cloud: 0.12,
        atm: 1.3,
      },
      c: {
        deep: [0.1, 0.1, 0.1],
        shallow: [0.2, 0.2, 0.2],
        sand: [0.86, 0.75, 0.58],
        dry: [0.7, 0.46, 0.3],
        grass: [0.6, 0.5, 0.4],
        green: [0.5, 0.4, 0.3],
        rock: [0.5, 0.36, 0.28],
        snow: [0.95, 0.92, 0.86],
        atm: [0.8, 0.7, 0.55],
        cloud: [1, 0.96, 0.9],
      },
    },
    {
      id: "lava",
      name: "Lava world",
      w: 1,
      ice: -2,
      emit: 1.4,
      cityP: 0,
      ringP: 0.1,
      day: [30, 90],
      p: {
        sea: 0.5,
        scale: 1,
        mount: 1.1,
        temp: 0,
        wet: 0.3,
        cloud: 0.3,
        atm: 0.9,
      },
      c: {
        deep: [0.35, 0.05, 0.01],
        shallow: [1, 0.38, 0.06],
        sand: [0.12, 0.1, 0.09],
        dry: [0.2, 0.16, 0.13],
        grass: [0.22, 0.16, 0.13],
        green: [0.16, 0.13, 0.12],
        rock: [0.28, 0.24, 0.22],
        snow: [0.5, 0.48, 0.46],
        atm: [1, 0.5, 0.3],
        cloud: [0.35, 0.3, 0.28],
      },
    },
  ];
  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
