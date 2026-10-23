// The game's death screen, for an address the site does not have. A clean link to a player, map
// or badge that does not exist (/p/name, /m/name, /b/name) says so and offers a search for it.
// Opened from disk, ?path=/p/name stands in for the address.
const missing = new URLSearchParams(location.search).get("path") || location.pathname;
const KINDS = { p: "player", m: "map", b: "badge" };

function askedFor(path) {
  const parts = path.replace(/\.html$/, "").split("/").filter(Boolean);
  const at = parts.findIndex((part) => KINDS[part]);
  if (at < 0 || !parts[at + 1]) return null;
  return { kind: KINDS[parts[at]], name: decodeURIComponent(parts[at + 1]).replace(/-/g, " ") };
}

function renderDeath() {
  const asked = askedFor(missing);
  const buttons = document.getElementById("buttons");
  // Respawn goes back where the visitor came from on the site; from a link pasted elsewhere there
  // is nowhere to go back to, and Title Screen alone takes them home
  const respawn = document.getElementById("respawn");
  if (document.referrer && new URL(document.referrer).origin === location.origin) {
    respawn.hidden = false;
    respawn.addEventListener("click", (event) => {
      event.preventDefault();
      history.back();
    });
  }
  if (!asked) return;
  document.getElementById("cause").textContent = `There is no ${asked.kind} called "${asked.name}"`;
  document.title = `No ${asked.kind} called ${asked.name} - Parkour Progress`;
  buttons.prepend(h("a", { class: "button", href: `search.html?q=${encodeURIComponent(asked.name)}` }, `Search for "${asked.name}"`));
}

renderDeath();
