// Brand layer. SUBPLOT and Wordie are the same machine wearing different clothes: one
// codebase, one pipeline, one set of bug fixes. What differs is the name, the voice, the
// palette, and - the real difference - who is allowed to publish.
//
//   subplot  curated. A closed list of approved creators, entertainment only.
//   wordie   open. Any YouTuber can apply, proves the channel by OAuth, then passes
//            automatic checks and a human yes before anything of theirs publishes.
//
// The brand is resolved from the request host. A Node serverless instance handles one
// request at a time, so a module-level "active" brand is safe here; nothing below may hold
// on to it across an await boundary that could span requests.

export const BRANDS = {
  subplot: {
    key: "subplot",
    name: "SUBPLOT",
    domain: "subplot.tv",
    tagline: "The story under the story. Breakdowns, theories, reactions, opinions, reviews and lore from the people who actually watch it.",
    memberWord: "SubPlotter",
    signup: "curated",              // approved list in CREATORS, edited by us
    accent: null,                   // null = the default palette in css.js
  },
  wordie: {
    key: "wordie",
    name: "WORDIE",
    domain: "wordie.tv",
    tagline: "Every video, in writing. Your words, your name, your channel - just for the people who would rather read.",
    memberWord: "Wordie",
    signup: "open",                 // OAuth proves the channel, checks and a human gate it
    accent: { ink: "#12121C", tint: "#0F7B6C", tintInk: "#0A5A4E", wash: "#E6F4F1", warm: "#F0A202" },
  },
};

const HOSTS = { "subplot.tv": "subplot", "wordie.tv": "wordie" };

export function brandFor(host = "") {
  const h = String(host).toLowerCase().replace(/^www\./, "").split(":")[0];
  return BRANDS[HOSTS[h]] || (h.startsWith("wordie") ? BRANDS.wordie : BRANDS.subplot);
}

let active = BRANDS.subplot;
export const setBrand = b => { active = b || BRANDS.subplot; };
export const brand = () => active;

// Palette override, emitted into the page head for any brand that is not the default.
export function brandCss(b = active) {
  const a = b.accent;
  if (!a) return "";
  return `:root{--ink:${a.ink};--blue:${a.tint};--blue-ink:${a.tintInk};--blue-wash:${a.wash};--orange:${a.warm};--tint:var(--blue)}`;
}
