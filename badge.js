const requested = new URLSearchParams(location.search).get("b");
const key = badgeIndex[requested] ? requested : "juku-section-victor";
const badge = badgeIndex[key];
const holders = badgeHolders[key];
const total = directory.players.length;
const [, token] = badge.name.split(" | ");
const pct = (holders.length / total) * 100;

function percent(n) {
  return n < 1 ? n.toFixed(1) : String(Math.round(n));
}

function slug(text) {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function reached(row) {
  return when(row[2], row[3]);
}

function renderSide() {
  const side = document.getElementById("side");
  const first = holders[0];
  const owned = holders.some((row) => row[0] === "wlatr");
  const mapPage = PAGES[badge.map];
  document.title = `${badge.name} - Parkour Progress`;
  document.getElementById("world").style.setProperty("--world", `url("${asset(`assets/world/${slug(badge.map)}.jpg`)}")`);

  side.append(...[
    h("h1", { class: `badge-name${badge.end ? " blend" : ""}${badge.third ? " holo" : ""}`, style: nameColours(badge.color, badge.end, badge.third), "data-text": badge.name }, badge.name),
    h("ul", { class: "facts" },
      h("li", {}, h("span", { class: "mode-chip" }, MODE_LETTER[badge.gamemode]), mapPage ? h("a", { href: mapPage }, badge.map) : badge.map),
      h("li", {}, socket(badge.tier), tierText(badge.tier)),
      badge.code !== "VICTOR" ? h("li", {}, `Earned at ${badge.code}`) : h("li", {}, "Earned by beating the map")),
    h("section", { class: "win", "aria-labelledby": "rarity-title" },
      h("h2", { class: "win-title", id: "rarity-title" }, "Rarity", h("small", {}, holders.length ? `${plural(holders.length, "player")} of ${total}` : "nobody yet")),
      h("div", { class: "well rarity" },
        h("strong", {}, `${percent(pct)}%`),
        h("span", { class: "meter", style: roleColours(badge) }, h("i", { style: `width:${Math.max(pct, holders.length ? 1 : 0)}%` })),
        first
          ? h("p", { class: "lead" }, exact(first[2], first[3]) ? [icon("crown", "first"), "First to get it"] : "Earliest on record",
            head(first[0]), personLink(first[0]), flag(first[1]), h("span", { class: "dim" }, reached(first)))
          : h("p", { class: "dim" }, `Nobody has reached ${badge.code === "VICTOR" ? `the end of ${badge.map}` : badge.code} yet.`))),
    owned ? h("p", { class: "lead" },
      h("a", { class: "button", href: `profile.html?fav=${key}` }, "Set as favourite badge"),
      h("span", { class: "dim" }, "Preview. On the site only the owner can do this, after Discord login.")) : null,
  ].filter(Boolean));
}

function renderHolders() {
  const list = document.getElementById("holders");
  document.getElementById("holders-count").textContent = holders.length ? "first to get it on top" : "";
  if (!holders.length) {
    list.append(h("li", { class: "none dim" }, "Nobody holds this badge yet."));
    return;
  }
  holders.forEach((row, i) => {
    const [name, country] = row;
    list.append(tip(h("li", { class: name === "wlatr" ? "you" : null },
      h("span", { class: "dim" }, `${i + 1}.`),
      head(name),
      h("span", { class: "who" }, personLink(name), flag(country), i === 0 && exact(row[2], row[3]) ? icon("crown", "first") : null),
      h("span", { class: "dim" }, reached(row))),
    () => `<b>${esc(name)}</b><p>Got it ${esc(reached(row))}</p>${favouriteLine(name)}`));
  });
}

renderSide();
renderHolders();
