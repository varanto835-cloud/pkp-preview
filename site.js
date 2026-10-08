const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
const TIER_NAMES = ["", "Mossy Oak", "Stone", "Oxidised Copper", "Knight Iron", "Royal Gold", "Amethyst",
  "Infernal Netherite", "Sapphire", "Emerald", "Demon Blade"];
const MODE_LETTER = { Rankup: "R", Segmented: "S", Onlysprint: "O", Miscellaneous: "M" };
const COUNTRIES = {
  ar: "Argentina", at: "Austria", au: "Australia", az: "Azerbaijan", br: "Brazil", ca: "Canada", ch: "Switzerland",
  cn: "China", cz: "Czechia", de: "Germany", dk: "Denmark", ec: "Ecuador", ee: "Estonia", es: "Spain", fi: "Finland",
  fm: "Micronesia", fr: "France", gb: "United Kingdom", gr: "Greece", hk: "Hong Kong", hr: "Croatia", hu: "Hungary",
  id: "Indonesia", ie: "Ireland", il: "Israel", it: "Italy", jo: "Jordan", jp: "Japan", kr: "South Korea", kz: "Kazakhstan", la: "Laos",
  md: "Moldova", my: "Malaysia", nl: "Netherlands", no: "Norway", pe: "Peru", ph: "Philippines", pl: "Poland", ps: "Palestine", pt: "Portugal",
  ro: "Romania", rs: "Serbia", ru: "Russia", se: "Sweden", sg: "Singapore", sk: "Slovakia", th: "Thailand", tw: "Taiwan",
  ua: "Ukraine", us: "United States",
};
const PAGES = { wlatr: "profile.html", "Magnum Opus": "map.html" };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// Animations always play, whatever the system setting says: many people switch it off only to
// make Windows feel faster, and then never see the podium (the user's call, 2026-10-06). A
// setting to turn them off will come with the site's settings; it will be kept in this browser.
const calm = { matches: stored("pkp-calm") === "1" };
document.documentElement.classList.toggle("calm", calm.matches);

