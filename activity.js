const PERIODS = [[7, "7 days", "Last 7 days"], [30, "30 days", "Last 30 days"], [183, "6 months", "Last 6 months"]];
const SHOWS = [["all", "All"], ["big", "Big moments"], ["victories", "Victories"], ["progress", "Progress"]];
const MODES = [["All", "All"], ["Rankup", "Rankup"], ["Segmented", "Segmented"], ["Onlysprint", "Onlysprint"], ["Miscellaneous", "Misc"]];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const XP_TITLE = { v: "Challenge Complete!", t: "Goal Reached!", r: "Goal Reached!", s: "Advancement Made!", m: "New Map!" };
// the site will keep each visitor's last visit in their browser; the mockup fixes it on this day
const LAST_VISIT = "2026-09-16";

let state = readUrl();

function readUrl() {
  const q = new URLSearchParams(location.search);
  const days = Number(q.get("days"));
  return {
    days: PERIODS.some(([d]) => d === days) ? days : 30,
    show: SHOWS.some(([s]) => s === q.get("show")) ? q.get("show") : "all",
    mode: MODES.some(([m]) => m === q.get("mode")) ? q.get("mode") : "All",
    country: q.get("country") || "",
    find: q.get("find") || "",
  };
}

// a tier run finished in one go (III, IV and V on the same day) reads as one line
const events = [];
for (const e of activityEvents) {
  const last = events[events.length - 1];
  if (e.k === "t" && last && last.k === "t" && last.d === e.d && last.p === e.p && last.mode === e.mode) {
    last.tiers.push(e.tier);
    last.tier = Math.max(last.tier, e.tier);
    continue;
  }
  events.push(e.k === "t" ? { ...e, tiers: [e.tier] } : e);
}
events.forEach((e, i) => {
  e.id = `e${i}`;
  if (e.tiers) e.tiers.sort((a, b) => a - b);
});

// helpers

function shift(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function dayName(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(`${iso}T00:00:00Z`).getUTCDay()];
  const year = iso.slice(0, 4) === activityEnd.slice(0, 4) ? "" : ` ${y}`;
  return `${weekday} ${d} ${MONTHS[m - 1]}${year}`;
}

function shortDay(iso) {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

function ordinal(n) {
  const tail = n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th";
  return `${n}${tail}`;
}

function listed(words) {
  return words.length < 2 ? words.join("") : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

function badgeOf(id) {
  const row = id == null ? null : activityBadges[id];
  if (!row) return null;
  const colours = row.slice(1, -1);
  return { name: row[0], color: colours[0], end: colours[1], third: colours[2], page: row[row.length - 1] };
}

function mapOf(e) {
  return e.m ? activityMaps[e.m] : null;
}

function modeOf(e) {
  if (e.k === "t") return e.mode;
  if (e.k === "r") return null;
  return mapOf(e) ? mapOf(e).mode : null;
}

// a step's "l/d" notes and SP or CP ranges stay in the tooltip
function shortStep(step) {
  return step.replace(/\s*\((?:[^)]*l\/d[^)]*|(?:SP|CP) ?\d[^)]*)\)/gi, "").trim() || step;
}

function isBig(e) {
  if (e.k === "t" || e.k === "r" || e.k === "m") return true;
  if (e.k === "v") return e.n === 1 || e.tier >= 8;
  return Boolean(e.far) || e.tier >= 9;
}

// which moments become toasts: firsts, tiers and the EXP top three before the rest
function weight(e) {
  const t = e.tier || 0;
  if (e.k === "v") return e.n === 1 ? 100 + t : t >= 8 ? 60 + t : 20 + t;
  if (e.k === "t") return 90 + t;
  if (e.k === "r") return e.rank === 1 ? 95 : e.rank <= 3 ? 85 : 60 - e.rank;
  if (e.k === "m") return 80;
  return e.far ? 70 + t : t >= 9 ? 50 + t : 10 + t;
}

function since() {
  return shift(activityEnd, 1 - state.days);
}

function matches(e, q) {
  return [e.p, e.m, ...(e.passed || [])].some((name) => name && name.toLowerCase().includes(q));
}

function visible(e) {
  if (e.d < since()) return false;
  if (state.show === "victories" && e.k !== "v") return false;
  if (state.show === "progress" && e.k !== "s") return false;
  if (state.show === "big" && !isBig(e)) return false;
  if (state.mode !== "All" && modeOf(e) !== state.mode) return false;
  if (state.country && (!e.p || activityCountry[e.p] !== state.country)) return false;
  const q = state.find.trim().toLowerCase();
  return !q || matches(e, q);
}

// the subject of a line, in [brackets] and in its badge colours, as the game prints an advancement

function paintStyle(badge) {
  return badge ? nameColours(badge.color, badge.end, badge.third) : "";
}

function bracket(text, badge, href, build) {
  const attrs = {
    class: badge ? `bk name${badge.end ? " blend" : ""}${badge.third ? " holo" : ""}` : "bk plain",
    style: paintStyle(badge),
  };
  if (href) attrs.href = href;
  return tip(h(href ? "a" : "span", attrs, bracketText(text)), build);
}

