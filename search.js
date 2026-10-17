// Search: every player, map and badge in one list, as the game's Multiplayer server list. Each row
// is an icon, a name and a line of facts, with the tier sword where the game puts its signal bars.
// The best match is outlined and Enter opens it; the arrows move the outline. The tabs on the
// window's top edge, as in the creative inventory, split the three kinds; with nothing typed,
// Players lists every player, hardest badge first. The world behind the page turns to the map of
// the outlined row.

const KINDS = [
  ["all", "All"],
  ["players", "Players"],
  ["maps", "Maps"],
  ["badges", "Badges"],
];
// rows of each kind on the All tab, before "See all"
const GROUP = 6;
// what Open says for each kind
const OPENS = { players: "Open profile", maps: "Open map", badges: "Open badge" };

// everything a row shows

const mapsByName = new Map(mapCatalog.map((m) => [m[0], m]));
const badgeMaps = new Map(badgeBoard.map(([b, map]) => [badgeTable[b][0], map]));
const pages = new Set(badgePages);

function role([name, color, end, third]) {
  return { name, color, end, third };
}

// the world a row stands in: a map's screenshot and how bright it is
function worldOf(mapName) {
  const m = mapsByName.get(mapName);
  return m && m[17] ? [m[17], m[19]] : null;
}

const boardOf = new Map(playerBoard.map(([name, , modes]) => [name, modes.All]));
const players = directory.players.map(([name, country]) => {
  const [exp, best] = boardOf.get(name) || [0, null];
  const badge = best && best[1] != null ? badgeTable[best[1]] : null;
  const value = best ? best[0] : 0;
  return {
    kind: "players", name, country, exp, value, tier: badge ? tierOf(value) : 0, badge,
    href: PAGES[name] || null, world: badge ? worldOf(badgeMaps.get(badge[0])) : null,
  };
});

const maps = mapCatalog.map((m) => ({
  kind: "maps", name: m[0], mode: m[1], list: m[2], value: m[4], victors: m[5], on: m[6], first: m[8],
  tier: m[4] ? tierOf(m[4]) : 0, shot: m[17], href: PAGES[m[0]] || null, world: m[17] ? [m[17], m[19]] : null,
}));

const badges = badgeBoard.map(([b, map, mode, value, holders]) => {
  const name = badgeTable[b][0];
  return {
    kind: "badges", name, role: role(badgeTable[b]), map, mode, value, holders, tier: value ? tierOf(value) : 0,
    href: pages.has(badgeKey(name)) ? badgeHref(name) : null, world: worldOf(map),
  };
});

const everything = { players, maps, badges };

// the hardest first, then the busiest
const WEIGHT = {
  players: (a, b) => b.value - a.value || b.exp - a.exp,
  maps: (a, b) => (a.list === 2) - (b.list === 2) || b.value - a.value || b.on - a.on,
  badges: (a, b) => b.value - a.value || b.holders - a.holders,
};

// how well a name matches what was typed: the whole name, its start, a word's start, anywhere
function score(name, q) {
  const n = name.toLowerCase();
  if (n === q) return 0;
  if (n.startsWith(q)) return 1;
  const at = n.indexOf(q);
  if (at < 0) return -1;
  for (let i = at; i > 0; i = n.indexOf(q, i + 1)) if (/[^a-z0-9]/.test(n[i - 1])) return 2;
  return 3;
}

function matching(kind, q) {
  const rows = everything[kind].filter((row) => (!state.tier || row.tier === state.tier) && (kind !== "players" || !state.country || row.country === state.country));
  if (!q) return rows.slice().sort((a, b) => WEIGHT[kind](a, b) || a.name.localeCompare(b.name));
  return rows
    .map((row) => [score(row.name, q), row])
    .filter(([s]) => s >= 0)
    .sort(([sa, a], [sb, b]) => sa - sb || WEIGHT[kind](a, b) || a.name.localeCompare(b.name))
    .map(([s, row]) => Object.assign(row, { score: s }));
}

// for a search that finds nothing: the closest names of any kind, by how many letters differ
function distance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let last = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const keep = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1));
      last = keep;
    }
  }
  return row[b.length];
}

