// The Badges tab, a page per tier, opened from the top bar or a layer of the home's beacon: what the
// tier is, every badge in it from the easiest up, with the ones you hold marked, so from the tier
// below you can see your ways up, and the players whose hardest badge stopped here. With no tier
// asked for it opens the tier above yours, or Tier I.
// in the mockup only wlatr's badges are known, so only wlatr signed in gets the marks
const ME = signedIn === "wlatr" ? signedIn : "";
const me = ME ? tierPlayers.find((p) => p[0] === ME) : null;
const requested = Number(new URLSearchParams(location.search).get("t"));
const tier = requested >= 1 && requested <= 10 ? requested : me ? Math.min(10, me[3] + 1) : 1;
const inTier = tierBadges.filter((b) => b[7] === tier);
const reached = tierPlayers.filter((p) => p[3] >= tier).length;
const stopped = tierPlayers.filter((p) => p[3] === tier);
const MODES = [["All", "All"], ["Rankup", "Rankup"], ["Segmented", "Segmented"], ["Onlysprint", "Onlysprint"], ["Miscellaneous", "Misc"]];

// the columns a click sorts by, a second click on the same one reverses it. Ties keep the tier's
// own order, easiest first
const SORTS = {
  held: { label: "Held", note: "The badges you hold.", order: ["Held first", "Not held first"], key: (b) => -b[9] },
  exp: { label: "EXP", note: "1000 EXP at difficulty 190, 2% less for every point below.", order: ["Easiest first", "Hardest first"], key: (b) => b[6] },
  players: { label: "Players", note: "Players who hold the badge.", order: ["Most first", "Fewest first"], key: (b) => -b[8] },
};
const asked = new URLSearchParams(location.search);
const view = {
  by: SORTS[asked.get("by")] && (asked.get("by") !== "held" || me) ? asked.get("by") : "exp",
  reverse: asked.get("order") === "reverse",
  mode: MODES.some(([m]) => m === asked.get("mode")) ? asked.get("mode") : "All",
};

function roleOf(colours) {
  return { color: colours[0], end: colours[1], third: colours[2] };
}

function linkOf(b) {
  const [key, , , map, , , , , , , page] = b;
  if (page) return `badge.html?b=${key}`;
  return PAGES[map] || `maps.html?find=${encodeURIComponent(map)}`;
}

// the tiers in a row of slots, this one lit, each opening its own page
function tierSteps() {
  return h("ol", { class: "tier-steps", "aria-label": "Tiers" }, ROMAN.slice(1).map((numeral, i) => {
    const t = i + 1;
    return h("li", {}, h("a", {
      class: t === tier ? "slot here" : "slot", href: `tier.html?t=${t}`, "aria-current": t === tier ? "page" : null,
      title: tierText(t),
    }, sword(t), h("span", { class: "sr-only" }, numeral)));
  }));
}

// where wlatr stands against this tier, in a line
function myLine() {
  if (!me) return h("p", { class: "lead dim" }, "Sign in to see which of these badges you hold.");
  const held = inTier.filter((b) => b[9]).length;
  const where = me[3] > tier ? "Your hardest badge is past this tier"
    : me[3] === tier ? "Your hardest badge is in this tier"
    : `Your hardest badge is Tier ${ROMAN[me[3]]}: the badges below would take you here`;
  return h("p", { class: "lead" }, head(ME), personLink(ME), h("span", { class: "dim" }, "(you)"),
    h("span", {}, `${held} of ${inTier.length} held.`), h("span", { class: "dim" }, `${where}.`));
}