// the step after the bar never breaks away from the word before it
function bracketText(text) {
  const cut = text.lastIndexOf(" | ");
  if (cut < 0) return withFlags(`[${text}]`);
  const head = text.slice(0, cut);
  const space = head.lastIndexOf(" ") + 1;
  return [withFlags(`[${head.slice(0, space)}`), h("span", { class: "nowrap" }, withFlags(`${head.slice(space)} | ${text.slice(cut + 3)}]`))];
}

// a map's badges carry the name the community uses for it ("ROC SP Mode")
function shortMap(e, badge) {
  return badge && badge.name.includes(" | ") ? badge.name.split(" | ")[0] : e.m;
}

function tierColour(tier) {
  return getComputedStyle(document.documentElement).getPropertyValue(`--t${tier}`).trim();
}

function tierBracket(tier) {
  return tip(h("span", { class: "bk name", style: nameColours(tierColour(tier)) }, `[Tier ${ROMAN[tier]} ${TIER_NAMES[tier]}]`), () => tierTip(tier));
}

function badgeHrefOf(badge) {
  return badge && badge.page ? badgeHref(badge.name) : null;
}

function pillHtml(badge) {
  const colours = `--c1:${badge.color};--c2:${badge.end || badge.color};--c3:${badge.third || badge.end || badge.color}`;
  return `<p class="tip-pill"><span class="pill"><span class="dot${badge.end ? " blend" : ""}" style="${colours}"></span><span>${esc(badge.name)}</span></span></p>`;
}

function headColour(badge) {
  return badge ? headingColour(badge.color, badge.end, badge.third) : "#fff";
}

function modeTier(mode, tier) {
  return `${mode}, ${tier ? tierText(tier) : "no tier yet"}`;
}

function victoryTip(e) {
  const badge = badgeOf(e.b);
  const map = mapOf(e);
  const parts = [
    `<b style="color:${headColour(badge)}">${esc(e.m)}</b>`,
    `<p>${esc(modeTier(map.mode, e.tier))}</p>`,
    `<p>${e.n === 1 ? "First victory ever" : `${ordinal(e.n)} of ${e.of} victors`}</p>`,
  ];
  if (e.fails != null) parts.push(`<p>${plural(e.fails, `${e.at} fail`)}</p>`);
  if (e.gain) parts.push(`<p>+${e.gain} EXP for ${esc(e.p)}</p>`);
  parts.push(`<p>Beaten on ${date(e.d)}</p>`);
  parts.push(badge ? `<p>Badge</p>${pillHtml(badge)}` : "<p>No victor badge yet</p>");
  if (badge && badge.page) parts.push('<p class="hint">Click for the badge page</p>');
  return parts.join("");
}

function stepTip(e) {
  const badge = badgeOf(e.b);
  const map = mapOf(e);
  const parts = [
    `<b style="color:${headColour(badge)}">${esc(e.m)} | ${esc(stripFlags(e.step))}</b>`,
    `<p>${esc(modeTier(map.mode, e.tier))}</p>`,
    `<p>${e.far ? "The furthest anyone has gone" : `Reached by ${plural(e.reached, "player")} so far`}</p>`,
  ];
  if (e.gain) parts.push(`<p>+${e.gain} EXP for ${esc(e.p)}</p>`);
  parts.push(`<p>Reached on ${date(e.d)}</p>`);
  if (badge) parts.push(`<p>${e.new ? "New badge at this step" : "Badge held on this map"}</p>${pillHtml(badge)}`);
  else parts.push("<p>No badge on this map yet</p>");
  if (badge && badge.page) parts.push('<p class="hint">Click for the badge page</p>');
  return parts.join("");
}

function mapTip(e) {
  const badge = badgeOf(e.b);
  const map = mapOf(e);
  return [
    `<b style="color:${headColour(badge)}">${esc(e.m)}</b>`,
    `<p>${esc(modeTier(map.mode, e.tier))}</p>`,
    `<p>Released on ${date(e.d)}</p>`,
    `<p>Built by ${esc(e.builder)}</p>`,
    `<p>${map.victors ? `${plural(map.victors, "victor")} by ${date(activityEnd)}` : "Still unbeaten"}</p>`,
  ].join("");
}

function tierTip(tier) {
  return `<b style="color:${legible(tierColour(tier))}">${esc(tierText(tier))}</b><p>Own every Tier ${ROMAN[tier]} badge in a gamemode to complete it. Higher badges on the same map count too.</p>`;
}

function personTip(name) {
  const code = activityCountry[name];
  return `<b>${esc(name)}</b><p>${esc(COUNTRIES[code] || "Country not set")}</p>${favouriteLine(name)}`;
}

function who(name) {
  return h("span", { class: "who" }, head(name), tip(personLink(name), () => personTip(name)), flag(activityCountry[name]));
}

function crowned(text) {
  return h("span", { class: "act-note crowned" }, icon("crown", "first"), text);
}

function note(text) {
  return h("span", { class: "act-note" }, text);
}

// the frame tells the kind, as in the game: spikes for a challenge (a victory), cut corners for a
// goal (a tier or a climb), a plain slot for the rest
const FRAME = { v: "challenge", t: "goal", r: "goal" };