function stored(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

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

// Some days the bot never recorded: progress imported on the first day of the history, and badges
// only known to be held by the day of a later step or of the victory. They read as plain dates
// with a small star that says why (Deciron found "by" and "or earlier" confusing).
function exact(iso, by) {
  return Boolean(iso) && !by && iso !== HISTORY_START;
}

function when(iso, by) {
  if (!iso) return "date not recorded";
  return exact(iso, by) ? date(iso) : `${date(iso)}*`;
}

function whyStar(iso, by) {
  return by
    ? `<b>Exact day not recorded</b><p>The bot only knows it was held by ${date(iso)}, the day of a later step or of the victory.</p>`
    : `<b>Exact day not recorded</b><p>Progress from before ${date(HISTORY_START)} was imported on that day, so it may be older.</p>`;
}

function dayOf(iso, by) {
  // short, so a tile label or a list cell with no date keeps its width
  if (!iso) return "no date";
  if (exact(iso, by)) return date(iso);
  return h("span", { class: "day" }, date(iso), tip(h("span", { class: "star", role: "img", "aria-label": "exact day not recorded" }, "*"), () => whyStar(iso, by)));
}

// the line under a list that has starred days
function starNote() {
  return h("p", { class: "star-note dim" }, "* Exact day not recorded: held by then, maybe earlier.");
}

function plural(n, word, many = word + "s") {
  return `${n} ${n === 1 ? word : many}`;
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

// grey face for players with no skin, like the game's empty one
const NO_FACE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAJklEQVR42mMMDQ1lwAZYGBgYzMzM0ERPnTrFxIAD0EOCBeIGTAkA0KwGcUOafBcAAAAASUVORK5CYII=";

// faces load only when they come near the screen
function head(name) {
  return h("img", {
    class: "head", src: asset(`assets/face/${name.toLowerCase()}.png`), width: 8, height: 8, alt: "", loading: "lazy", decoding: "async",
    onerror: (event) => {
      event.currentTarget.src = NO_FACE;
    },
  });
}

function tile(tag, attrs, art, tier, mark) {
  return h(tag, { ...attrs, class: `tile t${tier || 0}`, style: `--art:url("${asset(art)}")` },
    mark ? h("span", { class: "tile-mark" }, icon(mark)) : null,
    tier ? h("span", { class: "tile-tier" }, socket(tier)) : null);
}

// lighten dark role colours so names stay readable
// the same badge colours come back on many names, so each is worked out once
const legibleSeen = new Map();

function legible(hex) {
  if (!legibleSeen.has(hex)) legibleSeen.set(hex, lift(hex));
  return legibleSeen.get(hex);
}

// A dark badge colour is raised until it reads on the dark page (relative luminance 0.24,
// about 4.5:1 on the windows). Only its lightness goes up, in OKLCH where lightness and colour
// are kept apart: the hue stays, and a dark but vivid colour keeps all its saturation, so a
// dark red becomes a bright red, not a pink. A colour near black shows little of its hue, so it
// keeps only the colour it really has and stays a tinted grey.
function lift(hex) {
  const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  if (luminance(rgb) >= 0.24) return hex;
  const [l, a, b] = toOklab(rgb);
  const hue = Math.atan2(b, a);
  const chroma = Math.hypot(a, b);
  const share = Math.min(1, chroma / Math.max(1e-6, maxChroma(l, hue)));
  const vivid = Math.min(1, Math.max(0, (l - 0.1) / 0.2));
  let low = l;
  let high = 1;
  let best = [1, 1, 1];
  for (let step = 0; step < 18; step++) {
    const mid = (low + high) / 2;
    const shown = inGamut(mid, chroma + (share * maxChroma(mid, hue) - chroma) * vivid, hue);
    if (luminance(shown) >= 0.24) {
      high = mid;
      best = shown;
    } else {
      low = mid;
    }
  }
  return `#${best.map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("")}`;
}

function maxChroma(L, hue) {
  let low = 0;
  let high = 0.4;
  for (let step = 0; step < 16; step++) {
    const c = (low + high) / 2;
    if (fromOklab([L, c * Math.cos(hue), c * Math.sin(hue)]).every((x) => x >= 0 && x <= 1)) low = c;
    else high = c;
  }
  return low;
}

function luminance(rgb) {
  return rgb.reduce((sum, c, i) => sum + linear(c) * [0.2126, 0.7152, 0.0722][i], 0);
}

function linear(c) {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function gamma(c) {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
}

function toOklab(rgb) {
  const [r, g, b] = rgb.map(linear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function fromOklab([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

// the colour at this lightness, with chroma cut back only as far as the screen needs
function inGamut(L, chroma, hue) {
  let low = 0;
  let high = chroma;
  let fit = fromOklab([L, 0, 0]);
  for (let step = 0; step < 14; step++) {
    const c = (low + high) / 2;
    const rgb = fromOklab([L, c * Math.cos(hue), c * Math.sin(hue)]);
    if (rgb.every((v) => v >= 0 && v <= 1)) {
      low = c;
      fit = rgb;
    } else {
      high = c;
    }
  }
  const full = fromOklab([L, chroma * Math.cos(hue), chroma * Math.sin(hue)]);
  return (full.every((v) => v >= 0 && v <= 1) ? full : fit).map((v) => gamma(Math.min(1, Math.max(0, v))));
}

function oklchOf(hex) {
  const [l, a, b] = toOklab([1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255));
  return { l, c: Math.hypot(a, b), h: Math.atan2(b, a) };
}

function hexOf(rgb) {
  return `#${rgb.map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("")}`;
}

// A badge colour close to black has almost no hue left once it is made readable, so it turns
// grey. In a gradient it borrows the hue of the badge's most vivid colour instead, at its own
// lightness: a black to violet badge reads as two violets, not grey to violet.
const shownSeen = new Map();

function shownColours(c1, c2, c3) {
  const key = `${c1}${c2}${c3}`;
  if (shownSeen.has(key)) return shownSeen.get(key);
  const shown = [c1, c2 || c1, c3 || c2 || c1].map(legible);
  const lch = shown.map(oklchOf);
  const vivid = lch.reduce((a, b) => (b.c > a.c ? b : a));
  const out = shown.map((hex, i) => (lch[i].c < 0.05 && vivid.c > 0.1 ? legible(hexOf(inGamut(lch[i].l, vivid.c * 0.7, vivid.h))) : hex));
  shownSeen.set(key, out);
  return out;
}

function nameColours(c1, c2, c3) {
  const [a, b, c] = shownColours(c1, c2, c3);
  return `--c1:${a};--c2:${b};--c3:${c}`;
}

// a tooltip heading takes the most vivid of the badge's readable colours
function headingColour(c1, c2, c3) {
  if (!c1) return "#fff";
  return shownColours(c1, c2, c3).reduce((a, b) => (oklchOf(b).c > oklchOf(a).c ? b : a));
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

// the world behind the page can change to another map's screenshot: the new picture loads first,
// then fades in over the old one, and a bright screenshot gets a thicker veil
let worldNow = "";

function veil(light) {
  const top = Math.max(0.66, 1 - 0.03 / (light || 0.03));
  const bottom = Math.max(0.84, 1 - 0.015 / (light || 0.015));
  return `--veil-top: rgba(16, 16, 16, ${top.toFixed(2)}); --veil-bottom: rgba(16, 16, 16, ${bottom.toFixed(2)})`;
}

function setWorld(slug, light) {
  if (!slug || slug === worldNow) return;
  const first = !worldNow;
  worldNow = slug;
  const old = [...document.querySelectorAll(".world")];
  const next = h("div", { class: "world fresh", style: `--world: url('${asset(`assets/world/${slug}.jpg`)}'); ${veil(light)}` });
  document.body.prepend(next);
  const done = () => old.forEach((w) => w.remove());
  if (first || calm.matches) {
    next.classList.remove("fresh");
    done();
    return;
  }
  // wait for the picture so the swap never flashes the bare night
  const img = new Image();
  img.onload = img.onerror = () => {
    requestAnimationFrame(() => next.classList.remove("fresh"));
    setTimeout(done, 700);
  };
  img.src = asset(`assets/world/${slug}.jpg`);
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

// "by antoultrav" types itself under the brand, a letter at a time like the game's chat, with
// its blinking underscore; it runs as soon as this file loads, so the bar has its height before
// any page measures it
function initByline() {
  const brand = document.querySelector(".brand");
  if (!brand) return;
  const text = "by antoultrav";
  if (calm.matches) {
    brand.append(h("span", { class: "byline" }, text));
    return;
  }
  const typed = h("span", {});
  const caret = h("span", { class: "caret", "aria-hidden": "true" }, "_");
  brand.append(h("span", { class: "byline", "aria-label": text }, typed, caret));
  let shown = 0;
  const next = () => {
    shown += 1;
    typed.textContent = text.slice(0, shown);
    if (shown < text.length) setTimeout(next, text[shown] === " " ? 160 : 60 + Math.random() * 70);
    else setTimeout(() => caret.remove(), 1800);
  };
  setTimeout(next, 450);
}

initByline();

document.addEventListener("DOMContentLoaded", () => {
  document.body.append(tooltip);
  initSearch();
  initMenu();
});