function closest(q) {
  return [...players, ...maps, ...badges]
    .map((row) => {
      const n = row.name.toLowerCase();
      // a long badge name is compared by its map part and its code, not as a whole
      return [Math.min(distance(q, n), ...n.split(/ \| | /).map((part) => distance(q, part) + 1)), row];
    })
    .filter(([d]) => d <= Math.max(2, Math.floor(q.length / 3)))
    .sort(([da], [db]) => da - db)
    .slice(0, 3)
    .map(([, row]) => row);
}

// state, kept in the address so a search can be shared

const params = new URLSearchParams(location.search);
const state = {
  q: (params.get("q") || "").trim(),
  kind: KINDS.some(([k]) => k === params.get("kind")) ? params.get("kind") : null,
  country: params.get("country") || "",
  tier: Number(params.get("tier")) || 0,
};
if (!state.kind) state.kind = state.q ? "all" : "players";
// a tab picked by the visitor stays; otherwise typing shows all kinds, and clearing goes back to
// Players
let chosen = params.has("kind");

function save() {
  const q = new URLSearchParams();
  if (state.q) q.set("q", state.q);
  if (state.kind !== (state.q ? "all" : "players")) q.set("kind", state.kind);
  if (state.country) q.set("country", state.country);
  if (state.tier) q.set("tier", state.tier);
  const text = q.toString();
  history.replaceState(null, "", text ? `?${text}` : location.pathname);
}

// rows

const list = document.getElementById("list");
const input = document.getElementById("q");
let rows = [];
let picked = -1;

// a player's face; a map's picture, and a badge's map's, the sword being at the right already
function rowIcon(row) {
  if (row.kind === "players") return head(row.name);
  const shot = row.kind === "maps" ? row.shot : row.world && row.world[0];
  return shot ? h("img", { src: asset(`assets/tile/map_${shot}.jpg`), alt: "", loading: "lazy" }) : sword(row.tier, "") || h("span", { class: "find-blank" });
}

function rowName(row) {
  if (row.kind === "players") return [nameTag(row.name), row.badge ? pill("span", { class: "pill" }, role(row.badge), row.badge[0]) : null];
  if (row.kind === "badges") return pill("span", { class: "pill" }, row.role, row.name);
  return h("span", {}, row.name);
}

function rowFacts(row) {
  if (row.kind === "players") {
    // on a phone the flag stands for the country, its name in the flag's tooltip
    return [flag(row.country), h("span", { class: "find-country" }, ` ${COUNTRIES[row.country] || "No country set"},`), ` ${row.exp} EXP${row.badge ? "" : ", no badge yet"}`];
  }
  if (row.kind === "maps") {
    const beaten = row.victors ? `${plural(row.victors, "victor")}, first ${row.first[1]}` : "unbeaten";
    const list = row.list === 2 ? ", legacy" : row.list === 1 ? ", extra list" : "";
    return `${row.mode}, ${beaten}, ${row.on} on it${list}`;
  }
  return `${row.map}, ${row.mode}, ${plural(row.holders, "holder")}`;
}

function rowFor(row, i) {
  const attrs = {
    class: `find-row${row.href ? "" : " off"}`, role: "option", id: `row-${i}`, "aria-selected": "false",
    title: row.href ? null : "Not part of this mockup",
  };
  const tag = row.href ? "a" : "div";
  if (row.href) attrs.href = row.href;
  else Object.assign(attrs, { "aria-disabled": "true", tabindex: "-1" });
  const el = h(tag, attrs,
    h("span", { class: "find-icon" }, rowIcon(row), row.href ? icon("play", "find-play") : null),
    h("span", { class: "find-text" }, h("span", { class: "find-name" }, rowName(row)), h("span", { class: "find-facts" }, rowFacts(row))),
    h("span", { class: "find-tier" }, row.tier ? [sword(row.tier, "sword"), h("span", {}, ROMAN[row.tier])] : null));
  el.addEventListener("focus", () => pick(i, false));
  el.addEventListener("click", (event) => {
    // a click outlines the row; on a row that opens, the link does the rest
    pick(i, false);
    if (!row.href) event.preventDefault();
  });
  return el;
}

function more(kind, count) {
  return h("button", { class: "find-more", type: "button", onclick: () => { chosen = true; go({ kind }); } },
    `See all ${count} ${KINDS.find(([k]) => k === kind)[1].toLowerCase()}`, icon("arrow", "chev"));
}

