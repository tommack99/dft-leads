// House promo for the article rail: recruit SubPlotters where a reader is already reading one.
//
// Three variants, each arguing a different reason to join. Which one a reader sees is picked
// in the BROWSER, not on the server: pages are CDN-cached, so a server-side choice would hand
// the same variant to everyone who hit the same cached copy and the comparison would be junk.
//
// Measurement, in order of how much it is worth:
//   1. CONVERSIONS. The link carries ?v=<variant>, the application form keeps it in a hidden
//      field, and it lands on the monday row. That is the number that matters: applications
//      per variant, not clicks.
//   2. Views and clicks go to Vercel Web Analytics as custom events if the plan exposes them.
//      Written so that it is a no-op when it does not, and never breaks the page.

export const PROMO = [
  {
    id: "money",
    kicker: "Write for SUBPLOT",
    head: "Your videos are already articles. They just haven't been written yet.",
    line: "We turn them into pieces under your name and split what they earn 50/50.",
    cta: "See the terms",
  },
  {
    id: "readers",
    kicker: "Write for SUBPLOT",
    head: "Some of your audience would rather read than watch.",
    line: "Same take, in writing, linked back to the video. An audience on top of your views.",
    cta: "How it works",
  },
  {
    id: "yours",
    kicker: "Write for SUBPLOT",
    head: "Under your name. Non-exclusive. Leave whenever you like.",
    line: "No fees, no minimum term, and every article links to the video it came from.",
    cta: "Apply in a minute",
  },
];

export const promoCss = String.raw`
.promo{border-top:2px solid var(--ink);padding:1.1rem 0 1.3rem;display:block;text-decoration:none;color:inherit}
.promo .pk{font-family:var(--disp);font-weight:700;font-size:.64rem;letter-spacing:.14em;text-transform:uppercase;color:var(--blue)}
.promo h3{font-family:var(--disp);font-weight:700;font-size:1.02rem;line-height:1.22;letter-spacing:-.018em;margin:.55rem 0 .45rem}
.promo p{margin:0;font-size:.86rem;line-height:1.5;color:var(--ink-2)}
.promo .pc{display:inline-block;margin-top:.8rem;font-family:var(--disp);font-weight:700;font-size:.78rem;color:var(--blue)}
.promo:hover h3{color:var(--blue)}
.promo:hover .pc{text-decoration:underline}
.promo[hidden]{display:none}
`;

// All three are rendered; the browser reveals one. No layout shift: they are display:none
// until chosen, and the rail has no fixed height.
export function promoRail(base) {
  const cards = PROMO.map(v => `
  <a class="promo" data-v="${v.id}" hidden href="${base}/join?v=${v.id}">
    <span class="pk">${v.kicker}</span>
    <h3>${v.head}</h3>
    <p>${v.line}</p>
    <span class="pc">${v.cta} &rarr;</span>
  </a>`).join("");
  return `<div class="promowrap">${cards}<script>(function(){
  var els=document.querySelectorAll('.promowrap .promo');
  if(!els.length)return;
  var pick=els[Math.floor(Math.random()*els.length)];
  pick.hidden=false;
  var id=pick.getAttribute('data-v');
  function ev(n){try{if(window.va)window.va('event',{name:n,data:{variant:id}});}catch(e){}}
  ev('subplotter_promo_view');
  pick.addEventListener('click',function(){ev('subplotter_promo_click');});
})();</script></div>`;
}
