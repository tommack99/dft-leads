// SUBPLOT data layer — reads the article store the publisher writes to (Apify KV
// store youtube-mrss-feeds) and shapes it for the site. Server-side only.
// Cached per lambda instance for TTL_MS; the CDN caches rendered pages on top.

const STORE = "https://api.apify.com/v2/key-value-stores/5yFLBuHJj59ySXY9e";
const TTL_MS = 5 * 60 * 1000;

// Creators who have agreed to SUBPLOT, from the Article Rights board (monday 18427697857,
// "Subplot" column) plus the SubPlotter Applications board. Handles are the REAL YouTube
// handles, which are not always what the article store records.
//
// The list is only enforced when SUBPLOT_APPROVED_ONLY is set in the environment. While the
// site is a private preview it shows everything; setting that env var is the single switch
// that makes it launch-ready, with no deploy needed.
export const APPROVED_HANDLES = [
  "@breakdownsandblockbusters",   // Breakdowns & Blockbusters
  "@thekristianharloff",          // Kristian Harloff
  "@chaosgaming",                 // Chaos
  "@chaostrektv",                 // ChaosTrek
  "@wesnemo",                     // WesNemo
  "@film_paradise",               // Film Paradise
  "@lorereloaded",                // Lore Reloaded
  "@arealknowitall",              // Mr. Know-It-All (no articles yet; appears when his feed fills)
  "@coltonogburnchannel",         // Colton Ogburn
];
export const APPROVED = process.env.SUBPLOT_APPROVED_ONLY ? APPROVED_HANDLES : null;

export const slug = s => String(s).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export const CATS = {
  marvel: "Marvel",
  dc: "DC",
  scifi: "Sci-Fi & Fantasy",
  gaming: "Gaming",
  anime: "Anime",
  screen: "Screen",
};

const KW = {
  dc:     ["dc","batman","lanterns","green lantern","john stewart","superman","hal jordan","dark knight","the flash","wonder woman"],
  anime:  ["dragon ball","goku","vegeta","ultra instinct","toonami","anime","one piece","naruto","jujutsu","demon slayer"],
  gaming: ["gta","call of duty","elder scrolls","warhammer","grand theft auto","gaming","blood angels","miniature","police chase","outlaws","playstation","xbox","nintendo","ps5"],
  marvel: ["marvel","mcu","deadpool","wolverine","avengers","doom","secret wars","scarlet witch","spider-man","vision","x-men","kang","loki","franklin richards","hugh jackman","ryan reynolds","robert downey","kevin feige","elizabeth olsen","cassandra nova","infinity stones","doomsday","hunter b-15","fantastic four"],
  scifi:  ["star trek","star wars","stargate","voth","strange new worlds","prometheus","sci-fi","galaxy's edge","harry potter","ghosts","moaning myrtle","transformers","optimus","lord of the rings","dune","alien","predator"],
};
const ORDER = ["dc","anime","gaming","marvel","scifi"];

export function categorise(tags, headline) {
  const blob = ((tags || []).join(" ") + " " + (headline || "")).toLowerCase();
  for (const k of ORDER) if (KW[k].some(w => blob.includes(w))) return k;
  return "screen";
}

