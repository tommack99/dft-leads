export const config={maxDuration:300};
// SCAN-ONLY. Reads the persistent channel catalog (board 18421642067), scans each channel's
// last 7 days of uploads for brand sponsorships, and writes brands to the Brand Spend board.
// Discovery/catalog-building lives in a SEPARATE endpoint: api/channel-discovery.js.
// (Split 2026-07-18 so a single 300s run never has to discover AND scan — that was timing out.)
export default async function handler(req,res){
const YOUTUBE_API_KEY=process.env.YOUTUBE_API_KEY;
const MONDAY_API_KEY=process.env.MONDAY_API_KEY;
const BOARD_ID="18415192682";              // Brand Spend Intelligence (output)
const CATALOG_BOARD="18421642067";         // Brand Scraper — Channel Catalog (input)
const CAT_YTID="text_mm57h9s4",CAT_NICHE="text_mm57h3g2";
if(!YOUTUBE_API_KEY||!MONDAY_API_KEY)return res.status(500).json({error:"Missing env vars"});
const sleep=function(ms){return new Promise(function(r){setTimeout(r,ms);});};
async function monday(q){const r=await fetch("https://api.monday.com/v2",{method:"POST",headers:{"Content-Type":"application/json","Authorization":MONDAY_API_KEY},body:JSON.stringify({query:q})});return r.json();}

// ---- load the channel catalog (paginated) ----
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

// ---- sponsor detection ----
// NOISE now also strips URL schemes/hosts (http/https/www + bare TLDs) and generic commerce/CTA
// words (checkout/check/link/code/store/deal/promo/...) — this kills false positives like the
// "Checkout.com" row that came from creators' "check out the link" CTAs.
const NOISE=["YouTube","Google","Twitter","Instagram","Discord","Twitch","Reddit","Amazon","Apple","Microsoft","Steam","PlayStation","Xbox","Nintendo","Patreon","Spotify","Netflix","Facebook","TikTok","Linkedin","Subscribe","Channel","Video","Watch","Click","Link","Links","Below","Description","Comment","Like","Share","Merch","Support","Music","Join","Members","Podcast","http","https","www","com","net","org","co","io","checkout","check","code","codes","store","shop","cart","deal","deals","offer","offers","discount","coupon","sale","promo","today","free","get","new","best","top","review","reviews","here","link in","the link"];
function extractSponsors(desc,channelName){
if(!desc)return[];
const sponsors=new Set();
const channelDomain=channelName.toLowerCase().replace(/\s+/g,"");
const noiseLower=NOISE.map(function(n){return n.toLowerCase();});
function ok(brand){return brand.length>3&&brand.length<30&&!noiseLower.includes(brand.toLowerCase())&&!/^(https?|www)$/i.test(brand)&&brand.toLowerCase()!==channelDomain;}
const urlPattern=/(?:visit|go to|check out|head to|download|try|sign up(?:\s+at)?|use)\s+(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9][a-zA-Z0-9-]+)\.[a-z]{2,}/gi;
for(const m of [...desc.matchAll(urlPattern)]){const brand=m[1].charAt(0).toUpperCase()+m[1].slice(1);if(ok(brand))sponsors.add(brand);}
const byPattern=/(?:sponsored by|brought to you by|partner(?:ed)? with|in partnership with|thanks? to)\s+([A-Z][a-zA-Z0-9]+(?:\s[A-Z][a-zA-Z0-9]+)?)/g;
for(const m of [...desc.matchAll(byPattern)]){const brand=m[1].trim();if(ok(brand))sponsors.add(brand);}
const codePattern=/(?:use code|promo code|discount code)\s+\w+\s+(?:at|for|on)\s+([A-Z][a-zA-Z0-9]+)/gi;
for(const m of [...desc.matchAll(codePattern)]){const brand=m[1].trim();if(ok(brand))sponsors.add(brand);}
return[...sponsors];
}

const WINDOW_DAYS=7,MAX_VIDS_PER_CHANNEL=40;
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