function renderSide() {
  const side = document.getElementById("side");
  const values = inTier.map((b) => b[6]);
  document.title = `${tierText(tier)} - Parkour Progress`;
  const world = tierWorlds[tier];
  if (world) setWorld(world[0], world[1]);
  side.append(...[
    tierSteps(),
    // its sword, numeral and name in one heading, as the beacon labels a layer
    h("h1", { class: "tier-name", style: `--c1: var(--t${tier})` }, sword(tier), h("span", {}, `${ROMAN[tier]} ${TIER_NAMES[tier]}`)),
    // two columns, the players then the badges, the numbers in white
    h("ul", { class: "facts tier-facts" },
      h("li", {}, h("strong", {}, String(reached)), ` ${reached === 1 ? "player" : "players"} reached it or higher`),
      h("li", {}, h("strong", {}, String(stopped.length)), " stopped here"),
      h("li", {}, h("strong", {}, String(inTier.length)), inTier.length === 1 ? " badge" : " badges"),
      values.length ? h("li", {}, h("strong", {}, String(expOf(Math.min(...values)))), " to ",
        h("strong", {}, String(expOf(Math.max(...values)))), " EXP each") : null),
    myLine(),
  ].filter(Boolean));
}

function renderBadges() {
  document.getElementById("badges-title").textContent = `Badges in Tier ${ROMAN[tier]}`;
  document.getElementById("badges-win").classList.add(`m${tier}`);
  document.getElementById("badges-well").classList.toggle("no-held", !me);
  fillBadges();
}

// the sort and the gamemode stay in the address, so Back from a badge comes back to the same list
function saveView() {
  const q = new URLSearchParams(location.search);
  q.delete("me");
  for (const [key, value, plain] of [["by", view.by, "exp"], ["order", view.reverse ? "reverse" : "", ""], ["mode", view.mode, "All"]]) {
    if (value === plain) q.delete(key);
    else q.set(key, value);
  }
  history.replaceState(null, "", `?${q}`);
}

function go(change) {
  if ("by" in change && change.by !== view.by) change.reverse = false;
  Object.assign(view, change);
  saveView();
  fillBadges();
}

function seg(label, options, value, onPick) {
  return [h("div", { class: "seg", role: "group", "aria-label": label },
    h("span", { class: "dim" }, label),
    options.map(([option, text]) => h("button", { class: "button", type: "button", "aria-pressed": String(option === value), onclick: () => onPick(option) }, text))),
  h("span", { class: "mode-phone" }, guiSelect(label, options, value, onPick))];
}

// the arrow points the way the numbers go: up for easiest first, down for most first
function columnHead(cls, by) {
  const sort = SORTS[by];
  const active = view.by === by;
  const now = sort.order[view.reverse ? 1 : 0];
  const button = h("button", {
    type: "button", class: active ? "sorted" : null, "aria-pressed": String(active),
    "aria-label": active ? `${sort.label}, ${now.toLowerCase()}` : `Sort by ${sort.label}`,
    onclick: () => go(active ? { reverse: !view.reverse } : { by }),
  }, sort.label, active ? icon("arrow", `sort-arrow${(by === "exp") !== view.reverse ? " up" : ""}`) : null);
  tip(button, () => `<b>${esc(sort.label)}</b><p>${esc(sort.note)}</p>`
    + `<p class="hint">${active ? `${now}. Click again for ${sort.order[view.reverse ? 0 : 1].toLowerCase()}` : `Click for ${sort.order[0].toLowerCase()}`}</p>`);
  return h("span", { class: cls }, button);
}

// the day a badge was got is in its tick's tooltip; a touch screen has no hover, so a tap shows it
function tick(day, by) {
  const text = exact(day, by) ? `You got this badge on ${date(day)}`
    : by ? `You got this badge by ${date(day)}` : `You got this badge on ${date(day)} or earlier`;
  const why = exact(day, by) ? "" : by ? "The bot only knows it was held by then, the day of a later step or of the victory."
    : `Progress from before ${date(HISTORY_START)} was imported on that day.`;
  const el = h("button", { type: "button", class: "mine", "aria-label": text }, icon("check"));
  el.addEventListener("click", (event) => {
    if (touch) showTip(el, event.clientX, event.clientY);
  });
  return tip(el, () => `<b>${esc(text)}</b>${why ? `<p>${esc(why)}</p>` : ""}`);
}

// and the next tap anywhere else hides it
let touch = false;
document.addEventListener("pointerdown", (event) => {
  touch = event.pointerType !== "mouse";
  if (touch && !event.target.closest(".mine")) tooltip.hidden = true;
});

