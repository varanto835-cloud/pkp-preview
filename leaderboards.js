const MODE_LIST = [["All", "All"], ["Rankup", "Rankup"], ["Segmented", "Segmented"], ["Onlysprint", "Onlysprint"], ["Miscellaneous", "Misc"]];
const BANDS_RARITY = [[1, "1% or less"], [5, "Under 5%"], [15, "Under 15%"], [30, "Under 30%"], [Infinity, "30% or more"]];
const narrow = matchMedia("(max-width: 900px)");
const badgeMode = {};
const mapMode = {};
for (const [id, , mode] of badgeBoard) badgeMode[id] = mode;
for (const [name, mode] of mapBoard) mapMode[name] = mode;

// columns of each board; the ones with a sort key can be clicked to rank by them
const BOARDS = {
  players: {
    label: "Players", find: "Find a player",
    columns: [
      { label: "Player", lead: true },
      {
        label: "Hardest badge", by: "difficulty", alt: "victory", wide: true,
        note: "The hardest badge held, grouped by tier. With a gamemode picked, this is the TOP on the cards.",
        altNote: "The hardest map beaten, grouped by tier.",
      },
      { label: "Tiers", by: "tiers", note: "Tiers acquired: every badge in a tier and in the tiers below it is held." },
      { label: "Victories", by: "victories", note: "Maps beaten." },
      { label: "Badges", by: "badges", minor: true, note: "Every milestone reached on every map." },
      { label: "Sky fails", by: "sky", minor: true, note: "Fails at each map's fail point over every victory. Void fails are left out, as in the bot." },
      { label: "EXP", by: "exp", note: "Your best step on every map, added up: 1000 EXP at difficulty 190, 2% less for every point below." },
    ],
  },
  countries: {
    label: "Countries", find: "Find a country",
    columns: [
      { label: "Country", lead: true },
      { label: "Hardest badge", by: "difficulty", wide: true, note: "The hardest badge held by anyone from the country." },
      { label: "Players", by: "players", note: "Players with any progress." },
      { label: "Victories", by: "victories", note: "Maps beaten by the players of the country." },
      { label: "Maps", by: "maps", note: "Different maps beaten by at least one player of the country." },
      { label: "Badges", by: "badges", minor: true, note: "Badges held by the players of the country." },
      { label: "Sky fails", by: "sky", minor: true, note: "Fails at each map's fail point over every victory." },
    ],
  },
  maps: {
    label: "Maps", find: "Find a map",
    columns: [
      { label: "Map", lead: true },
      { label: "EXP", by: "exp", note: "EXP for beating the map. Maps without a difficulty value sit at the end." },
      { label: "Victors", by: "victors", note: "Players who beat the map." },
      { label: "On it", by: "players", note: "Players on the map right now, plus its victors." },
      { label: "Avg fails", by: "avg", minor: true, note: "Average fails of the victors at the map's own fail point." },
      { label: "Total fails", by: "total", minor: true, note: "Every fail of every victor at the map's own fail point, added up." },
      { label: "Last beaten", by: "last", alt: "first", note: "The latest victory on the map.", altNote: "The first victory on the map." },
    ],
  },
  badges: {
    label: "Badges", find: "Find a badge",
    columns: [
      { label: "Badge", lead: true },
      { label: "Map", wide: true },
      { label: "Holders", by: "rarest", note: "Players holding the badge, out of everyone on the server." },
    ],
  },
};
const DEFAULT_BY = { players: "exp", countries: "victories", maps: "exp", badges: "rarest" };
const SORT_NAMES = {
  exp: "EXP", difficulty: "Hardest badge", victory: "Hardest victory", tiers: "Tiers", victories: "Victories", badges: "Badges",
  sky: "Sky fails", players: "Players", maps: "Maps", victors: "Victors", avg: "Avg fails", total: "Total fails",
  last: "Last beaten", first: "First beaten", rarest: "Holders",
};
// what each order reads as, normal and reversed, like the bot's Descending button
const MOST = ["Most first", "Fewest first"];
const ORDER = {
  exp: ["Highest first", "Lowest first"], difficulty: ["Hardest first", "Easiest first"], victory: ["Hardest first", "Easiest first"],
  tiers: MOST, victories: MOST, badges: MOST, sky: MOST, players: MOST, maps: MOST, victors: MOST, total: MOST,
  avg: ["Highest first", "Lowest first"], last: ["Newest first", "Oldest first"], first: ["Oldest first", "Newest first"],
  rarest: ["Rarest first", "Most common first"],
};
const RISING = ["first", "rarest"];

let state = readUrl();
let rows = [];
let openIndex = -1;
const cache = new Map();

function sortKeys(board) {
  return BOARDS[board].columns.flatMap((c) => [c.by, c.alt]).filter(Boolean);
}

function readUrl() {
  const q = new URLSearchParams(location.search);
  const board = BOARDS[q.get("board")] ? q.get("board") : "players";
  const by = sortKeys(board).includes(q.get("by")) ? q.get("by") : DEFAULT_BY[board];
  const mode = MODE_LIST.some(([m]) => m === q.get("mode")) ? q.get("mode") : "All";
  return { board, by, mode, country: q.get("country") || "", reverse: q.get("order") === "reverse", pick: q.get("pick") };
}

function share(holders) {
  const pct = (holders / boardPlayers) * 100;
  return pct < 1 ? pct.toFixed(1) : String(Math.round(pct));
}

function badgeRow(id) {
  const row = id == null ? null : badgeTable[id];
  return row ? { name: row[0], color: row[1], end: row[2], third: row[3] } : null;
}

// a badge pill that keeps its token when the map name has to be cut
function pillSpan(id, fallback) {
  const badge = badgeRow(id);
  if (!badge) {
    const [map, token] = (fallback || "no badge").split(" | ");
    return h("span", { class: "pill ghost cut" }, dot(null), h("span", { class: "pill-map" }, map), token ? h("span", { class: "tok" }, ` | ${token}`) : null);
  }
  const [map, token] = badge.name.split(" | ");
  return h("span", { class: "pill cut" }, dot(badge), h("span", { class: "pill-map" }, map), h("span", { class: "tok" }, ` | ${token}`));
}

function victoryPill(row) {
  return row.victory ? pillSpan(row.victory[1], `${row.victory[2]} | VICTOR`) : "-";
}

function badgeLink(id, fallback) {
  const badge = badgeRow(id);
  if (!badge) return pillSpan(id, fallback);
  const [map, token] = badge.name.split(" | ");
  const page = badgePages.includes(badgeKey(badge.name));
  return pill(page ? "a" : "span", { class: "pill", href: page ? badgeHref(badge.name) : null }, badge, map, token);
}

