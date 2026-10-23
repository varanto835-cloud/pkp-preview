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
let hardestFirst = false;

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
    h("ul", { class: "facts" },
      // each number stays with its words when a fact wraps
      h("li", {}, h("span", {}, h("strong", {}, String(reached)), ` ${reached === 1 ? "player" : "players"} reached it or higher`)),
      h("li", {}, h("span", {}, h("strong", {}, String(stopped.length)), " stopped here")),
      h("li", {}, h("span", {}, h("strong", {}, String(inTier.length)), inTier.length === 1 ? " badge" : " badges")),
      values.length ? h("li", {}, `${expOf(Math.min(...values))} to ${expOf(Math.max(...values))} EXP each`) : null),
    myLine(),
  ].filter(Boolean));
}

function renderBadges() {
  const title = document.getElementById("badges-title");
  const sort = h("button", { class: "button", type: "button", "aria-pressed": "false" }, "Hardest first");
  sort.addEventListener("click", () => {
    hardestFirst = !hardestFirst;
    sort.setAttribute("aria-pressed", String(hardestFirst));
    fillBadges();
  });
  title.replaceChildren(h("span", {}, `Badges in Tier ${ROMAN[tier]} `, h("small", { id: "badges-order" })), sort);
  document.getElementById("badges-win").classList.add(`m${tier}`);
  fillBadges();
}

function fillBadges() {
  document.getElementById("badges-order").textContent = hardestFirst ? "hardest first" : "easiest first";
  const list = document.getElementById("badges");
  const rows = hardestFirst ? [...inTier].reverse() : inTier;
  if (!rows.length) {
    list.replaceChildren(h("li", { class: "none dim" }, "No badge is in this tier yet."));
    return;
  }
  list.replaceChildren(...rows.map((b, i) => {
    const [, name, colours, map, , mode, worth, , holders, held, page] = b;
    const mine = Boolean(me && held);
    const token = name.split(" | ")[1];
    const row = h("li", { class: mine ? "yours" : null },
      h("span", { class: "dim" }, `${i + 1}.`),
      pill("a", { class: "pill", href: linkOf(b) }, roleOf(colours), map, token),
      h("span", { class: "mode-chip", title: mode }, MODE_LETTER[mode]),
      h("span", { class: "meta" },
        h("span", { class: "worth" }, `${expOf(worth)} EXP`),
        h("span", { class: "dim" }, holders ? plural(holders, "player") : "nobody yet"),
        mine ? h("span", { class: "mine" }, icon("check"), h("span", { class: "mine-word" }, "yours")) : h("span")));
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
