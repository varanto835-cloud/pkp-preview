const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
const TIER_NAMES = ["", "Mossy Oak", "Stone", "Oxidised Copper", "Knight Iron", "Royal Gold", "Amethyst",
  "Infernal Netherite", "Sapphire", "Emerald", "Demon Blade"];
const MODE_LETTER = { Rankup: "R", Segmented: "S", Onlysprint: "O", Miscellaneous: "M" };
const COUNTRIES = {
  ar: "Argentina", at: "Austria", au: "Australia", az: "Azerbaijan", br: "Brazil", ca: "Canada", ch: "Switzerland",
  cn: "China", cz: "Czechia", de: "Germany", dk: "Denmark", ec: "Ecuador", ee: "Estonia", es: "Spain", fi: "Finland",
  fm: "Micronesia", fr: "France", gb: "United Kingdom", gr: "Greece", hk: "Hong Kong", hr: "Croatia", hu: "Hungary",
  ie: "Ireland", il: "Israel", it: "Italy", jo: "Jordan", jp: "Japan", kr: "South Korea", kz: "Kazakhstan", la: "Laos",
  my: "Malaysia", nl: "Netherlands", no: "Norway", ph: "Philippines", pl: "Poland", ps: "Palestine", pt: "Portugal",
  rs: "Serbia", ru: "Russia", se: "Sweden", sg: "Singapore", sk: "Slovakia", th: "Thailand", tw: "Taiwan",
  ua: "Ukraine", us: "United States",
};
const PAGES = { wlatr: "profile.html", "Magnum Opus": "map.html" };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const calm = matchMedia("(prefers-reduced-motion: reduce)");

// standalone build puts the images in INLINE
function asset(path) {
  return (typeof INLINE !== "undefined" && INLINE[path]) || path;
}

function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "style") node.style.cssText = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? "" : value);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : String(child));
  }
  return node;
}