function painted(name, badgeId, tag = "span") {
  const badge = badgeRow(badgeId);
  if (!badge) return h(tag, {}, name);
  return h(tag, { class: `name${badge.end ? " blend" : ""}`, style: nameColours(badge.color, badge.end, badge.third) }, name);
}

// boards

function playerList(by, mode, country) {
  const out = [];
  for (const [name, code, modes] of playerBoard) {
    const per = modes[mode];
    if (!per || (country && code !== country)) continue;
    const [exp, best, victories, badges, sky, tiers, bestTier, victory] = per;
    const value = best ? best[0] : 0;
    const key = {
      exp: exp ? [exp, value] : null,
      difficulty: best ? [value, exp, best[4]] : null,
      victory: victory ? [victory[0], exp] : null,
      tiers: tiers ? [tiers, bestTier] : null,
      victories: victories ? [victories] : null,
      badges: badges ? [badges] : null,
      sky: sky ? [sky] : null,
    }[by];
    out.push({ kind: "player", id: name, name, country: code, exp, best, victories, badges, sky, tiers, bestTier, victory, key });
  }
  return out;
}

function countryList(by, mode) {
  const out = [];
  for (const [code, modes] of Object.entries(countryBoard)) {
    const per = modes[mode];
    if (!per) continue;
    const [players, victories, maps, badges, sky, best] = per;
    const key = { victories: victories ? [victories] : null, players: [players], maps: maps ? [maps] : null, badges: badges ? [badges] : null, sky: sky ? [sky] : null, difficulty: best ? [best[0]] : null }[by];
    out.push({ kind: "country", id: code, code, name: COUNTRIES[code] || code.toUpperCase(), players, victories, maps, badges, sky, best, key });
  }
  return out;
}

function mapList(by, mode, country) {
  const out = [];
  const day = (pair) => (pair && pair[0] ? Number(pair[0].replaceAll("-", "")) : 0);
  for (const entry of mapBoard) {
    const [name, gamemode, value, , , , , , , failsLabel, badge, shot, builder, byCountry] = entry;
    if (mode !== "All" && gamemode !== mode) continue;
    // with a country picked, only the maps its players are on, counting only them
    if (country && !byCountry[country]) continue;
    const [victors, onMap, first, last, avg, fails] = country ? byCountry[country] : entry.slice(3, 9);
    const key = {
      exp: value != null ? [value] : null,
      victors: victors ? [victors] : null,
      players: onMap ? [onMap] : null,
      avg: avg != null ? [avg] : null,
      total: fails ? [fails] : null,
      first: first ? [-day(first)] : null,
      last: last ? [day(last)] : null,
    }[by];
    out.push({ kind: "map", id: name, name, mode: gamemode, value, victors, onMap, first, last, avg, fails, failsLabel, badge, shot, builder, key });
  }
  return out;
}

function badgeList(by, mode) {
  const out = [];
  for (const [id, map, gamemode, value, holders] of badgeBoard) {
    if (mode !== "All" && gamemode !== mode) continue;
    const name = badgeTable[id][0];
    out.push({ kind: "badge", id: name, name, badge: id, map, mode: gamemode, value, holders, key: holders ? [by === "rarest" ? -holders : holders] : null });
  }
  return out;
}

const byName = new Intl.Collator("en").compare;

function compare(a, b) {
  for (let i = 0; i < Math.max(a.key.length, b.key.length); i++) {
    const d = (b.key[i] || 0) - (a.key[i] || 0);
    if (d) return d;
  }
  return 0;
}

function build(board, by, mode, country, reverse = false) {
  const id = [board, by, mode, country, reverse].join("|");
  if (cache.has(id)) return cache.get(id);
  const all = { players: () => playerList(by, mode, country), countries: () => countryList(by, mode), maps: () => mapList(by, mode, country), badges: () => badgeList(by, mode) }[board]();
  const sign = reverse ? -1 : 1;
  const ranked = all.filter((row) => row.key).sort((a, b) => sign * compare(a, b) || byName(String(a.name), String(b.name)));
  let rank = 0;
  ranked.forEach((row, i) => {
    const prev = ranked[i - 1];
    rank = prev && compare(prev, row) === 0 ? rank : i + 1;
    row.rank = rank;
    row.tie = Boolean(prev && prev.key[0] === row.key[0] && prev.rank !== rank);
  });
  // maps and badges keep their unranked rows at the end, players and countries leave them out
  const rest = board === "maps" || board === "badges" ? all.filter((row) => !row.key).sort((a, b) => byName(a.name, b.name)) : [];
  const result = { rows: ranked.concat(rest), missing: all.length - ranked.length };
  cache.set(id, result);
  return result;
}

function rankIn(board, by, mode, id, country = "") {
  const row = build(board, by, mode, country).rows.find((r) => r.id === id);
  return row && row.rank ? row.rank : null;
}

function cardMode(name) {
  const per = (playerBoard.find(([n]) => n === name) || [])[2];
  const best = per && per.All && per.All[1];
  if (!best) return null;
  if (best[1] != null && badgeMode[best[1]]) return badgeMode[best[1]];
  return mapMode[bestLabels[best[2]].split(" | ")[0]] || null;
}

function band(row) {
  if (!row.holders) return "Nobody yet";
  return BANDS_RARITY.find(([limit]) => (row.holders / boardPlayers) * 100 <= limit)[1];
}

// cells

function lead(row) {
  if (row.kind === "player") return [head(row.name), nameTag(row.name), flag(row.country)];
  if (row.kind === "country") return [flag(row.code), h("span", {}, row.name)];
  if (row.kind === "map") return [h("span", { class: "mode-chip" }, MODE_LETTER[row.mode]), painted(row.name, row.badge), narrow.matches ? null : socket(tierOf(row.value))];
  return [socket(tierOf(row.value)), pillSpan(row.badge)];
}

