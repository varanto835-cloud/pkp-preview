// The map named in the address (?m=juku-section), Magnum Opus without one; on the real site every
// map has its own link. Its data loads first, then the page is drawn.
const MAP_DATA = ["magnum-opus", "juku-section"];
const asked = new URLSearchParams(location.search).get("m");
const mapSlug = MAP_DATA.includes(asked) ? asked : "magnum-opus";
const version = new URL(document.currentScript.src).search;
let steps, onMap, furthest, roleSteps, victorToken;

document.getElementById("world").style.setProperty("--world", `url("${asset(`assets/world/${mapSlug.replace(/-/g, "")}.jpg`)}")`);

function token(role) {
  return role.name.split(" | ")[1];
}

function stepName(step) {
  return step.title ? `${step.code} ${step.title}` : step.code;
}

function whoTip(who) {
  return `<b>${esc(who.name)}</b><p>${esc(COUNTRIES[who.country] || "")}</p><p>${esc(`On ${stepName(who.step)} since ${date(who.date)}`)}</p>${favouriteLine(who.name)}`;
}

function who(person) {
  const chip = h("span", { class: "who" }, head(person.name), personLink(person.name), flag(person.country));
  return tip(chip, () => whoTip(person));
}

function failsOf(victor) {
  return map.failsLabel && victor.fails != null ? `${victor.fails} ${map.failsLabel} ${victor.fails === 1 ? "fail" : "fails"}` : null;
}

function victorTip(victor, i) {
  const lines = [`Victor #${i + 1}, beat it on ${when(victor.date)}`, failsOf(victor), i === 0 && exact(victor.date) ? `First to beat ${map.name}` : null];
  return `<b>${esc(victor.name)}</b><p>${esc(COUNTRIES[victor.country] || "")}</p>${lines.filter(Boolean).map((line) => `<p>${esc(line)}</p>`).join("")}${favouriteLine(victor.name)}`;
}

function victorChip(victor, i) {
  return tip(h("span", { class: "who" }, head(victor.name), personLink(victor.name), flag(victor.country)), () => victorTip(victor, i));
}

// "Juwku and Alicja": each builder with their face, kept together when the line wraps
function builders(text) {
  const names = text.split(/\s*(?:,|&|\band\b)\s*/).filter(Boolean);
  return names.flatMap((name, i) => [i ? (i === names.length - 1 ? "and" : ",") : null, h("span", { class: "who" }, head(name), name)]);
}

function renderSide() {
  const side = document.getElementById("side");
  const victors = map.victors;
  const held = victors.length ? `Held by ${plural(victors.length, "player")} of ${map.players}` : "Held by nobody yet";
  const victorPill = tip(pill("a", { class: "pill", href: badgeHref(map.role.name) }, map.role, map.name, victorToken),
    () => `<b style="color:${headingColour(map.role.color, map.role.end, map.role.third)}">${esc(map.role.name)}</b><p>${map.gamemode}, ${tierText(map.tier)}</p><p>${held}</p><p class="hint">Click to open the badge page</p>`);
  const sibling = map.siblings[0];
  const first = victors[0];
  const last = victors[victors.length - 1];

  side.append(...[
    h("div", { class: "title" },
      h("h1", { class: `blend${map.role.third ? " holo" : ""}`, style: nameColours(map.role.color, map.role.end, map.role.third), "data-text": map.name }, map.name),
      tip(h("span", { class: "splash" }, victors.length ? `Beaten by ${plural(victors.length, "player")}!` : "Still unbeaten!"),
        () => victors.length
          ? `<b>${plural(victors.length, "victor")}</b><p>${esc(`First: ${first.name}, ${when(first.date)}`)}</p>${victors.length > 1 ? `<p>${esc(`Latest: ${last.name}, ${when(last.date)}`)}</p>` : ""}`
          : `<b>Unbeaten</b><p>Nobody has beaten ${esc(map.name)} yet.</p>${furthest[0] ? `<p>${esc(`Furthest: ${furthest[0].name} at ${furthest[0].step.code}`)}</p>` : ""}`)),
    h("ul", { class: "facts" },
      h("li", {}, h("span", { class: "mode-chip" }, MODE_LETTER[map.gamemode]), map.gamemode),
      h("li", {}, h("strong", {}, `#${map.rank}`), ` of ${map.ranked} rated maps`),
      h("li", {}, socket(map.tier), tierText(map.tier)),
      h("li", { class: "built" }, "Built by", builders(map.builder)),
      h("li", {}, h("strong", {}, `${expOf(map.value)} EXP`), " for the victory")),
    h("p", { class: "lead" }, victorPill,
      h("a", { class: "pill", href: map.video, target: "_blank", rel: "noopener" }, icon("play"), "Video playlist")),
    // the window under the facts holds what the map is about now: its victors once it is beaten,
    // until then the players closest to beating it
    victors.length ? victorsWindow() : furthestWindow(`${plural(onMap.length, "player")} on the map`),
    sibling ? h("p", { class: "dim" }, `Also on the list: ${sibling.name}, ${sibling.gamemode}, ${tierText(sibling.tier)}, ${expOf(sibling.value)} EXP, ${sibling.victors ? plural(sibling.victors, "victor") : "unbeaten"}.`) : null,
  ].filter(Boolean));
}