// ---- write brands to the Brand Spend board (scan columns only; contact columns are owned by the enrichment task) ----
const exRes=await monday("{boards(ids:["+BOARD_ID+"]){items_page(limit:500){items{id name column_values(ids:[\"numeric_mm3swzsf\",\"numeric_mm3szew3\"]){id text}}}}}");
const exMap={};
for(const i of(exRes&&exRes.data&&exRes.data.boards&&exRes.data.boards[0]&&exRes.data.boards[0].items_page&&exRes.data.boards[0].items_page.items)||[]){const cv=i.column_values||[];const gv=function(cid){const c=cv.find(function(x){return x.id===cid;});return Number((c&&c.text)||0);};exMap[i.name.toLowerCase()]={id:i.id,rec:gv("numeric_mm3swzsf"),peak:gv("numeric_mm3szew3")};}

const DISPLAY={buyraycon:"Raycon",raycon:"Raycon",expressvpn:"ExpressVPN",nordvpn:"NordVPN",surfshark:"Surfshark",betterhelp:"BetterHelp",squarespace:"Squarespace",displate:"Displate",saily:"Saily",helixsleep:"Helix Sleep",zocdoc:"Zocdoc",cookunity:"CookUnity",manscaped:"Manscaped",hellofresh:"HelloFresh",factormeals:"Factor",factor:"Factor",incogni:"Incogni",aura:"Aura",skillshare:"Skillshare",audible:"Audible",ridge:"Ridge",keeps:"Keeps",rocketmoney:"Rocket Money",ground:"Ground News",groundnews:"Ground News",shopify:"Shopify",scentbird:"Scentbird",greenchef:"Green Chef",asus:"ASUS",intel:"Intel",chime:"Chime"};
function displayName(name){const k=name.toLowerCase().replace(/\s+/g,"");if(DISPLAY[k])return DISPLAY[k];if(DISPLAY[name.toLowerCase()])return DISPLAY[name.toLowerCase()];return name.charAt(0).toUpperCase()+name.slice(1);}

const brands=Object.values(brandData).filter(function(d){return d.channels.size>=2;}).sort(function(a,b){return b.channels.size-a.channels.size;});
let saved=0;
for(const data of brands){const dn=displayName(data.name);const tier=data.channels.size>=5?"High":data.channels.size>=3?"Mid":"Low";const ex=exMap[dn.toLowerCase()];const trend=!ex?"New":data.channels.size>ex.rec?"Rising":data.channels.size<ex.rec?"Falling":"Steady";const peak=Math.max(ex?ex.peak:0,data.channels.size);const niche=[...data.niches].sort().join("/")||"Gaming/Film";
const cols={text_mm3shz66:dn,numeric_mm3swzsf:data.channels.size,numeric_mm3szew3:peak,date_mm3sx6hp:{date:data.lastSeen},text_mm3ss133:[...data.channels].slice(0,5).join(", "),text_mm3shf6v:niche,color_mm3samv9:{label:tier},color_mm3sgerw:{label:trend}};
const eid=ex&&ex.id;
try{
if(eid){await monday("mutation{change_multiple_column_values(board_id:"+BOARD_ID+",item_id:"+eid+",column_values:"+JSON.stringify(JSON.stringify(cols))+",create_labels_if_missing:true){id}}");}
else{await monday("mutation{create_item(board_id:"+BOARD_ID+",item_name:"+JSON.stringify(dn.substring(0,50))+",column_values:"+JSON.stringify(JSON.stringify(cols))+",create_labels_if_missing:true){id}}");}
saved++;
}catch(e){}
}

// decay brands present on the board but not seen this run
const seenSet=new Set(brands.map(function(b){return displayName(b.name).toLowerCase();}));
for(const zk in exMap){if(seenSet.has(zk))continue;try{await monday("mutation{change_multiple_column_values(board_id:"+BOARD_ID+",item_id:"+exMap[zk].id+",column_values:"+JSON.stringify(JSON.stringify({numeric_mm3swzsf:0,color_mm3sgerw:{label:"Falling"}}))+",create_labels_if_missing:true){id}}");}catch(e){}}

return res.json({message:"Done (scan-only)",windowDays:WINDOW_DAYS,catalogLoaded:catalog.length,channelsProcessed:processed,brandsFound:Object.keys(brandData).length,brandsOn2Plus:brands.length,saved,topBrands:brands.slice(0,20).map(function(b){return{name:displayName(b.name),channels:b.channels.size,niche:[...b.niches].sort().join("/")};})});
}
