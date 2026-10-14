// The home: a stage that turns through the hardest beaten map of each gamemode, each with the
// player who beat it first standing in 3D in front of it for that gamemode's players; then the
// search, a door to each part of the site, the newest victories as a hotbar and a beacon for the
// whole community.

function shortDay(iso) {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

function longDay(iso) {
  return `${shortDay(iso)} ${iso.slice(0, 4)}`;
}

function ordinal(n) {
  const tail = n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th";
  return `${n}${tail}`;
}

function badgeOf(row) {
  return row ? { name: row[0], color: row[1], end: row[2], third: row[3] } : null;
}

// a map name painted in its VICTOR badge, as everywhere on the site
function paintedMap(name, badge) {
  if (!badge) return h("span", {}, name);
  return h("span", { class: `name${badge.end ? " blend" : ""}`, style: nameColours(badge.color, badge.end, badge.third) }, name);
}

function mapLink(name) {
  return PAGES[name] || `maps.html?find=${encodeURIComponent(name)}`;
}

function playerLink(name) {
  return PAGES[name] || `leaderboards.html?pick=${encodeURIComponent(name)}`;
}

// "M7 Start (l/d to M7-6)" reads as "M7 Start" in a short line
function stepName(text) {
  return stripFlags(text).split(" (")[0];
}

function tierColour(tier) {
  return getComputedStyle(document.documentElement).getPropertyValue(`--t${tier}`).trim();
}

// values from 189 up are above the top of the scale, as the bot's role list says
function tierWords(value) {
  return value >= 189 ? "Tier X+" : `Tier ${ROMAN[tierOf(value)]}`;
}

// "Rankup, Tier X+. Released 20 Mar 2024.", the date never split across lines
function stageSub(m) {
  return [`${m.mode}, ${tierWords(m.value)}.`, m.released ? [" Released ", h("span", { class: "nowrap" }, `${longDay(m.released)}.`)] : ""].flat();
}

function pickLabel(m) {
  return m.victors ? `${m.name}, ${m.victors} ${m.victors === 1 ? "victor" : "victors"}` : `${m.name}, unbeaten, ${shareLeft(m)}% left`;
}

function shareLeft(m) {
  return Math.round((100 * (m.steps + 1 - m.held)) / (m.steps + 1));
}

// what the stage says about a map: how much is left and who is closest, or who beat it first
function stageStatus(m, badge) {
  if (!m.victors) {
    const left = shareLeft(m);
    const colours = badge ? `--c1: ${badge.color}; --c2: ${badge.end || badge.color}; --c3: ${badge.third || badge.end || badge.color}` : "";
    return [
      h("span", { class: "stage-line" }, h("span", {}, "Still to beat"), h("b", {}, `${left}% left`)),
      h("span", { class: "stage-bar", style: `--left: ${left}%; ${colours}`, role: "img", "aria-label": `${left}% of the map still to beat` }, h("i")),
    ];
  }
  return [
    h("span", { class: "stage-line" }, h("span", {}, m.victors === 1 ? "1 victor" : `${m.victors} victors`)),
    h("span", { class: "stage-faces" }, m.faces.map((name) => tip(h("a", { href: playerLink(name), "aria-label": name }, head(name)), () => `<b>${esc(name)}</b>`))),
  ];
}

function stageWho(m) {
  if (!m.victors) {
    const [name, step] = m.furthest;
    const togo = m.steps - m.held;
    const rest = togo ? `${togo} ${togo === 1 ? "step" : "steps"} and the victory to go` : "only the victory to go";
    return [head(name), nameTag(name), ` is at ${stepName(step)}: ${rest}`];
  }
  const [name, day] = m.first;
  // a map can be beaten by its verifier before it goes on the list
  const when = h("span", { class: "nowrap" }, longDay(day));
  if (m.released && day < m.released) return [head(name), "Beaten by ", nameTag(name), " before its release, ", when];
  return [head(name), "First beaten by ", nameTag(name), ", ", when];
}

// The player on the stage, in 3D from their own skin, comes on in a puff of smoke and does a move
// as on the podium: a backflip for whoever beat the map, a spin for whoever is closest to it.
let stageViewer = null;
let stageRun = 0;
// the title and the stage's player take turns, overlapping only at the end of each. At load the
// title goes first and the stage's player comes on once it is written and "Welcome to" is in its
// place, while Texyle sits down (titleHolds); a title that comes into view later waits until the
// stage's player has landed (stageBusy); and the stage doesn't turn until the title is built
// (titleBusy)
let stageBusy = false;
let titleBusy = false;
let titleHolds = false;

function getStageViewer() {
  stageViewer ||= loadViewer().then(() => {
    const s = makeViewer(h("canvas", { class: "stage-figure", "aria-hidden": "true" }));
    new ResizeObserver(() => sizeStage(s)).observe(s.canvas);
    return s;
  });
  return stageViewer;
}

function sizeStage(s) {
  const box = s.canvas.getBoundingClientRect();
  const width = Math.round(box.width);
  const height = Math.round(box.height);
  if (width && height && (width !== s.width || height !== s.height)) {
    s.width = width;
    s.height = height;
    s.gl.setSize(width, height, false);
  }
  paintStage(s);
}

function paintStage(s) {
  const view = s.view;
  if (!view || !s.width) return;
  const camera = s.camera;
  camera.fov = 30;
  s.gl.setViewport(0, view.up * view.move.air * view.scale, s.width, view.tall);
  s.rim.intensity = view.rim ? 2.4 : 0;
  if (view.rim) s.rim.color.set(view.rim);
  // seen from a little below, as on the podium
  const far = 4.5 + 16.5 / Math.tan((15 * Math.PI) / 180) / view.zoom;
  camera.aspect = s.width / view.tall;
  camera.position.set(0, -Math.sin(0.16) * far, Math.cos(0.16) * far);
  camera.lookAt(0, 2, 0);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  s.gl.render(s.scene, camera);
}

async function stagePlayer(name, kind, tier, run) {
  const spot = document.getElementById("stage-player");
  const key = name.toLowerCase();
  const tag = h("span", { class: "stage-tag" }, nameTag(name));
  let s;
  let skin;
  try {
    s = await getStageViewer();
    skin = await skinOf(key).then(picture);
  } catch {
    // no 3D here (no WebGL): the face stands in for the player
    if (run === stageRun) {
      spot.replaceChildren(h("span", { class: "stage-flat" }, head(name)), tag);
      stageBusy = false;
    }
    return;
  }
  if (run !== stageRun) return;
  s.loadSkin(skin, { model: skinSlim.includes(key) ? "slim" : "default" });
  const move = MOVES[kind];
  const height = spot.clientHeight;
  const scale = height / 340;
  const extra = (move.extra || 0) * scale;
  const tall = height + extra;
  s.view = { move, scale, tall, zoom: (0.9 * height) / tall, up: 0, rim: tierColour(tier) };
  s.canvas.style.width = `${Math.round(440 * scale)}px`;
  s.canvas.style.height = `${Math.round(tall + move.air * scale)}px`;
  s.canvas.style.bottom = `${-Math.round(16 * scale + extra / 2)}px`;
  s.canvas.classList.remove("shown");
  if (!s.compiled) {
    s.gl.compile(s.scene, s.camera);
    await shadersReady(s);
    s.compiled = true;
    if (run !== stageRun) return;
  }
  // the title goes first: the player comes on once it is written, or after 9s at most
  const asked = performance.now();
  while (titleHolds && performance.now() - asked < 9000) await new Promise((resolve) => setTimeout(resolve, 100));
  if (run !== stageRun) return;
  const shadow = h("span", { class: "pose-shadow" });
  spot.replaceChildren(shadow, s.canvas, tag);
  const end = move.length + LAG_MAX;
  const show = (ms) => {
    s.view.up = pose(s.playerObject, kind, ms);
    shadow.style.setProperty("--air", s.view.up.toFixed(3));
    sizeStage(s);
  };
  if (calm.matches) {
    show(end);
    s.canvas.classList.add("shown");
    stageBusy = false;
    return;
  }
  stageBusy = true;
  show(0);
  const dust = [...(move.dust || [])];
  let orbsAt = kind === "flip" ? move.orbs : 0;
  const t0 = performance.now();
  smoke(spot, spot.clientWidth / 2, 0, height, scale * 1.6);
  const step = (now) => {
    if (run !== stageRun) return;
    const since = now - t0;
    // the player shows once the smoke is thick
    if (since >= 120) s.canvas.classList.add("shown");
    const ms = Math.min(since, end);
    show(ms);
    if (dust.length && ms >= dust[0]) {
      dust.shift();
      puff(spot);
    }
    if (orbsAt && ms >= orbsAt) {
      orbsAt = 0;
      orbs(spot, Math.round(move.orbCount * 0.6));
    }
    // the title may start a little before the move ends: half a second after the player lands
    if (ms >= Math.min(end, move.land + 500)) stageBusy = false;
    if (ms < end) requestAnimationFrame(step);
    else idle(s, kind, end, run);
  };
  requestAnimationFrame(step);
}

// Once the move is done the player stays alive for a while, as players idle in the game: the arms
// sway a little and the head looks around, then they ease back to the end pose and hold it. It
// draws at about 30 frames a second, only while the stage is in view and the tab is shown;
// wakeIdle picks it up again when the stage comes back.
const IDLE_MS = 20000;
let idleState = null;

function idle(s, kind, end, run) {
  idleState = { s, kind, end, run, spent: 0, looping: false };
  wakeIdle();
}

function wakeIdle() {
  const st = idleState;
  if (!st || st.looping || st.run !== stageRun || st.spent >= IDLE_MS) return;
  st.looping = true;
  let last = 0;
  const tick = (now) => {
    if (st.run !== stageRun || !stageSeen || document.hidden) {
      st.looping = false;
      return;
    }
    if (last && now - last < 33) {
      requestAnimationFrame(tick);
      return;
    }
    st.spent = Math.min(IDLE_MS, st.spent + (last ? now - last : 0));
    last = now;
    const t = st.spent / 1000;
    const amount = Math.min(1, (IDLE_MS - st.spent) / 1500);
    st.s.view.up = pose(st.s.playerObject, st.kind, st.end);
    const sk = st.s.playerObject.skin;
    sk.rightArm.rotation.z += Math.sin(t * 1.7) * 0.05 * amount;
    sk.leftArm.rotation.z -= Math.sin(t * 1.7) * 0.05 * amount;
    sk.rightArm.rotation.x += Math.sin(t * 1.1) * 0.04 * amount;
    sk.leftArm.rotation.x -= Math.sin(t * 1.1) * 0.04 * amount;
    sk.head.rotation.y += Math.sin(t * 0.45) * 0.4 * amount;
    sk.head.rotation.x += Math.sin(t * 0.31) * 0.08 * amount;
    sizeStage(st.s);
    if (st.spent >= IDLE_MS) {
      st.looping = false;
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// The title is written by its two makers in a parkour run. antoultrav, who made the site, drops in
// from over the page onto the "P", already running, and writes "Parkour Progress!" with his feet:
// each letter goes down just ahead of him as he runs along the line, with a jump over the gap
// between the words and a last hop that turns him round and sits him on the "!". Texyle, who runs
// the site, drops in after him with "Welcome to" held up in one hand, turning a sideflip on the way
// down, sets it in its place and sits on the "P". Dropping in from the top, they take the same time
// on every screen, a little under 4s. The flip is keyed by hand, as the podium's moves are, and
// every other pose eases on springs. It plays once, the first time the title comes into view; with
// animations off it is all simply there, the two of them sitting on it.
const BUILDER = "antoultrav";
const FRIEND = "Texyle";
// a little faster than a sprint-jump in the game, in figure heights a second (Texyle asked for the
// whole title about 1.1 times quicker)
const RUN = 4.4;
// antoultrav's drop onto the "P", his jump over the gap and his hop round onto the "!"
const FALL_MS = 455;
const GAP_MS = 365;
const HOP_MS = 455;
// Texyle's drop with the sideflip in it, and how far to the left of his landing it starts, in
// figure heights
const FLIP_MS = 745;
const FLIP_LENGTH = 2.6;
// how long they stay alive once seated, breathing and looking around
const LIFE_MS = 20000;
// a figure's canvas is this many figure heights square, room for the flip
const FIGURE_BOX = 1.5;
// every joint at rest: standing, facing us
const STILL = { ra: 0, la: 0, raz: 0, laz: 0, rl: 0, ll: 0, rlz: 0, llz: 0, lean: 0, turn: 0, hy: 0, hx: 0, crouch: 0, roll: 0 };
// running to the right, turned three quarters to us, looking down at the letters
const RUNNING = { ...STILL, lean: 0.12, turn: 1, hy: -0.25, hx: 0.25 };
// sitting on the "!", leaning back on both hands, turned to the line and to us
const SITTING = { ...STILL, ra: 0.6, la: 0.6, raz: 0.15, laz: -0.15, rl: -1.3, ll: -1.6, rlz: 0.1, llz: -0.05, lean: -0.15, turn: -0.85, hy: 0.6, hx: -0.15 };
// sitting on the "P", the same turned the other way
const SITTING_LEFT = { ...SITTING, rl: -1.6, ll: -1.3, rlz: 0.05, llz: -0.1, turn: 0.85, hy: -0.6 };
// the limbs ease quickly, the body and the head more slowly
const LIMBS = new Set(["ra", "la", "raz", "laz", "rl", "ll", "rlz", "llz", "crouch"]);

// a critically damped spring: x goes to its target with no overshoot, at a pace set by hz
function follow(x, v, target, dt, hz) {
  const w = 2 * Math.PI * hz;
  const off = x - target;
  const k = (v + w * off) * dt;
  const e = Math.exp(-w * dt);
  return [target + (off + k) * e, (v - w * k) * e];
}

// the run, keyed by hand over one stride of two steps, for the right leg: it reaches forward, sweeps
// back under the body, pushes off behind, then swings through quickly. The left leg is half a
// stride on, and each arm swings with the other leg, a little behind it
const STRIDE = [[0, -0.95], [280, 0.1], [500, 0.8], [620, 0.55], [850, -0.75], [1000, -0.95]];

function running(u) {
  const leg = (at) => track(STRIDE, (((at % 1) + 1) % 1) * 1000);
  return { ...RUNNING, rl: leg(u), ll: leg(u + 0.5), ra: 0.85 * leg(u + 0.44), la: 0.85 * leg(u - 0.06), lean: RUNNING.lean + 0.03 * Math.cos(4 * Math.PI * u) };
}

function builderPose(s, p) {
  const sk = s.playerObject.skin;
  sk.resetJoints();
  // a landing bends him as the game's sneak does, as in figure.js
  const k = p.crouch;
  if (k) {
    sk.body.rotation.x = 0.4538 * k;
    sk.body.position.z = -2.1244 * k;
    sk.body.position.y = -6 - 2.1037 * k;
    sk.head.position.y = -3.6183 * k;
    sk.rightArm.position.z = sk.leftArm.position.z = 0.1683 * k;
    sk.rightArm.position.y = sk.leftArm.position.y = -2 - 2.5394 * k;
    sk.rightLeg.position.z = sk.leftLeg.position.z = -0.1 - 3.45 * k;
  }
  sk.rightArm.rotation.x = p.ra;
  sk.leftArm.rotation.x = p.la;
  sk.rightArm.rotation.z = p.raz;
  sk.leftArm.rotation.z = p.laz;
  sk.rightLeg.rotation.x = p.rl;
  sk.leftLeg.rotation.x = p.ll;
  sk.rightLeg.rotation.z = p.rlz;
  sk.leftLeg.rotation.z = p.llz;
  sk.head.rotation.y = p.hy;
  sk.head.rotation.x = p.hx;
  sk.rotation.x = p.lean;
  // turned first, then rolled about his own front to back, as in a sideflip
  s.playerObject.rotation.order = "YXZ";
  s.playerObject.rotation.set(0, p.turn, p.roll || 0);
}

function paintBuilder(s) {
  const box = s.canvas.getBoundingClientRect();
  const width = Math.round(box.width);
  const height = Math.round(box.height);
  if (!width || !height) return;
  if (width !== s.width || height !== s.height) {
    s.width = width;
    s.height = height;
    s.gl.setSize(width, height, false);
    // the viewer writes its size into the canvas's style; the CSS sizes it instead, so the figure
    // follows the title's size when the window changes
    s.canvas.style.width = "";
    s.canvas.style.height = "";
  }
  const camera = s.camera;
  camera.fov = 30;
  // the canvas is larger than the figure, for the flip; the camera zooms out to match
  camera.zoom = 1.125 / FIGURE_BOX;
  s.gl.setViewport(0, 0, width, height);
  // a strong white rim from behind, so the dark skin keeps its outline on the dark page
  s.rim.intensity = 4;
  s.rim.color.set("#ffffff");
  s.cameraLight.intensity = 0.8;
  s.globalLight.intensity = 2.8;
  const far = 4.5 + 16.5 / Math.tan((15 * Math.PI) / 180) / 0.95;
  camera.aspect = width / height;
  camera.position.set(0, -Math.sin(0.12) * far, Math.cos(0.12) * far);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  s.gl.render(s.scene, camera);
}

// the name tag sits over the head, slid in when the head is near either edge of the column
function keepTag(line, tag, x) {
  const column = line.closest(".home-intro").getBoundingClientRect();
  const head = line.getBoundingClientRect().left + x;
  const half = tag.offsetWidth / 2;
  const shift = Math.max(column.left + 4 - (head - half), Math.min(0, column.right - 4 - (head + half)));
  tag.style.translate = `calc(-50% + ${shift.toFixed(0)}px) 0`;
}

// square dust, like the game's particles, kicked out to both sides
function kick(title, x, y, size, count) {
  for (let i = 0; i < count; i++) {
    const side = Math.random() < 0.5 ? 1 : -1;
    const speck = h("i", { class: "scrape", style: `left: ${(x + (Math.random() - 0.5) * size * 2).toFixed(1)}px; top: ${y.toFixed(1)}px; width: ${size}px; height: ${size}px` });
    title.append(speck);
    speck.animate([
      { opacity: 0.9, translate: "0 0", scale: 1 },
      { opacity: 0, translate: `${(side * size * (3 + Math.random() * 5)).toFixed(1)}px ${(-size * Math.random() * 3).toFixed(1)}px`, scale: 0.6 },
    ], { duration: 650 + Math.random() * 300, easing: "cubic-bezier(0.3, 0.7, 0.4, 1)", fill: "both" }).finished.then(() => speck.remove());
  }
}

let builderViewer = null;

function getBuilderViewer() {
  builderViewer ||= loadViewer().then(() => makeViewer(h("canvas", { class: "title-figure", "aria-hidden": "true" })));
  return builderViewer;
}

function renderTitle() {
  const line = document.getElementById("build-line");
  const title = line.parentElement;
  const text = line.textContent;
  line.dataset.text = text;
  // each letter in a box of its own, so it can be set down like a block; the space stays text
  line.replaceChildren(...[...text].map((c) => (c === " " ? " " : h("span", { class: "letter" }, c))));
  // a box for each of them; index.js moves it, and its bottom is where the feet are
  const spots = [h("span", { class: "title-builder" }), h("span", { class: "title-builder" })];
  line.append(...spots);
  // the page starts with the title unbuilt (index.html), so it never shows before it is built
  if (calm.matches) {
    title.classList.remove("building");
    buildTitle(line, spots, true);
    return;
  }
  // in view at load, the title goes first and the stage's player waits for it
  const box = title.getBoundingClientRect();
  if (box.top >= 0 && box.bottom <= innerHeight) titleHolds = titleBusy = true;
  if (!("IntersectionObserver" in window)) {
    buildTitle(line, spots);
    return;
  }
  const watch = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    watch.disconnect();
    buildTitle(line, spots);
  }, { threshold: 0.6 });
  watch.observe(title);
}

// where a point on one of the figure's parts lands on its canvas, in CSS pixels, for the pose the
// figure is in now and the camera of its last paint
function pointOf(s, part, x, y, z) {
  s.playerObject.updateMatrixWorld(true);
  const p = s.camera.position.clone().set(x, y, z).applyMatrix4(part.matrixWorld).project(s.camera);
  return [((p.x + 1) / 2) * s.width, ((1 - p.y) / 2) * s.height];
}

// A figure resting on the title: a slow breath, and now and then a look somewhere else, or at the
// mouse while it moves, or at the other one while he is still moving (watch, a point on the
// screen). That lasts LIFE_MS; then only the mouse turns the head. Its pose eases on springs, the
// limbs quickly and the body slowly, so it settles into the rest from wherever it is. It draws at
// about 30 frames a second, only while the title is in view and the tab is shown.
function rest(s, from, still, eyesOf, watch) {
  const pose = { ...from };
  const speed = Object.fromEntries(Object.keys(pose).map((key) => [key, 0]));
  const t0 = performance.now();
  let mouse = null;
  let movedAt = -1e9;
  let looking = [still.hy, still.hx];
  let nextLook = t0 + 1800;
  let last = 0;
  let running = false;
  let eyes = eyesOf();
  // the turn of the head toward a point on the screen, d pixels in front of the figure: the body
  // faces still.turn, so the head turns by the rest, within what a neck allows
  const toward = (x, y, d) => {
    const box = s.canvas.getBoundingClientRect();
    const yaw = Math.atan2(x - box.left - eyes[0], d) - still.turn;
    const pitch = Math.atan2(y - box.top - eyes[1], d);
    return [Math.max(-1.3, Math.min(1.3, yaw)), Math.max(-0.5, Math.min(0.5, pitch))];
  };
  const tick = (now) => {
    if (now - last < 33) {
      requestAnimationFrame(tick);
      return;
    }
    const dt = last ? Math.min(1 / 30, (now - last) / 1000) : 1 / 60;
    last = now;
    const life = now - t0 < LIFE_MS;
    if (life && now > nextLook) {
      looking = [still.hy + (Math.random() - 0.5) * 0.9, still.hx + (Math.random() - 0.5) * 0.25];
      nextLook = now + 2500 + Math.random() * 2500;
    }
    // the mouse goes first, then the other one; both are in the page's plane, so the other one is
    // looked at as if close
    const following = mouse && (now - movedAt < 2500 || !life);
    const seen = !following && watch && watch();
    const gaze = following ? mouse : seen ? toward(seen[0], seen[1], s.canvas.offsetHeight * 0.5) : life ? looking : [still.hy, still.hx];
    const breath = life ? Math.sin((2 * Math.PI * (now - t0)) / 3600) : 0;
    const target = { ...still, hy: gaze[0], hx: gaze[1], lean: still.lean + 0.02 * breath, raz: still.raz + 0.015 * breath, laz: still.laz - 0.015 * breath };
    for (const key of Object.keys(pose)) {
      // a glance of its own is slow, about half a second; what it follows it follows quickly
      const hz = LIMBS.has(key) ? 14 : (key === "hy" || key === "hx") && !following && !seen ? 1.8 : 5;
      [pose[key], speed[key]] = follow(pose[key], speed[key], target[key], dt, hz);
    }
    builderPose(s, pose);
    paintBuilder(s);
    eyes = eyesOf();
    const box = s.canvas.getBoundingClientRect();
    const resting = !life && !following && Object.values(speed).every((v) => Math.abs(v) < 0.002);
    if (resting || document.hidden || box.bottom < 0 || box.top > innerHeight) {
      running = false;
      return;
    }
    requestAnimationFrame(tick);
  };
  const go = () => {
    if (running) return;
    running = true;
    requestAnimationFrame(tick);
  };
  addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse") return;
    const box = s.canvas.getBoundingClientRect();
    if (box.bottom < 0 || box.top > innerHeight) return;
    mouse = toward(event.clientX, event.clientY, 700);
    movedAt = performance.now();
    go();
  });
  document.documentElement.addEventListener("mouseleave", () => {
    mouse = null;
    go();
  });
  document.addEventListener("visibilitychange", go);
  if ("IntersectionObserver" in window) new IntersectionObserver(([entry]) => entry.isIntersecting && go()).observe(s.canvas);
  go();
}