function renderRoles() {
  const rail = document.getElementById("roles");
  // a short rail keeps its tiles the usual size, from the left, instead of stretching them
  rail.style.setProperty("--n", Math.max(roleSteps.length + 1, 6));
  document.getElementById("roles-title").append(h("small", {}, `${roleSteps.length} badges on the way to VICTOR`));
  // a step with no screenshot of its own shows the map's
  const art = (step) => (step.card === false ? `assets/tile/map_${mapSlug.replace(/-/g, "")}.jpg` : `assets/tile/tile_${step.id}.jpg`);
  const cards = roleSteps.map((step) => ({ step, href: `#step-${step.id}`, art: art(step), role: step.role, tier: step.tier, label: step.code, count: (step.holders || []).length }));
  cards.push({ href: "#victor", art: `assets/tile/tile_${map.art}.jpg`, role: map.role, tier: map.tier, label: "VICTOR", count: map.victors.length, victor: true });
  for (const item of cards) {
    const el = tile("a", { href: item.href }, item.art, item.tier);
    const who = item.victor
      ? (item.count ? `Beaten by ${plural(item.count, "player")}` : "Nobody has beaten it yet")
      : (item.count ? `${plural(item.count, "player")} on this step` : "Nobody on this step right now");
    tip(el, () => `<b style="color:${headingColour(item.role.color, item.role.end, item.role.third)}">${esc(item.role.name)}</b><p>${tierText(item.tier)}</p><p>${who}</p><p class="hint">Click to see it on the route</p>`);
    rail.append(h("li", {}, el, h("div", { class: "meta" },
      h("strong", {}, item.label),
      pill("a", { class: "pill", href: badgeHref(item.role.name) }, item.role, token(item.role)),
      h("span", { class: "dim" }, item.count ? plural(item.count, item.victor ? "victor" : "player") : "nobody"))));
  }
}

function span(values) {
  if (!values.length) return "no EXP";
  const low = expOf(Math.min(...values));
  const high = expOf(Math.max(...values));
  return low === high ? `${low} EXP` : `${low} to ${high} EXP`;
}

function legOf(step) {
  const match = step.code.match(/^M(\d+)/);
  if (match) return `M${match[1]}`;
  return step.code.startsWith("Shelf") ? "Shelf" : step.code;
}

function stepRow(step) {
  const people = step.holders || [];
  const row = h("li", { class: people.length ? "step held" : "step", id: `step-${step.id}` },
    h("span", { class: "step-mark" }, people.length ? icon("flag") : null),
    h("span", { class: "step-name" }, withFlags(stepName(step)), step.note ? h("span", { class: "dim" }, ` ${step.note}`) : null),
    h("span", {}, step.role ? tip(h("a", { class: "pill", href: badgeHref(step.role.name) }, dot(step.role), token(step.role)), () => `<b style="color:${headingColour(step.role.color, step.role.end, step.role.third)}">${esc(step.role.name)}</b><p>Badge for reaching this step</p><p class="hint">Click to open the badge page</p>`) : null),
    h("span", { class: "step-value" }, step.value == null ? "-" : `${expOf(step.value)} EXP`),
    socket(step.tier),
    people.length ? h("span", { class: "step-who" }, people.map(who)) : null);
  return row;
}

function renderRoute() {
  const route = document.getElementById("route");
  const title = document.getElementById("route-title");
  title.append(h("small", {}, plural(steps.length, "progress step")));
  const legs = [];
  for (const step of steps) {
    const name = legOf(step);
    if (!legs.length || legs[legs.length - 1].name !== name) legs.push({ name, steps: [] });
    legs[legs.length - 1].steps.push(step);
  }
  // a route whose steps are not grouped into legs (SP1 to SP8) is one plain list
  if (legs.every((leg) => leg.steps.length === 1)) {
    route.append(h("ol", {}, steps.map(stepRow)));
  } else {
    const openAll = h("button", { class: "button", type: "button" }, "Open all");
    const closeAll = h("button", { class: "button", type: "button" }, "Close all");
    title.append(h("span", { class: "actions" }, openAll, closeAll));
    for (const leg of legs) {
      const people = leg.steps.reduce((n, step) => n + (step.holders || []).length, 0);
      const values = leg.steps.map((step) => step.value).filter((n) => n != null);
      const roles = leg.steps.filter((step) => step.role);
      route.append(h("details", { class: "leg", open: people > 0 },
        h("summary", { class: "leg-head" }, icon("arrow", "fold"), h("strong", {}, leg.name),
          h("span", { class: "dim" }, span(values)),
          h("span", { class: "dim" }, plural(leg.steps.length, "step")),
          roles.map((step) => h("span", { class: "pill" }, dot(step.role), token(step.role))),
          people ? h("span", { class: "count" }, plural(people, "player")) : h("span", { class: "count dim" }, "nobody here")),
        h("ol", {}, leg.steps.map(stepRow))));
    }
    openAll.addEventListener("click", () => route.querySelectorAll("details").forEach((leg) => { leg.open = true; }));
    closeAll.addEventListener("click", () => route.querySelectorAll("details").forEach((leg) => { leg.open = false; }));
  }
  const victors = map.victors;
  route.append(h("ol", {}, h("li", { class: victors.length ? "step victor held" : "step victor", id: "victor" },
    h("span", { class: "step-mark" }, victors.length ? icon("flag") : null),
    h("span", { class: "step-name" }, h("strong", {}, "VICTOR")),
    h("span", {}, h("a", { class: "pill", href: badgeHref(map.role.name) }, dot(map.role), victorToken)),
    h("span", { class: "step-value" }, `${expOf(map.value)} EXP`),
    socket(map.tier),
    victors.length
      ? h("span", { class: "step-who" }, victors.slice(0, 12).map(victorChip),
        victors.length > 12 ? h("a", { class: "dim", href: "#victors-title" }, `and ${victors.length - 12} more`) : null)
      : h("span", { class: "step-who dim" }, "Nobody yet"))));
  route.append(h("p", { class: "dim route-note" }, "Only your best step on a map counts towards your EXP."));
}