function short(iso) {
  if (!iso) return "-";
  const [y, m] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

function cell(row, column) {
  const by = column.by;
  if (row.kind === "player") {
    if (by === "difficulty" && state.by === "victory") return victoryPill(row);
    if (by === "difficulty") return row.best ? pillSpan(row.best[1], bestLabels[row.best[2]]) : "-";
    if (by === "tiers") return row.tiers ? [socket(row.bestTier), String(row.tiers)] : "-";
    return String(row[by] || 0);
  }
  if (row.kind === "country") {
    if (by === "difficulty") return row.best ? pillSpan(row.best[1], bestLabels[row.best[2]]) : "-";
    return String(row[by] || 0);
  }
  if (row.kind === "map") {
    if (by === "exp") return row.value != null ? String(expOf(row.value)) : "-";
    if (by === "victors") return String(row.victors);
    if (by === "players") return String(row.onMap);
    if (by === "avg") return row.avg != null ? [String(row.avg), row.failsLabel !== "sky" ? h("small", {}, ` ${row.failsLabel}`) : null] : "-";
    if (by === "total") return row.fails != null ? String(row.fails) : "-";
    const pair = state.by === "first" ? row.first : row.last;
    return pair ? short(pair[0]) : "-";
  }
  if (column.wide) return h("span", { class: "dim" }, `${row.map}, ${row.mode}`);
  return row.holders ? [String(row.holders), h("small", {}, ` ${share(row.holders)}%`)] : "0";
}

// the value shown under a name on phones and on the podium
function valueOf(row, by = state.by) {
  if (row.kind === "player") {
    if (by === "exp") return `${row.exp} EXP`;
    if (by === "difficulty") return row.best ? pillSpan(row.best[1], bestLabels[row.best[2]]) : "-";
    if (by === "victory") return victoryPill(row);
    if (by === "tiers") return [socket(row.bestTier), ` ${row.tiers} ${row.tiers === 1 ? "tier" : "tiers"}`];
    if (by === "victories") return `${row.victories} ${row.victories === 1 ? "victory" : "victories"}`;
    if (by === "badges") return `${row.badges} badges`;
    return `${row.sky} sky fails`;
  }
  if (row.kind === "country") {
    if (by === "difficulty") return row.best ? pillSpan(row.best[1], bestLabels[row.best[2]]) : "-";
    return `${row[by]} ${{ victories: "victories", players: "players", maps: "maps", badges: "badges", sky: "sky fails" }[by]}`;
  }
  if (row.kind === "map") {
    if (!row.key) return "-";
    if (by === "exp") return `${expOf(row.value)} EXP`;
    if (by === "victors") return `${row.victors} ${row.victors === 1 ? "victor" : "victors"}`;
    if (by === "players") return `${row.onMap} on it`;
    if (by === "avg") return `${row.avg} avg ${row.failsLabel} fails`;
    if (by === "total") return `${row.fails} ${row.failsLabel} fails`;
    return date((by === "first" ? row.first : row.last)[0]);
  }
  return row.holders === 1 ? "1 holder" : `${row.holders} holders, ${share(row.holders)}%`;
}

function groupOf(row) {
  if ((row.kind === "player" || row.kind === "country") && state.by === "difficulty") return ["tier", tierOf(row.best[0])];
  if (row.kind === "player" && state.by === "victory") return ["tier", tierOf(row.victory[0])];
  if (row.kind === "badge") return ["band", band(row)];
  if (row.kind === "map" && !row.key) return ["none", state.by === "exp" ? "No EXP value" : "Not counted on this board"];
  return null;
}

function rankCell(row, tag = "span") {
  if (row.kind === "badge") return h(tag, { class: "rank" });
  const cellEl = h(tag, { class: "rank" }, row.rank === 1 && !state.reverse ? icon("crown", "first") : null, row.rank ? `${row.rank}` : "-");
  if (row.tie) {
    const why = state.by === "exp" ? "the hardest badge" : state.by === "difficulty" || state.by === "victory" ? "EXP" : "the tie-break";
    tip(cellEl, () => `<b>Same value as the row above</b><p>${esc(`Placed by ${why}, as the bot does.`)}</p>`);
  }
  return cellEl;
}

// podium: the top three standing on blocks of gold, iron and copper, as in a server lobby.
// Players are drawn in 3D from their skin, each in a parkour move that plays once.

const POSES = { 1: "flip", 2: "aerial", 3: "spin" };
const phone = matchMedia("(max-width: 760px)");
let viewerLib = null;
let stage = null;
let podiumRun = 0;

function loadViewer() {
  viewerLib ||= new Promise((resolve, reject) => {
    document.head.append(h("script", { src: asset("assets/lib/skinview3d.bundle.js"), onload: resolve, onerror: reject }));
  });
  return viewerLib;
}

// One 3D canvas over the whole podium, made once and kept: the three players are drawn into it
// side by side in one pass, so shaders compile once and nothing is copied between canvases
function getStage() {
  stage ||= loadViewer().then(() => {
    // the context is made first, with the graphics card's antialiasing, and the viewer takes it
    // as it is; the viewer's own smoothing pass is never used
    const canvas = h("canvas", { class: "podium-stage", "aria-hidden": "true" });
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
    // the frames overlap, so each player must not wipe its frame before drawing; paint clears once
    s.gl.autoClear = false;
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
    s.actors = [s.playerObject, new skinview3d.PlayerObject(), new skinview3d.PlayerObject()];
    s.actors.slice(1).forEach((actor) => s.playerWrapper.add(actor));
    // capes, elytra and ears are never shown; out of the scene they cost nothing
    for (const actor of s.actors) {
      actor.cape.removeFromParent();
      actor.elytra.removeFromParent();
      actor.ears.removeFromParent();
      // the outer skin layer is cut out, never see-through, so one pass draws it; the default
      // two passes would rebuild its shader state on every single draw
      actor.skin.layer2Material.forceSinglePass = true;
      actor.skin.layer2MaterialBiased.forceSinglePass = true;
    }
    s.textures = [];
    s.views = [];
    new ResizeObserver(() => {
      measure(s);
      paint(s);
    }).observe(s.canvas);
    return s;
  });
  return stage;
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

// where one player stands; the stage draws it there
function mountPose(box, row, place) {
  const kind = POSES[place];
  const move = MOVES[kind];
  const small = phone.matches;
  const scale = small ? 0.5 : 1;
  const height = small ? (place === 1 ? 170 : 150) : (place === 1 ? 340 : 300);
  // the flip and the aerial need room to turn over: a taller frame sunk by half the extra,
  // seen from further back so the player keeps its size
  const extra = (move.extra || 0) * scale;
  const tall = height + extra;
  box.style.height = `${height}px`;
  const shadow = h("span", { class: "pose-shadow" });
  box.append(shadow);
  const name = row.name.toLowerCase();
  const tier = row.best ? tierOf(row.best[0]) : 0;
  return {
    box, shadow, kind, move, name, scale, small, tall, ms: 0,
    slim: skinSlim.includes(name),
    rim: tier ? getComputedStyle(document.documentElement).getPropertyValue(`--t${tier}`).trim() : "",
    zoom: (0.9 * height) / tall,
    height,
    // the model leaves a little room under its feet, so the frame sits that much lower
    sink: (small ? 6 : 16) + extra / 2,
    // on phones the left column ends near the screen edge, so the aerial wheels a little to the right
    shift: small && kind === "aerial" ? 30 : 0,
    land() {
      box.closest(".podium-step")?.querySelector(".podium-value").count?.();
    },
  };
}

// moves one player to a moment of its move; the stage shows it on the next paint
function setPose(view, ms) {
  view.ms = ms;
  view.up = pose(view.actor, view.kind, ms);
  // phone columns are narrow, so the drift is shorter there
  view.x = track(view.move.slide, ms) * (view.small ? 0.15 : 1);
  view.shadow.style.setProperty("--slide", `${view.x}px`);
  view.shadow.style.setProperty("--air", view.up.toFixed(3));
}

// where each player's frame sits on the stage; the steps do not move while the players do,
// so this runs when the podium is set up or resized, never on every frame
function measure(s) {
  const area = s.canvas.getBoundingClientRect();
  const width = Math.round(area.width);
  const height = Math.round(area.height);
  if (width && height && (width !== s.width || height !== s.height)) {
    s.width = width;
    s.height = height;
    s.gl.setSize(width, height, false);
  }
  for (const view of s.views) {
    const box = view.box.getBoundingClientRect();
    view.w = view.move.extra ? 440 * view.scale : Math.min(view.small ? 110 : 300, box.width);
    view.left = box.left - area.left + box.width / 2 + view.shift - view.w / 2;
    view.bottom = area.bottom - box.bottom - view.sink;
  }
}

// draws every player into its own frame of the stage canvas
function paint(s) {
  const views = s.views.filter((view) => view.actor && view.box.isConnected && view.here);
  if (!views.length || !s.width) return;
  const gl = s.gl;
  gl.setScissorTest(false);
  gl.clear();
  gl.setScissorTest(true);
  // the players' poses are worked into world space once per frame, not once per frame drawn
  s.scene.matrixWorldAutoUpdate = true;
  s.scene.updateMatrixWorld();
  s.scene.matrixWorldAutoUpdate = false;
  const camera = s.camera;
  camera.fov = 30;
  for (const view of views) {
    const left = view.left + view.x;
    const bottom = view.bottom + view.up * view.move.air * view.scale;
    gl.setViewport(left, bottom, view.w, view.tall);
    gl.setScissor(left, bottom, view.w, view.tall);
    for (const actor of s.actors) actor.visible = actor === view.actor;
    s.rim.intensity = view.rim ? 2.4 : 0;
    if (view.rim) s.rim.color.set(view.rim);
    // seen from a little below, so the players stand over us
    const far = 4.5 + 16.5 / Math.tan((15 * Math.PI) / 180) / view.zoom;
    camera.aspect = view.w / view.tall;
    camera.position.set(0, -Math.sin(0.16) * far, Math.cos(0.16) * far);
    camera.lookAt(0, 2, 0);
    camera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();
    // only depth is cleared per player, so none can hide behind another where frames overlap
    gl.clearDepth();
    gl.render(s.scene, camera);
  }
}

// a player comes on in a puff of white smoke, as anything does when it spawns in the game
function appear(view) {
  const step = view.box.closest(".podium-step");
  if (!step) return;
  step.classList.remove("waiting");
  const area = step.getBoundingClientRect();
  const box = view.box.getBoundingClientRect();
  const cloud = h("span", { class: "poof", style: `left: ${box.left - area.left + box.width / 2 + view.x + view.shift}px; bottom: ${area.bottom - box.bottom}px` });
  for (let i = 0; i < 26; i++) {
    const size = (16 + Math.random() * 16) * view.scale;
    const grey = 200 + Math.round(Math.random() * 55);
    const speck = h("i", { style: `left: ${(Math.random() - 0.5) * 100 * view.scale - size / 2}px; top: ${-Math.random() * view.height * 0.9 - size / 2}px; width: ${size}px; height: ${size}px; background: rgb(${grey}, ${grey}, ${grey})` });
    // the cloud is thick for a moment, hiding the player as it appears, then thins out and rises
    speck.animate([
      { opacity: 0, scale: 0.4, translate: "0 0" },
      { opacity: 1, scale: 1, translate: "0 -4px", offset: 0.2 },
      { opacity: 0.85, scale: 1.1, translate: "0 -10px", offset: 0.45 },
      { opacity: 0, scale: 1.3, translate: `${(Math.random() - 0.5) * 30}px ${-24 - Math.random() * 20}px` },
    ], { duration: 650 + Math.random() * 300, delay: Math.random() * 80, easing: "ease-out", fill: "both" });
    cloud.append(speck);
  }
  step.append(cloud);
  setTimeout(() => cloud.remove(), 1100);
}

// no 3D here (no WebGL), the face stands in on the step
function flatten(view) {
  view.box.closest(".podium-step")?.classList.remove("waiting");
  const face = head(view.name);
  face.classList.add("podium-head");
  view.box.className = "pose flat";
  view.box.style.height = "";
  view.box.replaceChildren(face);
  view.land();
}

// dresses the players on the stage, then plays the three moves on one clock
async function stagePlayers(podium, views, run) {
  let s;
  let pictures;
  try {
    s = await getStage();
    pictures = await Promise.all(views.map((view) => skinOf(view.name).then(picture)));
  } catch {
    if (run === podiumRun) views.forEach(flatten);
    return;
  }
  if (run !== podiumRun) return;
  s.textures.forEach((texture) => texture.dispose());
  s.textures = [];
  views.forEach((view, i) => {
    // loadSkin draws into the viewer's canvas and replaces its texture, so each skin gets a fresh pair
    s.skinCanvas = document.createElement("canvas");
    s.skinTexture = null;
    s.loadSkin(pictures[i], { model: view.slim ? "slim" : "default" });
    view.texture = s.skinTexture;
    view.actor = s.actors[i];
    s.textures.push(view.texture);
  });
  s.skinTexture = null;
  for (const view of views) {
    view.actor.skin.map = view.texture;
    view.actor.skin.modelType = view.slim ? "slim" : "default";
    view.actor.skin.visible = true;
  }
  if (!s.compiled) {
    s.actors.forEach((actor) => (actor.visible = true));
    s.gl.compile(s.scene, s.camera);
    await shadersReady(s);
    s.compiled = true;
    if (run !== podiumRun) return;
  }
  s.views = views;
  s.canvas.classList.remove("shown");
  podium.append(s.canvas);
  measure(s);
  const end = (view) => view.move.length + LAG_MAX;
  if (calm.matches) {
    views.forEach((view) => {
      view.here = true;
      setPose(view, end(view));
    });
    paint(s);
    s.canvas.classList.add("shown");
    views.forEach((view) => view.land());
    return;
  }
  views.forEach((view) => {
    setPose(view, 0);
    view.dust = [...(view.move.dust || [])];
    view.orbs = view.move.orbs;
  });
  paint(s);
  s.canvas.classList.add("shown");
  // they come on one at a time, third place first and the winner last
  const t0 = performance.now() + 150;
  const step = (now) => {
    if (run !== podiumRun) return;
    let busy = false;
    for (const view of views) {
      if (view.done) continue;
      const since = now - t0 - view.move.delay;
      if (since < 0) {
        busy = true;
        continue;
      }
      if (!view.puffed) {
        view.puffed = true;
        appear(view);
      }
      // the player shows once the smoke is thick
      if (since >= 120) view.here = true;
      const ms = Math.min(since, end(view));
      if (ms !== view.ms) setPose(view, ms);
      if (view.dust.length && ms >= view.dust[0]) {
        view.dust.shift();
        puff(view.box);
      }
      if (view.orbs && ms >= view.orbs) {
        view.orbs = 0;
        orbs(view.box, view.move.orbCount);
      }
      if (ms >= view.move.land) view.land();
      if (ms >= end(view)) view.done = true;
      else busy = true;
    }
    paint(s);
    if (busy) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function podiumVisual(row, place) {
  if (row.kind === "player") {
    const box = h("span", { class: `pose ${POSES[place]}` });
    box.view = mountPose(box, row, place);
    return box;
  }
  if (row.kind === "country") return flag(row.code, "flag podium-flag");
  if (row.kind === "map") return row.shot ? tile("span", {}, `assets/tile/map_${row.shot}.jpg`, tierOf(row.value)) : h("span", { class: "podium-blank" });
  return null;
}

function renderPodium() {
  const podium = document.getElementById("podium");
  const run = ++podiumRun;
  const top = rows.filter((row) => row.rank).slice(0, 3);
  // the podium is for the top, a reversed board has none
  podium.hidden = state.board === "badges" || state.reverse || top.length < 3;
  if (podium.hidden) return podium.replaceChildren();
  const steps = [[top[1], 2, 4], [top[0], 1, 5], [top[2], 3, 3]];
  podium.className = `podium podium-${state.board}`;
  podium.replaceChildren(...steps.map(([row, place, material]) => {
    const open = () => openRow(rows.indexOf(row), true);
    const card = hasCard(row);
    return h("div", { class: `podium-step place${place}${row.kind === "player" && !calm.matches ? " waiting" : ""}` },
      h("span", { class: "podium-plate" },
        h("span", { class: "podium-name" }, row.kind === "player" ? [nameTag(row.name), flag(row.country)] : row.kind === "map" ? painted(row.name, row.badge) : row.name),
        h("span", { class: "podium-value" }, valueOf(row))),
      h("button", {
        class: `podium-visual${card ? " zoom" : ""}`, type: "button",
        "aria-label": card ? `See ${row.name}'s card` : `Number ${row.rank}: ${row.name}`,
        onclick: card ? () => showCard(row.name) : open,
      }, podiumVisual(row, place)),
      h("button", { class: "podium-label", type: "button", "aria-label": `Number ${row.rank}: ${row.name}`, onclick: open },
        h("span", { class: `podium-block m${material}` }, h("span", { class: "podium-rank" }, String(row.rank)))));
  }));
  // the numbers fill up as each player lands
  if (state.board === "players" && !calm.matches) podium.querySelectorAll(".podium-value").forEach(countUp);
  // the 3D starts once the page has been shown, so the table and the blocks appear at once
  const views = [...podium.querySelectorAll(".pose")].map((box) => box.view);
  if (views.length) requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => stagePlayers(podium, views, run))));
}

// the cards are drawn to be read at full size, so a click shows them that big
function hasCard(row) {
  return row.kind === "player" && boardCards.includes(row.name.toLowerCase());
}

const viewer = h("dialog", { class: "card-view", "aria-label": "Card", onclick: (event) => { if (event.target === viewer) viewer.close(); } });
document.body.append(viewer);

function showCard(name) {
  viewer.replaceChildren(
    h("img", { src: asset(`assets/card/${name.toLowerCase()}.webp`), width: 500, height: 700, alt: `${name}'s card` }),
    h("button", { class: "button", type: "button", onclick: () => viewer.close() }, "Close"));
  viewer.showModal();
}

// table on wide screens, list on phones; the detail opens under the clicked row

function sortArrow() {
  return icon("arrow", `sort-arrow${state.reverse ? " up" : ""}`);
}

// narrow tables drop the wide and minor columns, but never the one being sorted by
function columnClass(column) {
  const active = state.by === column.by || state.by === column.alt;
  return `${column.wide ? "c-wide" : "c-num"}${column.minor ? " c-minor" : ""}${active ? " on" : ""}`;
}

// a click sorts by the column, a second click on the same column reverses it
function columnHead(column) {
  if (!column.by) return h("th", { scope: "col", class: column.lead ? "c-lead" : column.wide ? "c-wide" : "c-num" }, column.label);
  const active = state.by === column.by || state.by === column.alt;
  const alt = active && state.by === column.alt;
  const label = alt ? SORT_NAMES[column.alt] : column.label;
  const note = alt ? column.altNote : column.note;
  const button = h("button", { type: "button", class: active ? "sorted" : null, onclick: () => go(active ? { reverse: !state.reverse, pick: null } : { by: column.by, pick: null }) },
    label, active ? sortArrow() : null);
  if (note) tip(button, () => `<b>${esc(label)}</b><p>${esc(note)}</p>${active ? `<p>${esc(`Click again for ${ORDER[state.by][state.reverse ? 0 : 1].toLowerCase()}.`)}</p>` : ""}`);
  const rising = RISING.includes(state.by) !== state.reverse;
  return h("th", { scope: "col", class: columnClass(column), "aria-sort": active ? (rising ? "ascending" : "descending") : "none" }, button);
}

let filling = null;
// runs work in the gaps between frames, so the podium keeps moving smoothly meanwhile
const later = window.requestIdleCallback
  ? (fn) => requestIdleCallback(fn, { timeout: 1000 })
  : (fn) => setTimeout(() => fn({ timeRemaining: () => 8 }));

// the rows seen first are built at once, the rest a few at a time in the gaps between frames
function fillRows(target, makeGroup, makeLine) {
  let last = null;
  let i = 0;
  const add = (count) => {
    const batch = document.createDocumentFragment();
    for (const end = Math.min(i + count, rows.length); i < end; i++) {
      const group = groupOf(rows[i]);
      if (group && (!last || group[1] !== last[1])) {
        batch.append(makeGroup(group));
        last = group;
      }
      batch.append(makeLine(rows[i], i));
    }
    target.append(batch);
  };
  add(40);
  const job = {
    // everything at once, for when a row further down is needed now
    finish() {
      if (filling !== job) return;
      add(Infinity);
      filling = null;
      markCut();
    },
  };
  const next = (gap) => {
    if (filling !== job) return;
    do add(5);
    while (i < rows.length && gap.timeRemaining() > 4);
    if (i < rows.length) return later(next);
    filling = null;
    markCut();
  };
  filling = i < rows.length ? job : null;
  if (filling) later(next);
}

function renderTable(body) {
  const columns = BOARDS[state.board].columns;
  const tbody = h("tbody");
  body.append(h("table", { class: `lb-table board-${state.board}` },
    h("thead", {}, h("tr", {}, h("th", { scope: "col", class: "c-rank" }, state.board === "badges" ? "" : "#"), columns.map(columnHead))),
    tbody));
  fillRows(tbody,
    (group) => h("tr", { class: "group-row" }, h("td", { colspan: columns.length + 1 },
      group[0] === "tier" ? [socket(group[1]), tierText(group[1])] : group[1])),
    (row, i) => h("tr", { class: `rank-line${row.rank && row.rank <= 3 && row.kind !== "badge" && !state.reverse ? " top" : ""}`, "data-i": i, onclick: () => openRow(i) },
      h("td", { class: "c-rank" }, rankCell(row)),
      columns.map((column) => column.lead
        ? h("td", { class: "c-lead" }, h("button", { type: "button", class: "row-open", "aria-expanded": "false", onclick: (event) => { event.stopPropagation(); openRow(i); } }, lead(row)))
        : h("td", { class: columnClass(column) }, cell(row, column)))));
}

function renderList(body) {
  const list = h("ol", { class: "lb-list" });
  body.append(list);
  fillRows(list,
    (group) => h("li", { class: "group-row" }, group[0] === "tier" ? [socket(group[1]), tierText(group[1])] : group[1]),
    (row, i) => h("li", { class: "rank-line", "data-i": i },
      h("button", { type: "button", class: "row-open", "aria-expanded": "false", onclick: () => openRow(i) },
        rankCell(row),
        h("span", { class: "lead" }, lead(row)),
        h("span", { class: "line-value" }, valueOf(row)))));
}

function renderEmpty(body) {
  const sky = state.by === "sky" && state.mode === "Segmented";
  body.append(h("div", { class: "rank-empty" },
    h("p", {}, sky ? "Segmented runs are entered with 0 fails, so there is no sky fails board for them." : "Nobody matches this board with these filters."),
    h("button", { class: "button", type: "button", onclick: () => go({ mode: "All", country: "", pick: null }) }, "Show every gamemode")));
}

function renderTitle() {
  const board = BOARDS[state.board];
  const ranked = rows.filter((r) => r.rank).length;
  const missing = build(state.board, state.by, state.mode, state.country).missing;
  const where = [state.mode === "All" ? null : state.mode, state.country ? COUNTRIES[state.country] : null].filter(Boolean).join(", ");
  const names = state.board === "players" ? playerBoard.map(([n]) => n) : rows.map((row) => row.name);
  const keys = sortKeys(state.board);
  const input = h("input", {
    type: "search", list: "find-list", placeholder: board.find, "aria-label": board.find,
    onkeydown: (event) => { if (event.key === "Enter") { event.preventDefault(); find(event.currentTarget.value); } },
    onchange: (event) => find(event.currentTarget.value),
  });
  // the title reads as a sentence: Players by EXP, highest first
  const by = keys.length > 1
    ? h("span", { class: "button select-face" },
      h("select", { "aria-label": "Rank by", onchange: (event) => go({ by: event.currentTarget.value, pick: null }) },
        keys.map((key) => h("option", { value: key, selected: key === state.by }, SORT_NAMES[key]))),
      icon("arrow", "chev"))
    : h("span", {}, SORT_NAMES[state.by]);
  document.getElementById("list-title").replaceChildren(
    h("span", { class: "rank-by" }, `${board.label} by`, by,
      h("button", { class: "button order", type: "button", "aria-label": `${ORDER[state.by][state.reverse ? 1 : 0]}, click to reverse`, onclick: () => go({ reverse: !state.reverse, pick: null }) },
        sortArrow(), ORDER[state.by][state.reverse ? 1 : 0])),
    h("small", {}, `${ranked} ranked${where ? `, ${where}` : ""}${state.board === "players" && missing ? `, ${missing} not on it yet` : ""}`),
    h("label", { class: "find" }, h("span", { class: "field" }, icon("search"), input), h("datalist", { id: "find-list" }, names.map((name) => h("option", { value: name })))));
}

function renderBody() {
  const body = document.getElementById("body");
  body.replaceChildren();
  filling = null;
  openIndex = -1;
  renderTitle();
  if (!rows.some((r) => r.rank) && state.board !== "badges") renderEmpty(body);
  else if (narrow.matches) renderList(body);
  else renderTable(body);
  markCut();
}

function markCut() {
  requestAnimationFrame(() => {
    const cut = [...document.querySelectorAll("#body .pill-map, #podium .pill-map, #body .pill.ghost .tok, #body .row-open > :nth-child(2), #body .lead > :nth-child(2)")];
    // every width is read before any class changes, so the page is laid out only once
    const over = cut.map((el) => el.scrollWidth > el.clientWidth + 1);
    cut.forEach((el, i) => el.classList.toggle("overflow", over[i]));
  });
}

// details

function statRow(label, value, rank, jump) {
  return h("tr", {},
    h("th", { scope: "row" }, label),
    h("td", {}, value),
    h("td", { class: "pos" }, rank ? h("button", { type: "button", onclick: jump }, `#${rank[0]}`, rank[1] ? h("small", {}, ` ${rank[1]}`) : null) : null));
}

function detailFrame(visual, title, sub, table, extra, action) {
  return h("div", { class: "inline-detail" },
    h("div", { class: "detail-visual" }, visual),
    h("div", { class: "detail-info" },
      h("div", { class: "detail-top" },
        h("div", {}, h("p", { class: "detail-name" }, title), sub ? h("p", { class: "dim" }, sub) : null),
        h("div", { class: "detail-actions" }, action,
          h("button", { class: "button close", type: "button", "aria-label": "Close", onclick: () => closeRow() }, icon("close")))),
      table ? h("table", { class: "detail-stats" }, h("tbody", {}, table)) : null,
      extra));
}

function playerDetail(row) {
  const mode = state.mode;
  const card = cardMode(row.name);
  const diffMode = mode === "All" ? card : mode;
  const winMode = mode === "All" && row.victory ? mapMode[row.victory[2]] : mode;
  const r = (by, m = mode) => {
    const rank = m ? rankIn("players", by, m, row.name) : null;
    if (!rank) return null;
    if (by === "difficulty") return [rank, `in ${m}${m === card ? ", the TOP on the card" : ""}`];
    return [rank, m === "All" ? "" : `in ${m}`];
  };
  const jump = (by, m = mode) => () => go({ board: "players", by, mode: m, country: "", pick: row.name });
  const visual = hasCard(row)
    ? h("button", { class: "zoom", type: "button", "aria-label": `See ${row.name}'s card`, onclick: () => showCard(row.name) },
      h("img", { class: "detail-card", src: asset(`assets/card/${row.name.toLowerCase()}.webp`), width: 500, height: 700, alt: "" }))
    : (() => { const c = head(row.name); c.classList.add("big"); return c; })();
  return detailFrame(visual, [nameTag(row.name, "strong"), flag(row.country)], COUNTRIES[row.country] || null, [
    statRow("EXP", String(row.exp), r("exp"), jump("exp")),
    statRow("Hardest badge", row.best ? badgeLink(row.best[1], bestLabels[row.best[2]]) : "-", r("difficulty", diffMode), jump("difficulty", diffMode)),
    statRow("Hardest victory", row.victory ? badgeLink(row.victory[1], `${row.victory[2]} | VICTOR`) : "none yet", r("victory", winMode), jump("victory", winMode)),
    statRow("Tiers acquired", row.tiers ? [socket(row.bestTier), ` ${row.tiers}, best ${ROMAN[row.bestTier]}`] : "none yet", r("tiers"), jump("tiers")),
    statRow("Victories", String(row.victories), r("victories"), jump("victories")),
    statRow("Badges", String(row.badges), r("badges"), jump("badges")),
    statRow("Sky fails", String(row.sky), r("sky"), jump("sky")),
  ], null, PAGES[row.name] ? h("a", { class: "button", href: PAGES[row.name] }, "Profile") : null);
}

function countryDetail(row) {
  const r = (by) => { const rank = rankIn("countries", by, state.mode, row.code); return rank ? [rank, null] : null; };
  const jump = (by) => () => go({ board: "countries", by, pick: row.code });
  const by = { victories: "victories", players: "exp", maps: "victories", badges: "badges", sky: "sky", difficulty: "difficulty" }[state.by];
  const top = build("players", by, state.mode, row.code).rows.slice(0, 5);
  return detailFrame(flag(row.code, "flag podium-flag"), h("strong", {}, row.name), null, [
    statRow("Hardest badge", row.best ? [badgeLink(row.best[1], bestLabels[row.best[2]]), h("span", { class: "dim" }, " by "), nameTag(row.best[3])] : "-", r("difficulty"), jump("difficulty")),
    statRow("Players", String(row.players), r("players"), jump("players")),
    statRow("Victories", String(row.victories), r("victories"), jump("victories")),
    statRow("Unique maps", String(row.maps), r("maps"), jump("maps")),
    statRow("Badges", String(row.badges), r("badges"), jump("badges")),
    statRow("Sky fails", String(row.sky), r("sky"), jump("sky")),
  ], top.length ? h("div", { class: "detail-more" },
    h("p", { class: "dim" }, `Best of ${row.name} by ${SORT_NAMES[by]}`),
    h("ol", { class: "mini-ranks" }, top.map((p) => h("li", {}, h("span", { class: "dim" }, `${p.rank}.`), head(p.name), nameTag(p.name), h("span", { class: "dim mini-value" }, valueOf(p, by)))))) : null,
  h("button", { class: "button", type: "button", onclick: () => go({ board: "players", by, country: row.code, pick: null }) }, "Players"));
}

function mapDetail(row) {
  const r = (by) => { const rank = rankIn("maps", by, state.mode, row.name, state.country); return rank ? [rank, null] : null; };
  const jump = (by) => () => go({ board: "maps", by, pick: row.name });
  const tier = tierOf(row.value);
  const from = state.country ? COUNTRIES[state.country] : "";
  return detailFrame(row.shot ? tile("span", {}, `assets/tile/map_${row.shot}.jpg`, tier) : null,
    painted(row.name, row.badge, "strong"), `${row.mode}${row.builder ? `, built by ${row.builder}` : ""}${from ? `. Players from ${from} only` : ""}`, [
      statRow("Tier", tier ? [socket(tier), ` ${tierText(tier)}`] : "none", null),
      statRow("Victory", row.value != null ? `${expOf(row.value)} EXP` : "no EXP", r("exp"), jump("exp")),
      statRow("Victors", String(row.victors), r("victors"), jump("victors")),
      statRow("On it", String(row.onMap), r("players"), jump("players")),
      statRow(row.failsLabel ? `Avg ${row.failsLabel} fails` : "Avg fails", row.avg != null ? String(row.avg) : "-", r("avg"), jump("avg")),
      statRow(row.failsLabel ? `Total ${row.failsLabel} fails` : "Total fails", row.fails != null ? String(row.fails) : "-", r("total"), jump("total")),
      statRow("First victor", row.first ? [nameTag(row.first[1]), h("span", { class: "dim" }, ` ${date(row.first[0])}`)] : from ? `nobody from ${from} yet` : "still unbeaten", null),
      row.last && row.victors > 1 ? statRow("Latest victor", [nameTag(row.last[1]), h("span", { class: "dim" }, ` ${date(row.last[0])}`)], null) : null,
    ].filter(Boolean), row.badge != null ? h("p", { class: "lead" }, badgeLink(row.badge)) : null,
    PAGES[row.name] ? h("a", { class: "button", href: PAGES[row.name] }, "Map page") : null);
}

function badgeDetail(row) {
  const badge = badgeRow(row.badge);
  const page = badgePages.includes(badgeKey(badge.name));
  const tier = tierOf(row.value);
  return detailFrame(socket(tier), h("strong", { class: `name${badge.end ? " blend" : ""}`, style: nameColours(badge.color, badge.end, badge.third) }, badge.name), `${row.mode}, ${band(row)}`, [
    statRow("Tier", tier ? tierText(tier) : "none", null),
    statRow("Holders", row.holders ? `${row.holders} of ${boardPlayers} players` : "nobody yet", null),
  ], h("div", { class: "rarity" },
    h("strong", {}, row.holders ? `${share(row.holders)}%` : "0%"),
    h("span", { class: "meter", style: roleColours(badge) }, h("i", { style: `width:${row.holders ? Math.max(1, (row.holders / boardPlayers) * 100) : 0}%` }))),
  page ? h("a", { class: "button", href: badgeHref(badge.name) }, "Badge page") : null);
}

function detailOf(row) {
  return { player: playerDetail, country: countryDetail, map: mapDetail, badge: badgeDetail }[row.kind](row);
}

function closeRow() {
  document.querySelectorAll("#body .detail-row, #body .find-miss").forEach((el) => el.remove());
  document.querySelectorAll("#body .rank-line.open").forEach((el) => el.classList.remove("open"));
  document.querySelectorAll("#body .row-open[aria-expanded='true']").forEach((el) => el.setAttribute("aria-expanded", "false"));
  openIndex = -1;
  state.pick = null;
  save(false);
}

function openRow(i, scroll = false) {
  if (i === openIndex && !scroll) return closeRow();
  filling?.finish();
  closeRow();
  const row = rows[i];
  const line = document.querySelector(`#body .rank-line[data-i="${i}"]`);
  if (!row || !line) return;
  const detail = line.tagName === "TR"
    ? h("tr", { class: "detail-row" }, h("td", { colspan: BOARDS[state.board].columns.length + 1 }, detailOf(row)))
    : h("li", { class: "detail-row" }, detailOf(row));
  line.after(detail);
  line.classList.add("open");
  line.querySelector(".row-open")?.setAttribute("aria-expanded", "true");
  openIndex = i;
  if (scroll) line.scrollIntoView({ block: "start", behavior: calm.matches ? "auto" : "smooth" });
  else detail.scrollIntoView({ block: "nearest", behavior: calm.matches ? "auto" : "smooth" });
  if (!calm.matches) {
    line.classList.remove("flash");
    void line.offsetWidth;
    line.classList.add("flash");
  }
  document.getElementById("announce").textContent = `${row.name}${row.rank ? `, number ${row.rank}` : ""}`;
  state.pick = String(row.id);
  save(false);
  markCut();
}

function find(text) {
  const wanted = text.trim().toLowerCase();
  if (!wanted) return;
  const exact = rows.findIndex((row) => String(row.name).toLowerCase() === wanted);
  const near = exact >= 0 ? exact : rows.findIndex((row) => String(row.name).toLowerCase().startsWith(wanted));
  if (near >= 0) return openRow(near, true);
  closeRow();
  const body = document.getElementById("body");
  const entry = state.board === "players" ? playerBoard.find(([n]) => n.toLowerCase() === wanted) : null;
  const per = entry ? entry[2][state.mode] || entry[2].All : null;
  const message = entry
    ? `${entry[0]} is not on the ${SORT_NAMES[state.by]} board${state.mode === "All" ? "" : ` for ${state.mode}`}${state.country ? ` in ${COUNTRIES[state.country]}` : ""}${state.by === "exp" && !per[0] ? ": their maps have no EXP value yet" : ""}.`
    : `Nothing called "${text.trim()}" on this board.`;
  const box = h("div", { class: "find-miss" }, h("p", {}, message));
  if (entry) {
    box.append(playerDetail({ kind: "player", id: entry[0], name: entry[0], country: entry[1], exp: per[0], best: per[1], victories: per[2], badges: per[3], sky: per[4], tiers: per[5], bestTier: per[6], victory: per[7] }));
  }
  body.prepend(box);
  box.scrollIntoView({ block: "nearest" });
}

// controls on the world, outside the windows

function renderTabs() {
  const tabs = document.getElementById("tabs");
  const ids = Object.keys(BOARDS);
  tabs.replaceChildren(...ids.map((id) => h("button", {
    class: "button board-tab", type: "button", role: "tab", id: `tab-${id}`, "aria-controls": "panel",
    "aria-selected": String(id === state.board), tabindex: id === state.board ? "0" : "-1",
    onclick: () => go({ board: id, by: DEFAULT_BY[id], pick: null }),
    onkeydown: (event) => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
      if (!step) return;
      event.preventDefault();
      const next = ids[(ids.indexOf(state.board) + step + ids.length) % ids.length];
      go({ board: next, by: DEFAULT_BY[next], pick: null });
      document.getElementById(`tab-${next}`).focus();
    },
  }, BOARDS[id].label)));
  document.getElementById("panel").setAttribute("aria-labelledby", `tab-${state.board}`);
}