async function buildTitle(line, spots, still = false) {
  const title = line.parentElement;
  const welcome = title.querySelector(".welcome");
  const text = line.dataset.text;
  const letters = text.length;
  const space = text.indexOf(" ");
  const boxes = [...line.querySelectorAll(".letter")];
  const boxAt = (i) => boxes[i - (i > space ? 1 : 0)];
  const done = () => {
    title.classList.remove("building");
    titleBusy = false;
    titleHolds = false;
  };
  await document.fonts?.ready;
  // where things stand, in the line's own box: the width of each letter, the top of the capitals
  // and of the other small letters, and the floor the line stands on
  const measure = () => {
    const tall = spots[0].offsetHeight;
    const end = line.clientWidth - parseFloat(getComputedStyle(line).paddingRight);
    const capTop = line.offsetHeight * 0.18;
    return { tall, cell: end / letters, capTop, xTop: capTop + (2 * parseFloat(getComputedStyle(line).fontSize)) / 9, base: line.offsetHeight - tall * 0.04 };
  };
  let m = measure();
  const middleOf = (i) => m.cell * (i + 0.5);
  const speck = () => Math.max(3, Math.round(m.tall / 20));
  // dust where feet or a block come down, at x and y in the line's box
  const dust = (x, y, count) => kick(title, line.offsetLeft + x, line.offsetTop + y - speck() * 0.5, speck(), count);
  const setDown = (i) => {
    const box = boxAt(i);
    box.classList.add("set");
    dust(box.offsetLeft + box.offsetWidth / 2, m.base, 2);
  };

  // the two of them, each from their own skin
  const figure = async (name, spot, viewer) => {
    const s = await viewer;
    const key = name.toLowerCase();
    s.loadSkin(await skinOf(key).then(picture), { model: skinSlim.includes(key) ? "slim" : "default" });
    // the name shows once its figure has sat down
    const tag = h("span", { class: "title-tag", hidden: true }, nameTag(name));
    spot.replaceChildren(s.canvas, tag);
    s.gl.compile(s.scene, s.camera);
    await shadersReady(s);
    return { s, spot, tag };
  };
  let them;
  try {
    them = await Promise.all([
      figure(FRIEND, spots[1], loadViewer().then(() => makeViewer(h("canvas", { class: "title-figure", "aria-hidden": "true" })))),
      figure(BUILDER, spots[0], getBuilderViewer()),
    ]);
  } catch {
    // no 3D here: the letters still go down one by one, and "Welcome to" comes after them
    if (!still) {
      await new Promise((resolve) => {
        boxes.forEach((box, i) => setTimeout(() => {
          box.classList.add("set");
          if (i === boxes.length - 1) resolve();
        }, i * 45));
      });
    }
    done();
    return;
  }
  const [texyle, anto] = them;
  // Texyle sits on the "P", antoultrav on the "!"
  texyle.at = 0;
  texyle.sits = SITTING_LEFT;
  anto.at = letters - 1;
  anto.sits = SITTING;
  const show = (f) => {
    f.s.canvas.classList.add("shown");
    f.tag.hidden = false;
  };
  const place = (f, x, y) => {
    f.x = x;
    f.y = y;
    f.spot.style.translate = `${x.toFixed(1)}px ${(y - m.tall).toFixed(1)}px`;
    if (!f.tag.hidden) keepTag(line, f.tag, x);
  };
  // sitting, the backs of the thighs rest on the top of his letter; drawn first, so the seat is
  // measured with this canvas's size and camera
  const seatOf = (f) => {
    builderPose(f.s, f.sits);
    paintBuilder(f.s);
    const sk = f.s.playerObject.skin;
    const [rx, ry] = pointOf(f.s, sk.rightLeg, 0, 0, -2);
    const [lx, ly] = pointOf(f.s, sk.leftLeg, 0, 0, -2);
    return [middleOf(f.at) - f.s.canvas.offsetLeft - (rx + lx) / 2, m.capTop + m.tall - f.s.canvas.offsetTop - Math.max(ry, ly)];
  };
  const eyes = (f) => () => pointOf(f.s, f.s.playerObject.skin.head, 0, 4, 0);
  const sit = (f) => {
    m = measure();
    place(f, ...seatOf(f));
    paintBuilder(f.s);
  };
  const seatBoth = () => them.forEach(sit);

  if (still) {
    done();
    welcome.classList.add("placed");
    // shown first, so each name tag has its width when it is kept inside the column
    requestAnimationFrame(() => {
      them.forEach(show);
      seatBoth();
    });
    addEventListener("resize", () => requestAnimationFrame(seatBoth));
    return;
  }

  // a stage player already coming on goes first; the title comes once it has landed, or after 6s
  // at most, and the stage holds its next turn from now until the title is done
  titleBusy = true;
  titleHolds = true;
  const asked = performance.now();
  while (stageBusy && performance.now() - asked < 6000) await new Promise((resolve) => setTimeout(resolve, 100));
  m = measure();
  const tall = m.tall;
  const v = (RUN * tall) / 1000;
  const lineBox = line.getBoundingClientRect();
  const set = new Array(letters).fill(false);
  // the top of the letter at i: the capitals, the "!" and the tall small letters reach the top,
  // the other small letters stop lower; left of the line, and in the gap, it is the floor
  const topOf = (i) => (i < 0 || i === space ? m.base : /[A-Z!bdfhklt]/.test(text[i]) ? m.capTop : m.xTop);
  const cellAt = (x) => Math.floor(x / m.cell);
  // the ground under the feet at x: the highest letter top under them that is down already
  const ground = (x, y) => {
    let g = Infinity;
    for (let i = cellAt(x - tall * 0.12); i <= cellAt(x + tall * 0.12); i++) if (i < 0 || set[i]) g = Math.min(g, topOf(i));
    return g === Infinity ? y : g;
  };
  // a jump's arc for the feet, from one height to another, rising lift above the higher one
  const arc = (from, to, lift) => (u) => from + (to - from) * u - 4 * ((from + to) / 2 - Math.min(from, to) + lift) * u * (1 - u);
  const smooth = (u) => {
    const k = Math.max(0, Math.min(1, u));
    return k * k * (3 - 2 * k);
  };
  const blend = (a, b, k) => Object.fromEntries(Object.keys(a).map((key) => [key, a[key] + (b[key] - a[key]) * k]));

  // antoultrav's run: he drops from behind the top bar onto the "P", moving at his running pace
  // already, and keeps it until the hop, which eases off into the seat; each letter goes down as
  // his front foot comes near it
  for (const f of them) f.seat = seatOf(f);
  // the top of the page, in the line's box
  const sky = -lineBox.top;
  const land1 = middleOf(0) + m.cell * 0.1;
  const x0 = land1 - v * FALL_MS;
  const take2 = middleOf(space) - (v * GAP_MS) / 2;
  const land2 = middleOf(space) + (v * GAP_MS) / 2;
  const take3 = anto.seat[0] - (v * HOP_MS) / 2;
  const when = (x) => (x - x0) / v;
  const jumps = [{ from: when(take2), to: when(land2), y: arc(topOf(cellAt(take2)), topOf(cellAt(land2)), tall * 0.2) }];
  const tHop = when(take3);
  const tSat = tHop + HOP_MS;
  const hopY = arc(topOf(cellAt(take3)), anto.seat[1], tall * 0.15);
  const lead = tall * 0.15 + m.cell * 0.3;

  // Texyle's: he drops in from behind the top bar too, up and to the left of where he lands, holding
  // "Welcome to" up over his head like a sign and turning a sideflip on the way down. It stands on
  // his fist and turns with him as a held thing does, so it can't be carried close to him: it is
  // wider than he is tall. Where its place is beside the line, on the floor (desktop), he lands
  // right there; he sneaks down, lowers it in front of him and lets it drop the last bit, then
  // jumps up onto the "P" and sits. Where it goes over the line (narrow screens), he lands on the
  // "P" and lobs it from over his head, so it never crosses him, and sits there
  welcome.style.translate = "";
  welcome.style.rotate = "";
  const wb = welcome.getBoundingClientRect();
  const slot = [wb.left + wb.width / 2 - lineBox.left, wb.top + wb.height / 2 - lineBox.top];
  // it comes down into its place the last glyph pixel, as each letter does
  const drop = parseFloat(getComputedStyle(welcome).fontSize) * 0.11;
  const floor = slot[0] < 0 && slot[1] > 0 && slot[1] < line.offsetHeight;
  const flipLand = floor ? slot[0] : middleOf(0);
  const landY = floor ? m.base : m.capTop;
  const flipTake = flipLand - tall * FLIP_LENGTH;
  // -1 for the right hand, on our left: on the floor it goes down in front of him, either hand
  // would do; tossed, it is the hand on its side
  const out = floor || slot[0] < flipLand ? -1 : 1;
  const hand = out < 0 ? ["ra", "raz", "la", "laz"] : ["la", "laz", "ra", "raz"];
  const arm = out < 0 ? "rightArm" : "leftArm";
  // he drops in while antoultrav is on his last steps
  const tFlip = tSat - 300;
  const tLand = tFlip + FLIP_MS;
  const tRelease = tLand + (floor ? 270 : 55);
  // the game's gravity is about 15 figure heights a second squared, here in pixels a millisecond
  // squared; the rest of the timeline is set when he lets go
  const gravity = (15 * tall) / 1e6;
  let toss = 0;
  let tPlaced = Infinity;
  let tSit = Infinity;
  let tRest = Infinity;
  // the fist covers the bottom of what it holds by this much
  const grip = 6;
  const c = texyle.s.canvas;
  // the drop: from the top of the page, gaining speed as a fall does
  const fallY = (u) => sky + (landY - sky) * (0.25 * u + 0.75 * u * u);
  // his jump from the floor up onto the "P", over the sign's right half, into the seat
  const jumpY = arc(m.base, texyle.seat[1], tall * 0.6);
  // where the sign's middle is, standing on his fist, upright to his body turned by a
  const carried = (f, x, y, a) => {
    const [hx, hy] = pointOf(f.s, f.s.playerObject.skin[arm], out, -10, 0);
    const up = wb.height / 2 - grip;
    return [x + c.offsetLeft + hx + Math.sin(a) * up, y - tall + c.offsetTop + hy - Math.cos(a) * up];
  };
  const placeWelcome = () => {
    welcome.style.translate = "";
    welcome.style.rotate = "";
    welcome.classList.add("placed");
    welcome.animate([{ translate: `0 ${(-drop).toFixed(1)}px` }, { translate: "0 0" }], { duration: 160, easing: "cubic-bezier(0.2, 0.8, 0.3, 1)" });
    dust(slot[0], slot[1] + wb.height / 2, 10);
  };

  const ease = (f, target, dt) => {
    for (const key of Object.keys(f.pose)) [f.pose[key], f.speed[key]] = follow(f.pose[key], f.speed[key], target[key], dt, LIMBS.has(key) ? 14 : 6);
  };
  // a stride every 1.8 figure heights; each step kicks up dust, as sprinting does in the game, and
  // the body is highest between steps
  const stride = (f, x, y) => {
    f.phase += Math.abs(x - f.lastX) / (tall * 1.8);
    const step = Math.floor(f.phase * 2);
    if (step !== f.step) {
      f.step = step;
      dust(x - tall * 0.12, y, 2);
    }
    return y - (tall * 0.035 * (1 + Math.cos(4 * Math.PI * f.phase))) / 2;
  };
  const centreOf = (f) => {
    const b = f.s.canvas.getBoundingClientRect();
    return [b.left + b.width / 2, b.top + b.height / 2];
  };
  // dust at the moments feet leave or meet the ground
  const antoKicks = [{ t: FALL_MS, count: 5 }, ...jumps.map((j) => ({ t: j.from, count: 3 })), ...jumps.map((j) => ({ t: j.to, count: 5 }))];
  const texyleKicks = [{ t: tLand, count: 6, x: flipLand, y: landY }];
  for (const f of them) {
    f.pose = { ...RUNNING };
    f.speed = Object.fromEntries(Object.keys(STILL).map((key) => [key, 0]));
    f.phase = 0;
    f.lastX = x0;
    // where his feet are on the letters, eased on a spring; the bob of the run is on top of it
    f.feet = m.base;
    f.feetSpeed = 0;
  }
  let over = false;
  let placed = false;
  let lastT = 0;

  const settle = (f) => {
    f.resting = true;
    show(f);
    place(f, ...f.seat);
    f.tag.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: "ease-out" });
  };

  const moveAnto = (t, dt) => {
    const f = anto;
    if (t >= tSat) {
      // seated: the rest of the line goes down, and he watches Texyle until he sits too
      for (let i = 0; i < letters; i++) if (!set[i] && i !== space) setDown(i);
      set.fill(true);
      settle(f);
      dust(middleOf(f.at), m.capTop, 4);
      rest(f.s, f.pose, SITTING, eyes(f), () => (texyle.resting ? null : centreOf(texyle)));
      return;
    }
    let x;
    let y;
    let target;
    if (t >= tHop) {
      // up as in a leap, turning to us, then down into the seat
      const u = (t - tHop) / HOP_MS;
      x = take3 + (f.seat[0] - take3) * (2 * u - u * u);
      y = hopY(u);
      target = blend({ ...RUNNING, rl: -0.6, ll: 0.3, ra: -0.4, la: -0.4, lean: 0.1, turn: 0.2, hx: 0.2 }, SITTING, smooth((u - 0.35) / 0.5));
    } else {
      x = x0 + v * t;
      const jump = jumps.find((j) => t >= j.from && t < j.to);
      if (t < FALL_MS) {
        // dropping in, arms a little up and out, looking down at where he lands
        const u = t / FALL_MS;
        y = sky + (topOf(0) - sky) * u * u;
        f.feet = y;
        f.feetSpeed = 0;
        target = { ...RUNNING, ra: -0.5, la: -0.5, raz: -0.35, laz: 0.35, rl: -0.4, ll: 0.3, lean: 0.05, hx: 0.5 };
      } else if (jump) {
        // in the air: one leg reaching for the landing, the arms opposite
        y = jump.y((t - jump.from) / (jump.to - jump.from));
        f.feet = y;
        f.feetSpeed = 0;
        target = { ...RUNNING, rl: -0.95, ll: 0.6, ra: 0.75, la: -0.85, lean: 0.2, hx: 0.35 };
      } else {
        [f.feet, f.feetSpeed] = follow(f.feet, f.feetSpeed, ground(x, f.feet), dt, 12);
        y = stride(f, x, f.feet);
        target = running(f.phase);
        // a landing bends him for a moment, harder after the drop
        if (t < FALL_MS + 130) target.crouch = 0.4;
        else if (jumps.some((j) => t >= j.to && t < j.to + 120)) target.crouch = 0.3;
      }
    }
    f.lastX = x;
    for (let i = 0; i < letters; i++) {
      if (!set[i] && i !== space && x >= i * m.cell - lead) {
        set[i] = true;
        setDown(i);
      }
    }
    for (const k of antoKicks) if (lastT < k.t && t >= k.t) dust(x, y, k.count);
    ease(f, target, dt);
    builderPose(f.s, f.pose);
    place(f, x, y);
    paintBuilder(f.s);
  };

  const moveTexyle = (t, dt) => {
    const f = texyle;
    if (!f.on) {
      f.on = true;
      f.s.canvas.classList.add("shown");
      welcome.classList.add("carried");
    }
    if (!placed && t >= tPlaced) {
      placed = true;
      placeWelcome();
      // the title is whole: the stage's player may come on while he goes to sit
      done();
    }
    if (t >= tRest) {
      settle(f);
      // the sign was in front of him until now
      welcome.classList.remove("carried");
      dust(middleOf(0), m.capTop, 4);
      rest(f.s, f.pose, SITTING_LEFT, eyes(f));
      return;
    }
    const ms = t - tFlip;
    const hold = (target, x, z) => {
      target[hand[0]] = x;
      target[hand[1]] = out * z;
    };
    const free = (target, z) => {
      target[hand[2]] = 0;
      target[hand[3]] = -out * z;
    };
    let x;
    let y;
    let target;
    let roll = 0;
    if (ms < FLIP_MS) {
      // the drop: a whole turn about his front to back on the way down, once he is out from under
      // the bar, slow at the start and the end, arms and legs out like a star, the sign held up
      // all the way round
      const u = ms / FLIP_MS;
      x = flipTake + (flipLand - flipTake) * u;
      y = fallY(u);
      roll = -TAU * wheel(Math.max(0, (u - 0.15) / 0.85));
      target = { ...STILL, turn: 0.15, hx: 0.15 };
      hold(target, 0, 2.55);
      free(target, ms > FLIP_MS - 200 ? 0.5 : 1.5);
      if (ms > 150 && ms < FLIP_MS - 160) Object.assign(target, { rlz: -0.55, llz: 0.55 });
    } else if (floor && t < tSit) {
      // down where the sign goes: he bends, sneaks down, lowers it in front of him and lets it
      // drop; once it is down he stands, looks up at the "P" and jumps
      x = flipLand;
      y = m.base;
      target = { ...STILL, lean: 0.04, hx: 0.45 };
      if (t < tLand + 130) target.crouch = 0.45;
      else if (!placed) target.crouch = 0.85;
      if (t < tLand + 55) hold(target, 0, 2.55);
      else if (t < tRelease) hold(target, -0.45, 0.2);
      else hold(target, -0.5, 0.15);
      free(target, 0.15);
      if (placed) Object.assign(target, { turn: 0.5, hy: 0.4, hx: -0.1 });
    } else if (floor) {
      // the jump up onto the "P": a leap, turning to us, then down into the seat
      const u = Math.min(1, (t - tSit) / (tRest - tSit));
      x = flipLand + (f.seat[0] - flipLand) * smooth(u);
      y = jumpY(u);
      target = blend({ ...STILL, rl: -0.6, ll: 0.3, ra: -0.4, la: -0.4, lean: 0.1, turn: 0.5, hx: 0.2 }, SITTING_LEFT, smooth((u - 0.35) / 0.5));
    } else {
      // down on the "P": he bends, flicks the sign off over his head toward its place, follows
      // through and watches it land, then sits
      x = flipLand;
      y = m.capTop;
      target = { ...STILL, lean: 0.04 };
      if (t < tLand + 130) target.crouch = 0.45;
      const yaw = Math.atan2(slot[0] - x, tall * 0.7);
      target.turn = yaw * 0.4;
      target.hy = Math.max(-1, Math.min(1, yaw * 0.6));
      target.hx = Math.max(-0.5, Math.min(0.6, Math.atan2(slot[1] - (y - tall * 0.85), tall * 0.7)));
      if (t < tRelease) hold(target, -0.3, 2.2);
      else if (!placed) hold(target, -0.4, 1.4);
      else hold(target, 0, 0.15);
      free(target, 0.15);
      if (t >= tSit) {
        // he sits down as he goes down, not before
        const k = smooth((t - tSit) / (tRest - tSit));
        x = flipLand + (f.seat[0] - flipLand) * k;
        y = m.capTop + (f.seat[1] - m.capTop) * k;
        target = blend(target, SITTING_LEFT, k);
      }
    }
    f.lastX = x;
    for (const k of texyleKicks) if (lastT < k.t && t >= k.t) dust(k.x, k.y, k.count);
    ease(f, target, dt);
    builderPose(f.s, { ...f.pose, roll });
    place(f, x, y);
    paintBuilder(f.s);
    if (!placed) {
      // held, it turns with him; let go, it falls under gravity to just over its place, a short
      // drop from in front of him or a lob from over his head, and drops in
      let a = -roll;
      let [wx, wy] = carried(f, x, y, a);
      if (t >= tRelease) {
        if (!f.thrown) {
          f.thrown = [wx, wy];
          const fall = slot[1] - drop - wy;
          toss = floor ? Math.max(110, Math.min(235, Math.sqrt((2 * Math.max(8, fall)) / gravity))) : Math.max(220, Math.min(380, 200 + Math.hypot(slot[0] - wx, fall) / 1.54));
          tPlaced = tRelease + toss;
          tSit = tPlaced + (floor ? 180 : 110);
          tRest = tSit + (floor ? HOP_MS : 410);
        }
        const [sx, sy] = f.thrown;
        const k = Math.min(t - tRelease, toss);
        const lift = (slot[1] - drop - sy - 0.5 * gravity * toss * toss) / toss;
        wx = sx + ((slot[0] - sx) * k) / toss;
        wy = sy + lift * k + 0.5 * gravity * k * k;
        a = floor ? 0 : Math.sign(slot[0] - sx) * 0.2 * Math.sin((Math.PI * k) / toss);
      }
      welcome.style.translate = `${(wx - slot[0]).toFixed(1)}px ${(wy - slot[1]).toFixed(1)}px`;
      welcome.style.rotate = `${a.toFixed(3)}rad`;
    }
  };

  // a window that changes size mid-run skips to the end: everything down, both of them seated
  const finish = () => {
    over = true;
    boxes.forEach((box) => box.classList.add("set"));
    if (!placed) {
      placed = true;
      welcome.style.translate = "";
      welcome.style.rotate = "";
      welcome.classList.add("placed");
    }
    welcome.classList.remove("carried");
    done();
    for (const f of them) {
      if (f.resting) continue;
      f.resting = true;
      show(f);
      rest(f.s, f.pose, f.sits, eyes(f));
    }
    seatBoth();
  };
  addEventListener("resize", () => (over ? requestAnimationFrame(seatBoth) : finish()));

  anto.s.canvas.classList.add("shown");
  const t0 = performance.now();
  let lastFrame = 0;
  const tick = (now) => {
    if (over) return;
    const dt = lastFrame ? Math.max(0, Math.min(1 / 30, (now - lastFrame) / 1000)) : 1 / 60;
    lastFrame = now;
    const t = Math.max(0, now - t0);
    if (!anto.resting) moveAnto(t, dt);
    if (!texyle.resting && t >= tFlip) moveTexyle(t, dt);
    lastT = t;
    if (anto.resting && texyle.resting) over = true;
    else requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// The panorama shows through more than on other pages, as much as each map's brightness allows:
// dim text over the brightest parts of the brighter maps still needs 4.5:1.
function homeVeil(light) {
  const top = Math.min(0.82, Math.max(0.55, 0.6 + ((light ?? 0.111) - 0.111) * 3));
  return [top.toFixed(2), Math.min(0.9, top + 0.2).toFixed(2)];
}

// The stage turns to the next map every ten seconds while it is in view and nobody is pointing
// at it; picking a map stops it, the visitor has taken over.
const STAGE_MS = 10000;
let stageAt = -1;
let stageSeen = true;

function showStage(i) {
  if (i === stageAt) return;
  stageAt = i;
  const run = ++stageRun;
  const m = home.stage[i];

  setWorld(m.world, m.light);
  const layers = document.querySelectorAll(".world");
  const [top, bottom] = homeVeil(m.light);
  layers[layers.length - 1].style.setProperty("--home-veil", `rgba(16, 16, 16, ${top}), rgba(16, 16, 16, ${bottom})`);

  // the sharp picture fades in over the one before it
  const view = document.getElementById("stage-view");
  const shot = h("span", { class: "stage-shot fresh", style: `--shot: url("${asset(`assets/tile/map_${m.slug}.jpg`)}")` });
  view.prepend(shot);
  const old = [...view.querySelectorAll(".stage-shot")].slice(1);
  requestAnimationFrame(() => shot.classList.remove("fresh"));
  setTimeout(() => old.forEach((layer) => layer.remove()), 700);

  view.style.setProperty("--frame", `url("${asset(`assets/gui/tile-${tierOf(m.value) || 0}.png`)}")`);
  fillWords(m);
  if (!calm.matches) document.getElementById("stage-words").animate([{ opacity: 0, translate: "0 6px" }, { opacity: 1, translate: "0 0" }], { duration: 300, easing: "cubic-bezier(0.16, 1, 0.3, 1)" });

  document.querySelectorAll(".stage-pick").forEach((pick, j) => pick.setAttribute("aria-pressed", String(j === i)));
  const time = document.querySelector(".pick-time");
  if (time) {
    time.style.setProperty("--time", "0");
    document.querySelectorAll(".stage-picks li")[i].append(time);
  }
  stagePlayer(m.victors ? m.first[0] : m.furthest[0], m.victors ? "flip" : "spin", tierOf(m.value), run);

  // the next map's picture is fetched now, so the turn has nothing to wait for
  const next = home.stage[(i + 1) % home.stage.length];
  new Image().src = asset(`assets/tile/map_${next.slug}.jpg`);
}

// the words for one map; a name that would take three lines steps down a size
function fillWords(m) {
  const badge = badgeOf(m.badge);
  const name = document.getElementById("stage-name");
  name.classList.remove("long");
  name.replaceChildren(h("a", { href: mapLink(m.name) }, paintedMap(m.name, badge)));
  if (name.offsetHeight > 2.5 * parseFloat(getComputedStyle(name).lineHeight)) name.classList.add("long");
  document.getElementById("stage-sub").replaceChildren(...stageSub(m));
  document.getElementById("stage-status").replaceChildren(...stageStatus(m, badge));
  document.getElementById("stage-who").replaceChildren(...stageWho(m));
  document.getElementById("stage-actions").replaceChildren(
    h("a", { class: "button", href: mapLink(m.name), "aria-label": `Open ${m.name}` }, "Open the map"),
    h("a", { class: "button", href: m.victors ? "maps.html" : "maps.html?show=unbeaten" }, m.victors ? "All maps" : "Unbeaten maps"));
}

// The words keep the height of the tallest of them, measured at this width, so the picks, the
// search and the doors never move when the stage turns.
function fitStage() {
  const words = document.getElementById("stage-words");
  words.style.minHeight = "";
  let tallest = 0;
  for (const m of home.stage) {
    fillWords(m);
    tallest = Math.max(tallest, words.offsetHeight);
  }
  if (stageAt >= 0) fillWords(home.stage[stageAt]);
  words.style.minHeight = `${tallest}px`;
}

function renderStage() {
  const picks = home.stage.map((m, i) => {
    const badge = badgeOf(m.badge);
    const colours = badge ? `--c1: ${badge.color}; --c2: ${badge.end || badge.color}; --c3: ${badge.third || badge.end || badge.color}` : "";
    const pick = h("button", { class: "stage-pick", type: "button", "aria-pressed": "false", "aria-label": pickLabel(m), style: `--shot: url("${asset(`assets/tile/map_${m.slug}.jpg`)}"); ${colours}` },
      m.victors ? h("b", {}, String(m.victors)) : h("i", { style: `--left: ${shareLeft(m)}%` }));
    tip(pick, () => `<b>${esc(m.name)}</b><p>${m.victors ? `${m.victors} ${m.victors === 1 ? "victor" : "victors"}` : `Unbeaten, ${shareLeft(m)}% left`}</p>`);
    return h("li", {}, pick);
  });
  const list = document.getElementById("stage-picks");
  list.replaceChildren(...picks);
  list.style.setProperty("--picks", picks.length);
  // the time to the next turn, a bar under the shown map that fills like the game's experience bar
  const time = calm.matches ? null : h("span", { class: "pick-time", "aria-hidden": "true" }, h("i"));
  if (time) picks[0].append(time);
  let picked = false;
  let held = false;
  document.querySelectorAll(".stage-pick").forEach((pick, i) => pick.addEventListener("click", () => {
    picked = true;
    time?.remove();
    showStage(i);
  }));
  showStage(0);
  fitStage();
  document.fonts?.ready.then(fitStage);
  let wait = null;
  addEventListener("resize", () => {
    clearTimeout(wait);
    wait = setTimeout(fitStage, 150);
  });
  const stage = document.getElementById("stage");
  // the world darkens once the stage is mostly out of view, as the game's does behind other screens
  if ("IntersectionObserver" in window) new IntersectionObserver(([entry]) => document.body.classList.toggle("stage-on", entry.intersectionRatio >= 0.5), { threshold: [0, 0.5, 1] }).observe(stage);
  if (calm.matches) return;
  stage.addEventListener("mouseenter", () => { held = true; });
  stage.addEventListener("mouseleave", () => { held = false; });
  stage.addEventListener("focusin", () => { held = true; });
  stage.addEventListener("focusout", () => { held = false; });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      stageSeen = entry.isIntersecting;
      if (stageSeen) wakeIdle();
    }, { threshold: 0.4 }).observe(stage);
  }
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) wakeIdle();
  });
  // the time only runs while the stage is in view and nobody is pointing at it
  let spent = 0;
  let before = performance.now();
  setInterval(() => {
    const now = performance.now();
    if (!picked && !held && !titleBusy && stageSeen && !document.hidden) spent += now - before;
    before = now;
    if (picked) return;
    if (spent >= STAGE_MS) {
      spent = 0;
      showStage((stageAt + 1) % home.stage.length);
    }
    time.style.setProperty("--time", (spent / STAGE_MS).toFixed(3));
  }, 100);
}

