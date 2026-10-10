// globe.js — the spinning 3D Earth with a dot for every YouTuber.
// It uses a helper library called globe.gl (in the lib folder) that does the hard 3D math.
// Other files talk to it through window.TubeGlobe:
//   TubeGlobe.setCreators(list)  -> put the dots on the globe
//   TubeGlobe.focus(handle)      -> fly the camera to one YouTuber
(function () {
  const el = document.getElementById("globe");
  const picked = document.getElementById("picked");
  const toggle = document.getElementById("earth-toggle");

  // Some old computers can't draw 3D. If so, say so nicely and stop.
  function canDraw3D() {
    try {
      const c = document.createElement("canvas");
      return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
    } catch (e) { return false; }
  }
  if (!window.Globe || !canDraw3D()) {
    el.innerHTML = '<p style="padding:20px">This computer can\'t show the 3D globe, but the leaderboard still works!</p>';
    toggle.hidden = true;
    window.TubeGlobe = { setCreators() {}, focus() {} };
    return;
  }

  const GREEN = "#00ff41";
  let realEarth = false;
  let countries = [];
  let stateLines = [];
  let pins = [];
  let pickedHandle = null;

  const globe = new Globe(el, { animateIn: true })
    .backgroundColor("rgba(0,0,0,0)")
    .showAtmosphere(true)
    .atmosphereColor(GREEN)
    .atmosphereAltitude(0.2)
    .width(el.clientWidth)
    .height(el.clientHeight);

  // ---- "Matrix Earth": a black ball with countries made of little green dots ----
  function paintEarth() {
    const mat = globe.globeMaterial();
    if (realEarth) {
      mat.color.set("#ffffff");
      globe.globeImageUrl("images/earth-blue-marble.jpg");
      globe.hexPolygonsData([]);
    } else {
      mat.color.set("#001a08");
      globe.globeImageUrl(null);
      globe.hexPolygonsData(countries);
    }
    toggle.textContent = realEarth ? "Matrix Earth" : "Real Earth";
  }

  globe
    .hexPolygonResolution(3)
    .hexPolygonMargin(0.35)
    .hexPolygonUseDots(true)
    .hexPolygonColor(() => GREEN)
    .hexPolygonLabel((d) => '<span style="font-family:monospace;color:#00ff41">' + d.properties.name + "</span>");

  // ---- US state borders as thin green lines ----
  globe
    .pathsData([])
    .pathPoints((line) => line)
    .pathPointLat((p) => p[1])
    .pathPointLng((p) => p[0])
    .pathPointAlt(0.003)
    .pathColor(() => "rgba(0,255,65,0.55)")
    .pathStroke(1)
    .pathTransitionDuration(0);

  // ---- The YouTuber dots ----
  globe
    .htmlElementsData([])
    .htmlLat("lat")
    .htmlLng("lng")
    .htmlAltitude(0.01)
    .htmlElement((d) => d.node);

  function makePin(c) {
    const node = document.createElement("button");
    node.type = "button";
    node.className = "pin" + (c.live ? " is-live" : "");
    node.setAttribute("aria-label", c.name + ", " + c.place);
    node.style.background = "none";
    node.style.border = "none";
    node.innerHTML =
      (c.avatar ? '<img alt="" src="' + c.avatar + '">' : '<div class="dot"></div>') +
      "<span>" + c.name + "</span>";
    node.addEventListener("click", () => focus(c.handle));
    return node;
  }

  // Lots of YouTubers live in Texas! So when several share a place,
  // we spread their dots out in a little circle so they don't stack on top of each other.
  function spreadOut(list) {
    const groups = {};
    list.forEach((c) => (groups[c.place] = groups[c.place] || []).push(c));
    const out = [];
    Object.values(groups).forEach((group) => {
      group.forEach((c, i) => {
        let lat = c.lat, lng = c.lng;
        if (group.length > 1) {
          const angle = (i / group.length) * Math.PI * 2;
          const r = 1.2 + group.length * 0.25;
          lat += Math.sin(angle) * r;
          lng += (Math.cos(angle) * r) / Math.cos((c.lat * Math.PI) / 180);
        }
        out.push(Object.assign({}, c, { lat, lng }));
      });
    });
    return out;
  }

  function setCreators(list) {
    pins = spreadOut(list).map((c) => Object.assign(c, { node: makePin(c) }));
    globe.htmlElementsData(pins);
    if (pickedHandle) highlight(pickedHandle);
  }

  function highlight(handle) {
    pins.forEach((p) => p.node.classList.toggle("is-picked", p.handle === handle));
  }

  function focus(handle) {
    const p = pins.find((x) => x.handle === handle);
    if (!p) return;
    pickedHandle = handle;
    controls.autoRotate = false;
    globe.pointOfView({ lat: p.lat, lng: p.lng, altitude: 0.9 }, 1500);
    highlight(handle);
    picked.hidden = false;
    picked.innerHTML =
      "<b>#" + p.rank + " " + p.name + "</b> lives in <b>" + p.place + "</b>" +
      (p.viewsText ? " &middot; " + p.viewsText + " views" : "") +
      (p.live ? ' &middot; <span class="live">LIVE NOW</span>' : "");
  }

  // ---- Camera: spin slowly until someone grabs it ----
  const controls = globe.controls();
  controls.autoRotate = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  controls.autoRotateSpeed = 0.5;
  controls.enableDamping = true;
  controls.minDistance = globe.getGlobeRadius() * 1.15;
  controls.maxDistance = globe.getGlobeRadius() * 5;
  controls.addEventListener("start", () => (controls.autoRotate = false));
  globe.pointOfView({ lat: 35, lng: -60, altitude: 2.3 });

  // Keep the globe the right size when the window changes
  window.addEventListener("resize", () => globe.width(el.clientWidth).height(el.clientHeight));

  toggle.addEventListener("click", () => {
    realEarth = !realEarth;
    paintEarth();
  });

  // Load the country shapes and state lines (they're in the data folder)
  Promise.all([
    fetch("data/countries.json").then((r) => r.json()),
    fetch("data/us-state-lines.json").then((r) => r.json()),
  ]).then(([c, s]) => {
    countries = c.features;
    stateLines = s;
    globe.pathsData(stateLines);
    paintEarth();
  });
  paintEarth();

  window.TubeGlobe = { setCreators, focus };
})();
