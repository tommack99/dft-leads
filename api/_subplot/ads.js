// SUBPLOT advertising. Nothing here is live until the AdSense publisher id is set in the
// Vercel env; until then every placement renders as the grey placeholder it does today.
//
//   ADSENSE_CLIENT        ca-pub-0000000000000000   turns ads on, serves ads.txt
//   ADSENSE_SLOT_<NAME>   1234567890                the ad unit id for one placement
//
// Placement names are the ones passed to adSlot(): leaderboard, in-article, article-rail,
// front-rail, in-feed, mobile-anchor. A placement with no slot id keeps its placeholder,
// so units can be switched on one at a time.

export const client = () => (process.env.ADSENSE_CLIENT || "").trim();
export const on = () => /^ca-pub-\d+$/.test(client());

const slotEnv = name => `ADSENSE_SLOT_${name.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`;
export const slotId = name => (process.env[slotEnv(name)] || "").trim();

// <head> tag. Loading the library also enables Auto ads if they are turned on in AdSense.
export const headTag = () => on()
  ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client()}" crossorigin="anonymous"></script>`
  : "";

// One ad unit, responsive within whatever box the placement gives it.
export function unit(name, extraClass = "") {
  const id = slotId(name);
  if (!on() || !id) return null;
  return `<div class="ad live ${extraClass}" data-slot="${name}">
    <ins class="adsbygoogle" style="display:block" data-ad-client="${client()}" data-ad-slot="${id}" data-ad-format="auto" data-full-width-responsive="true"></ins>
    <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
  </div>`;
}

// Required by Google so other sellers cannot pass off inventory as ours.
export const adsTxt = () => on()
  ? `google.com, ${client().replace(/^ca-/, "")}, DIRECT, f08c47fec0942fa0\n`
  : "";