// signed in, the first door is your own profile
function profileDoor() {
  const [mode, standing] = me.top;
  const fav = typeof favourites !== "undefined" && favourites[me.name];
  const bestMap = me.best.split(" | ")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
  // the hardest badge as the site shows a role everywhere: a pill with its colour, never split
  const [badgeMap, badgeToken] = me.best.split(" | ");
  const best = pill("span", { class: "pill door-pill" }, fav && fav[0] === me.best ? { color: fav[1], end: fav[2], third: fav[3] } : null, badgeMap, badgeToken);
  return door(PAGES[me.name] || "profile.html", `assets/tile/thumb_${bestMap}.jpg`, faceImg(me.name, "door-face"), [nameTag(me.name), h("span", { class: "dim" }, " (you)")], [
    [`TOP ${standing.top} in ${mode}, `, h("span", { class: "hl nowrap" }, `${me.exp} EXP`)],
    ["Hardest badge ", best],
  ]);
}

// A door to each part of the site: a picture of it, its name, and two lines of what is new or
// notable there, the way the game's server list says what is on each server. Nothing here repeats
// the stage or the hotbar.
function door(href, art, corner, title, lines) {
  const faces = corner?.classList.contains("face-wall");
  return h("li", {}, h("a", { class: `door${faces ? " faces" : art ? "" : " gold"}`, href, style: art ? `--art: url("${asset(art)}")` : "" },
    corner, h("b", {}, title), lines.map((line) => h("span", { class: "door-line" }, [line].flat(Infinity)))));
}