function fillBadges() {
  document.getElementById("filters").replaceChildren(...seg("Gamemode", MODES, view.mode, (mode) => go({ mode })));
  document.getElementById("badges-head").replaceChildren(...[
    h("span", { class: "c-sort dim" }, "Sort:"),
    h("span", { class: "c-n" }, "#"),
    me ? columnHead("c-held", "held") : null,
    h("span", { class: "c-mode" }, h("span", { class: "long" }, "Gamemode"), h("span", { class: "short" }, "Mode")),
    h("span", { class: "c-badge" }, "Badge"),
    columnHead("c-exp", "exp"),
    columnHead("c-players", "players"),
  ].filter(Boolean));
  const list = document.getElementById("badges");
  const sign = view.reverse ? -1 : 1;
  const key = SORTS[view.by].key;
  const rows = inTier.map((b, i) => [b, i])
    .filter(([b]) => view.mode === "All" || b[5] === view.mode)
    .sort(([a, i], [b, j]) => sign * (key(a) - key(b)) || i - j)
    .map(([b]) => b);
  if (!rows.length) {
    list.replaceChildren(h("li", { class: "none dim" }, inTier.length ? `No ${view.mode} badge is in this tier.` : "No badge is in this tier yet."));
    return;
  }
  list.replaceChildren(...rows.map((b, i) => {
    const [, name, colours, map, , mode, worth, , holders, held, page, day, by] = b;
    const mine = Boolean(me && held);
    const token = name.split(" | ")[1];
    const row = h("li", {},
      h("span", { class: "dim" }, `${i + 1}.`),
      me ? (mine ? tick(day, by) : h("span")) : null,
      modeChip(mode),
      pill("a", { class: "pill", href: linkOf(b) }, roleOf(colours), map, token),
      h("span", { class: "worth" }, `${expOf(worth)} EXP`),
      h("span", { class: "dim held-by" }, holders ? plural(holders, "player") : "nobody yet"));
    return tip(row, () => `<b>${esc(name)}</b><p>${esc(mode)}, ${tierText(tier)}, ${expOf(worth)} EXP</p>`
      + `<p>${holders ? `${plural(holders, "player")} hold it` : "Nobody holds it yet"}${mine ? ", you among them" : ""}</p>`
      + `<p class="hint">Click for ${page ? "its page" : "its map"}</p>`);
  }));
}

function renderStopped() {
  document.getElementById("stopped-note").textContent = stopped.length ? "strongest first, by their hardest badge" : "";
  const list = document.getElementById("stopped");
  if (!stopped.length) {
    list.append(h("li", { class: "none dim" }, "Nobody's hardest badge is in this tier."));
    return;
  }
  stopped.forEach(([name, country, , , badge], i) => {
    // their hardest badge, opening its page where it has one, or its map; a player whose hardest
    // step gives no badge yet says so, as the profile does
    let hardest = tip(h("span", { class: "pill ghost" }, dot(null), h("span", {}, "no badge")),
      () => `<b>No badge yet</b><p>${esc(name)}'s hardest step is in ${tierText(tier)},</p><p>but it gives no badge.</p>`);
    if (badge) {
      const [map, token] = badge[0].split(" | ");
      const known = tierBadges.find((b) => b[1] === badge[0]);
      const href = known ? linkOf(known) : PAGES[map] || `maps.html?find=${encodeURIComponent(map)}`;
      hardest = pill("a", { class: "pill", href }, roleOf(badge.slice(1)), map, token);
    }
    list.append(h("li", { class: name === ME ? "you" : null },
      h("span", { class: "dim" }, `${i + 1}.`), head(name), h("span", { class: "who" }, personLink(name), flag(country)), hardest));
  });
}

renderSide();
renderBadges();
renderStopped();
document.getElementById("mockup-note").textContent = me
  ? "Mockup: signed in as wlatr, so wlatr's badges are marked."
  : "Mockup: sign in, as wlatr, to see your own badges marked.";