// the row for a search that finds nothing: the game's server that cannot be reached
function nothing() {
  return h("div", { class: "find-row none", role: "option", "aria-disabled": "true", id: "row-none" },
    h("span", { class: "find-icon" }, icon("unknown", "find-unknown")),
    h("span", { class: "find-text" },
      h("span", { class: "find-name" }, `"${state.q}"`),
      h("span", { class: "find-facts" }, `Nothing by that name${state.tier || state.country ? " with these filters" : ""}`)),
    h("span", { class: "find-tier" }, icon("cross", "find-cross")));
}

function render() {
  const q = state.q.toLowerCase();
  const found = Object.fromEntries(["players", "maps", "badges"].map((kind) => [kind, matching(kind, q)]));
  rows = [];
  const parts = [];
  const add = (row) => {
    const i = rows.length;
    rows.push(row);
    return rowFor(row, i);
  };
  if (state.kind === "all") {
    // each kind in its own group, the one holding the best match first, as the game lists its
    // saved servers above the ones it found on the network
    const order = ["players", "maps", "badges"]
      .filter((kind) => found[kind].length)
      .sort((a, b) => (q ? found[a][0].score - found[b][0].score : 0));
    for (const kind of order) {
      const label = KINDS.find(([k]) => k === kind)[1];
      parts.push(h("div", { class: "find-group", role: "group", "aria-label": label },
        h("p", { class: "find-group-title" }, label),
        found[kind].slice(0, GROUP).map(add),
        found[kind].length > GROUP ? more(kind, found[kind].length) : null));
    }
  } else {
    parts.push(...found[state.kind].map(add));
  }
  if (!rows.length) {
    parts.push(nothing());
    const near = q ? closest(q) : [];
    if (near.length) parts.push(h("div", { class: "find-group", role: "group", "aria-label": "Did you mean" }, h("p", { class: "find-group-title" }, "Did you mean"), near.map(add)));
  }
  list.replaceChildren(...parts);
  list.scrollTop = 0;

  const total = state.kind === "all" ? found.players.length + found.maps.length + found.badges.length : found[state.kind].length;
  const word = state.kind === "all" ? "result" : KINDS.find(([k]) => k === state.kind)[1].toLowerCase().replace(/s$/, "");
  document.getElementById("count").textContent = !total ? "" : state.kind === "all" && !state.q ? `${total} in all` : plural(total, word);
  const title = state.q ? `Results for "${state.q}"` : KINDS.find(([k]) => k === state.kind)[1];
  document.getElementById("title").textContent = state.kind === "all" && !state.q ? "Search" : title;
  document.title = `${state.q ? `${state.q} - ` : ""}Search - Parkour Progress`;
  renderTabs(found);
  renderButtons();
  // with no match, the closest names are offered but none is outlined
  picked = -1;
  pick(total ? 0 : -1, false);
}

// the outline

let worldTimer = 0;

function pick(i, scroll = true) {
  const was = document.getElementById(`row-${picked}`);
  was?.classList.remove("on");
  was?.setAttribute("aria-selected", "false");
  picked = i;
  const el = document.getElementById(`row-${i}`);
  if (el) {
    el.classList.add("on");
    el.setAttribute("aria-selected", "true");
    input.setAttribute("aria-activedescendant", el.id);
    if (scroll) el.scrollIntoView({ block: "nearest" });
  } else {
    input.removeAttribute("aria-activedescendant");
  }
  renderOpen();
  // the world follows the outline once it rests
  clearTimeout(worldTimer);
  const world = rows[i] && rows[i].world;
  if (world) worldTimer = setTimeout(() => setWorld(world[0], world[1]), 260);
}

function move(step) {
  if (!rows.length) return;
  pick(picked < 0 ? 0 : (picked + step + rows.length) % rows.length);
}

function open() {
  const row = rows[picked];
  if (row && row.href) location.href = row.href;
}

// tabs, on the window's top edge

function tabIcon(kind, found) {
  if (kind === "players") {
    const lead = found.players[0] || players.slice().sort(WEIGHT.players)[0];
    return head(lead.name);
  }
  if (kind === "maps") {
    const lead = found.maps.find((m) => m.shot) || maps.find((m) => m.shot);
    return h("img", { src: asset(`assets/tile/map_${lead.shot}.jpg`), alt: "" });
  }
  if (kind === "badges") return sword(10, "");
  return icon("search");
}

