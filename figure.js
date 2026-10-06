// Players in 3D, from their own skins, doing parkour moves. Shared by the leaderboards podium
// and the activity page; skinview3d (MIT, in assets/lib) loads only when a page needs it.

let viewerLib = null;

function loadViewer() {
  viewerLib ||= new Promise((resolve, reject) => {
    document.head.append(h("script", { src: asset("assets/lib/skinview3d.bundle.js"), onload: resolve, onerror: reject }));
  });
  return viewerLib;
}

// The context is made first, with the graphics card's antialiasing, and the viewer takes it
// as it is; the viewer's own smoothing pass is never used
function makeViewer(canvas) {
  if (!canvas.getContext("webgl2", { antialias: true, alpha: true, premultipliedAlpha: true })) throw new Error("no WebGL");
  const s = new skinview3d.SkinViewer({ canvas, width: 1, height: 1, renderPaused: true });
  s.controls.enabled = false;
  s.autoRotate = false;
  s.animation = null;
  canvas.style.width = "";
  canvas.style.height = "";
  s.gl = s.renderer;
  // no waiting on the card to report shader errors; see shadersReady
  s.gl.debug.checkShaderErrors = false;
  s.gl.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  s.gl.setClearColor(0, 0);
  // the viewer's own pipeline shows colours as they are, without the sRGB step; keep that look
  s.gl.outputColorSpace = "srgb-linear";
  // light from above and a little in front, as in the game: tops bright, sides darker
  const Light = s.cameraLight.constructor;
  s.globalLight.intensity = 1.8;
  s.cameraLight.intensity = 0.35;
  const sun = new Light(0xffffff, 2.2, 0, 0);
  sun.position.set(-40, 140, 60);
  // and a rim of light from behind in the colour of the player's tier
  s.rim = new Light(0xffffff, 0, 0, 0);
  s.rim.position.set(70, 40, -90);
  s.scene.add(sun, s.rim);
  dress(s.playerObject);
  return s;
}

// capes, elytra and ears are never shown; out of the scene they cost nothing
function dress(actor) {
  actor.cape.removeFromParent();
  actor.elytra.removeFromParent();
  actor.ears.removeFromParent();
  // the outer skin layer is cut out, never see-through, so one pass draws it; the default
  // two passes would rebuild its shader state on every single draw
  actor.skin.layer2Material.forceSinglePass = true;
  actor.skin.layer2MaterialBiased.forceSinglePass = true;
}

// Shaders compile on the graphics card's own threads where the browser allows it, so the page
// keeps answering in the meantime; this waits until they are done.
function shadersReady(s) {
  const gl = s.gl.getContext();
  const parallel = gl.getExtension("KHR_parallel_shader_compile");
  const programs = s.gl.info.programs || [];
  if (!parallel) return Promise.resolve();
  const until = performance.now() + 4000;
  return new Promise((resolve) => {
    const check = () => {
      // a lost context answers nothing, and no card takes this long: go on and let the draw wait
      const done = gl.isContextLost() || performance.now() > until || programs.every((p) => gl.getProgramParameter(p.program, parallel.COMPLETION_STATUS_KHR));
      if (done) resolve();
      else setTimeout(check, 30);
    };
    check();
  });
}