function faceImg(name, cls) {
  return h("img", { class: cls, src: asset(`assets/face/${name.toLowerCase()}.png`), alt: "", loading: "lazy", onerror: (event) => { event.currentTarget.src = NO_FACE; } });
}

// the top three on blocks of gold, iron and copper, as on the Leaderboards podium
function doorPodium(top) {
  const place = (row, rank) => h("span", { class: `door-place p${rank}` }, faceImg(row[0], ""), h("i"));
  return h("span", { class: "door-podium", "aria-hidden": "true" }, place(top[1], 2), place(top[0], 1), place(top[2], 3));
}

const KIND_NAMES = [["v", "victory", "victories"], ["t", "tier completed", "tiers completed"], ["r", "climb", "climbs"], ["m", "new map", "new maps"], ["s", "step", "steps"]];

// "1 victory, 8 steps": what the new entries are, biggest kind first
function kindsText(kinds) {
  return KIND_NAMES.filter(([k]) => kinds[k]).map(([k, one, many]) => `${kinds[k]} ${kinds[k] === 1 ? one : many}`).join(", ");
}

// who the home is for: the signed-in player, when it is the one player this mockup has data for
const me = signedIn === home.me.name ? home.me : null;

// signed out, the first door asks you in, over a wall of the players already on the list
function signInDoor() {
  const names = [...new Set([...home.leaders.top.map((row) => row[0]), ...home.ladder.flatMap((row) => row[3].map((p) => p[0]))])].slice(0, 14);
  const wall = h("span", { class: "face-wall", "aria-hidden": "true" }, names.map((name) => faceImg(name, "")));
  return door("index.html?me=wlatr", null, wall, "Your profile", [
    "Sign in with Discord to see yourself here",
    [`${home.players} players from ${home.community.countries} countries are already on it`],
  ]);
}

