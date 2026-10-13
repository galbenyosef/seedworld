// index-inline-1 13 — data
// Lines 3139-3408 of readable/index-inline-1.pretty.js (statement-aligned).
  function paint(m, data) {
    const ctx = m.canvas.getContext("2d");
    const img = ctx.createImageData(512, 256);
    const o = img.data;
    if (m.kind === "h16") {
      for (let i = 0; i < 512 * 256; i++) {
        const v = data[i * 4];
        o[i * 4] = o[i * 4 + 1] = o[i * 4 + 2] = v;
        o[i * 4 + 3] = 255;
      }
    } else o.set(data);
    ctx.putImageData(img, 0, 0);
  }
  let prevTok = 0,
    prevTimer = 0;
  function schedulePreviews() {
    if (window.__manual) return;
    clearTimeout(prevTimer);
    prevTimer = setTimeout(renderPreviews, 250);
  }
  async function renderPreviews() {
    if (!bakeProg || !UB) return;
    const tok = ++prevTok;
    for (const m of MAPS) {
      const on = !m.cond || m.cond();
      m.card.hidden = !on;
      if (!on) continue;
      m.hintEl.textContent = m.hint();
      let data;
      try {
        data = await bakeQ(m.mode, 512, 256, null, bopt());
      } catch (e) {
        console.error(e);
        return;
      }
      if (tok !== prevTok) return;
      paint(m, data);
      if (m.id === "height") {
        W.hdata = data;
        updateHud();
      }
    }
  }
  ["x-flip", "x-rel"].forEach((id) =>
    $(id).addEventListener("input", () => {
      $("x-relo").textContent = (+$("x-rel").value).toFixed(2);
      schedulePreviews();
    }),
  );

  async function downloadOne(m) {
    if (busy) return;
    setBusy(true);
    try {
      const { w, h } = xsize();
      progress("Baking " + m.label.toLowerCase() + "…", 0);
      const data = await bakeQ(
        m.mode,
        w,
        h,
        (f) =>
          progress(
            "Baking " + m.label.toLowerCase() + " " + Math.round(f * 100) + "%",
            f,
          ),
        bopt(),
      );
      progress("Encoding PNG…", 1);
      await tick();
      const bytes = await encodeMap(m, data, w, h);
      saveBlob(new Blob([bytes], { type: "image/png" }), fileName(m, w));
      progress("Saved " + fileName(m, w), null);
    } catch (e) {
      console.error(e);
      progress("Could not export: " + e.message, null);
    }
    setBusy(false);
  }
  async function downloadAll() {
    if (busy) return;
    setBusy(true);
    try {
      const { w, h } = xsize();
      const list = MAPS.filter((m) => !m.cond || m.cond());
      const files = [];
      for (let i = 0; i < list.length; i++) {
        const m = list[i];
        const pre =
          "(" + (i + 1) + "/" + list.length + ") " + m.label.toLowerCase();
        progress(pre + " 0%", i / list.length);
        const data = await bakeQ(
          m.mode,
          w,
          h,
          (f) =>
            progress(
              pre + " " + Math.round(f * 100) + "%",
              (i + f * 0.9) / list.length,
            ),
          bopt(),
        );
        progress(pre + " encoding…", (i + 0.9) / list.length);
        await tick();
        files.push({
          name: fileName(m, w),
          data: await encodeMap(m, data, w, h),
        });
      }
      const info = {
        generator: "Openbench Seedworld",
        url: "https://openbench.fun/seedworld/#" + W.seed,
        name: W.name,
        seed: W.seed,
        type: W.cls.name,
        size: [w, h],
        projection:
          "equirectangular, north at the top, longitude 0 at the centre, wraps left to right",
        seaLevel: +P.sea.toFixed(3),
        seaLevelInHeightMap: +((P.sea - HLO) / HSPAN).toFixed(4),
        settings: {
          continents: P.scale,
          mountains: P.mount,
          warmth: P.temp,
          moisture: P.wet,
          clouds: P.cloud,
        },
        normalFormat:
          +$("x-flip").value === 1 ? "OpenGL (+Y up)" : "DirectX (-Y up)",
        normalStrength: +$("x-rel").value,
        files: files.map((f) => f.name),
      };
      const readme = [
        "Openbench Seedworld texture export",
        "",
        "World: " + W.name + " (" + W.cls.name + "), seed " + W.seed,
        "Open it again: https://openbench.fun/seedworld/#" + W.seed,
        "",
        "Layout: equirectangular, " +
          w +
          " x " +
          h +
          ". North is at the top, longitude 0 is the centre, the left and right edges join seamlessly.",
        "Use them on a standard UV sphere. In Unreal, Unity, Godot and Blender the default sphere mesh uses this layout.",
        "",
        "albedo     sRGB colour without lighting.",
        "height     16-bit grayscale PNG (import as linear, not sRGB). Value = (height - 0.15) / 1.2. Sea level sits at " +
          ((P.sea - HLO) / HSPAN).toFixed(4) +
          " of the range.",
        "normal     Tangent-space normal map, " +
          info.normalFormat +
          ". Import as a normal map. Open water is flat.",
        "roughness  Linear grayscale. Water is smooth, land is rough, ice is in between.",
        "clouds     Linear grayscale cloud density. Use it as opacity on a second sphere slightly larger than the planet.",
        "emissive   Present only for inhabited or lava worlds. sRGB colour for city lights or lava glow.",
        "ocean      Linear grayscale mask, white is open water.",
        "",
        "Free to use in personal and commercial projects. A credit to openbench.fun is welcome but not required.",
      ].join("\n");
      const enc = new TextEncoder();
      files.push(
        { name: "README.txt", data: enc.encode(readme) },
        { name: "info.json", data: enc.encode(JSON.stringify(info, null, 2)) },
      );
      progress("Packing zip…", 1);
      await tick();
      saveBlob(
        makeZip(files),
        slug() + "-" + W.seed + "-textures-" + w + ".zip",
      );
      progress("Saved the zip with " + list.length + " maps", null);
    } catch (e) {
      console.error(e);
      progress("Could not export: " + e.message, null);
    }
    setBusy(false);
  }
  $("x-all").addEventListener("click", downloadAll);
  [...$("x-size").options].forEach((o) => {
    if (+o.value > MAXTEX) o.disabled = true;
  });
  buildCards();

  /* test hook, harmless in production */
  window.__openbench = {
    sysOpts,
    setMode(m) {
      mode = m;
      updateChrome();
    },
    renderNow,
    P,
    W,
    S,
    bakeQ,
    encodeMap,
    makeZip,
    openSystem,
    visit,
    toggleRec,
    hiShot,
    hiShotRun,
    applySeed,
    makeWorld,
    showWorld,
    genBG,
    setPanel,
    setFilm,
    setPaused,
    compose,
    recGeom,
    bgc,
    canvas,
    get SYS() {
      return SYS;
    },
    get mode() {
      return mode;
    },
    set bgRoll(v) {
      bgRoll = v;
    },
    backToSystem,
    get BG() {
      return BG;
    },
  };

  S.dist = baseDist(P.rings);
  try {
    var _p = "seedworld",
      _g = !sessionStorage.getItem("ob_hit"),
      _pc = !!sessionStorage.getItem("ob_hit_" + _p),
      _pf = !localStorage.getItem("ob_seen_" + _p),
      _f = !localStorage.getItem("ob_seen");
    var _r = _pc
      ? fetch("/api/stats")
      : fetch(
          "/api/hit?p=" +
            _p +
            "&u=" +
            (_f ? 1 : 0) +
            "&g=" +
            (_g ? 1 : 0) +
            "&pu=" +
            (_pf ? 1 : 0),
          { method: "POST" },
        );
    _r.then(function (r) {
      return r.json();
    })
      .then(function (d) {
        var x = d && d.pages && d.pages[_p],
          e = document.getElementById("pagevisits");
        if (x && e) {
          e.textContent =
            Number(x.visits || 0).toLocaleString("en-US") + " visits";
          e.hidden = false;
        }
      })
      .catch(function () {});
    sessionStorage.setItem("ob_hit", "1");
    sessionStorage.setItem("ob_hit_" + _p, "1");
    localStorage.setItem("ob_seen", "1");
    localStorage.setItem("ob_seen_" + _p, "1");
  } catch (e) {}
  loadFromHash();
  window.addEventListener("hashchange", () => {
    if (location.hash !== "#" + stateHash()) loadFromHash();
  });
  requestAnimationFrame(frame);