// the frame is drawn around the slot, which stays as it is; an empty slot gets no frame
function framed(e, box) {
  return FRAME[e.k] && box.childNodes.length ? h("span", { class: `kind ${FRAME[e.k]}` }, box) : box;
}

function modeSlot(mode, what) {
  const label = `${mode || "No gamemode"}, no difficulty value yet`;
  return tip(h("span", { class: "socket mode", role: "img", "aria-label": label, tabindex: "-1" }, MODE_LETTER[mode] || "-"),
    () => `<b>${esc(mode || "No gamemode")}</b><p>No tier yet: this ${what} has no difficulty value.</p>`);
}

function lead(e) {
  if (e.k === "r") return framed(e, h("span", { class: "socket" }, icon("arrow", "up")));
  if (!e.tier) return framed(e, modeSlot(modeOf(e), e.k === "v" || e.k === "m" ? "map" : "step"));
  const box = h("span", { class: "socket" }, sword(e.tier, "sword small"));
  // a big moment's sword shines like an enchanted item: a violet copy of it, shown through a moving band
  if (isBig(e)) {
    box.classList.add("glint");
    box.append(h("img", { class: "sheen", src: asset(`assets/tier/tier${e.tier}.png`), alt: "" }));
  }
  return framed(e, box);
}

function sentence(e) {
  const badge = badgeOf(e.b);
  if (e.k === "v") {
    const bits = [who(e.p), " beat ", bracket(e.m, badge, badgeHrefOf(badge), () => victoryTip(e))];
    const notes = [];
    if (e.fails != null) notes.push(plural(e.fails, `${e.at} fail`));
    if (e.n === 1) bits.push(" ", crowned(["first victory ever", ...notes].join(", ")));
    else bits.push(" ", note([`${ordinal(e.n)} victor`, ...notes].join(", ")));
    return bits;
  }
  if (e.k === "s") {
    const text = e.new && badge ? badge.name : `${shortMap(e, badge)} | ${shortStep(e.step)}`;
    const bits = [who(e.p), e.new && badge ? " earned " : " reached ", bracket(text, badge, badgeHrefOf(badge), () => stepTip(e))];
    if (e.new && badge) bits.push(" ", note(["at ", h("span", { class: "nowrap" }, withFlags(shortStep(e.step)))]));
    if (e.far) bits.push(" ", crowned("furthest anyone has gone"));
    if (e.first) bits.push(" ", note("first step on record"));
    return bits;
  }
  if (e.k === "t") {
    const tiers = e.tiers.map((t) => tierBracket(t));
    const joined = tiers.flatMap((t, i) => (i === 0 ? [t] : [i === tiers.length - 1 ? " and " : ", ", t]));
    return [who(e.p), " completed ", ...joined, ` in ${e.mode}`];
  }
  if (e.k === "r") {
    const rank = h("strong", { class: e.rank === 1 ? "act-rank top" : "act-rank" }, e.rank === 1 ? icon("crown", "first") : null, `#${e.rank}`);
    const bits = [who(e.p), " climbed to ", rank, " by EXP"];
    if (e.passed.length) {
      const names = e.passed.slice(0, 2).map((n) => tip(personLink(n), () => personTip(n)));
      const more = e.passed.length > 2 ? [`${e.passed.length - 2} more`] : [];
      const all = [...names, ...more];
      bits.push(" ", h("span", { class: "act-note" }, "passing ", ...all.flatMap((n, i) => (i === 0 ? [n] : [i === all.length - 1 ? " and " : ", ", n]))));
    }
    return bits;
  }
  return [bracket(e.m, badge, null, () => mapTip(e)), " was released, built by ", h("span", { class: "builder" }, e.builder)];
}

function gainOf(e) {
  if (e.k === "r") return h("span", { class: "act-exp total" }, `${e.exp} EXP`);
  if (e.gain > 0) return h("span", { class: "act-exp" }, `+${e.gain} EXP`);
  return null;
}

// line screenshots are small copies, loaded only when their line comes near the screen
const shots = "IntersectionObserver" in window ? new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    entry.target.style.setProperty("--art", entry.target.dataset.art);
    shots.unobserve(entry.target);
  }
}, { rootMargin: "400px 0px" }) : null;

function shotOf(e) {
  const map = mapOf(e);
  if ((e.k !== "v" && e.k !== "m") || !map || !map.tile) return null;
  const art = `url("${asset(`assets/tile/thumb_${map.tile}.jpg`)}")`;
  // only the frame: at this size the tier socket would cover the picture
  const frame = h("span", { class: `tile t${e.tier || 0}`, style: "--art: none", "data-art": art });
  if (shots) shots.observe(frame);
  else frame.style.setProperty("--art", art);
  return h("span", { class: "shot" }, frame);
}

function line(e) {
  return h("li", { class: `act-line${isBig(e) ? " big" : ""}`, id: e.id }, lead(e), h("p", { class: "act-text" }, sentence(e)), shotOf(e), gainOf(e));
}

// the log, a day at a time; the first days are built at once, the rest in the gaps between frames

const later = window.requestIdleCallback
  ? (job) => requestIdleCallback(job, { timeout: 120 })
  : (job) => setTimeout(() => job({ timeRemaining: () => 8 }), 16);