function furthestWindow(count) {
  if (!furthest.length) return null;
  return h("section", { class: "win", "aria-labelledby": "furthest-title" },
    h("h2", { class: "win-title", id: "furthest-title" }, "Furthest players", h("small", {}, count)),
    h("ol", { class: "well furthest" }, furthest.slice(0, 6).map((person, i) => h("li", {},
      h("span", { class: "dim" }, `${i + 1}.`),
      who(person),
      h("a", { href: `#step-${person.step.id}`, class: "dim" }, person.step.code),
      h("span", { class: "dim" }, dayOf(person.date))))));
}

// every victor in order, the first crowned, as a badge page lists its holders
function victorsWindow() {
  const victors = map.victors;
  return h("section", { class: "win", "aria-labelledby": "victors-title" },
    h("h2", { class: "win-title", id: "victors-title" }, "Victors", h("small", {}, `${victors.length} of ${map.players} players`)),
    h("div", { class: "well" },
      h("ol", { class: "holders victors" }, victors.map((victor, i) => tip(h("li", { class: victor.name === signedIn ? "you" : null },
        h("span", { class: "dim" }, `${i + 1}.`),
        head(victor.name),
        h("span", { class: "who" }, personLink(victor.name), flag(victor.country), i === 0 && exact(victor.date) ? icon("crown", "first") : null),
        h("span", { class: "dim when" }, dayOf(victor.date), failsOf(victor) ? h("small", {}, failsOf(victor)) : null)),
      () => victorTip(victor, i))))));
}

// beside the route: the players still on it once the map is beaten, as their steps are there;
// until then the empty Victors window
function renderAside() {
  const aside = document.getElementById("aside");
  if (map.victors.length) {
    const side = furthestWindow(`${onMap.length} on the map`);
    if (side) aside.append(side);
    return;
  }
  const lead = furthest[0];
  aside.append(h("section", { class: "win", "aria-labelledby": "victors-title" },
    h("h2", { class: "win-title", id: "victors-title" }, "Victors", h("small", {}, "0")),
    h("div", { class: "well empty" },
        h("p", { class: "big" }, `Nobody has beaten ${map.name} yet.`),
        h("p", { class: "dim" }, `Victors show up here in order, with date${map.failsLabel ? ` and ${map.failsLabel} fails` : ""}.`),
        lead ? h("div", { class: "closest" },
          h("span", { class: "dim" }, "Furthest so far"),
          who(lead),
          h("a", { href: `#step-${lead.step.id}` }, icon("flag", "target-flag"), stepName(lead.step)),
          h("span", { class: "dim" }, "since ", dayOf(lead.date))) : null)));
}

function markTarget() {
  const target = location.hash && document.querySelector(location.hash);
  if (!target || !target.classList.contains("step")) return;
  const leg = target.closest("details");
  if (leg) leg.open = true;
  target.scrollIntoView({ block: "center" });
}

function draw() {
  steps = map.steps;
  onMap = steps.flatMap((step, index) => (step.holders || []).map((who) => ({ ...who, step, index })));
  furthest = [...onMap].sort((a, b) => b.index - a.index || (a.date || "").localeCompare(b.date || ""));
  roleSteps = steps.filter((step) => step.role);
  victorToken = token(map.role);
  document.title = `${map.name} - Parkour Progress`;
  themeColour(map.tier);
  renderSide();
  renderRoles();
  renderRoute();
  renderAside();
  markTarget();
  // the progress timeline, for a map that has one
  document.head.append(h("script", { src: asset(`data/${mapSlug}-timeline.js`) + version, onload: renderTimeline }));
}

addEventListener("hashchange", markTarget);
document.head.append(h("script", { src: asset(`data/${mapSlug}.js`) + version, onload: draw }));