function guiSelect(label, options, value, onPick) {
  return h("label", { class: "gui-select" }, h("span", { class: "dim" }, label),
    h("span", { class: "button select-face" },
      h("select", { onchange: (event) => onPick(event.currentTarget.value) },
        options.map(([option, text]) => h("option", { value: option, selected: option === value }, text))),
      icon("arrow", "chev")));
}

function renderFilters() {
  const filters = document.getElementById("filters");
  const parts = [h("div", { class: "seg", role: "group", "aria-label": "Gamemode" },
    h("span", { class: "dim" }, "Gamemode"),
    MODE_LIST.map(([mode, text]) => h("button", { class: "button", type: "button", "aria-pressed": String(mode === state.mode), onclick: () => go({ mode, pick: null }) }, text))),
  h("span", { class: "mode-phone" }, guiSelect("Gamemode", MODE_LIST, state.mode, (mode) => go({ mode, pick: null })))];
  if (state.board === "players" || state.board === "maps") {
    const found = state.board === "players" ? playerBoard.map(([, c]) => c) : mapBoard.flatMap((m) => Object.keys(m[13]));
    const codes = [...new Set(found.filter(Boolean))].sort((a, b) => (COUNTRIES[a] || a).localeCompare(COUNTRIES[b] || b));
    parts.push(guiSelect("Country", [["", "All"], ...codes.map((c) => [c, COUNTRIES[c] || c.toUpperCase()])], state.country, (country) => go({ country, pick: null })));
  }
  filters.replaceChildren(...parts);
}

