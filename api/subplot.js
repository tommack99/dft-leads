// SUBPLOT — server-rendered site. Routed here by vercel.json for the SUBPLOT
// host (and, for preview, the /subplot path on the roster host).
// Private preview: every response is noindex/nofollow and robots.txt disallows all.
// Optional gate: set SUBPLOT_PASS in Vercel env to require a password (user "subplot").
import { getData, cats } from "./_subplot/data.js";
import { brandFor, setBrand, BRANDS } from "./_subplot/brand.js";
import { runHealth } from "./_subplot/health.js";
import { setDesign } from "./_subplot/design.js";
import { listMonths, readMonth } from "./_subplot/archive.js";
import { homePage, articlePage, creatorPage, joinPage, aboutPage, threadPage, rssFeed, notFound, legalPage, artPath, revenuePage } from "./_subplot/render.js";
import { CAST } from "./_subplot/cast.js";
import { faviconSvg, assetKey } from "./_subplot/brand.js";
import { adsTxt } from "./_subplot/ads.js";
import { OG_PNG, APPLE_PNG } from "./_subplot/images.js";
// Share-card assets per brand. A brand with no entry here serves no og.png and no touch icon
// - better than serving another brand's. Wordie joins this map when it has artwork of its own.
const OG = { subplot: OG_PNG };
const TOUCH = { subplot: APPLE_PNG };

// Valid /s/<section> routes come from whichever brand is answering, not a fixed list.
const isSection = k => Object.prototype.hasOwnProperty.call(cats(), k);

function unauthorised(res) {
  res.setHeader("WWW-Authenticate", 'Basic realm="SUBPLOT preview"');
  res.setHeader("Cache-Control", "no-store");
  return res.status(401).send("Private preview.");
}

export default async function handler(req, res) {
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");

  // Which publication is this? Resolved from the host before anything renders. brandFor
  // returns null for a host this project does not publish on, and that is NOT the same as
  // "probably SUBPLOT" - an unnamed host gets nothing. The /subplot base path is the one
  // explicit exception: it names the brand in the request itself.
  const wantsSubplotBase = req.query.base === "subplot";
  const resolved = wantsSubplotBase ? BRANDS.subplot : brandFor(req.headers["x-forwarded-host"] || req.headers.host || "");
  // The health cron calls this function on whatever host Vercel schedules it from, so it must
  // still have a brand to read a store with. It gets one; a page request on that host does not.
  setBrand(resolved || BRANDS.subplot);

  const pass = process.env.SUBPLOT_PASS;
  if (pass) {
    const h = req.headers.authorization || "";
    const ok = h.startsWith("Basic ") && Buffer.from(h.slice(6), "base64").toString() === "subplot:" + pass;
    if (!ok) return unauthorised(res);
  }

  const path = "/" + String(req.query.path || "").replace(/^\/+|\/+$/g, "");
  const base = req.query.base === "subplot" ? "/subplot" : "";

  // Design preview. ?d=2 switches on the new look, ?d=1 switches it off, and the choice is
  // remembered in a cookie so links keep it while you click around. Nobody who has not asked
  // for it ever sees it, and the page is identical to production without the flag.
  const dq = String(req.query.d || "");
  if (dq === "1" || dq === "2") {
    res.setHeader("Set-Cookie", `subplot_design=${dq}; Path=/; Max-Age=${dq === "2" ? 604800 : 0}; SameSite=Lax`);
  }
  const cookieDesign = /(?:^|;\s*)subplot_design=2\b/.test(req.headers.cookie || "") ? 2 : 1;
  const activeDesign = dq === "2" ? 2 : dq === "1" ? 1 : cookieDesign;
  setDesign(activeDesign);

  // Daily health check, run by cron as /api/subplot?path=__health. Not a page: it is refused
  // unless it comes from Vercel's scheduler or carries CRON_SECRET, and it is never reachable
  // from the public site path because the host rewrite strips nothing else onto this route.
  if (path === "/__health") {
    const secret = process.env.CRON_SECRET;
    const fromCron = req.headers["x-vercel-cron"] || (secret && req.headers.authorization === "Bearer " + secret);
    // Fails closed: with no CRON_SECRET set there is no way to authorise, so the route does
    // not exist. (An earlier version compared undefined to undefined and let anyone through.)
    if (!fromCron && !(secret && req.query.key === secret)) return res.status(404).send("Not found");
    res.setHeader("Cache-Control", "no-store");
    return runHealth(req, res);
  }

  // Past this line everything renders a publication, so an unnamed host stops here.
  if (!resolved) { res.setHeader("Cache-Control", "no-store"); return res.status(404).send("Not found"); }

  // Creator signup. /api/auth/google and its callback are rewritten onto this function in
  // vercel.json rather than added as their own files: api/ sits on exactly twelve serverless
  // functions and Vercel Hobby fails the whole build at thirteen. The module is imported only
  // when one of these two routes is hit, so a normal page render never pays for it.
  if (path === "/__auth" || path === "/__auth/callback") {
    const auth = await import("./_subplot/auth.js");
    return path === "/__auth" ? auth.start(req, res) : auth.callback(req, res);
  }

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
  res.setHeader("Cache-Control", pass || activeDesign === 2 ? "private, no-store" : "public, s-maxage=300, stale-while-revalidate=3600");

  let html = null; let status = 200;
  const pg = Math.max(1, parseInt(req.query.p, 10) || 1);
  const q = String(req.query.q || "").trim().slice(0, 120);
  if (path === "/") html = homePage(data, base, "all", pg, q);
  else if (path.startsWith("/s/") && isSection(path.slice(3))) html = homePage(data, base, path.slice(3), pg, q);
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
