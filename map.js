const steps = map.steps;
const onMap = steps.flatMap((step, index) => (step.holders || []).map((who) => ({ ...who, step, index })));
const furthest = [...onMap].sort((a, b) => b.index - a.index || (a.date || "").localeCompare(b.date || ""));
const roleSteps = steps.filter((step) => step.role);
const [, victorToken] = map.role.name.split(" | ");

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

function renderSide() {
  const side = document.getElementById("side");
  const victorPill = tip(pill("a", { class: "pill", href: badgeHref(map.role.name) }, map.role, "Magnum Opus", victorToken),
    () => `<b style="color:${map.role.color}">${esc(map.role.name)}</b><p>${map.gamemode}, ${tierText(map.tier)}</p><p>Held by nobody yet</p><p class="hint">Click to open the badge page</p>`);
  const top = furthest.slice(0, 6);
  const sibling = map.siblings[0];

  side.append(
    h("div", { class: "title" },
      h("h1", { class: `blend${map.role.third ? " holo" : ""}`, style: nameColours(map.role.color, map.role.end, map.role.third) }, map.name),
      tip(h("span", { class: "splash" }, map.victors.length ? `Beaten by ${plural(map.victors.length, "player")}!` : "Still unbeaten!"),
        () => map.victors.length
          ? `<b>${plural(map.victors.length, "victor")}</b>`
          : `<b>Unbeaten</b><p>Nobody has beaten ${esc(map.name)} yet.</p>${furthest[0] ? `<p>${esc(`Furthest: ${furthest[0].name} at ${furthest[0].step.code}`)}</p>` : ""}`)),
    h("ul", { class: "facts" },
      h("li", {}, h("span", { class: "mode-chip" }, MODE_LETTER[map.gamemode]), map.gamemode),
      h("li", {}, h("strong", {}, `#${map.rank}`), ` of ${map.ranked} rated maps`),
      h("li", {}, socket(map.tier), tierText(map.tier)),
      h("li", {}, "Built by", head(map.builder), map.builder),
      h("li", {}, h("strong", {}, `${expOf(map.value)} EXP`), " for the victory")),
    h("p", { class: "lead" }, victorPill,
      h("a", { class: "pill", href: map.video, target: "_blank", rel: "noopener" }, icon("play"), "Video playlist")),
    h("section", { class: "win", "aria-labelledby": "furthest-title" },
      h("h2", { class: "win-title", id: "furthest-title" }, "Furthest players", h("small", {}, `${plural(onMap.length, "player")} on the map`)),
      h("ol", { class: "well furthest" }, top.map((person, i) => h("li", {},
        h("span", { class: "dim" }, `${i + 1}.`),
        who(person),
        h("a", { href: `#step-${person.step.id}`, class: "dim" }, person.step.code),
        h("span", { class: "dim" }, date(person.date)))))),
    sibling ? h("p", { class: "dim" }, `Also on the list: ${sibling.name}, ${sibling.gamemode}, ${tierText(sibling.tier)}, ${expOf(sibling.value)} EXP, ${sibling.victors ? plural(sibling.victors, "victor") : "unbeaten"}.`) : null,
  );
}

function renderRoles() {
  const rail = document.getElementById("roles");
  rail.style.setProperty("--n", roleSteps.length + 1);
  document.getElementById("roles-title").append(h("small", {}, `${roleSteps.length} badges on the way to VICTOR`));
  const cards = roleSteps.map((step) => ({ step, href: `#step-${step.id}`, art: `assets/tile/tile_${step.id}.jpg`, role: step.role, tier: step.tier, label: step.code, count: (step.holders || []).length }));
  cards.push({ href: "#victor", art: `assets/tile/tile_${map.art}.jpg`, role: map.role, tier: map.tier, label: "VICTOR", count: map.victors.length });
  for (const item of cards) {
    const el = tile("a", { href: item.href }, item.art, item.tier);
    tip(el, () => `<b style="color:${item.role.color}">${esc(item.role.name)}</b><p>${tierText(item.tier)}</p><p>${item.count ? `${plural(item.count, "player")} on this step` : "Nobody on this step right now"}</p><p class="hint">Click to see it on the route</p>`);
    rail.append(h("li", {}, el, h("div", { class: "meta" },
      h("strong", {}, item.label),
      pill("a", { class: "pill", href: badgeHref(item.role.name) }, item.role, token(item.role)),
      h("span", { class: "dim" }, item.count ? plural(item.count, "player") : "nobody"))));
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
    h("span", {}, step.role ? tip(h("a", { class: "pill", href: badgeHref(step.role.name) }, dot(step.role), token(step.role)), () => `<b style="color:${step.role.color}">${esc(step.role.name)}</b><p>Badge for reaching this step</p><p class="hint">Click to open the badge page</p>`) : null),
    h("span", { class: "step-value" }, step.value == null ? "-" : `${expOf(step.value)} EXP`),
    socket(step.tier),
    people.length ? h("span", { class: "step-who" }, people.map(who)) : null);
  return row;
}

function renderRoute() {
  const route = document.getElementById("route");
  const openAll = h("button", { class: "button", type: "button" }, "Open all");
  const closeAll = h("button", { class: "button", type: "button" }, "Close all");
  document.getElementById("route-title").append(h("small", {}, `${steps.length} progress steps`), h("span", { class: "actions" }, openAll, closeAll));
  const legs = [];
  for (const step of steps) {
    const name = legOf(step);
    if (!legs.length || legs[legs.length - 1].name !== name) legs.push({ name, steps: [] });
    legs[legs.length - 1].steps.push(step);
  }
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
  route.append(h("ol", {}, h("li", { class: "step victor", id: "victor" },
    h("span", { class: "step-mark" }),
    h("span", { class: "step-name" }, h("strong", {}, "VICTOR")),
    h("span", {}, h("a", { class: "pill", href: badgeHref(map.role.name) }, dot(map.role), victorToken)),
    h("span", { class: "step-value" }, `${expOf(map.value)} EXP`),
    socket(map.tier),
    h("span", { class: "step-who dim" }, "Nobody yet"))));
  route.append(h("p", { class: "dim route-note" }, "Only your best step on a map counts towards your EXP."));
}

function renderAside() {
  const aside = document.getElementById("aside");
  const lead = furthest[0];
  aside.append(h("section", { class: "win", "aria-labelledby": "victors-title" },
    h("h2", { class: "win-title", id: "victors-title" }, "Victors", h("small", {}, String(map.victors.length))),
    h("div", { class: "well empty" },
      h("p", { class: "big" }, `Nobody has beaten ${map.name} yet.`),
      h("p", { class: "dim" }, `Victors show up here in order, with date and ${map.failsLabel} fails.`),
      lead ? h("div", { class: "closest" },
        h("span", { class: "dim" }, "Furthest so far"),
        who(lead),
        h("a", { href: `#step-${lead.step.id}` }, icon("flag", "target-flag"), stepName(lead.step)),
        h("span", { class: "dim" }, `since ${date(lead.date)}`)) : null)));
}

function markTarget() {
  const target = location.hash && document.querySelector(location.hash);
  if (!target || !target.classList.contains("step")) return;
  const leg = target.closest("details");
  if (leg) leg.open = true;
  target.scrollIntoView({ block: "center" });
}

addEventListener("hashchange", markTarget);

renderSide();
renderRoles();
renderRoute();
renderAside();
addEventListener("load", markTarget);
