const MODES = [["All", "All"], ["Rankup", "Rankup"], ["Segmented", "Segmented"], ["Onlysprint", "Onlysprint"], ["Miscellaneous", "Misc"]];
const SORTS = [
  ["list", "Server order"], ["hardest", "Hardest"], ["victors", "Most victors"], ["players", "Most on it"],
  ["avg", "Avg fails"], ["fails", "Total fails"], ["newest", "Newest"], ["beaten", "Last beaten"], ["first", "First beaten"], ["name", "Name"],
];
const SHOWS = [["all", "All"], ["beaten", "Beaten"], ["unbeaten", "Unbeaten"], ["extra", "Extra"], ["legacy", "Legacy"]];
// the server keeps three lists per gamemode: main progress, Extra (victory only), and Legacy (too easy for the others now)
const LISTS = ["main", "extra", "legacy"];
const VIEWS = [["tiles", "Tiles"], ["list", "List"]];
const TIERS = [["", "Any"], ...[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((t) => [String(t), `${ROMAN[t]} ${TIER_NAMES[t]}`]), ["0", "None yet"]];

// one object per map, from the rows the data script wrote
const maps = mapCatalog.map((r, i) => ({
  i, name: r[0], mode: r[1], list: LISTS[r[2]], extra: r[2] === 1, legacy: r[2] === 2, position: r[3], value: r[4], tier: tierOf(r[4]),
  victors: r[5], on: r[6], steps: r[7], first: r[8], last: r[9], avg: r[10], failsLabel: r[11],
  builder: r[12], released: r[13], verified: r[14], video: r[15], badge: r[16], shot: r[17], far: r[18], light: r[19], fails: r[20],
}));

let state = readUrl();
// the page opens on this world, so the first map hovered fades in over it instead of replacing it
worldNow = "realmofchampions";

function readUrl() {
  const q = new URLSearchParams(location.search);
  const pick = (list, key, fallback) => (list.some(([v]) => v === q.get(key)) ? q.get(key) : fallback);
  return {
    mode: pick(MODES, "mode", "All"),
    sort: pick(SORTS, "sort", "list"),
    show: pick(SHOWS, "show", "all"),
    view: pick(VIEWS, "view", "tiles"),
    tier: pick(TIERS, "tier", ""),
    find: q.get("find") || "",
  };
}

function badgeOf(id) {
  const row = id == null ? null : mapBadges[id];
  return row ? { name: row[0], color: row[1], end: row[2], third: row[3] } : null;
}

// the map name painted with its VICTOR badge, as names are everywhere on the site
function painted(map, tag = "span", attrs = {}) {
  const badge = badgeOf(map.badge);
  if (!badge) return h(tag, attrs, map.name);
  return h(tag, { ...attrs, class: `${attrs.class || ""} name${badge.end ? " blend" : ""}`.trim(), style: nameColours(badge.color, badge.end, badge.third) }, map.name);
}

// a step's "l/d" notes and SP or CP ranges stay in the tooltip
function shortStep(step) {
  return step.replace(/\s*\((?:[^)]*l\/d[^)]*|(?:SP|CP) ?\d[^)]*)\)/gi, "").trim() || step;
}

function day(pair) {
  return pair && pair[0] ? Number(pair[0].replaceAll("-", "")) : 0;
}

function visible(m) {
  if (state.mode !== "All" && m.mode !== state.mode) return false;
  if (state.show === "beaten" && !m.victors) return false;
  if (state.show === "unbeaten" && m.victors) return false;
  if (state.show === "extra" && !m.extra) return false;
  if (state.show === "legacy" && !m.legacy) return false;
  if (state.tier !== "" && String(m.tier || 0) !== state.tier) return false;
  const q = state.find.trim().toLowerCase();
  return !q || m.name.toLowerCase().includes(q) || (m.builder || "").toLowerCase().includes(q);
}

const byName = new Intl.Collator("en").compare;