function renderTabs(found) {
  const counts = { all: found.players.length + found.maps.length + found.badges.length, players: found.players.length, maps: found.maps.length, badges: found.badges.length };
  document.getElementById("tabs").replaceChildren(...KINDS.map(([kind, label]) => h("button", {
    class: "find-tab", type: "button", role: "tab", "aria-selected": String(kind === state.kind), "aria-controls": "list",
    tabindex: kind === state.kind ? "0" : "-1", onclick: () => { chosen = true; go({ kind }); },
  }, h("span", { class: "find-tab-icon" }, tabIcon(kind, found)), h("span", {}, label), h("small", {}, String(counts[kind])))));
}

document.getElementById("tabs").addEventListener("keydown", (event) => {
  const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
  if (!step) return;
  event.preventDefault();
  const at = KINDS.findIndex(([k]) => k === state.kind);
  chosen = true;
  go({ kind: KINDS[(at + step + KINDS.length) % KINDS.length][0] });
  document.querySelector(".find-tab[aria-selected='true']").focus();
});

// the game's button row: Open, then the filters

function renderOpen() {
  const button = document.getElementById("open");
  if (!button) return;
  const row = rows[picked];
  button.textContent = row ? OPENS[row.kind] : "Open";
  button.disabled = !row || !row.href;
  button.title = row && !row.href ? "Not part of this mockup" : "";
}

// on a phone the filters lose their labels, so until one is set it shows the filter's name
const narrow = matchMedia("(max-width: 760px)");

function renderButtons() {
  const all = (what) => (narrow.matches ? what : "All");
  const tiers = [["0", all("Tier")], ...ROMAN.slice(1).map((r, i) => [String(i + 1), `Tier ${r}`])];
  const parts = [h("button", { class: "button find-open", id: "open", type: "button", onclick: open }, "Open")];
  if (state.kind === "players" || state.kind === "all") {
    const codes = [...new Set(players.map((p) => p.country))].filter((c) => COUNTRIES[c]).sort((a, b) => COUNTRIES[a].localeCompare(COUNTRIES[b]));
    parts.push(guiSelect("Country", [["", all("Country")], ...codes.map((c) => [c, COUNTRIES[c]])], state.country, (country) => go({ country })));
  }
  parts.push(guiSelect("Tier", tiers, String(state.tier), (tier) => go({ tier: Number(tier) })));
  if (state.country || state.tier) parts.push(h("button", { class: "button", type: "button", onclick: () => go({ country: "", tier: 0 }) }, "Clear filters"));
  document.getElementById("buttons").replaceChildren(...parts);
}

function go(change) {
  Object.assign(state, change);
  save();
  render();
}

// typing, and the keys the game's list answers to

input.value = state.q;
input.addEventListener("input", () => {
  const q = input.value.trim();
  const kind = chosen ? state.kind : q ? "all" : "players";
  go({ q, kind });
});

function keys(event) {
  if (event.key === "ArrowDown") { event.preventDefault(); move(1); }
  else if (event.key === "ArrowUp") { event.preventDefault(); move(-1); }
  else if (event.key === "Enter" && event.target === input) { event.preventDefault(); open(); }
  else if (event.key === "Escape" && event.target === input && input.value) { input.value = ""; go({ q: "", kind: chosen ? state.kind : "players" }); }
}
input.addEventListener("keydown", keys);
list.addEventListener("keydown", (event) => {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  keys(event);
  document.getElementById(`row-${picked}`)?.focus();
});

// the page's field is the search: the bar's own waits while it is on screen, and on a phone a
// button in the bar brings it back once it has scrolled off
if ("IntersectionObserver" in window) {
  new IntersectionObserver(([entry]) => document.body.classList.toggle("field-on", entry.isIntersecting),
    { rootMargin: `-${document.querySelector(".bar").offsetHeight}px 0px 0px 0px` }).observe(input);
}
document.querySelector(".bar-find").addEventListener("click", () => {
  input.scrollIntoView({ block: "center", behavior: calm.matches ? "auto" : "smooth" });
  input.focus({ preventScroll: true });
});

// the field says "Search" alone when its full placeholder would be cut
function fitPlaceholder() {
  input.placeholder = input.clientWidth < 300 ? "Search" : "Players, maps and badges";
}
addEventListener("resize", fitPlaceholder);
narrow.addEventListener("change", renderButtons);

render();
fitPlaceholder();
if (!matchMedia("(hover: none)").matches) input.focus();