let filling = null;

function countsOf(list) {
  const count = (k) => list.filter((e) => e.k === k).length;
  const parts = [];
  if (count("v")) parts.push(plural(count("v"), "victory", "victories"));
  if (count("s")) parts.push(plural(count("s"), "step"));
  const tiers = list.filter((e) => e.k === "t").reduce((n, e) => n + e.tiers.length, 0);
  if (tiers) parts.push(plural(tiers, "tier"));
  if (count("r")) parts.push(plural(count("r"), "climb"));
  if (count("m")) parts.push(plural(count("m"), "new map"));
  return parts.join(", ");
}

function renderLog(shown) {
  const log = document.getElementById("log");
  if (filling) filling.stop();
  if (!shown.length) {
    renderEmpty(log);
    return;
  }
  const days = [];
  for (const e of shown) {
    if (!days.length || days[days.length - 1].d !== e.d) days.push({ d: e.d, list: [] });
    days[days.length - 1].list.push(e);
  }
  const frag = document.createDocumentFragment();
  const queue = [];
  let built = 0;
  const fresh = shown.filter((e) => e.d > LAST_VISIT).length;
  const visit = shortDay(LAST_VISIT);
  let marked = false;
  let marker = null;
  const mark = () => {
    marked = true;
    marker = h("p", { class: "seen-bar", tabindex: "-1" }, fresh ? icon("arrow", "up") : null,
      fresh ? `${fresh} new since your last visit on ${visit}` : nothingNew(visit));
    frag.append(marker);
  };
  if (!fresh) mark();
  else if (fresh > 4) {
    // the answer to "what is new" stays in the first screen, and leads down to the marker
    // when the marker itself is further down than a few lines
    frag.append(h("div", { class: "seen-top" },
      h("span", {}, `${fresh} new since your last visit on ${visit}`),
      h("button", { class: "button", type: "button", onclick: () => marker.scrollIntoView({ block: "center", behavior: calm.matches ? "auto" : "smooth" }) }, "Jump to your last visit")));
  }
  for (const day of days) {
    if (!marked && day.d <= LAST_VISIT) mark();
    const lines = h("ol", { class: "act-lines" });
    const isNew = day.d > LAST_VISIT;
    frag.append(h("section", { class: `act-day${isNew ? " new" : ""}`, "aria-label": dayName(day.d) },
      h("h2", { class: "day-bar" }, h("span", {}, dayName(day.d), isNew ? h("span", { class: "new-tag" }, "New") : null), h("span", { class: "dim" }, countsOf(day.list))),
      lines));
    for (const e of day.list) {
      if (built < 50) lines.append(line(e));
      else queue.push([lines, e]);
      built++;
    }
  }
  if (!marked) mark();
  log.replaceChildren(frag);
  renderNews(fresh, marker, visit);
  let stopped = false;
  const step = (deadline) => {
    if (stopped) return;
    while (queue.length && deadline.timeRemaining() > 2) {
      const [lines, e] = queue.shift();
      lines.append(line(e));
    }
    if (queue.length) later(step);
    else filling = null;
  };
  filling = {
    stop: () => { stopped = true; },
    finish: () => {
      stopped = true;
      while (queue.length) {
        const [lines, e] = queue.shift();
        lines.append(line(e));
      }
      filling = null;
    },
  };
  if (queue.length) later(step);
  else filling = null;
}

// on phones the moment fills the first screen, so the count of what is new sits above it
function renderNews(fresh, marker, visit) {
  const news = document.getElementById("news");
  const jump = h("button", { class: "button", type: "button", onclick: () => marker.scrollIntoView({ block: "center", behavior: calm.matches ? "auto" : "smooth" }) }, "Jump to your last visit");
  news.replaceChildren(h("span", {}, fresh ? `${fresh} new since your last visit on ${visit}` : nothingNew(visit)), fresh ? jump : null);
}

// with a filter on, "nothing new" would hide that other things did happen
function nothingNew(visit) {
  const what = { big: "No big moments", victories: "No victories", progress: "No progress" }[state.show];
  if (what) return `${what} since your last visit on ${visit}`;
  if (state.mode !== "All" || state.country || state.find.trim()) return `Nothing that matches since your last visit on ${visit}`;
  return `Nothing new since your last visit on ${visit}`;
}

function renderEmpty(log) {
  document.getElementById("news").replaceChildren();
  const label = PERIODS.find(([d]) => d === state.days)[2].toLowerCase();
  const q = state.find.trim();
  const what = q ? `Nothing for "${q}"` : "Nothing here";
  const wider = state.days < 183 ? h("button", { class: "button", type: "button", onclick: () => go({ days: 183 }) }, "Show 6 months") : null;
  const clear = h("button", { class: "button", type: "button", onclick: () => go({ show: "all", mode: "All", country: "", find: "" }) }, "Clear the filters");
  log.replaceChildren(h("div", { class: "act-empty" },
    h("p", { class: "big" }, `${what} in the ${label}.`),
    h("p", { class: "dim" }, "Try a longer period, or fewer filters."),
    h("div", { class: "actions" }, wider, clear)));
}

// toasts: the three biggest moments slide in from the right, as the game shows an advancement