function picture(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// a skin file adds itself to skinData when loaded
function skinOf(name) {
  if (skinData[name]) return Promise.resolve(skinData[name]);
  if (!skinSlim.includes(name) && !skinWide.includes(name)) return Promise.resolve(skinBlank);
  return new Promise((resolve) => {
    const done = () => resolve(skinData[name] || skinBlank);
    document.head.append(h("script", { src: asset(`data/skin/${name}.js`), onload: done, onerror: done }));
  });
}

// A move is a list of keys per joint, [ms, value]; the last key is where the joint rests.
// Limbs swing forward with a negative x. "crouch" is the game's sneak, "lift" goes from 0
// to 1 of "air" pixels, "slide" moves the player sideways, "land" is when it touches down.
const TAU = 2 * Math.PI;

// keys that follow f(u) for u from 0 to 1, between t0 and t1
function along(t0, t1, f, n = 10) {
  return Array.from({ length: n + 1 }, (_, i) => [t0 + ((t1 - t0) * i) / n, f(i / n)]);
}

// starts and ends gently, steady in between
const wheel = (u) => u + 0.6 * (u * u * (3 - 2 * u) - u);

const MOVES = {
  // backflip off the gold, lands on both feet and throws both arms up
  flip: {
    delay: 1900, length: 3000, air: 135, extra: 40, dust: [430, 1300], land: 1300, orbs: 1350, orbCount: 18,
    crouch: [[0, 0], [250, 0.7], [420, 0], [1180, 0], [1300, 0.75], [1550, 0.1], [1800, 0], [3000, 0]],
    flip: [[0, 0], [420, 0], [600, -1.5], [800, -3.2], [1000, -4.9], [1200, -TAU], [3000, -TAU]],
    turn: [[0, 0.2], [300, 0.1], [450, -1.15], [1000, -1.1], [1350, 0.2], [1700, 0.35], [3000, 0.35]],
    lift: [[0, 0], [420, 0], [600, 0.62], [800, 1], [1000, 0.7], [1180, 0.12], [1300, 0], [3000, 0]],
    ra: [[0, 0], [250, 0.9], [420, -2.9], [650, -1.5], [1000, -1.3], [1250, -0.6], [1350, 0.3], [1650, -2.95], [1850, -2.7], [3000, -2.75]],
    la: [[0, 0], [250, 0.9], [420, -2.9], [650, -1.5], [1000, -1.3], [1250, -0.6], [1350, 0.3], [1650, -2.95], [1850, -2.7], [3000, -2.75]],
    raz: [[0, 0], [1350, 0], [1650, -0.5], [1850, -0.42], [3000, -0.45]],
    laz: [[0, 0], [1350, 0], [1650, 0.5], [1850, 0.42], [3000, 0.45]],
    rl: [[0, 0], [420, 0], [600, -1.4], [1000, -1.4], [1200, -0.4], [1300, -0.15], [1600, 0], [3000, 0]],
    ll: [[0, 0], [420, 0], [600, -1.3], [1000, -1.3], [1200, 0.3], [1300, 0.15], [1600, 0], [3000, 0]],
    rlz: [[0, 0], [1250, 0], [1350, -0.12], [1700, -0.06], [3000, -0.06]],
    llz: [[0, 0], [1250, 0], [1350, 0.12], [1700, 0.06], [3000, 0.06]],
    hx: [[0, 0], [250, 0.3], [420, -0.3], [1250, 0.3], [1400, 0.35], [1700, -0.35], [1900, -0.27], [3000, -0.3]],
  },
  // an aerial from standing: arms up, a star wheeling sideways toward the middle of the podium,
  // a soft landing, then both arms open to the crowd
  aerial: {
    delay: 1000, length: 3100, air: 85, extra: 40, dust: [520, 1520], land: 1520, orbs: 1570, orbCount: 14,
    roll: [[0, 0], ...along(520, 1520, (u) => -TAU * wheel(u))],
    slide: [[0, -110], ...along(520, 1520, (u) => -110 * (1 - wheel(u)))],
    lift: [[0, 0], ...along(520, 1520, (u) => 4 * u * (1 - u))],
    turn: [[0, 0.1], [1520, 0.1], [2000, 0.25], [3100, 0.3]],
    crouch: [[0, 0], [200, 0], [460, 0.4], [540, 0], [1480, 0], [1600, 0.55], [1800, 0.15], [1950, 0], [3100, 0]],
    raz: [[0, 0], [200, 0], [460, -2.7], [600, -1.6], [1350, -1.5], [1700, -0.35], [2000, -0.1], [2300, -0.1], [2550, -1.05], [2750, -0.92], [3100, -0.95]],
    laz: [[0, 0], [200, 0], [460, 2.7], [600, 1.6], [1350, 1.5], [1700, 0.35], [2000, 0.1], [2300, 0.1], [2550, 1.05], [2750, 0.92], [3100, 0.95]],
    ra: [[0, 0], [2300, 0], [2550, -0.6], [3100, -0.55]],
    la: [[0, 0], [2300, 0], [2550, -0.6], [3100, -0.55]],
    rlz: [[0, 0], [540, 0], [700, -0.6], [1380, -0.6], [1520, -0.2], [1800, -0.07], [3100, -0.07]],
    llz: [[0, 0], [540, 0], [700, 0.6], [1380, 0.6], [1520, 0.2], [1800, 0.07], [3100, 0.07]],
    lean: [[0, 0], [2300, 0], [2600, -0.08], [3100, -0.07]],
    hx: [[0, 0], [460, -0.2], [700, 0.1], [1520, 0.2], [1800, 0], [2300, 0], [2600, -0.35], [3100, -0.3]],
  },
  // a 360 jump: winds up, turns a full circle in the air, lands facing us and punches one fist up
  spin: {
    delay: 0, length: 2700, air: 70, dust: [520, 1420], land: 1420, orbs: 1470, orbCount: 10,
    turn: [[0, -0.3], [200, -0.3], [460, -0.8], ...along(520, 1420, (u) => -0.8 + (TAU + 0.5) * wheel(u))],
    lift: [[0, 0], ...along(520, 1420, (u) => 4 * u * (1 - u))],
    crouch: [[0, 0], [200, 0], [460, 0.45], [540, 0], [1380, 0], [1500, 0.5], [1700, 0.1], [1850, 0], [2000, 0], [2130, 0.22], [2280, 0], [2700, 0]],
    ra: [[0, 0], [200, 0], [460, 0.6], [620, -1.2], [1300, -1.2], [1550, 0], [2000, 0], [2130, 0.6], [2300, -3.0], [2450, -2.82], [2700, -2.85]],
    la: [[0, 0], [200, 0], [460, 0.6], [620, -1.2], [1300, -1.2], [1550, 0], [2700, 0]],
    raz: [[0, 0], [540, 0], [620, 0.25], [1300, 0.25], [1550, -0.1], [2000, -0.1], [2300, -0.48], [2700, -0.42]],
    laz: [[0, 0], [540, 0], [620, -0.25], [1300, -0.25], [1550, 0.1], [2700, 0.12]],
    rl: [[0, 0], [540, 0], [700, -0.35], [1250, -0.35], [1420, 0], [2700, 0]],
    ll: [[0, 0], [540, 0], [700, -0.15], [1250, -0.15], [1420, 0], [2700, 0]],
    rlz: [[0, 0], [1700, 0], [2000, -0.08], [2700, -0.08]],
    llz: [[0, 0], [1700, 0], [2000, 0.08], [2700, 0.08]],
    hx: [[0, 0], [460, 0.25], [700, 0], [1420, 0.15], [1700, 0], [2000, -0.1], [2300, -0.4], [2700, -0.35]],
  },
};

// a smooth curve through the keys that never swings past one: a limb that stops, stops there
const slopes = new WeakMap();

function slopesOf(keys) {
  if (slopes.has(keys)) return slopes.get(keys);
  const n = keys.length;
  const step = [];
  for (let i = 0; i < n - 1; i++) step.push((keys[i + 1][1] - keys[i][1]) / (keys[i + 1][0] - keys[i][0]));
  const m = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    const [a, b] = [step[i - 1], step[i]];
    if (a * b <= 0) continue;
    const h0 = keys[i][0] - keys[i - 1][0];
    const h1 = keys[i + 1][0] - keys[i][0];
    const w1 = 2 * h1 + h0;
    const w2 = h1 + 2 * h0;
    m[i] = (w1 + w2) / (w1 / a + w2 / b);
  }
  slopes.set(keys, m);
  return m;
}