function sorted(list) {
  const key = {
    list: (m) => [["Rankup", "Segmented", "Onlysprint", "Miscellaneous"].indexOf(m.mode), LISTS.indexOf(m.list), m.position],
    hardest: (m) => [m.value == null ? 1 : 0, -(m.value || 0)],
    victors: (m) => [-m.victors],
    players: (m) => [-m.on],
    newest: (m) => [m.released ? 0 : 1, -Number((m.released || "0").replaceAll("-", ""))],
    beaten: (m) => [m.last ? 0 : 1, -day(m.last)],
    first: (m) => [m.first && m.first[0] ? 0 : 1, day(m.first)],
    avg: (m) => [m.avg == null ? 1 : 0, -(m.avg || 0)],
    fails: (m) => [m.fails == null ? 1 : 0, -(m.fails || 0)],
    name: (m) => [0],
  }[state.sort];
  return [...list].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i];
    return byName(a.name, b.name);
  });
}

// facts

function victorsText(m) {
  return m.victors ? plural(m.victors, "victor") : "Unbeaten";
}

function mapTip(m) {
  const badge = badgeOf(m.badge);
  const lines = [`<b style="color:${badge ? headingColour(badge.color, badge.end, badge.third) : "#fff"}">${esc(m.name)}</b>`,
    `<p>${esc(m.mode)}${m.extra ? ", Extra" : m.legacy ? ", Legacy" : ""}, ${esc(m.tier ? tierText(m.tier) : "no tier yet")}</p>`];
  if (m.value != null) lines.push(`<p>${expOf(m.value)} EXP for the victory</p>`);
  else if (m.legacy) lines.push("<p>No EXP: legacy maps are off the rated lists</p>");
  const crown = '<svg class="icon first" aria-hidden="true"><use href="#i-crown"/></svg>';
  lines.push(m.victors
    ? `<p>${esc(victorsText(m))}</p><p>${crown} First ${esc(m.first[1])}${m.first[0] ? ` on ${esc(date(m.first[0]))}` : ""}${m.victors > 1 && m.last ? `, latest ${esc(m.last[1])}${m.last[0] ? ` on ${esc(date(m.last[0]))}` : ""}` : ""}</p>`
    : `<p>Still unbeaten${m.far ? `, furthest ${esc(m.far[0])} at ${esc(shortStep(stripFlags(m.far[1])))}` : ""}</p>`);
  lines.push(`<p>${m.steps ? `${plural(m.on, "player")} on it, ${plural(m.steps, "step")}` : m.legacy ? "Legacy: too easy for the main lists now, still kept up to date" : "No progress steps, victory only"}</p>`);
  if (m.avg != null) lines.push(`<p>${m.avg} ${esc(m.failsLabel)} fails on average, ${m.fails} in all</p>`);
  lines.push(`<p>Built by ${esc(m.builder)}</p>`);
  if (m.released) lines.push(`<p>Released ${esc(date(m.released))}${m.verified ? `, verified by ${esc(m.verified)}` : ""}</p>`);
  if (badge) lines.push(`<p>Badge</p><p class="tip-pill"><span class="pill"><span class="dot${badge.end ? " blend" : ""}" style="${roleColours(badge)}"></span><span>${esc(badge.name)}</span></span></p>`);
  lines.push(`<p class="hint">${PAGES[m.name] ? "Click to open the map page" : "Map page not part of this mockup"}</p>`);
  return lines.join("");
}

function art(m) {
  if (m.shot) return tile("span", {}, `assets/tile/map_${m.shot}.jpg`, m.tier);
  const frame = h("span", { class: `tile t${m.tier || 0} blank` }, h("span", { class: "dim" }, "No screenshot yet"));
  if (m.tier) frame.append(h("span", { class: "tile-tier" }, socket(m.tier)));
  return frame;
}

// what the current sort ordered by, shown first on the card as the sorted column is in the list
function sortedFact(m) {
  const value = {
    hardest: m.value != null ? `${expOf(m.value)} EXP` : "no EXP",
    newest: m.released ? `released ${date(m.released)}` : "no release day",
    beaten: m.last && m.last[0] ? `beaten ${date(m.last[0])}` : "unbeaten",
    first: m.first && m.first[0] ? `first beaten ${date(m.first[0])}` : "unbeaten",
    avg: m.avg != null ? `${m.avg} ${m.failsLabel} fails on average` : "no fails counted",
    fails: m.fails != null ? `${m.fails} ${m.failsLabel} fails` : "no fails counted",
  }[state.sort];
  return value ? h("span", { class: "on" }, value) : null;
}