function renderNote() {
  const note = document.getElementById("mockup-note");
  note.replaceChildren(...(me
    ? ["Mockup: you are signed in as wlatr, last seen 16 Sep. ", h("a", { href: "index.html?me=" }, "Sign out"), " to see the home as most visitors see it."]
    : ["Mockup: you are not signed in. ", h("a", { href: "index.html?me=wlatr" }, "Sign in"), " to see the home of a signed-in player, wlatr."]));
}

function renderDoors() {
  const first = home.leaders.top[0];
  const newest = home.catalog.newest;
  const newestSlug = newest[2] || (home.stage.find((m) => m.name === newest[0]) || {}).slug || "pandorasbox";
  // each number stays with its word when the line wraps
  const count = (n, what) => h("span", { class: "nowrap" }, h("span", { class: "hl" }, String(n)), ` ${what}`);
  document.getElementById("home-totals").replaceChildren(
    h("span", {}, "Every map, step and victor of the hardest Minecraft parkour."),
    h("span", {}, count(home.players, "players,"), " ", count(home.maps, "maps,"), " ", count(home.wins, "victories")));
  const busiest = home.activity.busiest;
  const climb = home.leaders.climb;
  document.getElementById("doors").replaceChildren(
    me ? profileDoor() : signInDoor(),
    door("activity.html", `assets/tile/thumb_${busiest[3] || home.victories[0][7]}.jpg`, null, "Activity", [
      me ? [h("span", { class: "hl" }, `${home.activity.fresh} new`), ` since your last visit: ${kindsText(home.activity.kinds)}`]
        : [h("span", { class: "hl" }, `${home.activity.monthKinds.v || 0} victories`), ` and ${home.activity.monthKinds.s || 0} steps in the last 30 days`],
      ["Busiest this month: ", paintedMap(busiest[0], badgeOf(busiest[2]))],
    ]),
    door("leaderboards.html", null, doorPodium(home.leaders.top), "Leaderboards", [
      ["#1 ", nameTag(first[0]), ", ", h("span", { class: "hl nowrap" }, `${first[2]} EXP`)],
      climb && me && climb[3] === me.name ? [nameTag(climb[1]), ` passed you for #${climb[2]}, ${shortDay(climb[0])}`]
        : climb ? [nameTag(climb[1]), ` climbed to #${climb[2]}, ${shortDay(climb[0])}`] : "No climbs lately",
    ]),
    door("maps.html", `assets/tile/thumb_${newestSlug}.jpg`, null, "Maps", [
      [`${home.maps} maps, `, h("span", { class: "hl" }, `${home.unbeaten.length} unbeaten`)],
      ["New: ", paintedMap(newest[0], badgeOf(newest[3])), `, ${shortDay(newest[1])}`],
    ]),
  );
}