// history: board, sort and filter changes can be undone with Back, opening a row cannot

function save(push) {
  const q = new URLSearchParams();
  if (state.board !== "players") q.set("board", state.board);
  if (state.by !== DEFAULT_BY[state.board]) q.set("by", state.by);
  if (state.mode !== "All") q.set("mode", state.mode);
  if (state.country) q.set("country", state.country);
  if (state.reverse) q.set("order", "reverse");
  if (state.pick) q.set("pick", state.pick);
  const text = q.toString();
  const url = text ? `?${text}` : location.pathname;
  if (push) history.pushState(null, "", url);
  else history.replaceState(null, "", url);
}

function go(change) {
  // a new ranking starts in its normal order
  const fresh = ("by" in change && change.by !== state.by) || ("board" in change && change.board !== state.board);
  if (fresh && !("reverse" in change)) change.reverse = false;
  Object.assign(state, change);
  if (!sortKeys(state.board).includes(state.by)) state.by = DEFAULT_BY[state.board];
  if (state.board !== "players" && state.board !== "maps") state.country = "";
  const pick = state.pick;
  render(Boolean(change.pick));
  state.pick = pick;
  save(true);
}

function render(fromUrl) {
  rows = build(state.board, state.by, state.mode, state.country, state.reverse).rows;
  const pick = state.pick;
  renderTabs();
  renderFilters();
  renderPodium();
  renderBody();
  const keep = pick ? rows.findIndex((row) => String(row.id) === pick) : -1;
  if (keep >= 0) openRow(keep, Boolean(fromUrl));
}

addEventListener("popstate", () => {
  state = readUrl();
  render(true);
});

narrow.addEventListener("change", () => render());
addEventListener("resize", () => {
  markCut();
  if (stage) {
    stage.then((s) => {
      measure(s);
      paint(s);
    }, () => {});
  }
});

render(true);