function toastLead(e) {
  if (e.k === "r") return framed(e, h("span", { class: "socket" }, icon("arrow", "up")));
  if (e.tier) return framed(e, h("span", { class: "socket" }, sword(e.tier, "sword small")));
  if (e.p) return framed(e, h("span", { class: "socket" }, head(e.p)));
  return h("span", { class: "socket" });
}

function toastMain(e) {
  const badge = badgeOf(e.b);
  const paint = (text, b) => h("span", { class: b ? `name${b.end ? " blend" : ""}` : "", style: paintStyle(b) }, text);
  if (e.k === "v" || e.k === "m") return paint(e.m, badge);
  if (e.k === "s") return paint(withFlags(`${shortMap(e, badge)} | ${shortStep(e.step)}`), badge);
  if (e.k === "t") return h("span", { class: "name", style: nameColours(tierColour(e.tier)) }, `Tier ${ROMAN[e.tier]} ${TIER_NAMES[e.tier]}`);
  return h("span", {}, `#${e.rank} by EXP`);
}

function toastWhat(e) {
  if (e.k === "v") return `${e.p}, ${e.n === 1 ? "first victory ever" : `${ordinal(e.n)} victor`}`;
  if (e.k === "s") return `${e.p}, ${e.far ? "furthest anyone has gone" : `reached by ${e.reached}`}`;
  if (e.k === "t") return `${e.p} completed it in ${e.mode}`;
  if (e.k === "r") return `${e.p}${e.passed.length ? `, passing ${e.passed[0]}` : ""}`;
  return `Built by ${e.builder}`;
}

function toastSub(e) {
  return [`${toastWhat(e)}, `, h("span", { class: "nowrap" }, shortDay(e.d))];
}

function jumpTo(e) {
  if (filling) filling.finish();
  const row = document.getElementById(e.id);
  if (!row) return;
  row.scrollIntoView({ block: "center", behavior: calm.matches ? "auto" : "smooth" });
  row.classList.remove("flash");
  void row.offsetWidth;
  row.classList.add("flash");
}

function toast(e, i) {
  const gain = e.gain > 0 ? h("span", { class: "act-exp" }, "+", `${e.gain} EXP`) : null;
  const button = h("button", {
    class: "toast", type: "button", style: `--i:${i}`, onclick: () => jumpTo(e),
    "aria-label": `${XP_TITLE[e.k]} ${toastWhat(e)}, ${shortDay(e.d)}. Show it in the log`,
  }, toastLead(e), h("span", { class: "toast-text" },
    h("span", { class: "toast-title" }, h("span", {}, XP_TITLE[e.k]), gain),
    h("span", { class: "toast-main" }, toastMain(e)),
    h("span", { class: "toast-sub dim" }, toastSub(e))));
  button.gain = gain;
  return button;
}

function renderToasts(list) {
  const box = document.getElementById("toasts");
  box.replaceChildren(...list.map((e, i) => toast(e, i + 1)));
  box.hidden = !list.length;
}

// the biggest moment, held up: the map's screenshot in its tier frame, and the player in 3D on a
// block of the tier's material in front of it, coming on in smoke and doing a move, as on the podium

const MOMENT_MOVE = { v: "flip", s: "spin" };
let momentViewer = null;
let momentRun = 0;

function getMomentViewer() {
  momentViewer ||= loadViewer().then(() => {
    const s = makeViewer(h("canvas", { class: "moment-figure", "aria-hidden": "true" }));
    new ResizeObserver(() => sizeMoment(s)).observe(s.canvas);
    return s;
  });
  return momentViewer;
}

function sizeMoment(s) {
  const box = s.canvas.getBoundingClientRect();
  const width = Math.round(box.width);
  const height = Math.round(box.height);
  if (width && height && (width !== s.width || height !== s.height)) {
    s.width = width;
    s.height = height;
    s.gl.setSize(width, height, false);
  }
  paintMoment(s);
}

function paintMoment(s) {
  const view = s.view;
  if (!view || !s.width) return;
  const camera = s.camera;
  camera.fov = 30;
  s.gl.setViewport(0, view.up * view.move.air * view.scale, s.width, view.tall);
  s.rim.intensity = view.rim ? 2.4 : 0;
  if (view.rim) s.rim.color.set(view.rim);
  // seen from a little below, as on the podium
  const far = 4.5 + 16.5 / Math.tan((15 * Math.PI) / 180) / view.zoom;
  camera.aspect = s.width / view.tall;
  camera.position.set(0, -Math.sin(0.16) * far, Math.cos(0.16) * far);
  camera.lookAt(0, 2, 0);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  s.gl.render(s.scene, camera);
}

// The game's experience bar: the green number is the player's place on the EXP board, and the
// bar shows how far they are from the player below to the player above, as the game shows the
// way to the next level. When the gain takes them past someone the bar fills, the number goes
// up, and the bar starts again from where they now are.
function xpTip(e) {
  const [from, to, , , above, gap, exp] = e.xp;
  const lines = [`<b>#${to} by EXP</b>`, `<p>${exp} EXP after this, on ${date(e.d)}</p>`];
  if (!from) lines.push("<p>Their first EXP on record</p>");
  else if (to < from) lines.push(`<p>Up from #${from}</p>`);
  if (!above) lines.push("<p>Nobody above</p>");
  else if (gap > 0) lines.push(`<p>${gap} EXP more to pass ${esc(above)}</p>`);
  else lines.push(`<p>Level with ${esc(above)}, who is placed above on the hardest badge, as the bot does</p>`);
  return lines.join("");
}

