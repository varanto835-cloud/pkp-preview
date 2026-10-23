// The player named in the address (?p=iamher0brine), wlatr without one; on the real site every
// player has their own link. Their data loads first, then the page is drawn.
const PLAYER_DATA = ["wlatr", "iamher0brine"];
const askedPlayer = new URLSearchParams(location.search).get("p");
const playerSlug = PLAYER_DATA.includes(askedPlayer) ? askedPlayer : "wlatr";
const dataVersion = new URL(document.currentScript.src).search;
const SORTS = [["tier", "Tier"], ["map", "Map"], ["colour", "Colour"], ["rarity", "Rarity"], ["date", "Date"]];
const SHOWN = [["All", "All"], ["Rankup", "Rankup"], ["Segmented", "Segmented"], ["Onlysprint", "Onlysprint"], ["Miscellaneous", "Misc"]];
const RARITY = [[1, "1% or less"], [5, "Under 5%"], [15, "Under 15%"], [30, "Under 30%"], [Infinity, "30% or more"]];
const view = { sort: "tier", mode: "All", top: false };
const picked = new URLSearchParams(location.search).get("fav");
let best, bestMap, bestToken, favourite;

function stepLabel(label) {
  return stripFlags(label).replace(/\s*\([^)]*\)\s*$/, "");
}

function roleTip(role, lines, hint) {
  const colour = role && role.color ? headingColour(role.color, role.end, role.third) : "#fff";
  const title = role && role.name ? role.name : lines.shift();
  return `<b style="color:${colour}">${esc(title)}</b>${lines.map((line) => `<p>${esc(line)}</p>`).join("")}${hint ? `<p class="hint">${esc(hint)}</p>` : ""}`;
}

function share(holders) {
  return (holders / player.players) * 100;
}

function rarity(holders) {
  if (holders == null) return null;
  const pct = share(holders);
  return `Held by ${plural(holders, "player")} of ${player.players} (${pct < 1 ? pct.toFixed(1) : Math.round(pct)}%)`;
}

// The hero: the player in 3D from their own skin, standing on a small floating island of their
// hardest badge's tier material; everything else about them is beside it
function renderCard() {
  const stand = document.getElementById("card");
  stand.classList.add(`m${best.tier}`);
  const canvas = h("canvas", { class: "ps-model", role: "img", tabindex: "0", "aria-label": `${player.name} in 3D, on an island of Tier ${ROMAN[best.tier]} blocks; drag or use the arrow keys to turn and tilt` });
  stand.append(canvas);
  standModel(canvas, best.tier);
}

// a long name steps down the type scale until it holds on one line, rather than breaking in the
// middle; a short one keeps the page's size
const FITS = ["", "fit-72", "fit-54", "fit-45", "fit-36", "fit-27"];

function fitName() {
  const name = document.querySelector(".hero h1");
  for (const step of FITS) {
    name.classList.remove(...FITS.slice(1));
    if (step) name.classList.add(step);
    if (name.offsetHeight <= parseFloat(getComputedStyle(name).lineHeight) * 1.5) break;
  }
}

// the island's tip is level with the foot of Tiers acquired beside it; with the two stacked, on a
// phone, the player keeps a height of their own
function levelStand() {
  const stand = document.getElementById("card").getBoundingClientRect();
  const tiers = document.querySelector(".hero-side > .win").getBoundingClientRect();
  const beside = stand.right <= tiers.left;
  document.getElementById("card").style.setProperty("--floor", beside ? `${Math.round(tiers.bottom - stand.top)}px` : "");
}

