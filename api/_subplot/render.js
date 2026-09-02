// SUBPLOT page templates. Pure functions: (data, base) -> HTML string.
import { CSS } from "./css.js";
import { CATS } from "./data.js";

const BRAND = "SUBPLOT";
const TAG = "The story under the story. Breakdowns, theories, reactions, opinions, reviews and lore from the people who actually watch it.";

export const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = p => new Date(p).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const dayLabel = p => new Date(p).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const dayKey = p => String(p).slice(0, 10);
const initials = n => n.replace(/[^A-Za-z ]/g, "").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
const slugH = h => h.replace(/^@/, "");

const EXTRA_CSS = String.raw`
.card{text-decoration:none;color:inherit}
a.lead,a.card,.takes a,.wire a,.roster a{text-decoration:none;color:inherit}
.wire a{width:100%;display:grid;grid-template-columns:1fr auto;gap:0 1rem;align-items:stretch;cursor:pointer;transition:background .15s}
.wire a:hover{background:var(--paper-2)}
.wire a:hover .txt h3{color:var(--blue)}
.takes a{display:grid;width:100%;grid-template-columns:2px 1fr;gap:0 .7rem;cursor:pointer;align-items:stretch}
.takes a:hover .tk span{color:var(--blue)}
.nav a{cursor:pointer;white-space:nowrap;font-family:var(--disp);font-weight:700;font-size:.74rem;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-2);padding:1.05rem 1.2rem;border-bottom:3px solid transparent;margin-bottom:-1px;text-decoration:none;transition:color .15s,border-color .15s}
.nav a:hover{color:var(--blue)}
.nav a[aria-current="true"]{color:var(--blue);border-bottom-color:var(--blue)}
.nav a.join{margin-left:auto;color:var(--orange-ink)}
.nav a.join:hover{border-bottom-color:var(--orange)}
.top-meta a.joinlink{color:var(--blue);font-weight:500;font-family:var(--disp);font-size:.74rem;letter-spacing:.06em;text-transform:uppercase;text-decoration:none}
.top-meta a.joinlink:hover{color:var(--orange-ink)}
.brandblock{text-decoration:none;color:inherit}
.back{text-decoration:none}
.band a.cta,.joinhero a.cta{text-decoration:none;display:inline-block}
.foot a{color:inherit;text-decoration:none}
.foot a:hover{color:var(--blue)}
.roster a{display:flex;align-items:center;gap:.7rem;width:100%}
.roster li{padding:0}
.roster a{padding:.55rem 1.3rem}
.roster a:hover{background:var(--paper-2)}
.chead{display:grid;grid-template-columns:auto 1fr;gap:1.4rem;align-items:center;padding:2.4rem 0 1.8rem;border-bottom:1px solid var(--ink)}
.chead .mono{width:64px;height:64px;font-size:1.2rem}
.chead h1{font-family:var(--disp);font-weight:800;font-size:clamp(1.8rem,4vw,2.8rem);letter-spacing:-.025em;margin:0;line-height:1.05}
.chead p{margin:.3rem 0 0;color:var(--ink-2)}
.chead .meta{margin-top:.5rem;display:block}
.chead a.yt{color:var(--blue);font-weight:700;text-decoration:none;border-bottom:1.5px solid currentColor}
.empty{padding:3rem 0;color:var(--ink-2)}
.wire .sub a{color:var(--blue-ink);font-weight:600;text-decoration:none}
.wire .sub a:hover{text-decoration:underline}
`;