function card(m) {
  const page = PAGES[m.name];
  const link = h(page ? "a" : "span", { class: "map-link", href: page || null }, art(m));
  const facts = [h("span", { class: m.victors ? (state.sort === "victors" ? "on" : "") : "unbeaten" }, victorsText(m))];
  if (m.steps) facts.push(h("span", { class: state.sort === "players" ? "on" : "dim" }, `${m.on} on it`));
  else facts.push(h("span", { class: "dim" }, m.legacy ? "Legacy" : m.extra ? "Extra" : "victory only"));
  const sorted = sortedFact(m);
  if (sorted) facts.unshift(sorted);
  const line = [m.value != null ? `${expOf(m.value)} EXP` : m.legacy ? "no EXP" : "no EXP yet", m.steps ? plural(m.steps, "step") : null].filter(Boolean).join(", ");
  return tip(h("li", { class: "map-card", onpointerenter: () => showWorld(m), onfocusin: () => showWorld(m) }, link,
    h("div", { class: "meta" },
      painted(m, page ? "a" : "strong", { class: "map-name", href: page || null }),
      h("span", { class: "map-facts" }, ...facts),
      line ? h("span", { class: "dim" }, line) : null,
      h("span", { class: "dim builder" }, `by ${m.builder}`))), () => mapTip(m));
}

// the world behind the page follows the map under the pointer, after a short rest on it
let worldTimer = 0;

function showWorld(m) {
  if (!m.shot || !matchMedia("(hover: hover)").matches) return;
  clearTimeout(worldTimer);
  worldTimer = setTimeout(() => setWorld(m.shot, m.light), 150);
}

// the open challenges: the maps nobody has beaten, with who stands furthest on each
function challenges(list) {
  const open = list.filter((m) => !m.victors);
  if (!open.length) return [];
  return [
    h("h2", { class: "list-head" }, h("span", {}, "Still unbeaten"), h("span", { class: "dim" }, plural(open.length, "open challenge"))),
    h("ol", { class: "map-grid challenges" }, open.map((m) => {
      const page = PAGES[m.name];
      const who = m.far ? h("span", { class: "who" }, head(m.far[0]), nameTag(m.far[0])) : h("span", { class: "dim" }, "nobody yet");
      return tip(h("li", { class: "map-card", onpointerenter: () => showWorld(m), onfocusin: () => showWorld(m) },
        h(page ? "a" : "span", { class: "map-link", href: page || null }, art(m)),
        h("div", { class: "meta" },
          painted(m, page ? "a" : "strong", { class: "map-name", href: page || null }),
          h("span", { class: "map-facts" }, h("span", { class: "unbeaten" }, "Furthest"), who),
          m.far ? h("span", { class: "dim" }, "at ", withFlags(shortStep(stripFlags(m.far[1])))) : null,
          h("span", { class: "dim" }, `${m.mode}, ${m.tier ? `Tier ${ROMAN[m.tier]}` : "no tier yet"}`),
          h("span", { class: "dim" }, `${m.on} on it`))), () => mapTip(m));
    })),
  ];
}

// the list view: the leaderboard table without ranks

// key, label, kind; the column widths are in the stylesheet, and the Map column takes what is left
const COLUMNS = [
  ["name", "Map", "lead"], ["hardest", "Tier", "num"], ["exp", "EXP", "num"], ["victors", "Victors", "num"],
  ["players", "On it", "num"], ["steps", "Steps", "num"], ["avg", "Avg fails", "num"], ["fails", "Fails", "num"], ["newest", "Released", "num"], ["builder", "Builder", "wide"],
];
const SORT_OF = { hardest: "hardest", exp: "hardest", victors: "victors", players: "players", avg: "avg", fails: "fails", newest: "newest", name: "name" };

