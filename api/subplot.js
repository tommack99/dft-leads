// SUBPLOT — server-rendered site. Routed here by vercel.json for the SUBPLOT
// host (and, for preview, the /subplot path on the roster host).
// Private preview: every response is noindex/nofollow and robots.txt disallows all.
// Optional gate: set SUBPLOT_PASS in Vercel env to require a password (user "subplot").
import { getData } from "./_subplot/data.js";
import { brandFor, setBrand } from "./_subplot/brand.js";
import { listMonths, readMonth } from "./_subplot/archive.js";
import { homePage, articlePage, creatorPage, joinPage, aboutPage, threadPage, rssFeed, notFound, legalPage, artPath, revenuePage } from "./_subplot/render.js";
import { CAST } from "./_subplot/cast.js";
import { faviconSvg, assetKey } from "./_subplot/brand.js";
import { adsTxt } from "./_subplot/ads.js";
import { OG_PNG, APPLE_PNG, WORDIE_OG_PNG, WORDIE_APPLE_PNG } from "./_subplot/images.js";
const OG = { subplot: OG_PNG, wordie: WORDIE_OG_PNG };
const TOUCH = { subplot: APPLE_PNG, wordie: WORDIE_APPLE_PNG };

const CATS = new Set(["marvel", "dc", "scifi", "gaming", "anime", "screen"]);

function unauthorised(res) {
  res.setHeader("WWW-Authenticate", 'Basic realm="SUBPLOT preview"');
  res.setHeader("Cache-Control", "no-store");
  return res.status(401).send("Private preview.");
}

export default async function handler(req, res) {
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");

  // Which publication is this? Resolved from the host before anything renders.
  setBrand(brandFor(req.headers["x-forwarded-host"] || req.headers.host || ""));

  const pass = process.env.SUBPLOT_PASS;
  if (pass) {
    const h = req.headers.authorization || "";
    const ok = h.startsWith("Basic ") && Buffer.from(h.slice(6), "base64").toString() === "subplot:" + pass;
    if (!ok) return unauthorised(res);
  }

  const path = "/" + String(req.query.path || "").replace(/^\/+|\/+$/g, "");
  const base = req.query.base === "subplot" ? "/subplot" : "";

  // The revenue archive is money data: its own gate, and it FAILS CLOSED. No password set in
  // the environment means the page does not exist, whatever the rest of the site is doing.
  if (path === "/revenue") {
    const rp = process.env.SUBPLOT_REVENUE_PASS;
    if (!rp) return res.status(404).send("Not found");
    const h = req.headers.authorization || "";
    if (!(h.startsWith("Basic ") && Buffer.from(h.slice(6), "base64").toString() === "revenue:" + rp)) {
      res.setHeader("WWW-Authenticate", 'Basic realm="SUBPLOT revenue"');
      return res.status(401).send("Authentication required");
    }
    try {
      const months = await listMonths();
      const want = months.includes(String(req.query.month)) ? String(req.query.month) : months[0];
      const month = want ? await readMonth(want) : null;
      const d = await getData();
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).send(revenuePage(months, month, d, base));
    } catch (e) {
      return res.status(500).send("Revenue archive unavailable: " + String(e.message || e));
    }
  }

  if (path === "/favicon.svg") { res.setHeader("Content-Type", "image/svg+xml"); res.setHeader("Cache-Control", "public, max-age=86400"); return res.status(200).send(faviconSvg() || CAST.favicon); }
  if (path === "/apple-touch-icon.png") { res.setHeader("Content-Type", "image/png"); res.setHeader("Cache-Control", "public, max-age=86400"); const b = TOUCH[assetKey()]; if (!b) return res.status(404).end(); return res.status(200).send(Buffer.from(b, "base64")); }
  if (path === "/og.png") { res.setHeader("Content-Type", "image/png"); res.setHeader("Cache-Control", "public, max-age=86400"); const b = OG[assetKey()]; if (!b) return res.status(404).end(); return res.status(200).send(Buffer.from(b, "base64")); }
  if (path === "/ads.txt") {
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Cache-Control", "public, max-age=3600");
    const t = adsTxt();
    if (!t) return res.status(404).send("");
    return res.status(200).send(t);
  }
  if (path === "/robots.txt") {
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Cache-Control", "public, max-age=3600");
    // Private preview: block indexing crawlers, but let Google's AD crawlers through.
    // Mediapartners-Google reads pages so ads can be matched; AdsBot-Google and Google-Adstxt
    // fetch /ads.txt, and blocking them makes AdSense report ads.txt as "Not found" - which
    // caps what buyers will pay for the inventory. /ads.txt is allowed to everyone: it is a
    // public declaration by design and carries nothing private.
    return res.status(200).send([
      "User-agent: Mediapartners-Google", "Allow: /", "",
      "User-agent: AdsBot-Google", "Allow: /", "",
      "User-agent: Google-Adstxt", "Allow: /", "",
      "User-agent: *", "Allow: /ads.txt", "Disallow: /", "",
    ].join("\n"));
  }

  let data;
  try { data = await getData(); }
  catch (e) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(502).send("The article feed isn't reachable right now: " + e.message);
  }

  if (path === "/feed.xml") { res.setHeader("Content-Type", "application/rss+xml; charset=utf-8"); res.setHeader("Cache-Control", "public, s-maxage=600"); return res.status(200).send(rssFeed(data, base)); }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", pass ? "private, no-store" : "public, s-maxage=300, stale-while-revalidate=3600");

  let html = null; let status = 200;
  const pg = Math.max(1, parseInt(req.query.p, 10) || 1);
  if (path === "/") html = homePage(data, base, "all", pg);
  else if (path.startsWith("/s/") && CATS.has(path.slice(3))) html = homePage(data, base, path.slice(3), pg);
  else if (path.startsWith("/a/")) {
    // /a/<handle>/<videoId> is canonical; the old /a/<videoId> form 301s to it, as does a
    // stale handle, so an article's earnings only ever accrue under one URL channel.
    const seg = path.slice(3).split("/");
    const a = data.arts.find(x => x.id === seg[seg.length - 1]);
    if (!a) html = null;
    else {
      const want = base + artPath(a);
      if (path === artPath(a)) html = articlePage(a, data, base);
      else { res.setHeader("Location", want); return res.status(301).end(); }
    }
  }
  else if (path.startsWith("/c/")) html = creatorPage(decodeURIComponent(path.slice(3)), data, base);
  else if (path.startsWith("/t/")) html = threadPage(path.slice(3), data, base);
  else if (path === "/join") html = joinPage(data, base);
  else if (path === "/about") html = aboutPage(data, base);
  else if (["/contact", "/privacy", "/terms", "/creators"].includes(path)) html = legalPage(path.slice(1), data, base);
  if (!html) { html = notFound(base); status = 404; res.setHeader("Cache-Control", "no-store"); }
  return res.status(status).send(html);
}