function esc(text) {
  return String(text).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

function value(n) {
  if (n == null) return "-";
  return String(Math.round(n * 100) / 100);
}

// same as the bot: 1000 EXP at 190, 2% less for every point below
function expOf(n) {
  return n == null ? null : Math.round(1000 * 0.98 ** (190 - n));
}

function date(iso) {
  if (!iso) return "no date";
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

// progress from before this day was imported on it, so the date only means "on or before"
const HISTORY_START = "2025-04-06";

function when(iso, by) {
  if (!iso) return "date not recorded";
  if (by) return `by ${date(iso)}`;
  return iso === HISTORY_START ? `${date(iso)} or earlier` : date(iso);
}

function exact(iso, by) {
  return Boolean(iso) && !by && iso !== HISTORY_START;
}

function plural(n, word, many = word + "s") {
  return `${n.toLocaleString("en-US")} ${n === 1 ? word : many}`;
}

function icon(name, cls = "") {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", `icon ${cls}`.trim());
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `#i-${name}`);
  svg.append(use);
  return svg;
}

function sword(tier, cls = "sword") {
  if (!tier) return null;
  return h("img", { class: cls, src: asset(`assets/tier/tier${tier}.png`), alt: `Tier ${ROMAN[tier]}` });
}

function socket(tier, cls = "") {
  if (!tier) return h("span");
  return h("span", { class: `socket ${cls}`.trim() }, sword(tier, "sword small"));
}

function flag(code, cls = "flag") {
  if (!code) return null;
  return h("img", { class: cls, src: asset(`assets/flag/${code}.png`), alt: COUNTRIES[code] || code.toUpperCase(), title: COUNTRIES[code] || "" });
}

function tierText(tier) {
  return tier ? `Tier ${ROMAN[tier]} ${TIER_NAMES[tier]}` : "No tier";
}

// hall names can have a flag emoji, use the flag icon instead
function withFlags(text) {
  const parts = String(text).split(/([\u{1F1E6}-\u{1F1FF}]{2})/u);
  return parts.filter(Boolean).map((part) => {
    if (!/^[\u{1F1E6}-\u{1F1FF}]{2}$/u.test(part)) return part;
    const code = [...part].map((c) => String.fromCharCode(c.codePointAt(0) - 0x1f1e6 + 97)).join("");
    return flag(code);
  });
}

function stripFlags(text) {
  return String(text).replace(/\s*[\u{1F1E6}-\u{1F1FF}]{2}/gu, "").trim();
}

function roleColours(role) {
  if (!role || !role.color) return "";
  return `--c1:${role.color};--c2:${role.end || role.color};--c3:${role.third || role.end || role.color}`;
}

function dot(role) {
  return h("span", { class: role && role.end ? "dot blend" : "dot", style: roleColours(role) });
}

function badgeKey(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function badgeHref(name) {
  return `badge.html?b=${badgeKey(name)}`;
}

function pill(tag, attrs, role, name, token) {
  return h(tag, attrs, dot(role), h("span", {}, name, token ? h("span", { class: "tok" }, ` | ${token}`) : null));
}

// tooltips

const tooltip = h("div", { class: "tooltip", role: "tooltip", hidden: true });
const tips = new WeakMap();

function tip(el, build) {
  tips.set(el, build);
  if (!el.hasAttribute("tabindex") && !/^(A|BUTTON)$/.test(el.tagName)) el.tabIndex = 0;
  return el;
}

function placeTip(x, y) {
  const pad = 12;
  const box = tooltip.getBoundingClientRect();
  let left = x + pad;
  let top = y - pad - 8;
  if (left + box.width > innerWidth - 8) left = x - pad - box.width;
  if (top + box.height > innerHeight - 8) top = innerHeight - 8 - box.height;
  tooltip.style.left = `${Math.max(8, left)}px`;
  tooltip.style.top = `${Math.max(8, top)}px`;
}

function showTip(el, x, y) {
  const build = tips.get(el);
  if (!build) return;
  tooltip.innerHTML = build();
  tooltip.hidden = false;
  placeTip(x, y);
}

function tipTarget(event) {
  let el = event.target instanceof Element ? event.target : null;
  while (el && !tips.has(el)) el = el.parentElement;
  return el;
}

document.addEventListener("pointerover", (event) => {
  const el = tipTarget(event);
  if (el) showTip(el, event.clientX, event.clientY);
});

document.addEventListener("pointermove", (event) => {
  if (!tooltip.hidden) placeTip(event.clientX, event.clientY);
});

document.addEventListener("pointerout", (event) => {
  const el = tipTarget(event);
  if (el && !el.contains(event.relatedTarget)) tooltip.hidden = true;
});

// keyboard focus only, a click keeps the tooltip where the pointer is
document.addEventListener("focusin", (event) => {
  const el = tipTarget(event);
  if (!el || !event.target.matches(":focus-visible")) return;
  const box = el.getBoundingClientRect();
  showTip(el, box.right, box.top + 8);
});

document.addEventListener("focusout", () => {
  tooltip.hidden = true;
});

addEventListener("scroll", () => {
  tooltip.hidden = true;
}, { passive: true });

// player heads, grey if the account is gone

function head(name) {
  const canvas = h("canvas", { class: "head", width: 8, height: 8, "aria-hidden": "true" });
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#555";
  ctx.fillRect(0, 0, 8, 8);
  ctx.fillStyle = "#8b8b8b";
  ctx.fillRect(1, 1, 6, 6);
  const img = new Image();
  img.onload = () => {
    ctx.clearRect(0, 0, 8, 8);
    ctx.drawImage(img, 0, 0);
  };
  img.src = asset(`assets/face/${name.toLowerCase()}.png`);
  return canvas;
}

function tile(tag, attrs, art, tier, mark) {
  return h(tag, { ...attrs, class: `tile t${tier || 0}`, style: `--art:url("${asset(art)}")` },
    mark ? h("span", { class: "tile-mark" }, icon(mark)) : null,
    tier ? h("span", { class: "tile-tier" }, socket(tier)) : null);
}

// lighten dark role colours so names stay readable
function legible(hex) {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const luminance = (rgb) => rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
  let lifted = channels;
  for (let t = 0; luminance(lifted) < 0.24 && t <= 1; t += 0.05) {
    lifted = channels.map((v) => Math.round(v + (255 - v) * t));
  }
  return `#${lifted.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function nameColours(c1, c2, c3) {
  return `--c1:${legible(c1)};--c2:${legible(c2 || c1)};--c3:${legible(c3 || c2 || c1)}`;
}

// name in the colours of the favourite badge
function nameTag(name, tag = "span", attrs = {}) {
  const row = typeof favourites !== "undefined" && favourites[name];
  if (!row) return h(tag, attrs, name);
  const [, c1, c2, c3] = row;
  const cls = `name${c2 ? " blend" : ""}${c3 ? " holo" : ""}`;
  return h(tag, { ...attrs, class: cls, style: nameColours(c1, c2, c3) }, name);
}

function personLink(name) {
  const page = PAGES[name];
  return nameTag(name, page ? "a" : "span", page ? { href: page } : {});
}

function favouriteLine(name) {
  const row = typeof favourites !== "undefined" && favourites[name];
  if (!row) return "<p>No favourite badge yet</p>";
  const [badge, c1, c2, c3] = row;
  const colours = `--c1:${c1};--c2:${c2 || c1};--c3:${c3 || c2 || c1}`;
  return `<p>Favourite badge</p><p class="tip-pill"><span class="pill"><span class="dot${c2 ? " blend" : ""}" style="${colours}"></span><span>${esc(badge)}</span></span></p>`;
}

// card tilt

function holdCard(card) {
  if (calm.matches) return;
  card.addEventListener("pointermove", (event) => {
    const box = card.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width;
    const y = (event.clientY - box.top) / box.height;
    card.classList.add("live");
    card.style.setProperty("--ry", `${(x - 0.5) * 14}deg`);
    card.style.setProperty("--rx", `${(0.5 - y) * 10}deg`);
  });
  card.addEventListener("pointerleave", () => {
    card.classList.remove("live");
    card.style.setProperty("--ry", "0deg");
    card.style.setProperty("--rx", "0deg");
  });
}

// search

function initSearch() {
  const form = document.querySelector(".search");
  if (!form || typeof directory === "undefined") return;
  const input = form.querySelector("input");
  const list = form.querySelector(".results");
  let items = [];
  let active = -1;

  function render() {
    const q = input.value.trim().toLowerCase();
    list.replaceChildren();
    items = [];
    active = -1;
    if (!q) {
      list.hidden = true;
      return;
    }
    const rank = (name) => (name.toLowerCase().startsWith(q) ? 0 : 1);
    const maps = directory.maps.filter((m) => m[0].toLowerCase().includes(q)).sort((a, b) => rank(a[0]) - rank(b[0]));
    const players = directory.players.filter((p) => p[0].toLowerCase().includes(q)).sort((a, b) => rank(a[0]) - rank(b[0]));
    const rows = [...maps.slice(0, 4).map((m) => ({ map: m })), ...players.slice(0, 8 - Math.min(4, maps.length)).map((p) => ({ player: p }))];
    if (!rows.length) {
      list.append(h("span", { class: "off" }, `Nothing called "${input.value.trim()}"`));
      list.hidden = false;
      return;
    }
    for (const row of rows) {
      const name = row.map ? row.map[0] : row.player[0];
      const page = PAGES[name];
      const extra = row.map
        ? h("small", {}, `${row.map[1]}${row.map[3] ? `, ${plural(row.map[3], "victor")}` : ""}`)
        : h("small", {}, COUNTRIES[row.player[1]] || (row.player[1] || "").toUpperCase());
      const label = row.map ? name : nameTag(name);
      const lead = row.map ? (sword(tierOf(row.map[2]), "sword") || h("span", { class: "sword" })) : flag(row.player[1]) || h("span", { class: "flag" });
      const item = page
        ? h("a", { href: page, role: "option" }, lead, label, extra)
        : h("span", { class: "off", role: "option", title: "Not part of this mockup" }, lead, label, extra);
      items.push(item);
      list.append(item);
    }
    list.hidden = false;
  }

  function move(step) {
    if (!items.length) return;
    items[active]?.classList.remove("active");
    active = (active + step + items.length) % items.length;
    items[active].classList.add("active");
  }

  input.addEventListener("input", render);
  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") { event.preventDefault(); move(1); }
    if (event.key === "ArrowUp") { event.preventDefault(); move(-1); }
    if (event.key === "Escape") { input.value = ""; render(); }
    if (event.key === "Enter") {
      event.preventDefault();
      const pick = items[active] || items.find((item) => item.href);
      if (pick && pick.href) location.href = pick.href;
    }
  });
  document.addEventListener("click", (event) => {
    if (!form.contains(event.target)) list.hidden = true;
  });
  input.addEventListener("focus", render);
}

const BANDS = [[185, 10], [175, 9], [160, 8], [142, 7], [125, 6], [109, 5], [87, 4], [59, 3], [34, 2], [0, 1]];

function tierOf(n) {
  if (n == null) return null;
  return BANDS.find(([min]) => n >= min)[1];
}

function initMenu() {
  const button = document.querySelector(".menu");
  if (!button) return;
  const nav = button.closest("nav");
  button.addEventListener("click", () => {
    const open = !nav.classList.contains("open");
    nav.classList.toggle("open", open);
    button.setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("click", (event) => {
    if (!nav.contains(event.target)) {
      nav.classList.remove("open");
      button.setAttribute("aria-expanded", "false");
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  document.body.append(tooltip);
  initSearch();
  initMenu();
});