function cell(m, key) {
  if (key === "hardest") return m.tier ? [socket(m.tier), ` ${ROMAN[m.tier]}`] : h("span", { class: "dim" }, "-");
  if (key === "exp") return m.value != null ? String(expOf(m.value)) : h("span", { class: "dim" }, "-");
  if (key === "victors") return m.victors ? String(m.victors) : h("span", { class: "unbeaten" }, "0");
  if (key === "players") return m.steps ? String(m.on) : h("span", { class: "dim" }, "-");
  if (key === "steps") return m.steps ? String(m.steps) : h("span", { class: "dim" }, "-");
  if (key === "avg") return m.avg != null ? String(m.avg) : h("span", { class: "dim" }, "-");
  if (key === "fails") return m.fails != null ? String(m.fails) : h("span", { class: "dim" }, "-");
  if (key === "newest") return m.released ? date(m.released) : h("span", { class: "dim" }, "-");
  if (key === "builder") return h("span", {}, m.builder);
  return null;
}

function table(list) {
  const head = COLUMNS.map(([key, label, kind]) => {
    const sort = SORT_OF[key];
    const active = sort && state.sort === sort;
    return h("th", { scope: "col", class: `c-${kind}`, "aria-sort": active ? "descending" : "none" },
      sort ? h("button", { type: "button", class: active ? "sorted" : null, onclick: () => go({ sort }) }, label) : label);
  });
  return h("table", { class: "lb-table map-table" },
    h("colgroup", {}, ...COLUMNS.map(([key]) => h("col", { class: `col-${key}` }))),
    h("thead", {}, h("tr", {}, ...head)),
    h("tbody", {}, list.map((m) => tip(h("tr", { class: "rank-line" },
      h("td", { class: "c-lead" }, h("span", { class: "map-cell" }, m.shot ? h("span", { class: "thumb", style: `--art: url("${asset(`assets/tile/thumb_${m.shot}.jpg`)}")` }) : h("span", { class: "thumb" }),
        painted(m, PAGES[m.name] ? "a" : "span", { class: "map-name", href: PAGES[m.name] || null }), m.extra ? h("span", { class: "dim" }, "Extra") : m.legacy ? h("span", { class: "dim" }, "Legacy") : null)),
      ...COLUMNS.slice(1).map(([key, , kind]) => h("td", { class: `c-${kind}` }, cell(m, key)))), () => mapTip(m)))));
}

// rendering

function groupHead(title, list, sub) {
  const open = list.filter((m) => !m.victors).length;
  const on = list.reduce((n, m) => n + m.on, 0);
  const facts = [plural(list.length, "map"), open ? `${open} unbeaten` : null, on ? `${on} on them` : null].filter(Boolean).join(", ");
  return h("h2", { class: "list-head" }, h("span", {}, title, sub ? h("span", { class: "dim" }, ` ${sub}`) : null), h("span", { class: "dim" }, facts));
}

function renderCatalog() {
  const catalog = document.getElementById("catalog");
  const shown = sorted(maps.filter(visible));
  const label = SORTS.find(([s]) => s === state.sort)[1].toLowerCase();
  document.getElementById("announce").textContent = `${plural(shown.length, "map")}, ${label}`;
  if (!shown.length) {
    catalog.replaceChildren(h("div", { class: "act-empty" },
      h("p", { class: "big" }, state.find.trim() ? `No map called "${state.find.trim()}" here.` : "No map matches these filters."),
      h("div", { class: "actions" }, h("button", { class: "button", type: "button", onclick: () => go({ mode: "All", show: "all", tier: "", find: "" }) }, "Clear the filters"))));
    return;
  }
  if (state.view === "list") {
    catalog.replaceChildren(h("div", { class: "win lb-window" }, h("div", { class: "well lb-body" }, table(shown))));
    // only a name or a builder list that does not fit gets the fade
    for (const span of catalog.querySelectorAll(".c-wide > span, .map-cell .map-name")) span.classList.toggle("cut", span.scrollWidth > span.clientWidth);
    return;
  }
  const blocks = [];
  if (state.sort === "list") {
    // the open challenges first, then the server's own list: a block per gamemode, the Extra maps after the main list
    if (state.show === "all" && state.tier === "" && !state.find.trim()) blocks.push(...challenges(shown));
    for (const [mode] of MODES.slice(1)) {
      const here = shown.filter((m) => m.mode === mode);
      if (!here.length) continue;
      const main = here.filter((m) => m.list === "main");
      const extra = here.filter((m) => m.extra);
      const legacy = here.filter((m) => m.legacy);
      blocks.push(groupHead(mode === "Miscellaneous" ? "Misc" : mode, here));
      if (main.length) blocks.push(h("ol", { class: "map-grid" }, main.map(card)));
      if (extra.length) {
        blocks.push(h("h3", { class: "sub-head dim" }, "Extra maps", h("span", {}, ": victory only, no progress steps")));
        blocks.push(h("ol", { class: "map-grid" }, extra.map(card)));
      }
      if (legacy.length) {
        blocks.push(h("h3", { class: "sub-head dim" }, "Legacy maps", h("span", {}, ": too easy for the lists above now, still kept up to date")));
        blocks.push(h("ol", { class: "map-grid" }, legacy.map(card)));
      }
    }
  } else {
    blocks.push(groupHead(SORTS.find(([s]) => s === state.sort)[1], shown, state.mode === "All" ? "" : state.mode));
    blocks.push(h("ol", { class: "map-grid" }, shown.map(card)));
  }
  catalog.replaceChildren(...blocks);
  // only a builder line that does not fit gets the fade
  for (const span of catalog.querySelectorAll(".map-card .builder")) span.classList.toggle("cut", span.scrollWidth > span.clientWidth);
}

