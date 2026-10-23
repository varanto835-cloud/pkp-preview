// The map's progress over time (Texyle's idea, website-feedbacks): a replay from its release to
// the last day of the data, today on the real site. Drag the slider or press Play. The players
// race across the board as Texyle drew it: the furthest on the left, one column each, their chip
// on the step they had reached that day; columns change places as players pass each other, and a
// victory sends a player to the victors. The board keeps its locked player in view: the furthest
// one, or the one you pick. A player whose day was never recorded shows up on the last day only,
// starred, so the replay never makes a date up.
const DAY_MS = 86400000;
const SPEEDS = [[1, "1 day"], [2, "2 days"], [3, "3 days"], [5, "5 days"], [7, "1 week"], [10, "10 days"],
  [14, "2 weeks"], [21, "3 weeks"], [30, "1 month"], [42, "6 weeks"], [61, "2 months"], [91, "3 months"],
  [122, "4 months"], [183, "6 months"], [274, "9 months"], [365, "1 year"]];

function renderTimeline() {
  if (typeof timeline === "undefined") return;
  const block = document.getElementById("timeline-block");
  const box = document.getElementById("timeline");
  const first = Date.parse(timeline.start);
  const total = Math.round((Date.parse(timeline.end) - first) / DAY_MS);
  const dayOf = (iso) => Math.round((Date.parse(iso) - first) / DAY_MS);
  const isoOf = (n) => new Date(first + n * DAY_MS).toISOString().slice(0, 10);
  const stepAt = (index) => map.steps[index];
  // the mockup's data stops on the day the copy was taken, so it names that day
  const live = timeline.end === new Date().toISOString().slice(0, 10);
  const byEnd = live ? "by today" : `by ${date(timeline.end)}`;

  const players = timeline.players.map((p) => ({ ...p, days: p.moves.map(([d, s]) => [dayOf(d), s]), won: p.victory ? dayOf(p.victory) : null }));
  // where a player stands on day n: their last step by then, with the victors once they won,
  // and a step with no recorded day only on the last day
  const standing = (p, n) => {
    if (p.won != null && p.won <= n) return { won: true };
    let step = null;
    let since = null;
    for (const [d, s] of p.days) if (d <= n) [step, since] = [s, d];
    if (p.undated != null && n >= total && (step == null || p.undated > step)) return { step: p.undated, since: null };
    return step == null ? null : { step, since };
  };

  // everyone the history follows gets a column; the victors who only won live in the list
  const columns = players.filter((p) => p.days.length || p.undated != null)
    .sort((a, b) => (a.days[0]?.[0] ?? total + 1) - (b.days[0]?.[0] ?? total + 1));
  // every progress step of the map, reached or not, so the board climbs as far as the map does
  const rows = map.steps.map((_, index) => index).reverse();
  const victors = map.victors.map((v, i) => ({ ...v, day: v.date ? dayOf(v.date) : total, first: i === 0 && exact(v.date) }));

  // the race order on day n: climbers first, the furthest first and, on one step, whoever got
  // there first; then those not on the map yet, in the order they will come; the victors last
  const keyOf = (p, i, now) => !now ? [1, i, 0, 0] : now.won ? [2, p.won, i, 0] : [0, -now.step, now.since ?? total + 1, i];
  const byKey = (a, b) => {
    const k = a.key.findIndex((v, at) => v !== b.key[at]);
    return k < 0 ? 0 : a.key[k] - b.key[k];
  };
  const race = (n) => columns.map((p, i) => {
    const now = standing(p, n);
    return { p, i, now, key: keyOf(p, i, now) };
  }).sort(byKey);

  // the month bars over the slider: how many steps were reached each month, each bar as wide as
  // its days so the bars run with the slider. A victory is a line on its own day, in the VICTOR
  // badge's colour, and a followed player's steps are hover-yellow marks on theirs (Texyle's
  // idea). Everything the replay has passed is lit, up to the day shown and not a day further
  const months = new Map();
  for (const p of players) for (const [d] of p.days) months.set(isoOf(d).slice(0, 7), (months.get(isoOf(d).slice(0, 7)) || 0) + 1);
  const spans = [];
  for (let d = 0; d <= total;) {
    const iso = isoOf(d);
    const next = Math.min(total + 1, Math.round((Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)), 1) - first) / DAY_MS));
    spans.push([iso.slice(0, 7), next - d]);
    d = next;
  }
  const peak = Math.max(1, ...months.values());
  const layer = (cls) => h("div", { class: `tl-layer ${cls}` },
    spans.map(([month, days]) => h("span", { class: "tl-month", style: `--days:${days};--h:${(months.get(month) || 0) / peak}` })),
    victors.filter((v) => v.date).map((v) => h("i", { class: "tl-win", style: `--at:${v.day / total}` })),
    h("span", { class: "tl-marks" }));
  const layers = [layer("unlit"), layer("lit")];
  const bars = h("div", { class: "tl-bars", "aria-hidden": "true", style: `--victor:${map.role.color}` }, h("div", { class: "tl-bars-in" }, layers));
  let marked;
  const markFollowed = () => {
    if (marked === followed) return;
    marked = followed;
    const p = players.find((each) => each.name === followed);
    const days = p ? [...p.days.map(([d]) => d), ...(p.won != null ? [p.won] : [])] : [];
    for (const el of layers) el.querySelector(".tl-marks").replaceChildren(...days.map((d) => h("i", { style: `--at:${d / total}` })));
  };

  // the game's slider: the day is written on it
  const slider = h("input", { type: "range", min: 0, max: total, value: total, "aria-label": "Day of the replay" });
  const sliderText = h("span", { class: "tl-day" });
  const years = [];
  // the years, but none so near an end that it would run into the labels at the ends
  for (let y = new Date(first).getUTCFullYear() + 1; y <= new Date(timeline.end).getUTCFullYear(); y++) {
    const at = dayOf(`${y}-01-01`) / total;
    if (at > 0.12 && at < 0.88) years.push([at, String(y)]);
  }
  const axis = h("div", { class: "tl-axis", "aria-hidden": "true" },
    h("span", { style: "--at:0" }, "Release"),
    years.map(([at, label]) => h("span", { style: `--at:${at}` }, label)),
    h("span", { style: "--at:1" }, live ? "Today" : date(timeline.end)));

  // the speed is free, as Texyle asked: from a day to a year a second, in steps that grow as they
  // go so the slow end gets as much room as the fast one, each named in the unit it reads best
  // in; it starts on the step nearest to a 20 second replay
  const speedIndex = SPEEDS.reduce((best, [days], i) => Math.abs(Math.log(days * 20 / total)) < Math.abs(Math.log(SPEEDS[best][0] * 20 / total)) ? i : best, 0);
  let speed = SPEEDS[speedIndex][0];
  const speedInput = h("input", { type: "range", min: 0, max: SPEEDS.length - 1, value: speedIndex, "aria-label": "Replay speed" });
  const speedText = h("span", { class: "tl-day" });
  const showSpeed = () => {
    const [days, name] = SPEEDS[Number(speedInput.value)];
    speed = days;
    speedText.textContent = `${name} a second`;
    speedInput.setAttribute("aria-valuetext", speedText.textContent);
  };
  speedInput.addEventListener("input", showSpeed);
  showSpeed();

  const play = h("button", { class: "button tl-play", type: "button" }, "Play");

  // the board: steps as rows, highest on top, each with its tier; players as narrow columns, so
  // the whole race fits in view and reads as a climb. Over each column the player's face, and
  // their name read up the column like a book's spine (Texyle wanted it compact, with the names
  // in view); the game's name tag adds the day, over the locked player and the one under the
  // pointer. The font is monospaced, so the line-up and the step column are sized in characters;
  // on phones a step may take two lines, split where its longer half is shortest
  const codes = rows.map((index) => stepAt(index).code);
  const twoLines = (code) => {
    const words = code.split(" ");
    return Math.min(...words.map((_, i) => Math.max(words.slice(0, i).join(" ").length, words.slice(i).join(" ").length)));
  };
  const grid = h("div", { class: "tl-grid", style: [`--cols:${columns.length}`, `--rows:${rows.length}`,
    `--name:${Math.max(...columns.map((p) => p.name.length))}`, `--code:${Math.max(...codes.map((code) => code.length))}`,
    `--code2:${Math.max(...codes.map(twoLines))}`].join(";") });
  const headRow = h("div", { class: "tl-heads" });
  grid.append(h("span", { class: "tl-corner" }, "Step"), headRow);
  const rowCounts = rows.map((index, r) => {
    const step = stepAt(index);
    const count = h("span", { class: "tl-count" });
    grid.append(h("span", { class: r % 2 ? "tl-row even" : "tl-row", style: `grid-row:${r + 2}` }));
    const cell = h("span", { class: r % 2 ? "tl-step even" : "tl-step", style: `grid-row:${r + 2}${step.tier ? `;--c1:var(--t${step.tier})` : ""}` },
      step.tier ? socket(step.tier, "tl-socket") : h("span", { class: "socket tl-socket" }), h("strong", {}, withFlags(step.code)), count);
    if (step.tier) tip(cell, () => `<b style="color:var(--t${step.tier})">${esc(step.code)}</b><p>${esc(tierText(step.tier))}${step.value ? `, ${expOf(step.value)} EXP` : ""}</p>`);
    grid.append(cell);
    return count;
  });
  const lanes = columns.map((p, i) => {
    const lane = h("span", { class: "tl-lane", "data-i": i });
    lane.addEventListener("click", () => follow(p.name));
    grid.append(lane);
    return lane;
  });
  // the locked player's climb: a mark on every step they reached on record, joined by a line
  const climb = h("i", { class: "tl-climb" });
  const marks = h("span");
  const trail = h("span", { class: "tl-trail", "aria-hidden": "true" }, climb, marks);
  grid.append(trail);
  const heads = columns.map((p, i) => {
    const button = h("button", { class: "tl-head", type: "button", "aria-pressed": "false", "aria-label": p.name, "data-i": i },
      h("span", { class: "tl-spine" }, nameTag(p.name)), head(p.name));
    button.addEventListener("click", () => follow(p.name));
    tip(button, () => `<b>${esc(p.name)}</b><p>${esc(COUNTRIES[p.country] || "")}</p><p>${p.days.length ? `${plural(p.days.length, "step")} on record` : `No day on record: on the map ${byEnd}`}</p><p class="hint">${followed === p.name ? "Click to let go" : "Click to follow"}</p>`);
    headRow.append(button);
    return button;
  });
  const chips = columns.map((p, i) => {
    const chip = h("span", { class: "tl-chip off", "data-i": i }, head(p.name), h("span", { class: "tl-tag" }, nameTag(p.name), h("span", { class: "tl-when" })));
    chip.addEventListener("click", () => follow(p.name));
    grid.append(chip);
    return chip;
  });
  // the pointer or the focus on a head, a lane or a chip lights that player's column and shows
  // their name tag
  let lit = -1;
  const light = (i) => {
    if (i === lit) return;
    if (lit >= 0) for (const el of [heads[lit], lanes[lit], chips[lit]]) el.classList.remove("lit");
    lit = i;
    if (lit >= 0) for (const el of [heads[lit], lanes[lit], chips[lit]]) el.classList.add("lit");
  };
  const litFrom = (event) => {
    const at = event.target.closest("[data-i]");
    light(at ? Number(at.dataset.i) : -1);
  };
  grid.addEventListener("pointerover", litFrom);
  grid.addEventListener("focusin", litFrom);
  grid.addEventListener("pointerleave", () => light(-1));
  grid.addEventListener("focusout", () => light(-1));

  // the scoreboard of the day shown, as a server shows one down the side, and the victors so far
  const scoreTitle = h("p", { class: "score-title" });
  const climbingCount = h("b");
  const victorCount = h("b");
  const furthestStep = h("b");
  const furthestWho = h("li", { class: "tl-who" });
  const score = h("section", { class: "well score tl-score", "aria-label": "The day shown" }, scoreTitle,
    h("ul", { class: "score-rows" },
      h("li", {}, h("span", {}, "Climbing"), climbingCount),
      h("li", {}, h("span", {}, "Victors"), victorCount),
      h("li", {}, h("span", {}, "Furthest"), furthestStep),
      furthestWho));
  // a victor in the list is followed like a player on the board: their steps and their victory
  // marked on the bars, and their column whenever the replay is before their victory
  const list = h("ol", { class: "tl-victors" }, victors.map((v) => {
    const li = h("li", { "data-day": v.day, "data-name": v.name, role: "button", tabindex: "0", "aria-pressed": "false" },
      head(v.name), nameTag(v.name),
      h("span", { class: "tl-won dim" }, flag(v.country), v.date ? date(v.date) : "no date", v.first ? icon("crown", "first") : null));
    li.addEventListener("click", () => follow(v.name));
    li.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      follow(v.name);
    });
    return li;
  }));
  const nobody = h("p", { class: "tl-none dim" }, "Nobody yet");
  const winners = h("section", { class: "well score tl-winners", "aria-label": "Victors" }, h("p", { class: "score-title" }, "Victors"), list, nobody);

  const lockLine = h("p", { class: "tl-lock", "aria-live": "polite" });
  // days something happened: with quiet days skipped, Play leaps over a stretch with nothing in it
  const busy = [...new Set([...players.flatMap((p) => p.days.map(([d]) => d)), ...victors.filter((v) => v.date).map((v) => v.day)])].sort((a, b) => a - b);
  const skip = h("input", { type: "checkbox" });
  const find = h("input", { type: "search", placeholder: "Find a player", "aria-label": "Find a player to follow", spellcheck: "false" });
  const well = h("div", { class: "well tl-well" }, grid);

  // one inventory window like the route's, everything in its dark wells: the controls with the
  // follow line, the scoreboards, the board
  box.append(
    h("div", { class: "well tl-deck" },
      play,
      h("div", { class: "tl-scrub" }, bars, h("label", { class: "tl-slider" }, slider, sliderText), axis),
      h("div", { class: "tl-speed" }, h("label", { class: "tl-slider" }, speedInput, speedText),
        h("div", { class: "tl-axis", "aria-hidden": "true" }, h("span", { style: "--at:0" }, "Slower"), h("span", { style: "--at:1" }, "Faster"))),
      h("div", { class: "tl-bar" }, lockLine,
        h("label", { class: "check tl-skip" }, skip, h("span", { class: "box", "aria-hidden": "true" }, icon("check")), "Skip quiet days"),
        h("label", { class: "field tl-find" }, icon("search"), find))),
    h("div", { class: "tl-side" }, score, winners),
    h("div", { class: "tl-main" }, well));

  // following: the locked player is the furthest one, or the one picked; the board keeps them in
  // view, their column across and their step down the middle, gliding there; it lets go while
  // you scroll it yourself, and takes over again when they move
  let followed = null;
  let ranked = [];
  let lockKey = "";
  let glide = 0;
  function follow(name) {
    followed = followed === name ? null : name;
    show(Number(slider.value));
    // picking someone brings the whole board into the window, so the follow is seen on a phone too
    if (followed) well.scrollIntoView({ block: "nearest", behavior: calm.matches ? "auto" : "smooth" });
  }
  find.addEventListener("input", () => {
    const q = find.value.trim().toLowerCase();
    const p = q && players.find((each) => each.name.toLowerCase().startsWith(q));
    if (p && p.name !== followed) follow(p.name);
  });
  for (const type of ["wheel", "pointerdown", "touchstart"]) {
    well.addEventListener(type, () => {
      cancelAnimationFrame(glide);
      glide = 0;
    }, { passive: true });
  }
  addEventListener("resize", () => keepInView(true));

  function keepInView(force = false) {
    const c = ranked.findIndex((entry) => entry.p.name === (followed || ranked[0]?.p.name));
    if (c < 0) return;
    const now = ranked[c].now;
    const r = now && !now.won ? rows.indexOf(now.step) : -1;
    const key = `${followed}|${c}|${r}`;
    if (key === lockKey && !force) return;
    lockKey = key;
    const lead = grid.querySelector(".tl-step").offsetWidth;
    const col = heads[0].offsetWidth;
    const top = headRow.offsetHeight;
    const rowH = grid.querySelector(".tl-step").offsetHeight;
    // the furthest player is the first column, so following them keeps the board at its left;
    // anyone else is kept in view with their name tag, which runs right from the face
    let x = well.scrollLeft;
    const left = c * col;
    const span = Math.max(col, chips[ranked[c].i].querySelector(".tl-tag").offsetWidth);
    const view = well.clientWidth - lead;
    if (!followed) x = 0;
    else if (left < well.scrollLeft + 24 || left + span > well.scrollLeft + view - 24) x = span > view - 48 ? left - 24 : left + span / 2 - view / 2;
    let y = well.scrollTop;
    if (r >= 0) y = top + r * rowH + rowH / 2 - (top + well.clientHeight) / 2;
    x = Math.max(0, Math.min(well.scrollWidth - well.clientWidth, x));
    y = Math.max(0, Math.min(well.scrollHeight - well.clientHeight, y));
    cancelAnimationFrame(glide);
    if (force === "now" || calm.matches) {
      well.scrollLeft = x;
      well.scrollTop = y;
      return;
    }
    let last = performance.now();
    const step = (t) => {
      const k = 1 - Math.exp(-(t - last) / 110);
      last = t;
      const dx = x - well.scrollLeft;
      const dy = y - well.scrollTop;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
        well.scrollLeft = x;
        well.scrollTop = y;
        glide = 0;
        return;
      }
      well.scrollLeft += dx * k;
      well.scrollTop += dy * k;
      glide = requestAnimationFrame(step);
    };
    glide = requestAnimationFrame(step);
  }

  const placed = columns.map(() => null);
  let drawn = false;
  function show(n) {
    sliderText.textContent = date(isoOf(n));
    scoreTitle.textContent = date(isoOf(n));
    bars.style.setProperty("--now", n / total);
    markFollowed();
    // a victory takes the player off the board, to the victors (Texyle)
    const order = race(n);
    ranked = order.filter((entry) => !entry.now?.won);
    for (const { i } of order.filter((entry) => entry.now?.won)) {
      for (const el of [heads[i], lanes[i], chips[i]]) el.classList.add("gone");
      placed[i] = null;
    }
    grid.style.setProperty("--cols", ranked.length);
    const locked = followed || ranked[0]?.p.name;
    const perRow = new Map();
    let climbing = 0;
    ranked.forEach(({ p, i, now }, c) => {
      const chip = chips[i];
      const on = p.name === followed;
      for (const el of [heads[i], lanes[i], chip]) {
        el.classList.remove("gone");
        el.style.setProperty("--c", c);
      }
      heads[i].classList.toggle("on", on);
      heads[i].setAttribute("aria-pressed", String(on));
      lanes[i].classList.toggle("on", on);
      chip.classList.toggle("on", on);
      chip.classList.toggle("locked", p.name === locked);
      const r = now && !now.won ? rows.indexOf(now.step) : -1;
      chip.classList.toggle("off", r < 0);
      chip.classList.toggle("top", r === 0);
      if (r >= 0) {
        chip.style.setProperty("--r", r);
        chip.querySelector(".tl-when").textContent = now.since == null ? "no day on record" : shortDate(isoOf(now.since));
        perRow.set(r, (perRow.get(r) || 0) + 1);
        climbing++;
        // a step up flashes, as an opened row does
        if (drawn && placed[i] != null && r < placed[i]) flash(chip);
      }
      placed[i] = r < 0 ? null : r;
    });
    rowCounts.forEach((count, r) => { count.textContent = perRow.get(r) || ""; });
    let won = 0;
    for (const li of list.children) {
      const shown = Number(li.dataset.day) <= n;
      if (drawn && shown && li.hidden) flash(li);
      li.hidden = !shown;
      li.classList.toggle("on", li.dataset.name === followed);
      li.setAttribute("aria-pressed", String(li.dataset.name === followed));
      if (shown) won++;
    }
    nobody.hidden = won > 0;
    climbingCount.textContent = String(climbing);
    victorCount.textContent = String(won);
    // once the map is beaten the furthest climber means little, so it says so (Texyle)
    const lead = ranked[0] && ranked[0].now ? ranked[0] : null;
    furthestStep.textContent = lead && !won ? stepAt(lead.now.step).code : "-";
    furthestWho.replaceChildren(...(won ? [h("span", { class: "dim" }, "Map beaten")]
      : lead ? [head(lead.p.name), personLink(lead.p.name)] : [h("span", { class: "dim" }, "Nobody on it yet")]));
    lockLine.replaceChildren(...(followed
      ? [h("span", {}, "Following "), nameTag(followed), h("span", { class: "dim" }, ". Click them again to let go.")]
      : [h("span", { class: "dim" }, "Following the furthest climber. Click a player to follow them.")]));
    drawTrail(n, locked);
    keepInView(drawn ? false : "now");
    drawn = true;
  }

  // the trail hangs from the locked player's first step on record up to where they stand; it
  // grows with their chip, and moves to another player without gliding
  let trailOf = null;
  function drawTrail(n, name) {
    const c = ranked.findIndex((entry) => entry.p.name === name);
    const entry = ranked[c];
    const r = entry && entry.now && !entry.now.won ? rows.indexOf(entry.now.step) : -1;
    trail.hidden = r < 0;
    if (r < 0) {
      trailOf = null;
      return;
    }
    const passed = [...new Set(entry.p.days.filter(([d]) => d <= n).map(([, s]) => rows.indexOf(s)))];
    const low = Math.max(r, ...passed);
    const jump = trailOf !== name;
    trail.classList.toggle("jump", jump);
    trail.style.setProperty("--c", c);
    trail.style.setProperty("--low", low);
    climb.style.setProperty("--len", low - r);
    marks.replaceChildren(...passed.map((at) => h("b", { style: `--up:${low - at}` })));
    if (jump) {
      void trail.offsetWidth;
      trail.classList.remove("jump");
    }
    trailOf = name;
  }

  function flash(el) {
    el.classList.remove("flash");
    void el.offsetWidth;
    el.classList.add("flash");
  }

  function shortDate(iso) {
    const [y, mo, d] = iso.split("-").map(Number);
    return `${d} ${MONTHS[mo - 1]} ${String(y).slice(2)}`;
  }

  slider.addEventListener("input", () => {
    stop();
    show(Number(slider.value));
  });

  // Play runs the days at the chosen speed and stops on the last day; from there it starts over
  let running = null;
  function stop() {
    if (running) cancelAnimationFrame(running);
    running = null;
    play.textContent = "Play";
  }
  play.addEventListener("click", () => {
    if (running) return stop();
    if (Number(slider.value) >= total) {
      slider.value = 0;
      show(0);
    }
    play.textContent = "Pause";
    let last = null;
    let at = Number(slider.value);
    const tick = (now) => {
      if (last != null) at = Math.min(total, at + ((now - last) / 1000) * speed);
      last = now;
      // a quiet stretch takes a third of a second at most, then the next thing happens
      if (skip.checked) {
        const next = busy.find((d) => d > at) ?? total;
        if ((next - at) / speed > 0.35) at = next - speed * 0.35;
      }
      const day = Math.round(at);
      if (day !== Number(slider.value)) {
        slider.value = day;
        show(day);
      }
      if (at >= total) return stop();
      running = requestAnimationFrame(tick);
    };
    running = requestAnimationFrame(tick);
  });

  block.hidden = false;
  show(total);
}