function xpText(e) {
  const [from, to, , , above, gap, exp] = e.xp;
  const climb = from && to < from ? `, up from #${from}` : "";
  const next = !above ? ", nobody above" : gap > 0 ? `, ${gap} EXP more to pass ${above}` : `, level with ${above}`;
  return `Now #${to} by EXP with ${exp} EXP${climb}${next}.`;
}

function xpBar(e) {
  const [from, to, start, end] = e.xp;
  const level = h("span", { class: "xp-level" }, `#${from || to}`);
  const fill = h("i", { style: `scale: ${from ? start : 0} 1` });
  const row = tip(h("span", { class: "xp-row", tabindex: "-1" }, level, h("span", { class: "xp-bar" }, fill)), () => xpTip(e));
  const settle = () => {
    level.textContent = `#${to}`;
    fill.style.scale = `${end} 1`;
  };
  row.settle = settle;
  row.play = () => {
    const ease = "cubic-bezier(0.16, 1, 0.3, 1)";
    if (!from || to >= from) {
      fill.animate([{ scale: `${from ? start : 0} 1` }, { scale: `${end} 1` }], { duration: 900, easing: ease });
      settle();
      return;
    }
    // passing someone: fill up, the number goes up, then fill again to where they are now
    fill.animate([{ scale: `${start} 1` }, { scale: "1 1" }], { duration: 450, easing: "ease-in", fill: "forwards" }).finished.then(() => {
      level.textContent = `#${to}`;
      level.animate([{ scale: 1 }, { scale: 1.4 }, { scale: 1 }], { duration: 320, easing: ease });
      fill.getAnimations().forEach((a) => a.cancel());
      fill.animate([{ scale: "0 1" }, { scale: `${end} 1` }], { duration: 600, easing: ease });
      fill.style.scale = `${end} 1`;
    });
  };
  return row;
}

// no 3D here (no WebGL), the face stands on the block
function flatMoment(spot, e, gain) {
  const face = head(e.p);
  face.classList.add("moment-head");
  spot.replaceChildren(face);
  spot.parentNode.classList.add("here");
  gain?.count?.();
}