// The nine newest victories as the game's hotbar: the map in each slot, the victor's face, and
// the victor number where the game puts a stack's count. The selected slot's name shows above it
// and the selection steps along on its own until the visitor takes over; keys 1 to 9 pick a slot.
// Featured: the biggest victories, steps and new maps of the last 30 days, weighed as on the
// Activity page (data/home.js), a card each: the map's screenshot in its tier frame, its name, and
// who did what, in the words of the Activity page

function renderFeatured() {
  const start = new Date(Date.parse(`${home.end}T00:00:00Z`) - 29 * 86400000).toISOString().slice(0, 10);
  document.getElementById("featured-note").textContent = `The biggest of the last 30 days, ${shortDay(start)} to ${shortDay(home.end)}`;
  const cards = home.featured.map(([kind, d, name, country, map, badge, n, tier, shot, step, far, reached]) => {
    const what = kind === "v" ? (n === 1 ? [h("span", { class: "hl" }, "first victory ever")] : [`${ordinal(n)} victor`])
      : kind === "s" ? [far ? "furthest anyone has gone" : `reached by ${reached}`, step ? ` at ${step}` : ""] : ["new map"];
    const who = name ? [head(name), nameTag(name), flag(country), ", "] : [];
    const text = `${name ? `${name}, ` : ""}${map}, ${what.map((part) => (typeof part === "string" ? part : part.textContent)).join("")}, ${shortDay(d)}`;
    return h("li", {}, h("a", { class: "feature", href: name ? `activity.html?find=${encodeURIComponent(name)}` : mapLink(map), "aria-label": text },
      tile("span", { "aria-hidden": "true" }, `assets/tile/map_${shot}.jpg`, tier),
      h("span", { class: "feature-map" }, paintedMap(map, badgeOf(badge))),
      h("span", { class: "feature-who dim" }, ...who.filter(Boolean), ...what, ", ", h("span", { class: "nowrap" }, shortDay(d)))));
  });
  document.getElementById("featured").replaceChildren(...cards);
}

