// SUBPLOT data layer — reads the article store the publisher writes to (Apify KV
// store youtube-mrss-feeds) and shapes it for the site. Server-side only.
// Cached per lambda instance for TTL_MS; the CDN caches rendered pages on top.

const STORE = "https://api.apify.com/v2/key-value-stores/5yFLBuHJj59ySXY9e";
const TTL_MS = 5 * 60 * 1000;

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

const cleanBrand = n => (n || "").replace(/\s*—\s*New$/, "").trim();
const norm = t => String(t || "").trim().replace(/\s+and\s+/i, " & ");
const STOP = new Set(["marvel","mcu","marvel studios","marvel cinematic universe","dc","pixar","reaction","sci-fi",
  "gaming community","interview","movie industry","stargate lore","easter egg","dc studios","hbo","star wars",
  "stargate","dragon ball","dragon ball z","x-men","ghosts","ryan reynolds","hugh jackman","netflix","disney"]);

let cache = { at: 0, data: null, pending: null };

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
        h: a.headline, s: a.subheadline || "", body: a.body_html || "",
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
  arts.sort((x, y) => new Date(y.p) - new Date(x.p));

  // creators
  const byC = new Map();
  for (const a of arts) {
    const e = byC.get(a.c) || { handle: a.c, name: a.b, n: 0, latest: a.p };
    e.n++; byC.set(a.c, e);
  }
  const panel = [...byC.values()].sort((x, y) => y.n - x.n);

  // threads: one subject, several creators
  const tagmap = new Map();
  for (const a of arts) {
    for (const t of a.t) {
      const n = norm(t); if (STOP.has(n.toLowerCase())) continue;
      const list = tagmap.get(n) || []; if (!list.some(x => x.id === a.id)) list.push(a); tagmap.set(n, list);
    }
  }
  const threads = [];
  for (const [t, items] of tagmap) {
    const creators = new Set(items.map(i => i.c));
    if (items.length >= 3 && creators.size >= 2) {
      const recent = items.filter(i => Date.now() - new Date(i.p) < 21 * 864e5);
      if (recent.length < 2) continue;
      const cats = {}; items.forEach(i => cats[i.k] = (cats[i.k] || 0) + 1);
      const k = Object.entries(cats).sort((a, b) => b[1] - a[1])[0][0];
      threads.push({ t, n: items.length, c: creators.size, k,
        items: items.sort((a, b) => b.w - a.w).slice(0, 6).map(i => i.id) });
    }
  }
  threads.sort((a, b) => b.n - a.n || b.c - a.c);
  return { arts, panel, threads: threads.slice(0, 3), loadedAt: new Date().toISOString() };
}

export async function getData() {
  const now = Date.now();
  if (cache.data && now - cache.at < TTL_MS) return cache.data;
  if (!cache.pending) cache.pending = load().then(d => { cache = { at: Date.now(), data: d, pending: null }; return d; })
    .catch(err => { cache.pending = null; if (cache.data) return cache.data; throw err; });
  return cache.pending;
}