async function stageMoment(e, spot, gain, run) {
  const name = e.p.toLowerCase();
  let s;
  let skin;
  try {
    s = await getMomentViewer();
    skin = await skinOf(name).then(picture);
  } catch {
    if (run === momentRun) flatMoment(spot, e, gain);
    return;
  }
  if (run !== momentRun) return;
  s.loadSkin(skin, { model: skinSlim.includes(name) ? "slim" : "default" });
  const kind = MOMENT_MOVE[e.k] || "spin";
  const move = MOVES[kind];
  const height = spot.clientHeight;
  const scale = height / 340;
  // the flip needs room to turn over, as on the podium: a taller frame, seen from further back
  const extra = (move.extra || 0) * scale;
  const tall = height + extra;
  s.view = { move, scale, tall, zoom: (0.9 * height) / tall, up: 0, rim: e.tier ? tierColour(e.tier) : "" };
  s.canvas.style.width = `${Math.round(440 * scale)}px`;
  s.canvas.style.height = `${Math.round(tall + move.air * scale)}px`;
  s.canvas.style.bottom = `${-Math.round(16 * scale + extra / 2)}px`;
  s.canvas.classList.remove("shown");
  if (!s.compiled) {
    s.gl.compile(s.scene, s.camera);
    await shadersReady(s);
    s.compiled = true;
    if (run !== momentRun) return;
  }
  const shadow = h("span", { class: "pose-shadow" });
  spot.replaceChildren(shadow, s.canvas);
  const end = move.length + LAG_MAX;
  const show = (ms) => {
    s.view.up = pose(s.playerObject, kind, ms);
    shadow.style.setProperty("--air", s.view.up.toFixed(3));
    sizeMoment(s);
  };
  if (calm.matches) {
    show(end);
    s.canvas.classList.add("shown");
    spot.parentNode.classList.add("here");
    gain?.count?.();
    return;
  }
  show(0);
  const art = spot.closest(".moment-art");
  const dust = [...(move.dust || [])];
  let orbsAt = move.orbs;
  let landed = false;
  let puffed = false;
  // it comes on once the toasts have started sliding in
  const t0 = performance.now() + 400;
  const step = (now) => {
    if (run !== momentRun) return;
    const since = now - t0;
    if (since >= 0) {
      if (!puffed) {
        puffed = true;
        smoke(art, spot.offsetLeft + spot.offsetWidth / 2, art.clientHeight - spot.offsetTop - spot.offsetHeight, height, scale * 1.6);
      }
      // the player shows once the smoke is thick
      if (since >= 120) {
        s.canvas.classList.add("shown");
        spot.parentNode.classList.add("here");
      }
      const ms = Math.min(since, end);
      show(ms);
      if (dust.length && ms >= dust[0]) {
        dust.shift();
        puff(spot);
      }
      if (orbsAt && ms >= orbsAt) {
        orbsAt = 0;
        orbs(spot, Math.round(move.orbCount * 0.7));
      }
      if (!landed && ms >= move.land) {
        landed = true;
        gain?.count?.();
      }
      if (ms >= end) return;
    }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function renderMoment(e) {
  const box = document.getElementById("moment");
  const run = ++momentRun;
  box.hidden = !e;
  if (!e) {
    box.replaceChildren();
    return;
  }
  const map = mapOf(e);
  const spot = h("span", { class: "moment-spot" });
  const tag = h("span", { class: "moment-tag" }, nameTag(e.p), flag(activityCountry[e.p]));
  const card = toast(e, 0);
  box.replaceChildren(
    h("div", { class: "moment-art" },
      tile("span", {}, `assets/tile/map_${map.tile}.jpg`, e.tier),
      e.tier
        ? h("span", { class: "moment-ledge", style: `--tex: url("${asset(`assets/gui/mat-${e.tier}.png`)}")` })
        : h("span", { class: "moment-ledge plain" }),
      spot,
      tag),
    card);
  const xp = e.xp && card.gain ? xpBar(e) : null;
  if (xp) {
    card.querySelector(".toast-text").append(xp);
    card.setAttribute("aria-label", card.getAttribute("aria-label").replace(". Show it", `. ${xpText(e)} Show it`));
  }
  if (card.gain && !calm.matches) {
    countUp(card.gain);
    // no "+0 EXP" while the player is still in the air; the bar moves when the gain counts
    const count = card.gain.count;
    card.gain.classList.add("waiting");
    card.gain.count = () => {
      card.gain.classList.remove("waiting");
      count();
      xp?.play();
    };
  } else {
    xp?.settle();
  }
  stageMoment(e, spot, card.gain, run);
}

// the scoreboard: totals for what the log shows, then who gained most and where it happened

function scoreList(rows) {
  return h("ul", { class: "score-rows" }, rows);
}

function renderTotals(shown) {
  const period = PERIODS.find(([d]) => d === state.days)[2];
  const count = (k) => shown.filter((e) => e.k === k).length;
  const players = new Set(shown.filter((e) => e.p && e.k !== "r").map((e) => e.p)).size;
  const rows = [
    ["Victories", count("v")],
    ["Steps", count("s")],
    ["New badges", shown.filter((e) => e.k === "s" && e.new && e.b != null).length],
    ["Tiers completed", shown.filter((e) => e.k === "t").reduce((n, e) => n + e.tiers.length, 0)],
    ["Players", players],
    ["New maps", count("m")],
  ];
  const scope = [];
  if (state.show !== "all") scope.push({ big: "big moments", victories: "victories", progress: "progress" }[state.show]);
  if (state.mode !== "All") scope.push(state.mode);
  if (state.country) scope.push(COUNTRIES[state.country] || state.country.toUpperCase());
  if (state.find.trim()) scope.push(`"${state.find.trim()}"`);
  document.getElementById("totals").replaceChildren(...[
    h("h2", { class: "score-title" }, period),
    h("p", { class: "score-sub dim" }, `${shortDay(since())} to ${date(activityEnd)}`),
    scope.length ? h("p", { class: "score-scope" }, `Counting only ${listed(scope)}`) : null,
    scoreList(rows.map(([label, n]) => h("li", { class: n ? "" : "none" }, h("span", {}, label), h("b", {}, n)))),
  ].filter(Boolean));
}

function followButton(name, content, active) {
  return h("button", {
    class: "follow", type: "button", "aria-pressed": String(active),
    onclick: () => go({ find: active ? "" : name }),
  }, content);
}

function renderGains(shown) {
  const sum = new Map();
  for (const e of shown) {
    if ((e.k === "v" || e.k === "s") && e.gain) sum.set(e.p, (sum.get(e.p) || 0) + e.gain);
  }
  const top = [...sum].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const find = state.find.trim().toLowerCase();
  const rows = top.map(([name, gain]) => h("li", {},
    followButton(name, [head(name), nameTag(name)], find === name.toLowerCase()),
    h("b", { class: "act-exp" }, `+${gain}`)));
  document.getElementById("gains").replaceChildren(
    h("h2", { class: "score-title" }, "Most EXP gained"),
    rows.length ? scoreList(rows) : h("p", { class: "score-none dim" }, "No EXP gained here"));
}

function renderBusy(shown) {
  const count = new Map();
  for (const e of shown) {
    if (e.k === "v" || e.k === "s") count.set(e.m, (count.get(e.m) || 0) + 1);
  }
  const top = [...count].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5);
  const find = state.find.trim().toLowerCase();
  const rows = top.map(([name, n]) => {
    const map = activityMaps[name];
    const badge = badgeOf(map.b);
    return h("li", {},
      followButton(name, [map.tier ? socket(map.tier) : modeSlot(map.mode, "map"), h("span", { class: badge ? `name${badge.end ? " blend" : ""}` : "", style: paintStyle(badge) }, name)], find === name.toLowerCase()),
      h("b", {}, n));
  });
  document.getElementById("busy").replaceChildren(
    h("h2", { class: "score-title" }, "Busiest maps"),
    rows.length ? scoreList(rows) : h("p", { class: "score-none dim" }, "No victories or steps here"));
}

// controls on the world, outside the panels

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
  document.getElementById("periods").replaceChildren(...PERIODS.map(([d, text]) => h("button", {
    class: "button board-tab", type: "button", "aria-pressed": String(d === state.days), onclick: () => go({ days: d }),
  }, text)));
  const codes = [...new Set(Object.values(activityCountry).filter(Boolean))].sort((a, b) => (COUNTRIES[a] || a).localeCompare(COUNTRIES[b] || b));
  document.getElementById("shows").replaceChildren(...seg("Show", SHOWS, state.show, (show) => go({ show })));
  document.getElementById("filters").replaceChildren(
    ...seg("Gamemode", MODES, state.mode, (mode) => go({ mode })),
    guiSelect("Country", [["", "All"], ...codes.map((c) => [c, COUNTRIES[c] || c.toUpperCase()])], state.country, (country) => go({ country })));
  const find = document.getElementById("find");
  if (find.value !== state.find) find.value = state.find;
  clear.hidden = !state.find;
}