function renderHotbar() {
  const bar = document.getElementById("hotbar");
  const label = document.getElementById("item-name");
  const slots = home.victories.map(([d, name, country, map, badge, n, tier, shot]) =>
    h("a", {
      class: `hot-slot${shot ? "" : " blank"}${n === 1 ? " first-victor" : ""}`,
      href: `activity.html?find=${encodeURIComponent(name)}`,
      style: shot ? `--art: url("${asset(`assets/tile/thumb_${shot}.jpg`)}")` : "",
      "aria-label": `${name} beat ${map}, ${ordinal(n)} victor, ${shortDay(d)}`,
    }, head(name), h("span", { class: "hot-count", "aria-hidden": "true" }, String(n))));
  bar.replaceChildren(...slots.map((slot) => h("li", {}, slot)));

  let selected = 0;
  let held = false;
  const select = (i) => {
    selected = i;
    slots.forEach((slot, j) => slot.classList.toggle("selected", j === i));
    // on a phone the strip scrolls sideways; keep the picked slot in the middle of it
    if (bar.scrollWidth > bar.clientWidth) {
      const box = slots[i].getBoundingClientRect();
      const strip = bar.getBoundingClientRect();
      bar.scrollTo({ left: bar.scrollLeft + box.left - strip.left - (strip.width - box.width) / 2, behavior: calm.matches ? "auto" : "smooth" });
    }
    const [d, name, country, map, badge, n] = home.victories[i];
    const which = n === 1 ? [", the ", h("span", { class: "hl" }, "first victor")] : [`, ${ordinal(n)} victor`];
    label.replaceChildren(...[nameTag(name), flag(country), " beat ", paintedMap(map, badgeOf(badge)), ...which, `, ${shortDay(d)}`].filter(Boolean));
  };
  select(0);
  slots.forEach((slot, i) => {
    slot.addEventListener("mouseenter", () => select(i));
    slot.addEventListener("focus", () => select(i));
  });
  bar.addEventListener("mouseenter", () => { held = true; });
  bar.addEventListener("mouseleave", () => { held = false; });
  bar.addEventListener("focusin", () => { held = true; });
  bar.addEventListener("focusout", () => { held = false; });
  bar.addEventListener("keydown", (event) => {
    const key = Number(event.key);
    if (key >= 1 && key <= slots.length) {
      event.preventDefault();
      slots[key - 1].focus();
      select(key - 1);
    }
  });
  // The selection steps along once, through every slot and back to the first, and only while the
  // hotbar is in view; then it waits for the visitor.
  if (calm.matches || !("IntersectionObserver" in window)) return;
  let steps = 0;
  let timer = null;
  const step = () => {
    if (held || document.hidden) return;
    select((selected + 1) % slots.length);
    if (++steps >= slots.length) {
      clearInterval(timer);
      watch.disconnect();
    }
  };
  const watch = new IntersectionObserver(([entry]) => {
    clearInterval(timer);
    if (entry.isIntersecting) timer = setInterval(step, 3500);
  }, { threshold: 0.6 });
  watch.observe(bar);
}