// The player stands still on the island, turned a little toward the words beside them, lit from
// behind in their tier's colour; a drag, or the arrow keys, turns them and the island round, or
// tilts them up to 30 degrees either way, and they stay as left. It draws only when it changes.
// Without 3D their face stands in for them, on a slab.
async function standModel(canvas, tier) {
  let s;
  try {
    await loadViewer();
    s = makeViewer(canvas);
    const key = player.name.toLowerCase();
    s.loadSkin(await skinOf(key).then(picture), { model: skinSlim.includes(key) ? "slim" : "default" });
  } catch {
    const face = head(player.name);
    face.classList.add("ps-face");
    face.loading = "eager";
    canvas.replaceWith(face, h("span", { class: "ps-slab", "aria-hidden": "true" }));
    return;
  }
  const island = await islandOf(s, tier);
  const rim = getComputedStyle(document.documentElement).getPropertyValue(`--t${tier}`).trim();
  if (rim) {
    s.rim.color.set(rim);
    s.rim.intensity = 2.4;
  }
  const arms = s.playerObject.skin;
  arms.rightArm.rotation.z = 0.06;
  arms.leftArm.rotation.z = -0.06;
  let yaw = 0.45;
  let tilt = 0;
  const paint = () => {
    const box = canvas.getBoundingClientRect();
    const width = Math.round(box.width);
    const height = Math.round(box.height);
    if (!width || !height) return;
    if (width !== s.width || height !== s.height) {
      s.width = width;
      s.height = height;
      s.gl.setSize(width, height, false);
    }
    // the camera circles the figure's middle as it tilts, through a narrow lens, and one frame
    // holds the whole figure and island at any turn and tilt (worked out over all of them): from
    // a little over the head down to the island's tip
    const camera = s.camera;
    const half = 20.35;
    const up = [Math.cos(tilt), -Math.sin(tilt)];
    const aim = [-2.2 - 0.106 * up[0], -0.106 * up[1]];
    const far = half / Math.tan((12 * Math.PI) / 180);
    camera.fov = 24;
    camera.aspect = width / height;
    camera.position.set(0, aim[0] + far * Math.sin(tilt), aim[1] + far * Math.cos(tilt));
    camera.lookAt(0, aim[0], aim[1]);
    camera.updateProjectionMatrix();
    // level, that frame leaves the tip a hair over its bottom edge; the canvas hangs as much
    // lower, so the tip stays on the line of Tiers acquired
    canvas.style.bottom = `${-Math.round((0.355 * height) / (2 * half))}px`;
    s.playerObject.rotation.y = yaw;
    island.rotation.y = yaw;
    s.gl.render(s.scene, camera);
  };
  s.gl.compile(s.scene, s.camera);
  await shadersReady(s);
  // it comes in once, as one movement that slows to a stop, and then nothing moves on its own:
  // the player and the island rise the last bit into place, the whole picture at once so the
  // island's tip is never cut by the canvas edge, while the fragments break off the island
  if (!calm.matches) island.settle(0);
  paint();
  canvas.classList.add("shown");
  new ResizeObserver(paint).observe(canvas);
  if (!calm.matches) {
    let start = null;
    const enter = (now) => {
      if (start == null) {
        start = now;
        canvas.animate([{ translate: "0 24px" }, { translate: "0 0" }], { duration: 800, easing: "cubic-bezier(0.16, 1, 0.3, 1)" });
      }
      // close to the site's ease
      const u = Math.min(1, (now - start) / 800);
      island.settle(u < 1 ? 1 - 2 ** (-10 * u) : 1);
      paint();
      if (u < 1) requestAnimationFrame(enter);
    };
    requestAnimationFrame(enter);
  }

  // the tilt moves freely up to 20 degrees, then slows to a stop at 30; back toward level it
  // moves freely again
  const TILT = Math.PI / 6;
  const FREE = Math.PI / 9;
  const tiltBy = (step) => {
    const past = (Math.abs(tilt) - FREE) / (TILT - FREE);
    const give = past > 0 && Math.sign(step) === Math.sign(tilt) ? 1 - past * past : 1;
    tilt = Math.max(-TILT, Math.min(TILT, tilt + step * give));
  };

  let from = null;
  canvas.addEventListener("pointerdown", (event) => {
    from = [event.clientX, event.clientY];
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (from == null) return;
    // dragging down brings the top toward you, as if pulling the figure by its front
    yaw += (event.clientX - from[0]) * 0.012;
    tiltBy((event.clientY - from[1]) * 0.012);
    from = [event.clientX, event.clientY];
    paint();
  });
  const drop = () => {
    from = null;
  };
  canvas.addEventListener("pointerup", drop);
  canvas.addEventListener("pointercancel", drop);
  canvas.addEventListener("keydown", (event) => {
    const turn = { ArrowLeft: -0.26, ArrowRight: 0.26 }[event.key];
    const lean = { ArrowUp: -0.26, ArrowDown: 0.26 }[event.key];
    if (!turn && !lean) return;
    event.preventDefault();
    if (turn) yaw += turn;
    else tiltBy(lean);
    paint();
  });
}