function shell({ base, title, desc, body, current = "all", bodyClass = "" }) {
  const nav = [["all", "All"], ...Object.entries(CATS)].map(([k, n]) =>
    `<a href="${base}/${k === "all" ? "" : "s/" + k}" ${k === current ? 'aria-current="true"' : ""}>${esc(n)}</a>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=DM+Mono:wght@400;500&family=Mulish:wght@400;600;700&display=swap">
<style>${CSS}${EXTRA_CSS}</style>
</head>
<body class="${bodyClass}">
<header class="top">
  <div class="wrap top-in">
    <a class="brandblock" href="${base}/">
      <span class="wordmark">${BRAND}</span>
      <span class="plotline"></span>
      <span class="tagline">${esc(TAG)}</span>
    </a>
    <div class="top-meta">
      <b>${esc(new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" }))}</b>
      <span id="panelcount-slot"></span>
    </div>
  </div>
  <nav class="nav"><div class="wrap nav-in">${nav}<a class="join" href="${base}/join">Become a SubPlotter</a></div></nav>
</header>
${body}
<footer class="foot">
  <div class="wrap foot-in">
    <div><p class="fm">${BRAND}</p><p>${esc(TAG)}</p></div>
    <div><h3>About</h3><ul><li><a href="${base}/join">Become a SubPlotter</a></li><li>Who we are</li><li>Editorial standards</li><li>How we use AI</li></ul></div>
    <div><h3>Sections</h3><ul>${Object.entries(CATS).map(([k, n]) => `<li><a href="${base}/s/${k}">${esc(n)}</a></li>`).join("")}</ul></div>
    <div><h3>Contact</h3><p>hello@subplot.tv</p><p>corrections@subplot.tv</p><p class="legal">Terms &middot; Privacy &middot; Creator agreement</p></div>
  </div>
  <div class="protolabel"><div class="wrap">Private preview &middot; not indexed &middot; articles read live from the production feed</div></div>
</footer>
<script>
document.addEventListener('click', e => {
  const play = e.target.closest('.player .play');
  if (!play) return;
  const p = play.closest('.player'); const v = p.dataset.v;
  const ifr = document.createElement('iframe');
  ifr.src = 'https://www.youtube-nocookie.com/embed/' + v + '?autoplay=1&rel=0';
  ifr.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
  ifr.allowFullscreen = true; ifr.title = 'Original video';
  p.appendChild(ifr); play.remove();
});
</script>
</body>
</html>`;
}

const card = (a, base) => `
  <a class="card" href="${base}/a/${esc(a.id)}">
    <span class="thumb"><img alt="" loading="lazy" src="${esc(a.thumbSmall)}"></span>
    <span class="kicker">${esc(CATS[a.k])}</span>
    <span class="headline">${esc(a.h)}</span>
    <span class="who"><b>${esc(a.c)}</b> · ${a.rt} min</span>
  </a>`;

function wire(list, base) {
  const groups = [];
  for (const a of list) {
    const g = groups[groups.length - 1];
    if (g && g.k === dayKey(a.p)) g.items.push(a); else groups.push({ k: dayKey(a.p), p: a.p, items: [a] });
  }
  return groups.map(g => `
    <section class="daygroup"><div class="daylabel">${esc(dayLabel(g.p))}</div><ul class="wire">
    ${g.items.map(a => `
      <li><a href="${base}/a/${esc(a.id)}">
        <span class="txt"><h3>${esc(a.h)}</h3>
          <span class="sub"><b>${esc(a.b)}</b><span>${esc(CATS[a.k])}</span></span></span>
        <span class="rt">${a.rt} min</span>
      </a></li>`).join("")}
    </ul></section>`).join("");
}

function rail(panel, base) {
  return `
    <aside class="rail">
      <div class="box">
        <h2>The Panel</h2>
        <p class="note">Every article is adapted from one creator&rsquo;s own video and runs under their name. No anonymous bylines.</p>
        <ul class="roster">${panel.map(p => `
          <li><a href="${base}/c/${esc(slugH(p.handle))}"><span class="mono">${esc(initials(p.name))}</span>
            <span class="rn">${esc(p.handle)}</span>
            <span class="rc">${p.n}</span></a></li>`).join("")}
        </ul>
      </div>
      <div class="box">
        <h2>Editorial standards</h2>
        <ul class="stdlist">
          <li>Each article names the creator it came from and links the source video.</li>
          <li>Claims keep the strength the creator gave them &mdash; a rumour stays a rumour.</li>
          <li>AI assistance is disclosed on every article.</li>
          <li>Corrections: <span style="color:var(--ink)">corrections@subplot.tv</span></li>
        </ul>
      </div>
    </aside>`;
}

const band = base => `
    <section class="band">
      <div><h2>Make videos? Get read.</h2>
      <p>SUBPLOT turns the videos you already make into articles, under your name, with a link back to every one. We split what they earn down the middle. Apply with your YouTube handle.</p></div>
      <a class="cta" href="${base}/join">Become a SubPlotter</a>
    </section>`;

export function homePage(data, base, section = "all") {
  const list = data.arts.filter(a => section === "all" || a.k === section);
  if (!list.length) return shell({ base, title: `${BRAND} — ${CATS[section] || "Front Page"}`, desc: TAG, current: section,
    body: `<main class="homeview"><div class="wrap"><p class="empty">Nothing in this section yet.</p></div></main>` });
  const lead = list[0]; const rest = list.slice(1);
  const seconds = rest.slice(0, 3); const wireList = rest.slice(3);
  const threads = data.threads.filter(t => section === "all" || t.k === section);
  const byId = id => data.arts.find(a => a.id === id);
  const body = `
<main class="homeview">
  <div class="wrap">
    <a class="lead" href="${base}/a/${esc(lead.id)}">
      <span class="plate"><img alt="" src="${esc(lead.thumb)}"></span>
      <span class="leadgrid">
        <span><span class="kicker">${esc(CATS[lead.k])}</span>
          <h2 class="headline" style="margin-top:.45rem">${esc(lead.h)}</h2></span>
        <span class="leadside"><span class="dek">${esc(lead.s)}</span>
          <span class="leadmeta"><span class="who"><b>${esc(lead.c)}</b></span>
            <span class="meta">${esc(fmt(lead.p))} · ${lead.w.toLocaleString("en-GB")} words · ${lead.rt} min read</span></span></span>
      </span>
    </a>
    ${threads.length ? `
    <section>
      <div class="rule-h"><h2>Threads</h2><span class="note">one subject, several creators</span></div>
      <div class="threads">${threads.map(t => `
        <section class="thread">
          <div class="thread-top"><span class="kicker">Thread</span><h3>${esc(t.t)}</h3>
            <span class="count">${t.n} articles · ${t.c} creators</span></div>
          <ul class="takes">${t.items.map(byId).filter(Boolean).map(a => `
            <li><a href="${base}/a/${esc(a.id)}"><span class="stripe"></span>
              <span class="tk"><b>${esc(a.b)}</b><span>${esc(a.h)}</span></span></a></li>`).join("")}
          </ul>
        </section>`).join("")}
      </div>
    </section>` : ""}
    <div class="rule-h"><h2>Latest${section === "all" ? " across the network" : " in " + esc(CATS[section])}</h2><span class="note">${list.length} stories</span></div>
    <section class="grid3">${seconds.map(a => card(a, base)).join("")}</section>
    <div class="cols">
      <div>${wire(wireList, base)}</div>
      ${rail(data.panel, base)}
    </div>
    ${band(base)}
  </div>
</main>`;
  return shell({ base, title: section === "all" ? `${BRAND}` : `${CATS[section]} — ${BRAND}`, desc: TAG, current: section, body })
    .replace('<span id="panelcount-slot"></span>', `<span>${data.panel.length} creators writing here</span>`);
}

export function articlePage(a, data, base) {
  const body = `
<article class="artview" style="display:block">
  <div class="artrule"></div>
  <div class="wrap">
    <a class="back" href="${base}/">&larr; Back to the front page</a>
    <div class="artmain">
      <span class="kicker">${esc(CATS[a.k])}</span>
      <h1 class="headline">${esc(a.h)}</h1>
      <p class="dek">${esc(a.s)}</p>
      <div class="authorbar"><span class="mono">${esc(initials(a.b))}</span>
        <span class="nm"><b><a href="${base}/c/${esc(slugH(a.c))}" style="color:inherit;text-decoration:none">${esc(a.c)}</a></b><span>${esc(fmt(a.p))}</span></span>
        <span class="meta">${a.w.toLocaleString("en-GB")} words · ${a.rt} min read</span></div>
      <div class="prose">${a.body}</div>
      <div class="rule-h" style="margin-top:2.6rem"><h2>Watch the original</h2><span class="note">${esc(a.c)} · YouTube</span></div>
      <div class="player" data-v="${esc(a.v)}" style="margin-top:1rem">
        <img alt="" src="${esc(a.thumb)}">
        <button class="play" aria-label="Play the original video"></button>
      </div>
      <p class="disclose">Adapted from ${esc(a.b)}&rsquo;s original video. Written with the help of AI from that video&rsquo;s transcript; the views and analysis are ${esc(a.b)}&rsquo;s own.</p>
      <div class="tags">${a.t.map(t => `<span>${esc(t)}</span>`).join("")}</div>
    </div>
  </div>
</article>`;
  return shell({ base, title: `${a.h} — ${BRAND}`, desc: a.s, current: a.k, body })
    .replace('<span id="panelcount-slot"></span>', `<span>${data.panel.length} creators writing here</span>`);
}

export function creatorPage(handle, data, base) {
  const list = data.arts.filter(a => slugH(a.c).toLowerCase() === handle.toLowerCase());
  if (!list.length) return null;
  const name = list[0].b; const h = list[0].c;
  const body = `
<main class="homeview">
  <div class="wrap">
    <div class="chead">
      <span class="mono">${esc(initials(name))}</span>
      <div><h1>${esc(h)}</h1>
        <p>${list.length} article${list.length === 1 ? "" : "s"} on ${BRAND} &middot; <a class="yt" href="https://www.youtube.com/${esc(h)}" target="_blank" rel="noopener">Channel on YouTube</a></p>
        <span class="meta">Every piece below is adapted from one of ${esc(name)}&rsquo;s own videos, with the video at the end.</span></div>
    </div>
    <section class="grid3">${list.slice(0, 3).map(a => card(a, base)).join("")}</section>
    <div class="cols">
      <div>${wire(list.slice(3), base)}</div>
      ${rail(data.panel, base)}
    </div>
  </div>
</main>`;
  return shell({ base, title: `${name} — ${BRAND}`, desc: `${name}'s videos, in writing.`, body })
    .replace('<span id="panelcount-slot"></span>', `<span>${data.panel.length} creators writing here</span>`);
}

export function joinPage(data, base) {
  const body = `
<section class="joinview" style="display:block">
  <div class="artrule" style="background:var(--orange)"></div>
  <div class="wrap">
    <a class="back" href="${base}/">&larr; Back to the front page</a>
    <div class="joinhero">
      <div><span class="kicker">Become a SubPlotter</span>
        <h1>Your videos, <em>in writing.</em> Under your name.</h1></div>
      <div><p>You make the video. We turn it into an article that people find on Google and Discover, bylined to you, linking back to your channel. You don&rsquo;t write a word.</p>
        <a class="cta" href="#apply">Apply with your handle</a></div>
    </div>
    <div class="rule-h"><h2>How it works</h2><span class="note">three steps, one of them yours</span></div>
    <div class="steps">
      <div class="step"><span class="n">01</span><h3>You keep making videos.</h3><p>Nothing changes on your channel. You upload as normal; we pick up each new video from your public captions.</p></div>
      <div class="step"><span class="n">02</span><h3>We turn each one into an article.</h3><p>Our system drafts it from your transcript, then checks it line by line against what you actually said. Your claims stay your claims &mdash; a rumour stays a rumour. Nothing gets invented.</p></div>
      <div class="step"><span class="n">03</span><h3>It runs under your name.</h3><p>Your byline, your channel link on every piece, your audience. Pull any article at any time. Leave whenever you like.</p></div>
    </div>
    <div class="honest"><span class="lbl">The honest bit</span>
      <div><p>The first draft is written by AI, from your YouTube video transcript. A fidelity check then compares it with the video and holds anything that drifts. Every article says so in a short note at the end &mdash; readers don&rsquo;t mind how something was made; they mind being lied to about it.</p>
        <p>What&rsquo;s never AI: the ideas, the takes, the jokes, the reporting, the personality. Those are yours, which is the whole point.</p></div>
    </div>
    <div class="twocol">
      <div><h3>What you get</h3><ul>
        <li><b>An audience on top of your views, not instead of them.</b> Google and Discover surface articles, so these are readers your video wasn&rsquo;t going to reach &mdash; and every article points them at the video.</li>
        <li><b>A link back on every piece.</b> Each article points at the video it came from.</li>
        <li><b>Half of what your articles earn.</b> A straight 50/50 split. No fees, no minimum term, no exclusivity. Paid monthly once your balance clears $50.</li>
        <li><b>Company.</b> Your take sits alongside other creators covering the same thing &mdash; see Threads on the front page.</li></ul></div>
      <div><h3>What we ask</h3><ul>
        <li><b>The videos are yours.</b> You own them, or hold the rights to have them adapted.</li>
        <li><b>Captions on.</b> We work from your public transcript; auto-captions are fine.</li>
        <li><b>A real name and a real channel.</b> No anonymous bylines here.</li>
        <li><b>Patience with the odd hold.</b> If the check flags an article, it waits for a human. That&rsquo;s a feature.</li></ul></div>
    </div>
    <div class="apply" id="apply">
      <div class="aside"><h2>Apply with your YouTube handle.</h2>
        <p>That&rsquo;s all we really need &mdash; we look at the channel, the captions and the kind of videos you make, then come back to you within a week.</p>
        <p>The terms are the same for everyone and they&rsquo;re on the form, so there&rsquo;s nothing to negotiate and nothing hidden.</p>
        <p>We&rsquo;re taking film, TV, games, comics, anime and everything adjacent. Long-form, reactions, breakdowns, lore, interviews.</p></div>
      <form class="form" id="applyform" method="post" action="${base}/api/apply">
        <div class="field"><label for="f-handle">YouTube handle</label>
          <div class="handle"><span>youtube.com/</span><input id="f-handle" name="handle" placeholder="@yourchannel" required autocomplete="off"></div></div>
        <div class="row2">
          <div class="field"><label for="f-name">Your name</label><input id="f-name" name="name" placeholder="As it should appear on your byline" required></div>
          <div class="field"><label for="f-email">Email</label><input id="f-email" name="email" type="email" placeholder="you@example.com" required></div>
        </div>
        <div class="row2">
          <div class="field"><label for="f-kind">What you make</label>
            <select id="f-kind" name="kind"><option>Breakdowns &amp; theories</option><option>Reviews &amp; reactions</option><option>Lore &amp; explainers</option><option>News &amp; leaks</option><option>Gaming</option><option>Anime</option><option>Interviews</option><option>Something else</option></select></div>
          <div class="field"><label for="f-size">Channel size <small>(optional)</small></label>
            <select id="f-size" name="size"><option value="">Rather not say</option><option>Under 10k</option><option>10k &ndash; 100k</option><option>100k &ndash; 500k</option><option>500k &ndash; 1M</option><option>Over 1M</option></select></div>
        </div>
        <div class="terms"><span class="lbl">Standard terms</span>
          <p><b>50 / 50</b> on everything your articles earn &middot; non-exclusive, so run them anywhere else you like &middot; no fees, no minimum term &middot; leave any time and we take the articles down &middot; paid monthly from $50.</p></div>
        <label class="consent"><input type="checkbox" name="consent" value="yes" required><span>I own these videos or hold the rights to have them adapted, and I understand articles are drafted from my transcripts with AI assistance and published under my name.</span></label>
        <input type="text" name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">
        <button class="submit" type="submit" id="f-submit">Send application</button>
        <p class="formnote" id="formnote">We reply to every application. Nothing publishes until you&rsquo;ve said yes to the terms.</p>
      </form>
      <div class="done" id="applydone" hidden><b>Got it &mdash; thanks.</b><p>We&rsquo;ll look at the channel and be in touch within a week. Nothing publishes until you&rsquo;ve agreed the terms.</p></div>
    </div>
  </div>
</section>
<script>
(function(){
  const form = document.getElementById('applyform');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('f-submit'); btn.disabled = true; btn.textContent = 'Sending…';
    const fd = new FormData(form); const rec = Object.fromEntries(fd.entries());
    try {
      const r = await fetch(form.action, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(rec) });
      if (!r.ok) throw new Error(String(r.status));
      form.hidden = true; document.getElementById('applydone').hidden = false;
    } catch (err) {
      btn.disabled = false; btn.textContent = 'Send application';
      document.getElementById('formnote').textContent = 'That didn’t go through — try again, or email hello@subplot.tv with your handle.';
    }
  });
})();
</script>`;
  return shell({ base, title: `Become a SubPlotter — ${BRAND}`, desc: "Your videos, in writing. Under your name.", body })
    .replace('<span id="panelcount-slot"></span>', `<span>${data.panel.length} creators writing here</span>`);
}

export function notFound(base) {
  return shell({ base, title: `Not found — ${BRAND}`, desc: "", body: `<main class="homeview"><div class="wrap"><p class="empty">That page isn&rsquo;t here. <a href="${base}/">Back to the front page.</a></p></div></main>` })
    .replace('<span id="panelcount-slot"></span>', "");
}
