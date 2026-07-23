export const config={maxDuration:300};
// SCAN-ONLY. Reads the channel catalog (board 18421642067), scans each channel's last 7 days
// of uploads for brand sponsorships, writes brands to the Brand Spend board (18415192682).
// Discovery lives in api/channel-discovery.js. (Split 2026-07-18.)
// Detection v2 (2026-07-18): sponsor-signal gate + curated known-sponsor dictionary + generic
// fallback. Big recall uplift over the old narrow regex while controlling precision.
// Momentum (2026-07-20): numeric_mm3szew3 now holds week-over-week Momentum (this scan's channel
// count minus last scan's), NOT the old all-time peak. New brand = 0; a brand that dropped off
// this scan = negative (0 - last count). "recent" (numeric_mm3swzsf) stays the live count.
export default async function handler(req,res){
const YOUTUBE_API_KEY=process.env.YOUTUBE_API_KEY;
const MONDAY_API_KEY=process.env.MONDAY_API_KEY;
const BOARD_ID="18415192682";
const CATALOG_BOARD="18421642067";
const CAT_YTID="text_mm57h9s4",CAT_NICHE="text_mm57h3g2";
if(!YOUTUBE_API_KEY||!MONDAY_API_KEY)return res.status(500).json({error:"Missing env vars"});
const sleep=function(ms){return new Promise(function(r){setTimeout(r,ms);});};
async function monday(q){const r=await fetch("https://api.monday.com/v2",{method:"POST",headers:{"Content-Type":"application/json","Authorization":MONDAY_API_KEY},body:JSON.stringify({query:q})});return r.json();}

async function loadCatalog(){
const out=[];let cursor=null;
for(let p=0;p<12;p++){
const q=cursor
?"{next_items_page(limit:250,cursor:"+JSON.stringify(cursor)+"){cursor items{name column_values(ids:[\""+CAT_YTID+"\",\""+CAT_NICHE+"\"]){id text}}}}"
:"{boards(ids:["+CATALOG_BOARD+"]){items_page(limit:250){cursor items{name column_values(ids:[\""+CAT_YTID+"\",\""+CAT_NICHE+"\"]){id text}}}}}";
let d;try{d=await monday(q);}catch(e){break;}
const page=cursor?(d&&d.data&&d.data.next_items_page):(d&&d.data&&d.data.boards&&d.data.boards[0]&&d.data.boards[0].items_page);
if(!page)break;
for(const it of(page.items||[])){let ytId="",niche="";for(const cv of(it.column_values||[])){if(cv.id===CAT_YTID)ytId=(cv.text||"").trim();if(cv.id===CAT_NICHE)niche=(cv.text||"").trim();}if(ytId)out.push({id:ytId,name:it.name,niche:niche?niche.split("/"):["Gaming","Film"]});}
cursor=page.cursor;if(!cursor)break;
}
return out;
}
const catalog=await loadCatalog();

// ---- detection v2 ----
// A description must carry a genuine sponsorship SIGNAL before we read brands from it — this
// stops us tagging brands a channel merely talks about editorially.
const SIGNAL=/(sponsor|sponsored|sponsorship|brought to you by|thanks to|in partnership|partnered with|#ad\b|\bad\b|promo code|use code|discount code|coupon|% off|percent off|free trial|sign up at|check out|head to|go to|download|affiliate|link below|link in (?:the )?description|check the description)/i;

// Curated known creator-sponsor dictionary. Distinctive names match anywhere; common English
// words (aura, ridge, honey, notion, chime, factor, brilliant, casper, wix...) are matched by
// their DOMAIN/compound form only, so normal prose can't trigger them.
const BRAND_TOKENS={
"NordVPN":["nordvpn","nord vpn"],"Surfshark":["surfshark"],"ExpressVPN":["expressvpn","express vpn"],"Private Internet Access":["private internet access","privateinternetaccess"],"CyberGhost":["cyberghost"],"Proton VPN":["protonvpn","proton vpn"],"Atlas VPN":["atlas vpn","atlasvpn"],"NordPass":["nordpass"],"Incogni":["incogni"],"DeleteMe":["joindeleteme","deleteme"],"1Password":["1password"],"Dashlane":["dashlane"],"Malwarebytes":["malwarebytes"],"Aura":["aura.com","auraframes"],
"BetterHelp":["betterhelp","better help"],"Talkspace":["talkspace"],"Manscaped":["manscaped"],"Dr Squatch":["dr squatch","drsquatch","dr. squatch"],"Harry's":["harrys.com","harry's"],"Keeps":["keeps.com","joinkeeps"],"Hims":["forhims","hims.com"],"MeUndies":["meundies"],"Scentbird":["scentbird"],"Native":["nativedeo","native.com"],"Function of Beauty":["function of beauty","functionofbeauty"],
"Squarespace":["squarespace"],"Wix":["wix.com"],"Shopify":["shopify"],"Notion":["notion.so","notion.com"],"Grammarly":["grammarly"],"Skillshare":["skillshare"],"Brilliant":["brilliant.org"],"MasterClass":["masterclass"],"Audible":["audible.com","audibletrial","audible.co"],"Babbel":["babbel"],"Rosetta Stone":["rosetta stone"],"CuriosityStream":["curiositystream"],"Nebula":["nebula.tv","watchnebula"],"Blinkist":["blinkist"],"Fiverr":["fiverr"],"Canva":["canva.com"],
"Displate":["displate"],"Established Titles":["established titles","establishedtitles"],"Ground News":["ground news","ground.news","groundnews"],"Honey":["joinhoney","honey.com"],"Opera GX":["opera gx","operagx"],"KiwiCo":["kiwico"],"Curiosity Box":["curiosity box","curiositybox"],"World Anvil":["world anvil","worldanvil"],
"Raid Shadow Legends":["raid shadow legends","raid: shadow legends","plarium"],"Rise of Kingdoms":["rise of kingdoms"],"AFK Arena":["afk arena"],"AFK Journey":["afk journey"],"Whiteout Survival":["whiteout survival"],"Call of Dragons":["call of dragons"],"State of Survival":["state of survival"],"Marvel Snap":["marvel snap"],"Hero Wars":["hero wars"],"World of Tanks":["world of tanks"],"World of Warships":["world of warships"],"War Thunder":["war thunder"],
"HelloFresh":["hellofresh","hello fresh"],"Green Chef":["greenchef","green chef"],"Factor":["factormeals","factor meals","factor75"],"CookUnity":["cookunity","cook unity"],"Blue Apron":["blue apron"],"Magic Spoon":["magic spoon","magicspoon"],"Athletic Greens":["athletic greens","ag1"],"LMNT":["drinklmnt","lmnt"],"Seed":["seed.com"],"Ritual":["ritual.com"],
"Helix Sleep":["helix sleep","helixsleep"],"Casper":["casper.com"],"Eight Sleep":["eight sleep","eightsleep"],"Brooklinen":["brooklinen"],"Purple":["purple.com"],"Ridge":["ridge wallet","ridgewallet","ridge.com"],"Bespoke Post":["bespoke post","bespokepost"],"Vessi":["vessi"],
"Rocket Money":["rocket money","rocketmoney"],"Chime":["chime.com"],"SoFi":["sofi.com"],"Cash App":["cash app","cashapp"],"Acorns":["acorns"],"DraftKings":["draftkings"],
"Raycon":["raycon","buyraycon"],"Anker":["anker"],"Elgato":["elgato"],"Logitech":["logitech"],"Razer":["razer"],"SteelSeries":["steelseries"],"Corsair":["corsair"],"Secretlab":["secretlab"],"ASUS ROG":["asus rog","republic of gamers"],"MSI":["msi.com"],"GFuel":["gfuel","g fuel"],"Intel":["intel.com"],"NZXT":["nzxt"],
"DoorDash":["doordash"],"Saily":["saily.com","getsaily"],"MUBI":["mubi.com"],"Shudder":["shudder"],"Established":["establishedtitles"]
};
const NOISE=["youtube","google","twitter","instagram","discord","twitch","reddit","amazon","apple","microsoft","steam","playstation","xbox","nintendo","patreon","spotify","netflix","facebook","tiktok","linkedin","subscribe","channel","video","watch","click","link","links","below","description","comment","like","share","merch","support","music","join","members","podcast","http","https","www","com","net","org","co","io","checkout","check","code","codes","store","shop","cart","deal","deals","offer","offers","discount","coupon","sale","promo","today","free","get","new","best","top","review","reviews","here"];

function extractSponsors(desc,channelName){
if(!desc)return[];
const d=desc.toLowerCase();
if(!SIGNAL.test(d))return[]; // no sponsorship signal → skip
const found=new Set();
for(const brand in BRAND_TOKENS){for(const t of BRAND_TOKENS[brand]){if(d.includes(t)){found.add(brand);break;}}}
// generic fallback: still discover NEW sponsors not yet in the dictionary
const chan=channelName.toLowerCase().replace(/\s+/g,"");
const noiseLower=NOISE;
function ok(b){return b.length>3&&b.length<30&&!noiseLower.includes(b.toLowerCase())&&!/^(https?|www)$/i.test(b)&&b.toLowerCase()!==chan;}
const byPattern=/(?:sponsored by|brought to you by|partner(?:ed)? with|in partnership with)\s+([A-Za-z][a-zA-Z0-9]+(?:\s[A-Z][a-zA-Z0-9]+)?)/gi;
for(const m of [...desc.matchAll(byPattern)]){const b=m[1].trim();if(ok(b))found.add(b);}
const codePattern=/(?:use code|promo code|discount code)\s+\w+\s+(?:at|for|on)\s+([A-Z][a-zA-Z0-9]+)/gi;
for(const m of [...desc.matchAll(codePattern)]){const b=m[1].trim();if(ok(b))found.add(b);}
return[...found];
}

const WINDOW_DAYS=30,MAX_VIDS_PER_CHANNEL=40;
const cutoffMs=Date.now()-WINDOW_DAYS*24*60*60*1000;
function uploadsPlaylist(channelId){return channelId&&channelId.slice(0,2)==="UC"?"UU"+channelId.slice(2):"";}
async function getRecentVideoIds(uploadsId){
if(!uploadsId)return[];const ids=[];let pageToken="";
try{
for(let page=0;page<3;page++){
const r=await fetch("https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId="+uploadsId+"&maxResults=50&key="+YOUTUBE_API_KEY+(pageToken?"&pageToken="+pageToken:""));
const d=await r.json();let stop=false;
for(const i of(d.items||[])){const cd=i.contentDetails||{};const pub=cd.videoPublishedAt?Date.parse(cd.videoPublishedAt):0;if(pub&&pub<cutoffMs){stop=true;break;}if(cd.videoId)ids.push(cd.videoId);if(ids.length>=MAX_VIDS_PER_CHANNEL){stop=true;break;}}
pageToken=d.nextPageToken||"";if(stop||!pageToken)break;
}
}catch(e){}
return ids;
}
async function getVideoDetails(ids){
if(!ids.length)return[];const out=[];
for(let i=0;i<ids.length;i+=50){try{const r=await fetch("https://www.googleapis.com/youtube/v3/videos?part=snippet&id="+ids.slice(i,i+50).join(",")+"&key="+YOUTUBE_API_KEY);for(const v of(((await r.json()).items)||[]))out.push(v);}catch(e){}}
return out;
}

const brandData={};const today=new Date().toISOString().split("T")[0];let processed=0;
const MAX_CHANNELS=1000;
const channelsToProcess=catalog.slice(0,MAX_CHANNELS);
const CONCURRENCY=20;
for(let bi=0;bi<channelsToProcess.length;bi+=CONCURRENCY){const batch=channelsToProcess.slice(bi,bi+CONCURRENCY);await Promise.all(batch.map(async function(channel){
try{
const vids=await getRecentVideoIds(uploadsPlaylist(channel.id));
const videos=await getVideoDetails(vids);
for(const v of videos){for(const s of extractSponsors(v.snippet&&v.snippet.description||"",channel.name)){const k=s.toLowerCase().replace(/\s+/g,"");if(!brandData[k])brandData[k]={name:s,channels:new Set(),niches:new Set(),lastSeen:today};brandData[k].channels.add(channel.name);for(const nn of(channel.niche||[]))brandData[k].niches.add(nn);brandData[k].lastSeen=today;}}
processed++;
}catch(e){processed++;}}));await sleep(50);
}

const exRes=await monday("{boards(ids:["+BOARD_ID+"]){items_page(limit:500){items{id name column_values(ids:[\"numeric_mm3swzsf\"]){id text}}}}}");
const exMap={};
for(const i of(exRes&&exRes.data&&exRes.data.boards&&exRes.data.boards[0]&&exRes.data.boards[0].items_page&&exRes.data.boards[0].items_page.items)||[]){const cv=i.column_values||[];const gv=function(cid){const c=cv.find(function(x){return x.id===cid;});return Number((c&&c.text)||0);};exMap[i.name.toLowerCase()]={id:i.id,rec:gv("numeric_mm3swzsf")};}

// dict brands are already canonical; DISPLAY only tidies generic-fallback captures
const DISPLAY={buyraycon:"Raycon"};
function displayName(name){if(BRAND_TOKENS[name])return name;const k=name.toLowerCase().replace(/\s+/g,"");if(DISPLAY[k])return DISPLAY[k];return name.charAt(0).toUpperCase()+name.slice(1);}

// Keep brands seen on 2+ channels (single-channel added too much noise), all in the one group.
const brands=Object.values(brandData).filter(function(d){return d.channels.size>=2;}).sort(function(a,b){return b.channels.size-a.channels.size;});
let saved=0;
for(const data of brands){const dn=displayName(data.name);const tier=data.channels.size>=5?"High":data.channels.size>=3?"Mid":"Low";const ex=exMap[dn.toLowerCase()];const trend=!ex?"New":data.channels.size>ex.rec?"Rising":data.channels.size<ex.rec?"Falling":"Steady";const momentum=ex?(data.channels.size-ex.rec):0;const niche=[...data.niches].sort().join("/")||"Gaming/Film";
const cols={text_mm3shz66:dn,numeric_mm3swzsf:data.channels.size,numeric_mm3szew3:momentum,date_mm3sx6hp:{date:data.lastSeen},text_mm3ss133:[...data.channels].slice(0,5).join(", "),text_mm3shf6v:niche,color_mm3samv9:{label:tier},color_mm3sgerw:{label:trend}};
const eid=ex&&ex.id;
try{
if(eid){await monday("mutation{change_multiple_column_values(board_id:"+BOARD_ID+",item_id:"+eid+",column_values:"+JSON.stringify(JSON.stringify(cols))+",create_labels_if_missing:true){id}}");}
else{
// New brand: create WITHOUT the Trend value, then set Trend in a second call so it registers as a
// status CHANGE — this is what fires the Monday "when Trend changes to New" email automation.
const colsNoTrend=Object.assign({},cols);delete colsNoTrend.color_mm3sgerw;
const cr=await monday("mutation{create_item(board_id:"+BOARD_ID+",item_name:"+JSON.stringify(dn.substring(0,50))+",column_values:"+JSON.stringify(JSON.stringify(colsNoTrend))+",create_labels_if_missing:true){id}}");
const newId=cr&&cr.data&&cr.data.create_item&&cr.data.create_item.id;
if(newId)await monday("mutation{change_multiple_column_values(board_id:"+BOARD_ID+",item_id:"+newId+",column_values:"+JSON.stringify(JSON.stringify({color_mm3sgerw:{label:trend}}))+",create_labels_if_missing:true){id}}");
}
saved++;
}catch(e){}
}

const seenSet=new Set(brands.map(function(b){return displayName(b.name).toLowerCase();}));
for(const zk in exMap){if(seenSet.has(zk))continue;try{await monday("mutation{change_multiple_column_values(board_id:"+BOARD_ID+",item_id:"+exMap[zk].id+",column_values:"+JSON.stringify(JSON.stringify({numeric_mm3swzsf:0,numeric_mm3szew3:-(exMap[zk].rec||0),color_mm3sgerw:{label:"Falling"}}))+",create_labels_if_missing:true){id}}");}catch(e){}}

return res.json({message:"Done (scan-only v3)",windowDays:WINDOW_DAYS,catalogLoaded:catalog.length,channelsProcessed:processed,brandsFound:Object.keys(brandData).length,brandsOn2Plus:brands.filter(function(b){return b.channels.size>=2;}).length,brandsEmerging:brands.filter(function(b){return b.channels.size===1;}).length,saved,topBrands:brands.slice(0,25).map(function(b){return{name:displayName(b.name),channels:b.channels.size,niche:[...b.niches].sort().join("/")};})});
}