function ladderSlot(mode, level) {
  const row = (player.ladders[mode] || []).find((entry) => entry.level === level);
  const held = player.modes[mode].tier || 0;
  if (!row) {
    return tip(h("span", { class: "slot none" }), () => roleTip(null, [`Tier ${ROMAN[level]}`, `No ${mode} badges in this tier yet.`]));
  }
  let state = "empty";
  if (level <= held) state = "full held";
  else if (row.owned === row.total) state = "full";
  else if (row.owned > 0) state = "part";
  const ratio = row.owned / row.total;
  const slot = h("span", { class: `slot ${state}`, style: `--sword:url("${asset(`assets/tier/tier${level}.png`)}")` }, sword(level),
    state === "part" ? h("span", { class: "wear" }, h("i", { style: `--w:${Math.round(ratio * 100)}%;--r:${ratio.toFixed(2)}` })) : null);
  return tip(slot, () => {
    const lines = [`${mode}, ${row.owned} of ${plural(row.total, "badge")}`];
    if (level <= held) lines.push("Acquired");
    else if (row.owned === row.total) lines.push(`Complete, counts once Tier ${ROMAN[held + 1]} is acquired`);
    if (row.missing.length) {
      lines.push("Missing:");
      row.missing.slice(0, 5).forEach((label) => lines.push(`  ${stepLabel(label)}`));
      if (row.missing.length > 5) lines.push(`  and ${row.missing.length - 5} more`);
    }
    return `<b style="color:var(--t${level})">${tierText(level)}</b>${lines.map((line) => `<p>${esc(line)}</p>`).join("")}`;
  });
}

// favourite badge above the name
// with no badge yet the name stays plain white and there is no favourite to show
function paintName() {
  const name = document.querySelector(".hero h1");
  if (!favourite) return;
  name.style.cssText = nameColours(favourite.color, favourite.end, favourite.third);
  name.classList.toggle("blend", Boolean(favourite.end));
  name.classList.toggle("holo", Boolean(favourite.third));
  document.getElementById("favourite").replaceChildren(
    tip(pill("a", { class: "pill", href: badgeHref(favourite.name) }, favourite, favourite.name), () => badgeTip(favourite)),
    h("span", { class: "dim" }, "Favourite badge"));
}

function renderSide() {
  const side = document.getElementById("side");
  const numerals = h("div", { class: "ladder numerals dim", "aria-hidden": "true" }, h("span"),
    Array.from({ length: 10 }, (_, i) => h("span", {}, ROMAN[i + 1])));
  const ladders = ["Rankup", "Segmented", "Onlysprint"].map((mode) => {
    const info = player.modes[mode];
    return h("div", { class: "ladder" },
      h("span", { class: "mode" }, mode, h("small", { class: "dim" }, info.top ? `TOP ${info.top} of ${info.ranked}` : "Unranked")),
      Array.from({ length: 10 }, (_, i) => ladderSlot(mode, i + 1)));
  });
  const acquired = Object.entries(player.modes).filter(([, m]) => m.tier).sort((a, b) => b[1].tier - a[1].tier)[0];
  const bestPill = tip(pill("a", { class: "pill", href: badgeHref(best.label) }, best.role, bestMap, bestToken),
    () => roleTip(best.role, [`${best.gamemode}, ${tierText(best.tier)}`, `${bestToken === "VICTOR" ? "Beaten" : "Reached"} ${when(best.date)}`]));

  side.append(
    h("p", { class: "favourite", id: "favourite" }),
    h("h1", { "data-text": player.name }, player.name),
    h("ul", { class: "facts" },
      h("li", {}, flag(player.country), COUNTRIES[player.country]),
      h("li", {}, h("strong", {}, `TOP ${player.modes[best.gamemode].top}`), ` in ${best.gamemode}`),
      h("li", {}, `${player.exp} EXP`),
      h("li", {}, plural(player.victories.length, "victory", "victories")),
      h("li", {}, plural(badges.length, "badge")),
      h("li", {}, `${player.progress.length} in progress`)),
    h("p", { class: "lead" }, h("span", { class: "dim" }, "Hardest badge"), bestPill,
      h("span", { class: "dim" }, `${tierText(best.tier)}, ${date(best.date)}`)),
    h("section", { class: acquired ? `win material m${acquired[1].tier}` : "win", "aria-labelledby": "tiers-title" },
      h("h2", { class: "win-title", id: "tiers-title" },
        tip(h("span", { class: "help" }, "Tiers acquired"), () => "<b>Tiers acquired</b><p>A tier is acquired when every badge in it,</p><p>and in every tier below it, is held.</p><p>Hover a sword to see what is missing.</p>"),
        h("small", {}, acquired ? `Best: Tier ${ROMAN[acquired[1].tier]} ${TIER_NAMES[acquired[1].tier]}, ${acquired[0]}` : "None acquired yet")),
      h("div", { class: "well" }, numerals, ladders)),
  );
  paintName();
}