function guiSelect(label, options, value, onPick) {
  return h("label", { class: "gui-select" }, h("span", { class: "dim" }, label),
    h("span", { class: "button select-face" },
      h("select", { onchange: (event) => onPick(event.currentTarget.value) },
        options.map(([option, text]) => h("option", { value: option, selected: option === value }, text))),
      icon("arrow", "chev")));
}

function seg(label, options, value, onPick) {
  return [h("div", { class: "seg", role: "group", "aria-label": label },
    h("span", { class: "dim" }, label),
    options.map(([option, text]) => h("button", { class: "button", type: "button", "aria-pressed": String(option === value), onclick: () => onPick(option) }, text))),
  h("span", { class: "mode-phone" }, guiSelect(label, options, value, onPick))];
}

function renderControls() {
  document.getElementById("modes").replaceChildren(...MODES.map(([mode, text]) => h("button", {
    class: "button board-tab", type: "button", "aria-pressed": String(mode === state.mode), onclick: () => go({ mode }),
  }, text)));
  const unbeaten = maps.filter((m) => !m.victors).length;
  document.getElementById("count").textContent = `${maps.length} maps on the server's list, ${unbeaten} of them still unbeaten.`;
  const find = h("input", { type: "search", value: state.find, placeholder: "Map or builder", "aria-label": "Find a map or builder",
    oninput: (event) => go({ find: event.currentTarget.value }, false) });
  document.getElementById("tools").replaceChildren(
    h("span", { class: "mode-phone" }, guiSelect("Gamemode", MODES, state.mode, (mode) => go({ mode }))),
    guiSelect("Sort by", SORTS, state.sort, (sort) => go({ sort })),
    Object.assign(guiSelect("Tier", TIERS, state.tier, (tier) => go({ tier })), { className: "gui-select tier" }),
    guiSelect("Show", SHOWS, state.show, (show) => go({ show })),
    ...seg("View", VIEWS, state.view, (view) => go({ view })),
    h("label", { class: "find" }, h("span", { class: "field" }, icon("search"), find)));
}

function save(push) {
  const q = new URLSearchParams();
  if (state.mode !== "All") q.set("mode", state.mode);
  if (state.sort !== "list") q.set("sort", state.sort);
  if (state.show !== "all") q.set("show", state.show);
  if (state.view !== "tiles") q.set("view", state.view);
  if (state.tier !== "") q.set("tier", state.tier);
  if (state.find.trim()) q.set("find", state.find.trim());
  const text = q.toString();
  const url = text ? `?${text}` : location.pathname;
  if (push) history.pushState(null, "", url);
  else history.replaceState(null, "", url);
}

function go(change, push = true) {
  const typing = "find" in change && Object.keys(change).length === 1;
  Object.assign(state, change);
  renderCatalog();
  if (!typing) renderControls();
  save(push);
}

addEventListener("popstate", () => {
  state = readUrl();
  renderControls();
  renderCatalog();
});

renderControls();
renderCatalog();