// YouTube-style sign-off ("What do you think…?") as the final paragraph reads as a template on a
// site. Drop it from the rendered body only when it is a short, single, standalone question.
function trimSignoff(html) {
  const m = html.match(/<p>([^<]{12,180}\?)\s*<\/p>\s*$/);
  if (!m) return html;
  const q = m[1];
  if ((q.match(/[.!?]/g) || []).length > 1) return html;      // more than one sentence: keep
  return html.slice(0, m.index).trimEnd();
}
// House style: no em dashes anywhere on the site, including article text from the pipeline.
const noDash = t => String(t || "").replace(/\s*(?:\u2014|&mdash;|&#8212;)\s*/g, " - ");
const cleanBrand = n => (n || "").replace(/\s*—\s*New$/, "").trim();
const norm = t => String(t || "").trim().replace(/\s+and\s+/i, " & ");
const STOP = new Set(["marvel","mcu","marvel studios","marvel cinematic universe","dc","pixar","reaction","sci-fi",
  "gaming community","interview","movie industry","stargate lore","easter egg","dc studios","hbo","star wars",
  "stargate","dragon ball","dragon ball z","x-men","ghosts","ryan reynolds","hugh jackman","netflix","disney"]);

let cache = { at: 0, data: null, pending: null };

// Real channel identity, resolved from the videos themselves. The store's `creator` field
// is not reliable — four of its handles point at the wrong channel or at no channel at all —
// so the video's own channel is the source of truth for the handle and the profile picture.
// Cached for a day; channel art rarely changes.
const CH_TTL = 24 * 3600e3;
const chCache = new Map();                       // brand (lowercased) -> { at, handle, av, title }

async function ytJson(path, key, ids) {
  const r = await fetch(`https://www.googleapis.com/youtube/v3/${path}&id=${ids.join(",")}&key=${key}`);
  if (!r.ok) throw new Error(`${r.status} from YouTube ${path}`);
  return r.json();
}

// Resolves one channel per brand and rewrites each article's handle to the real one.
// Returns brand -> { handle, av, title }.
async function resolveChannels(arts) {
  const out = {};
  const now = Date.now();
  const sample = new Map();                      // brand -> a video to resolve it from
  for (const a of arts) {
    const b = a.b.toLowerCase();
    const hit = chCache.get(b);
    if (hit && now - hit.at < CH_TTL) { out[a.b] = hit; continue; }
    if (!sample.has(b) && a.v) sample.set(b, { brand: a.b, v: a.v });
  }
  const key = process.env.YOUTUBE_API_KEY;
  if (key && sample.size) {
    try {
      const wanted = [...sample.values()];
      const chByVideo = new Map();
      for (let i = 0; i < wanted.length; i += 50) {
        const j = await ytJson("videos?part=snippet", key, wanted.slice(i, i + 50).map(w => w.v));
        for (const it of j.items || []) chByVideo.set(it.id, it.snippet.channelId);
      }
      const chIds = [...new Set(chByVideo.values())];
      const info = new Map();
      for (let i = 0; i < chIds.length; i += 50) {
        const j = await ytJson("channels?part=snippet", key, chIds.slice(i, i + 50));
        for (const c of j.items || []) {
          const t = c.snippet.thumbnails || {};
          info.set(c.id, { handle: c.snippet.customUrl || "", av: (t.medium || t.default || {}).url || "", title: c.snippet.title || "" });
        }
      }
      for (const w of wanted) {
        const c = info.get(chByVideo.get(w.v));
        if (!c || !c.handle) continue;
        const rec = { at: Date.now(), handle: c.handle, av: c.av, title: c.title };
        chCache.set(w.brand.toLowerCase(), rec);
        out[w.brand] = rec;
      }
    } catch { /* fall back to whatever the store gave us */ }
  }
  for (const a of arts) { const c = out[a.b]; if (c) a.c = c.handle; }
  return out;
}

// YouTube view counts for recent articles (used to pick the front-page lead until the site
// has its own read data). Needs YOUTUBE_API_KEY; silently skipped without it.
const VIEWS_WINDOW = 14 * 864e5;
async function addViews(arts) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return;
  const recent = arts.filter(a => Date.now() - new Date(a.p) < VIEWS_WINDOW).slice(0, 150);
  for (let i = 0; i < recent.length; i += 50) {
    const batch = recent.slice(i, i + 50);
    try {
      const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${batch.map(a => a.v).join(",")}&key=${key}`);
      if (!r.ok) continue;
      const j = await r.json();
      for (const it of j.items || []) {
        const a = batch.find(x => x.v === it.id); if (!a) continue;
        a.views = Number(it.statistics?.viewCount || 0);
        a.ageDays = Math.max(1, (Date.now() - new Date(a.u || a.p)) / 864e5);
      }
    } catch { /* leave views undefined */ }
  }
}

async function fetchJson(url) {
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`${r.status} for ${url}`);
  return r.json();
}

async function load() {
  const keys = (await fetchJson(STORE + "/keys?limit=1000")).data.items
    .map(i => i.key).filter(k => k.endsWith("__items"));
  const results = await Promise.allSettled(keys.map(k => fetchJson(STORE + "/records/" + k)));
  const seen = new Set(); const arts = [];
  results.forEach((res, i) => {
    if (res.status !== "fulfilled" || !Array.isArray(res.value)) return;
    const evergreen = keys[i].includes("evergreen");
    for (const a of res.value) {
      if (!a || !a.guid || !a.headline || !a.thumbnail || seen.has(a.guid)) continue;
      if (/^unable to generate/i.test(a.headline)) continue;
      const brand = cleanBrand(a.displayName);        // feeds without a displayName are old playlist experiments — skip
      if (!brand || !a.creator) continue;
      seen.add(a.guid);
      const v = (String(a.link || "").match(/v=([\w-]+)/) || [])[1] || String(a.guid).replace(/^yt-/, "");
      arts.push({
        id: String(a.guid).replace(/^yt-/, ""),
        h: noDash(a.headline), s: noDash(a.subheadline), body: noDash(trimSignoff(a.body_html || "")),
        w: a.word_count || 0, rt: Math.max(1, Math.round((a.word_count || 0) / 220)),
        t: (a.tags || []).slice(0, 8), b: brand, c: a.creator,
        p: a.pubDate, u: a.uploadDate, v, evergreen,
        k: categorise(a.tags, a.headline),
        thumb: `https://i.ytimg.com/vi/${v}/hq720.jpg`,
        thumbSmall: `https://i.ytimg.com/vi/${v}/mqdefault.jpg`,
      });
    }
  });
  // Some feeds record the display name as the creator instead of the handle.
  // Map those onto the real handle where the brand already has one; otherwise derive one.
  const handleByBrand = new Map();
  for (const a of arts) if (a.c.startsWith("@")) handleByBrand.set(a.b.toLowerCase(), a.c);
  for (const a of arts) {
    if (a.c.startsWith("@")) continue;
    const known = handleByBrand.get(a.c.toLowerCase()) || handleByBrand.get(a.b.toLowerCase());
    a.c = known || ("@" + a.c.toLowerCase().replace(/[^a-z0-9_.-]/g, ""));
  }
  const channels = await resolveChannels(arts);
  arts.sort((x, y) => new Date(y.p) - new Date(x.p));
  await addViews(arts);
  if (APPROVED) { const kept = arts.filter(a => APPROVED.includes(a.c)); arts.length = 0; arts.push(...kept); }

  // creators
  const byC = new Map();
  for (const a of arts) {
    const e = byC.get(a.c) || { handle: a.c, name: a.b, n: 0, latest: a.p };
    e.n++; byC.set(a.c, e);
  }
  const panel = [...byC.values()].sort((x, y) => y.n - x.n);
  const av = {};
  for (const p of panel) { const c = channels[p.name]; p.av = (c && c.av) || ""; if (p.av) av[p.handle] = p.av; }

  // threads: one subject, several creators — ranked by what's moving now, not by lifetime size
  const RECENT = 21 * 864e5;
  const tagmap = new Map();
  for (const a of arts) {
    a.t.forEach((t, i) => {
      const n = norm(t); if (STOP.has(n.toLowerCase())) return;
      const prominent = i < 3 || a.h.toLowerCase().includes(n.toLowerCase());
      if (!prominent) return;
      const list = tagmap.get(n) || []; if (!list.some(x => x.id === a.id)) list.push(a); tagmap.set(n, list);
    });
  }
  const subjects = {};
  for (const [t, items] of tagmap) {
    if (items.length < 2) continue;
    const sl = slug(t); if (!sl) continue;
    const sorted = items.slice().sort((a, b) => new Date(b.p) - new Date(a.p));
    if (!subjects[sl] || subjects[sl].items.length < sorted.length) subjects[sl] = { t, slug: sl, n: sorted.length, c: new Set(sorted.map(i => i.c)).size, items: sorted.map(i => i.id) };
  }
  const threads = [];
  for (const [t, items] of tagmap) {
    const recent = items.filter(i => Date.now() - new Date(i.p) < RECENT).sort((a, b) => new Date(b.p) - new Date(a.p));
    const creators = new Set(recent.map(i => i.c));
    if (recent.length < 3 || creators.size < 2) continue;
    const cats = {}; recent.forEach(i => cats[i.k] = (cats[i.k] || 0) + 1);
    const k = Object.entries(cats).sort((a, b) => b[1] - a[1])[0][0];
    // one take per creator first, then the rest, newest first
    const seenC = new Set(); const firsts = [], rest = [];
    for (const i of recent) (seenC.has(i.c) ? rest : (seenC.add(i.c), firsts)).push(i);
    threads.push({ t, slug: slug(t), n: recent.length, c: creators.size, k, score: recent.length * creators.size,
      items: firsts.concat(rest).slice(0, 6).map(i => i.id) });
  }
  threads.sort((a, b) => b.score - a.score);
  const chosen = []; const used = new Set();
  for (const t of threads) {
    const overlap = t.items.filter(id => used.has(id)).length;
    if (overlap > t.items.length / 2) continue;
    chosen.push(t); t.items.forEach(id => used.add(id));
    if (chosen.length === 3) break;
  }
  return { arts, panel, threads: chosen, subjects, avatars: av, loadedAt: new Date().toISOString() };
}

export async function getData() {
  const now = Date.now();
  if (cache.data && now - cache.at < TTL_MS) return cache.data;
  if (!cache.pending) cache.pending = load().then(d => { cache = { at: Date.now(), data: d, pending: null }; return d; })
    .catch(err => { cache.pending = null; if (cache.data) return cache.data; throw err; });
  return cache.pending;
}
