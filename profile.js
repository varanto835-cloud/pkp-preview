const best = player.best;
const [bestMap, bestToken] = best.label.split(" | ");
const SORTS = [["tier", "Tier"], ["map", "Map"], ["colour", "Colour"], ["rarity", "Rarity"], ["date", "Date"]];
const SHOWN = [["All", "All"], ["Rankup", "Rankup"], ["Segmented", "Segmented"], ["Onlysprint", "Onlysprint"], ["Miscellaneous", "Misc"]];
const RARITY = [[1, "1% or less"], [5, "Under 5%"], [15, "Under 15%"], [30, "Under 30%"], [Infinity, "30% or more"]];
const view = { sort: "tier", mode: "All", top: false };
const picked = new URLSearchParams(location.search).get("fav");
const favourite = badges.find((b) => badgeKey(b.name) === picked) || badges.find((b) => b.name === best.label) || badges[0];

function stepLabel(label) {
  return stripFlags(label).replace(/\s*\([^)]*\)\s*$/, "");
}

function roleTip(role, lines, hint) {
  const colour = role && role.color ? role.color : "#fff";
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

function renderCard() {
  const card = document.getElementById("card");
  const top = player.modes[best.gamemode].top;
  const file = asset(`assets/card/${player.name.toLowerCase()}.webp`);
  card.append(
    h("img", { src: file, width: 500, height: 700, alt: `${player.name}'s card: ${best.label}, Tier ${ROMAN[best.tier]}, TOP ${top} in ${best.gamemode}` }),
    h("span", { class: "card-glint", "aria-hidden": "true" }));
  tip(card, () => roleTip(null, [`${player.name}'s card`, best.label, `Tier ${ROMAN[best.tier]}, TOP ${top} in ${best.gamemode}`],
    "The card of the hardest badge, from Goldy's generator"));
  holdCard(card);
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
function paintName() {
  const name = document.querySelector(".hero h1");
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
    () => roleTip(best.role, [`${best.gamemode}, ${tierText(best.tier)}`, `Beaten ${date(best.date)}`]));

  side.append(
    h("p", { class: "favourite", id: "favourite" }),
    h("h1", {}, player.name),
    h("ul", { class: "facts" },
      h("li", {}, flag(player.country), COUNTRIES[player.country]),
      h("li", {}, h("strong", {}, `TOP ${player.modes[best.gamemode].top}`), ` in ${best.gamemode}`),
      h("li", {}, `${player.exp.toLocaleString("en-US")} EXP`),
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
  rail.style.setProperty("--n", player.progress.length);
  document.getElementById("progress-title").append(h("small", {}, `${player.progress.length} maps, hardest first`));
  for (const step of player.progress) {
    const href = PAGES[step.map] ? `${PAGES[step.map]}#step-${step.id}` : null;
    const card = tile(href ? "a" : "div", { href }, `assets/tile/tile_${step.id}.jpg`, step.tier, "flag");
    tip(card, () => roleTip(null, [
      `${step.map} | ${stripFlags(step.code)}`,
      `${step.gamemode}, ${tierText(step.tier)}`,
      step.value == null ? "No EXP" : `${expOf(step.value)} EXP`,
      `Step ${step.step} of ${step.steps}${step.note ? `, ${step.note}` : ""}`,
      step.date ? `Reached ${date(step.date)}` : "Date not recorded",
      step.role ? `Latest badge: ${step.role.name}` : "No badge on this map yet",
      rarity(step.holders),
    ].filter(Boolean), href ? "Click to open this step on the map" : null));

    const token = step.role ? step.role.name.split(" | ")[1] : null;
    rail.append(h("li", {}, card,
      h("div", { class: "meta" },
        h("strong", { class: "meta-map" }, step.map),
        h("span", { class: "dim" }, withFlags(step.title && !/^[\u{1F1E6}-\u{1F1FF}]{2}$/u.test(step.title) ? `${step.code} ${step.title}` : step.code)),
        token ? pill("a", { class: "pill", href: badgeHref(step.role.name) }, step.role, token) : h("span", { class: "pill ghost" }, dot(null), h("span", {}, "no badge")),
        h("span", { class: "dim date" }, date(step.date)))));
  }
}

// badges

function badgeTip(b) {
  return roleTip(b, [
    `${b.gamemode}, ${tierText(b.tier)}`,
    !b.date ? "Date not recorded"
      : b.by ? `Got on the way to the victory, by ${date(b.date)}`
        : b.date === HISTORY_START ? `Got on or before ${date(b.date)}` : `Got ${date(b.date)}`,
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
  let list = badges.filter((b) => view.mode === "All" || b.gamemode === view.mode);
  if (view.top) list = highestOnly(list);
  body.className = `well collection by-${view.sort}`;
  body.replaceChildren(...badgeRows(list).map(([label, pills]) =>
    h("div", { class: label ? "tier-row" : "tier-row bare" }, label, h("div", { class: "pills" }, pills))));
  document.getElementById("badges-count").textContent = `${plural(list.length, "badge")} on ${plural(new Set(list.map((b) => b.map)).size, "map")}`;
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

renderCard();
renderSide();
renderProgress();
renderCollection();