const clear = h("button", { class: "clear", type: "button", "aria-label": "Clear", hidden: true, onclick: () => {
  go({ find: "" });
  document.getElementById("find").focus();
} }, icon("close"));
document.querySelector(".chat-find").append(clear);

// history: period and filter changes can be undone with Back; typing only replaces the address

function save(push) {
  const q = new URLSearchParams();
  if (state.days !== 30) q.set("days", state.days);
  if (state.show !== "all") q.set("show", state.show);
  if (state.mode !== "All") q.set("mode", state.mode);
  if (state.country) q.set("country", state.country);
  if (state.find.trim()) q.set("find", state.find.trim());
  const text = q.toString();
  const url = text ? `?${text}` : location.pathname;
  if (push) history.pushState(null, "", url);
  else history.replaceState(null, "", url);
}

function go(change, push = true) {
  Object.assign(state, change);
  render();
  save(push);
}

let lastTop = "";

// the moment is the biggest victory or step with a screenshot to stand in front of; the toasts
// under it are the next biggest, one of each kind before any kind comes twice
function highlights(shown) {
  // what happened since the last visit goes first, then the rest of the period
  const ranked = shown.map((e) => [weight(e), e])
    .sort((a, b) => (b[1].d > LAST_VISIT) - (a[1].d > LAST_VISIT) || b[0] - a[0] || b[1].d.localeCompare(a[1].d))
    .map(([, e]) => e);
  // the moment is the biggest new thing when it is a big moment; a quiet day holds up the
  // biggest of the period instead, and what is new stays in the toasts and the log
  const holds = (e) => e.p && (e.k === "v" || e.k === "s") && mapOf(e).tile;
  const fresh = ranked.find((e) => e.d > LAST_VISIT && holds(e));
  const biggest = [...ranked].sort((a, b) => weight(b) - weight(a) || b.d.localeCompare(a.d)).find(holds);
  const hero = (fresh && isBig(fresh) ? fresh : biggest || fresh) || null;
  const rest = ranked.filter((e) => e !== hero);
  const picked = [];
  const titles = new Set(hero ? [XP_TITLE[hero.k]] : []);
  for (const e of rest) {
    if (picked.length === (hero ? 2 : 3)) break;
    if (!titles.has(XP_TITLE[e.k])) {
      titles.add(XP_TITLE[e.k]);
      picked.push(e);
    }
  }
  for (const e of rest) {
    if (picked.length >= (hero ? 2 : 3)) break;
    if (!picked.includes(e)) picked.push(e);
  }
  picked.sort((a, b) => rest.indexOf(a) - rest.indexOf(b));
  return { hero, picked };
}

function render() {
  const shown = events.filter(visible);
  renderControls();
  renderLog(shown);
  renderTotals(shown);
  renderGains(shown);
  renderBusy(shown);
  const { hero, picked } = highlights(shown);
  // the moment and the toasts come on again only when they change
  const key = [hero, ...picked].map((e) => e && e.id).join();
  if (key !== lastTop) {
    lastTop = key;
    renderMoment(hero);
    renderToasts(picked);
  }
  const lead = [hero, ...picked].find((e) => e && mapOf(e) && mapOf(e).world);
  if (lead) setWorld(mapOf(lead).world, mapOf(lead).light);
  const label = PERIODS.find(([d]) => d === state.days)[2].toLowerCase();
  document.getElementById("announce").textContent = `${plural(shown.length, "entry", "entries")} in the ${label}`;
}

document.getElementById("find").addEventListener("input", (event) => go({ find: event.currentTarget.value }, false));
document.getElementById("find").addEventListener("keydown", (event) => {
  if (event.key === "Escape") go({ find: "" }, false);
});

addEventListener("popstate", () => {
  state = readUrl();
  render();
});

// day bars stop right under the top bar, which is taller on phones
function measureBar() {
  document.documentElement.style.setProperty("--bar", `${document.querySelector(".bar").offsetHeight}px`);
}

addEventListener("resize", measureBar);
measureBar();
render();