function track(keys, ms) {
  if (!keys) return 0;
  if (ms <= keys[0][0]) return keys[0][1];
  const last = keys.length - 1;
  if (ms >= keys[last][0]) return keys[last][1];
  let i = 0;
  while (keys[i + 1][0] < ms) i++;
  const m = slopesOf(keys);
  const [t1, p1] = keys[i];
  const [t2, p2] = keys[i + 1];
  const h = t2 - t1;
  const u = (ms - t1) / h;
  const u2 = u * u;
  const u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * p1 + (u3 - 2 * u2 + u) * h * m[i] + (3 * u2 - 2 * u3) * p2 + (u3 - u2) * h * m[i + 1];
}

// arms and head trail the body a little
const LAG = { ra: 60, la: 60, raz: 60, laz: 60, hx: 90, hy: 90 };
const LAG_MAX = 90;

function pose(player, kind, ms) {
  const move = MOVES[kind];
  const at = (joint) => track(move[joint], ms - (LAG[joint] || 0));
  const s = player.skin;
  s.resetJoints();
  // the sneak of the game, from skinview3d's crouch animation, scaled by k
  const k = at("crouch");
  s.body.rotation.x = 0.4538 * k;
  s.body.position.z = -2.1244 * k;
  s.body.position.y = -6 - 2.1037 * k;
  s.head.position.y = -3.6183 * k;
  s.rightArm.position.z = s.leftArm.position.z = 0.1683 * k;
  s.rightArm.position.y = s.leftArm.position.y = -2 - 2.5394 * k;
  s.rightLeg.position.z = s.leftLeg.position.z = -0.1 - 3.45 * k;
  s.rightArm.rotation.x = at("ra");
  s.rightArm.rotation.z = at("raz");
  s.leftArm.rotation.x = at("la");
  s.leftArm.rotation.z = at("laz");
  s.rightLeg.rotation.x = at("rl");
  s.rightLeg.rotation.z = at("rlz");
  s.leftLeg.rotation.x = at("ll");
  s.leftLeg.rotation.z = at("llz");
  s.head.rotation.x = at("hx");
  s.head.rotation.y = at("hy");
  s.rotation.x = at("lean");
  // turn first, then flip around the player's own sideways axis
  player.rotation.order = "YXZ";
  player.rotation.set(at("flip"), at("turn"), at("roll"));
  return at("lift");
}