// The climb as a beacon: each layer is everyone whose hardest badge reached that tier or higher,
// built from the tier's material; Tier X is the beacon block itself. At rest it steps in a block a
// side per layer, as a beacon does in the game. Hovered, or with its button, each layer eases to
// its share of the players at the width of the base (CSS), a thin sliver at least, so the widths
// are seen to mean something; the labels give the exact counts.
const BEACON_BASE = 19;
const BEACON_FITS = [
  { block: 36, room: 240, mode: "" },
  { block: 30, room: 220, mode: "" },
  { block: 24, room: 200, mode: "" },
  { block: 24, room: 110, mode: "short" },
  // on a phone the labels move into a key under the pyramid
  { block: 16, room: 0, mode: "legend" },
];

function beaconWidths() {
  const total = home.ladder[home.ladder.length - 1][1];
  return home.ladder.map(([, reached], i) => [2 * i + 1, Math.max(0.35, (reached / total) * BEACON_BASE)]);
}

function layoutBeacon() {
  const box = document.getElementById("beacon");
  const width = box.clientWidth;
  const fit = BEACON_FITS.find((f) => f.block * BEACON_BASE + 2 * f.room <= width) || BEACON_FITS[BEACON_FITS.length - 1];
  const widths = beaconWidths();
  box.style.setProperty("--block", `${fit.block}px`);
  box.classList.toggle("short", fit.mode === "short");
  box.classList.toggle("legend", fit.mode === "legend");
  [...box.querySelectorAll(".beacon-row")].forEach((row, i) => {
    row.style.setProperty("--w", widths[i][0]);
    row.style.setProperty("--p", widths[i][1].toFixed(3));
    row.style.setProperty("--i", i);
  });
}

function beaconTag(name, note) {
  return h("span", { class: "beacon-tag" }, head(name), nameTag(name), note ? h("span", { class: "dim" }, note) : null);
}

function renderBeacon() {
  const box = document.getElementById("beacon");
  const base = home.ladder[home.ladder.length - 1][1];
  const hover = matchMedia("(hover: hover)").matches;
  document.getElementById("climb-note").textContent = `${base} players hold a tier. ${hover ? "Hover the beacon" : "Use the button"} to size each layer by the players who reached it, and ${hover ? "click" : "tap"} a layer for its badges.`;
  const rows = home.ladder.map(([tier, reached, here, names]) => {
    const href = `tier.html?t=${tier}`;
    const layer = h("a", { class: `layer m${tier}`, href, "aria-label": `Tier ${ROMAN[tier]} ${TIER_NAMES[tier]}: ${reached} ${reached === 1 ? "player" : "players"} reached it or higher` });
    tip(layer, () => {
      const more = here > names.length ? ` and ${here - names.length} more` : "";
      const stopped = here ? `<p>${here} stopped here: ${names.map(([name]) => esc(name)).join(", ")}${more}</p>` : "";
      return `<b style="color: var(--t${tier})">Tier ${ROMAN[tier]} ${esc(TIER_NAMES[tier])}</b><p>${reached} ${reached === 1 ? "player" : "players"} reached it or higher</p>${stopped}<p class="hint">Click to see this tier's badges</p>`;
    });
    const label = h("a", { class: "layer-label", href, tabindex: "-1", "aria-hidden": "true" }, sword(tier, "sword small"),
      h("span", { class: "layer-tier" }, ROMAN[tier]), h("span", { class: "layer-name" }, TIER_NAMES[tier]), h("span", { class: "layer-count" }, String(reached)));
    const row = h("div", { class: `beacon-row${tier === 10 ? " summit" : ""}` }, layer, label);
    const tags = [];
    if (me && tier === me.tier) tags.push(beaconTag(me.name, " (you)"));
    if (tier === 10) tags.push(...names.filter(([name]) => !me || name !== me.name).slice(0, 1).map(([name]) => beaconTag(name)));
    if (tags.length) row.append(h("span", { class: "beacon-tags" }, tags));
    return row;
  });
  // on a phone the key opens the tier pages, the thin layers being hard to tap
  const key = h("ol", { class: "beacon-key" }, home.ladder.map(([tier, reached]) =>
    h("li", {}, h("a", { href: `tier.html?t=${tier}` }, sword(tier, "sword small"), h("span", {}, `Tier ${ROMAN[tier]}`), h("span", { class: "layer-count" }, String(reached))))));
  box.replaceChildren(...rows, key);
  layoutBeacon();
  const size = document.getElementById("beacon-size");
  size.addEventListener("click", () => {
    const counted = box.classList.toggle("counted");
    size.setAttribute("aria-pressed", String(counted));
    size.textContent = counted ? "Back to the beacon" : "Size by players";
  });
  if ("ResizeObserver" in window) new ResizeObserver(layoutBeacon).observe(box);
  // the beam rises once, the first time the beacon comes into view
  if (calm.matches || !("IntersectionObserver" in window)) {
    box.classList.add("lit");
    return;
  }
  const watch = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    box.classList.add("lit");
    watch.disconnect();
  }, { threshold: 0.5 });
  watch.observe(box);
}

// the top bar's search stays out of the way while the big one is on screen
function watchHeroSearch() {
  const hero = document.querySelector(".hero-search");
  if (!hero || !("IntersectionObserver" in window)) return;
  new IntersectionObserver(([entry]) => document.body.classList.toggle("hero-search-on", entry.isIntersecting),
    { rootMargin: `-${document.querySelector(".bar").offsetHeight}px 0px 0px 0px` }).observe(hero);
}

// the big search says "Search" alone when its full placeholder would be cut on a narrow phone
function fitPlaceholder() {
  const input = document.querySelector(".hero-search input");
  if (!input) return;
  const full = "Search players and maps";
  const style = getComputedStyle(input);
  const pen = document.createElement("canvas").getContext("2d");
  pen.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const room = input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  input.placeholder = pen.measureText(full).width <= room ? full : "Search";
}

// on a phone the bar has no search of its own: once the big one scrolls off, a button brings it back
function wireBarFind() {
  const button = document.querySelector(".bar-find");
  const input = document.querySelector(".hero-search input");
  if (!button || !input) return;
  button.addEventListener("click", () => {
    input.scrollIntoView({ block: "center", behavior: calm.matches ? "auto" : "smooth" });
    input.focus({ preventScroll: true });
  });
}

worldNow = "";
renderStage();
renderDoors();
renderNote();
renderTitle();
renderFeatured();
renderHotbar();
renderBeacon();
watchHeroSearch();
wireBarFind();
fitPlaceholder();
document.fonts?.ready.then(fitPlaceholder);
addEventListener("resize", fitPlaceholder);