function renderProgress() {
  const rail = document.getElementById("progress");
  // a short rail keeps its tiles the usual size, from the left, instead of stretching them
  rail.style.setProperty("--n", Math.max(player.progress.length, 6));
  document.getElementById("progress-title").append(h("small", {}, `${player.progress.length} maps, hardest first`));
  for (const step of player.progress) {
    const href = PAGES[step.map] ? `${PAGES[step.map]}#step-${step.id}` : null;
    // a step with no screenshot of its own shows its map's
    const art = step.card === false && step.world ? `assets/tile/map_${step.world}.jpg` : `assets/tile/tile_${step.id}.jpg`;
    const card = tile(href ? "a" : "div", { href }, art, step.tier, "flag");
    tip(card, () => roleTip(null, [
      `${step.map} | ${stripFlags(step.code)}`,
      `${step.gamemode}, ${tierText(step.tier)}`,
      step.value == null ? "No EXP" : `${expOf(step.value)} EXP`,
      `Step ${step.step} of ${step.steps}${step.note ? `, ${step.note}` : ""}`,
      step.date ? `Reached ${when(step.date)}` : "Date not recorded",
      step.date && !exact(step.date) ? "* exact day not recorded, reached by then" : null,
      step.role ? `Latest badge: ${step.role.name}` : "No badge on this map yet",
      rarity(step.holders),
    ].filter(Boolean), href ? "Click to open this step on the map" : null));

    const token = step.role ? step.role.name.split(" | ")[1] : null;
    rail.append(h("li", {}, card,
      h("div", { class: "meta" },
        h("strong", { class: "meta-map" }, step.map),
        h("span", { class: "dim" }, withFlags(step.title && !/^[\u{1F1E6}-\u{1F1FF}]{2}$/u.test(step.title) ? `${step.code} ${step.title}` : step.code)),
        token ? pill("a", { class: "pill", href: badgeHref(step.role.name) }, step.role, token) : h("span", { class: "pill ghost" }, dot(null), h("span", {}, "no badge")),
        h("span", { class: "dim date" }, dayOf(step.date)))));
  }
}

// badges

function badgeTip(b) {
  return roleTip(b, [
    `${b.gamemode}, ${tierText(b.tier)}`,
    b.date ? `Got ${when(b.date, b.by)}` : "Date not recorded",
    b.date && !exact(b.date, b.by) ? "* exact day not recorded, held by then" : null,
    rarity(b.holders),
    b.first ? "First player to beat it" : null,
    b === favourite ? "Favourite badge" : null,
  ].filter(Boolean), "Click to open the badge page");
}

function badgePill(b, label) {
  const el = pill("a", { class: b === favourite ? "pill picked" : "pill", href: badgeHref(b.name) }, b, label);
  if (b.first) el.append(icon("crown", "first"));
  return tip(el, () => badgeTip(b));
}

function highestOnly(list) {
  const top = new Map();
  for (const b of list) {
    if (!top.has(b.map) || b.order > top.get(b.map).order) top.set(b.map, b);
  }
  return list.filter((b) => top.get(b.map) === b);
}

function hue(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d < 0.12) return 400 - max * 40;
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return h * 60;
}

function grouped(list) {
  const groups = new Map();
  for (const [key, b] of list) {
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(b);
  }
  return groups;
}