function puff(box) {
  const dust = h("span", { class: "dust" }, Array.from({ length: 7 }, () => h("i")));
  box.append(dust);
  setTimeout(() => dust.remove(), 900);
}

// experience orbs come out of the block and fly into the player, as in the game
function orbs(box, count) {
  const w = box.clientWidth;
  const top = box.clientHeight;
  for (let i = 0; i < count; i++) {
    const orb = h("i", { class: "orb" });
    box.append(orb);
    const x0 = w * (0.15 + Math.random() * 0.7);
    const y0 = top + 20 + Math.random() * 60;
    const x1 = w / 2 + (Math.random() - 0.5) * 30;
    const y1 = top * 0.5;
    const bend = (Math.random() - 0.5) * 120;
    // they pop out of the block, drift, then speed up into the player
    orb.animate([
      { translate: `${x0}px ${y0}px`, scale: 0.4, opacity: 0, easing: "cubic-bezier(0.2, 0.8, 0.4, 1)" },
      { translate: `${x0}px ${y0 - 50}px`, scale: 1, opacity: 1, offset: 0.25, easing: "ease-in-out" },
      { translate: `${(x0 + x1) / 2 + bend}px ${(y0 + y1) / 2 - 30}px`, scale: 1, opacity: 1, offset: 0.6, easing: "cubic-bezier(0.6, 0, 0.9, 0.4)" },
      { translate: `${x1}px ${y1}px`, scale: 0.5, opacity: 0.2 },
    ], { duration: 900 + Math.random() * 400, delay: i * 50, fill: "both" })
      .finished.then(() => orb.remove());
  }
}

// the value on a name tag starts at 0 and counts up when its player lands
function countUp(value) {
  const text = [...value.childNodes].find((node) => node.nodeType === 3 && /^\d+/.test(node.data));
  if (!text) return;
  const [, digits, rest] = text.data.match(/^(\d+)(.*)$/);
  const end = Number(digits);
  text.data = `0${rest}`;
  value.count = () => {
    value.count = null;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / 900);
      text.data = `${Math.round(end * (1 - (1 - t) ** 3))}${rest}`;
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
}

// a puff of white smoke, as anything gets when it spawns in the game, centred at x over bottom
function smoke(area, x, bottom, height, scale) {
  const cloud = h("span", { class: "poof", style: `left: ${x}px; bottom: ${bottom}px` });
  for (let i = 0; i < 26; i++) {
    const size = (16 + Math.random() * 16) * scale;
    const grey = 200 + Math.round(Math.random() * 55);
    const speck = h("i", { style: `left: ${(Math.random() - 0.5) * 100 * scale - size / 2}px; top: ${-Math.random() * height * 0.9 - size / 2}px; width: ${size}px; height: ${size}px; background: rgb(${grey}, ${grey}, ${grey})` });
    // the cloud is thick for a moment, hiding the player as it appears, then thins out and rises
    speck.animate([
      { opacity: 0, scale: 0.4, translate: "0 0" },
      { opacity: 1, scale: 1, translate: "0 -4px", offset: 0.2 },
      { opacity: 0.85, scale: 1.1, translate: "0 -10px", offset: 0.45 },
      { opacity: 0, scale: 1.3, translate: `${(Math.random() - 0.5) * 30}px ${-24 - Math.random() * 20}px` },
    ], { duration: 650 + Math.random() * 300, delay: Math.random() * 80, easing: "ease-out", fill: "both" });
    cloud.append(speck);
  }
  area.append(cloud);
  setTimeout(() => cloud.remove(), 1100);
}