function badgeRows(list) {
  const rows = [];
  if (view.sort === "tier") {
    const groups = grouped(list.map((b) => [b.tier || 0, b]));
    for (let tier = 10; tier >= 0; tier--) {
      const items = groups.get(tier);
      if (!items) continue;
      const tag = tier
        ? tip(h("span", { class: "tier-tag" }, h("span", { class: "slot full" }, sword(tier)), ROMAN[tier]), () => `<b style="color:var(--t${tier})">${tierText(tier)}</b><p>${plural(items.length, "badge")} in this tier</p>`)
        : h("span", { class: "tier-tag" }, h("span", { class: "slot none" }), "-");
      rows.push([tag, items.sort((a, b) => (b.value || 0) - (a.value || 0)).map((b) => badgePill(b, b.name))]);
    }
  } else if (view.sort === "map") {
    const groups = grouped(list.map((b) => [b.map, b]));
    const top = (items) => Math.max(...items.map((b) => b.value || 0));
    for (const [map, items] of [...groups].sort((a, b) => top(b[1]) - top(a[1]))) {
      rows.push([h("span", { class: "row-label" }, h("strong", {}, map), h("span", { class: "dim" }, items[0].gamemode)),
        items.sort((a, b) => a.order - b.order).map((b) => badgePill(b, b.token))]);
    }
  } else if (view.sort === "colour") {
    rows.push([null, [...list].sort((a, b) => hue(a.color) - hue(b.color)).map((b) => badgePill(b, b.name))]);
  } else if (view.sort === "rarity") {
    const band = (b) => RARITY.find(([limit]) => share(b.holders) <= limit);
    const groups = grouped(list.map((b) => [band(b)[1], b]));
    for (const [, label] of RARITY) {
      const items = groups.get(label);
      if (items) rows.push([h("span", { class: "row-label" }, label), items.sort((a, b) => a.holders - b.holders).map((b) => badgePill(b, b.name))]);
    }
  } else {
    const groups = grouped(list.map((b) => [b.date ? b.date.slice(0, 4) : "No date", b]));
    for (const [year, items] of [...groups].sort((a, b) => b[0].localeCompare(a[0]))) {
      rows.push([h("span", { class: "row-label" }, year), items.sort((a, b) => (b.date || "").localeCompare(a.date || "")).map((b) => badgePill(b, b.name))]);
    }
  }
  const loose = unbadged.filter((u) => view.mode === "All" || u.gamemode === view.mode);
  if (loose.length) {
    rows.push([h("span", { class: "row-label dim" }, "No badge yet"), loose.map((u) => tip(
      pill("span", { class: "pill ghost" }, null, u.map, "VICTOR"),
      () => roleTip(null, [`${u.map} | VICTOR`, `${u.gamemode}, beaten ${date(u.date)}`, "No badge placed on this map yet"])))]);
  }
  return rows;
}

function renderBadges() {
  const body = document.getElementById("badges");
  const shown = badges.filter((b) => view.mode === "All" || b.gamemode === view.mode);
  const list = view.top ? highestOnly(shown) : shown;
  body.className = `well collection by-${view.sort}`;
  body.replaceChildren(...badgeRows(list).map(([label, pills]) =>
    h("div", { class: label ? "tier-row" : "tier-row bare" }, label, h("div", { class: "pills" }, pills))));
  // with one badge a map the count says so, so it never seems to disagree with the facts above
  document.getElementById("badges-count").textContent = view.top && list.length < shown.length
    ? `${list.length} of ${plural(shown.length, "badge")}, the highest on each map`
    : `${plural(list.length, "badge")} on ${plural(new Set(list.map((b) => b.map)).size, "map")}`;
}

function renderCollection() {
  const bar = document.getElementById("badges-bar");
  const group = (label, options, key) => h("div", { class: "seg", role: "group", "aria-label": label },
    h("span", {}, label),
    options.map(([option, text]) => h("button", {
      class: "button", type: "button", "aria-pressed": String(view[key] === option),
      onclick: (event) => {
        view[key] = option;
        event.currentTarget.parentElement.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === event.currentTarget)));
        renderBadges();
      },
    }, text)));
  // phones start with one badge per map, the box still shows everything
  const phone = matchMedia("(max-width: 760px)").matches;
  view.top = phone;
  const only = h("input", { type: "checkbox", checked: phone, onchange: (event) => {
    view.top = event.currentTarget.checked;
    renderBadges();
  } });
  bar.append(group("Sort by", SORTS, "sort"), group("Show", SHOWN, "mode"),
    h("label", { class: "check" }, only, h("span", { class: "box", "aria-hidden": "true" }, icon("check")), "Only highest per map"));
  renderBadges();
}

function draw() {
  best = player.best;
  [bestMap, bestToken] = best.label.split(" | ");
  favourite = badges.find((b) => badgeKey(b.name) === picked) || badges.find((b) => b.name === best.label) || badges[0] || null;
  document.title = `${player.name} - Parkour Progress`;
  themeColour(best.tier);
  if (best.art) document.getElementById("world").style.setProperty("--world", `url("${asset(`assets/world/${best.art}.jpg`)}")`);
  renderCard();
  renderSide();
  fitName();
  levelStand();
  document.fonts?.ready.then(() => {
    fitName();
    levelStand();
  });
  addEventListener("resize", fitName);
  new ResizeObserver(levelStand).observe(document.getElementById("side"));
  renderProgress();
  renderCollection();
}

// the player's file, then their badges, then the page
const load = (file, then) => document.head.append(h("script", { src: asset(`data/${file}.js`) + dataVersion, onload: then }));
load(playerSlug, () => load(`${playerSlug}-badges`, draw));
