export const config={maxDuration:300};
export default async function handler(req,res){
const YOUTUBE_API_KEY=process.env.YOUTUBE_API_KEY;
const MONDAY_API_KEY=process.env.MONDAY_API_KEY;
const BOARD_ID="18415192682";
if(!YOUTUBE_API_KEY||!MONDAY_API_KEY)return res.status(500).json({error:"Missing env vars"});

// Step 1: Discover channels dynamically via YouTube search.
// Each term carries a niche so brands can be labelled Gaming / Film / Tech.
const SEARCH_TERMS=[
{q:"RPG game review youtube",niche:"Gaming"},{q:"soulslike game youtube",niche:"Gaming"},{q:"strategy game youtube",niche:"Gaming"},
{q:"simulation game youtube",niche:"Gaming"},{q:"sim racing youtube",niche:"Gaming"},{q:"fighting game youtube",niche:"Gaming"},
{q:"MMO game youtube",niche:"Gaming"},{q:"survival horror game youtube",niche:"Gaming"},{q:"indie game youtube",niche:"Gaming"},
{q:"speedrun youtube",niche:"Gaming"},{q:"retro gaming youtube",niche:"Gaming"},{q:"handheld emulation youtube",niche:"Gaming"},
{q:"esports youtube channel",niche:"Gaming"},{q:"game design youtube",niche:"Gaming"},{q:"video game documentary youtube",niche:"Gaming"},
{q:"tabletop rpg youtube",niche:"Gaming"},{q:"board game review youtube",niche:"Gaming"},{q:"warhammer hobby youtube",niche:"Gaming"},
{q:"movie review youtube",niche:"Film"},{q:"film video essay youtube",niche:"Film"},{q:"movie reaction youtube",niche:"Film"},
{q:"tv series review youtube",niche:"Film"},{q:"horror movie youtube",niche:"Film"},{q:"sci fi movie youtube",niche:"Film"},{q:"filmmaking youtube",niche:"Film"},
{q:"anime review youtube",niche:"Film"},{q:"comic book youtube",niche:"Film"},
// Tech (added 2026-07: broaden beyond Gaming/Film into consumer-tech sponsorship spend).
{q:"pc building youtube",niche:"Tech"},{q:"gaming hardware review youtube",niche:"Tech"},{q:"tech review youtube",niche:"Tech"},
{q:"smartphone review youtube",niche:"Tech"},{q:"laptop review youtube",niche:"Tech"},{q:"consumer tech youtube",niche:"Tech"},
{q:"gadget review youtube",niche:"Tech"},{q:"tech news youtube",niche:"Tech"},
// Region terms.
{q:"UK gaming youtube",niche:"Gaming"},{q:"British film youtube",niche:"Film"},{q:"Australian gaming youtube",niche:"Gaming"},
];

const discoveredChannels=new Map(); // id -> {name, niche:[atoms]}

// Seeds default to broad Gaming/Film; named tech/film seeds get atomic niches so
// brand labels stay accurate without asserting a wrong single niche.
const TECH_SEEDS=new Set(["Linus Tech Tips","Marques Brownlee","Austin Evans","Dave2D","Mrwhosetheboss"]);
const FILM_SEEDS=new Set(["Heavy Spoilers","Screen Rant","WatchMojo","New Rockstars","Dead Meat","Emergency Awesome","Jeremy Jahns","Chris Stuckmann","Gigguk","Looper","CinemaSins","Cinema Therapy","Alex Meyers","The Critical Drinker","Mother Basement","The Anime Man","Anime America","Steve Reviews","Sean Chandler","Wisecrack","Like Stories Of Old","Folding Ideas","Now You See It","Just Write","CinemaBlend","Blockbuster Reviews","Chibi Reviews","Star Wars Theory"]);
function seedNiche(name){if(TECH_SEEDS.has(name))return["Tech"];if(FILM_SEEDS.has(name))return["Film"];return["Gaming","Film"];}

const SEED_CHANNELS=[
{id:"UCq3hT5JPPKy87JGbDls_5BQ",name:"Heavy Spoilers"},
{id:"UCXuqSBlHAE6Xw-yeJA0Tunw",name:"Linus Tech Tips"},
{id:"UCBcRF18a7Qf58cCRy5xuWwQ",name:"Marques Brownlee"},
{id:"UCXa_bzvv7Oo1glaW9FldDhQ",name:"Gameranx"},
{id:"UCg40OxZ1GYh3u3jBntB6DLg",name:"Skill Up"},
{id:"UCq6VFHwMzcMXbuKyG7SQYIg",name:"penguinz0"},
{id:"UCgMJGv4cKl-jeWuQ9EquLMQ",name:"Screen Rant"},
{id:"UCaWd5_7JhbQBe4dknZhsHJg",name:"WatchMojo"},
{id:"UCuWZNzb-6-NLKH6DYi3SJ7Q",name:"New Rockstars"},
{id:"UCYzPXprvl5Y-Sf0g4vX-m6g",name:"jacksepticeye"},
{id:"UC7_YxT-KID8kRbqZo7MyscQ",name:"Markiplier"},
{id:"UCTfAlnSPgxUd0yIHHorPzsQ",name:"Asmongold TV"},
{id:"UCo8bcnLyZH8tBIH9V1mLgqQ",name:"The Game Theorists"},
{id:"UCsvn_Po0SmunchJYtttWpOxMg",name:"videogamedunkey"},
{id:"UCR1D15p_vdP3HkrH8wgjQRg",name:"Internet Historian"},
{id:"UC0fDG3byEcMtbOqPMymDNbw",name:"Noclip"},
{id:"UCs3A-5be7MuCDDNnPgAUBcA",name:"NakeyJakey"},
{id:"UCi3T_1Jv9Pf3wJnMGBnRFrg",name:"Dead Meat"},
{id:"UCDiFRMQWpcp8_KD4vwIVicw",name:"Emergency Awesome"},
{id:"UCItEBhiTrNHbkTkVHLNNbAg",name:"Jeremy Jahns"},
{id:"UCPmHkzKn-BqtCQNmqaaEMww",name:"Chris Stuckmann"},
{id:"UC8UcOUi8Eo5TJpfYFChpxOA",name:"Gigguk"},
{id:"UCGPItl9gZqPKPCNaltqFtxQ",name:"Looper"},
{id:"UCJx5KP-pCDOG0nNbXKFxsAg",name:"Kinda Funny Games"},
{id:"UCbu2SsF-Or3Rsn3NxqODImA",name:"IGN"},
{id:"UCNvSVsen5EPIJ4UXGiGFx9w",name:"GameSpot"},
{id:"UCmGSJVG3mCRXVOP4yZrU1Dw",name:"GameXplain"},
{id:"UCdJdEguB1F1CiYe7OEi3SBg",name:"ESL Gaming"},
{id:"UCkBR3-HnLQHeaMQBbVvDGOw",name:"MoistCr1TiKaL"},
{id:"UCiFPBiGFBGnSGvbTtMhGolA",name:"Easy Allies"},
{id:"UCnCoL3KI_n_wSTJzu3pCJkw",name:"Bellular News"},
{id:"UC8aG3LDTDwNR1UQhSn9uVrw",name:"Upper Echelon Gamez"},
{id:"UCK9_x1DImhU-eolIay5rb2Q",name:"ACG"},
{id:"UC2eEGT06FrWFU6VBnPOR9lg",name:"Girlfriend Reviews"},
{id:"UCIPPMRA040LQr5QPyJEbmXA",name:"MrBeast Gaming"},
{id:"UCEQ7KR9enYdQsB6kcMnw0NA",name:"Mortismal Gaming"},
{id:"UCoZQiN0o7f36H7PaW4fVhFw",name:"Retro Game Corps"},
{id:"UCyhnYIvIKK_--PiJXCMKxQQ",name:"Joseph Anderson"},
{id:"UCpqXJOEqGS-TCnazcHCo0rA",name:"theRadBrad"},
{id:"UC0M0rxSz3IF0CsSour1iWmw",name:"Cinemassacre"},
{id:"UCnbvPS_rXp4PC21PG2k1UVg",name:"Gaming Historian"},
{id:"UClOGLGPOqlAiLmOvXW5lKbw",name:"MandaloreGaming"},
{id:"UCD6VugMZKRhSyzWEWA9W2fg",name:"SsethTzeentach"},
{id:"UCxfr3b8IuHSzu22UHnAvHWg",name:"MoistCr1TiKaL Gaming"},
{id:"UC477Kvszl9JivqOxN1dFgPQ",name:"Iron Pineapple"},
{id:"UCRWyPm7MrfotIYF8A8MGV3g",name:"Josh Strife Hayes"},
{id:"UCY3A_5R_m3PXCn5XDhvBBsg",name:"Adam Millard"},
{id:"UCPnPgDPqs4eBTTbcPI0q_FQ",name:"Insider Gaming"},
{id:"UCt_oFAUph4_8P3N_Xs-FGHg",name:"Scamboli Reviews"},
{id:"UCfGmaA-nXPryTfimsnkLieQ",name:"Chibi Reviews"},
{id:"UCAYF6ZY9gWBR1GW3R7PX7yw",name:"Majuular"},
{id:"UCFOlioIjE_FnKOrd9Ac-Iww",name:"Rye Games"},
{id:"UCs8lYkna2S6DkcHO9o2008A",name:"Roanoke Gaming"},
{id:"UCSCoziKHqjqbox3Fv3Pb4BA",name:"theScore esports"},
{id:"UCSJPFQdZwrOutnmSFYtbstA",name:"The Critical Drinker"},
{id:"UCY6Ij8zOds0WJEeqCLOnqOQ",name:"Alex Meyers"},
{id:"UCCYX4s1DCn51Hpf1peHS30Q",name:"Cinema Therapy"},
{id:"UCYUQQgogVeQY8cMQamhHJcg",name:"CinemaSins"},
{id:"UCBs2Y3i14e1NWQxOGliatmg",name:"Mother Basement"},
{id:"UC3ETCazlHenpXEsrEJH-k5A",name:"The Anime Man"},
{id:"UC76ylFnNS-Tojn1I4PX1kIA",name:"Anime America"},
{id:"UCqERpXggAprNW8QT_WO1N5Q",name:"Steve Reviews"},
{id:"UCQxTL5uhg3jYRakna8CvJ5g",name:"Sean Chandler"},
{id:"UCXi6_LknvHkNLDJ5fEv8XbA",name:"Wisecrack"},
{id:"UCkFuXPHp-8WO7uZqLKTTsMw",name:"Like Stories Of Old"},
{id:"UCzwQYUVCpZqtN93H8RR44Qw",name:"Folding Ideas"},
{id:"UCi8e0iOVk1fEOogdfu4YgfA",name:"Now You See It"},
{id:"UCTLkMQAiJ9AqUMwXKBtJlyA",name:"Just Write"},
{id:"UCVyTR6tFcjuAAhGK7lAr-mQ",name:"CinemaBlend"},
{id:"UCuIRv8rLfdagGkcyEJcMi6A",name:"Blockbuster Reviews"},
{id:"UCGhs9S33RAeT5DEuKTO4Oew",name:"Force Gaming"},
{id:"UCZMF14eNxvuReRTceX_mbqQ",name:"The Game Overanalyser"},
{id:"UCVdDUN69YsAXPxh2y71sMtQ",name:"I Finished A Video Game"},
{id:"UCjKSoJlPgcK6BmoSqXpj5xQ",name:"Action Button"},
{id:"UCeZLO2VgbZHeDcongKzzfOw",name:"8-bit Music Theory"},
{id:"UCDC7X5gNh2LxQ2PnN_OKD5g",name:"NeoGamer"},
{id:"UCJfJWct8jN1RpCuVWk3zHTA",name:"Daryl Talks Games"},
{id:"UCRW9giz4WKZSVssQWdd5pLg",name:"Video Game Analysis"},
{id:"UCBRdH7MGiy3EmNG1GndsdIg",name:"Avalanche Reviews"},
{id:"UC5c-DuzPdH9iaWYdI0v0uzw",name:"Star Wars Theory"},
];
for(const c of SEED_CHANNELS)discoveredChannels.set(c.id,{name:c.name,niche:seedNiche(c.name)});

// Step 2: Search YouTube for more channels. Paginate up to 2 pages per term to widen
// the unique-channel catch. ~37 terms x 2 pages = up to ~74 search calls (~7,400 units).
for(const term of SEARCH_TERMS){
let pageToken="";
for(let page=0;page<2;page++){
try{
const r=await fetch("https://www.googleapis.com/youtube/v3/search?part=snippet&q="+encodeURIComponent(term.q)+"&type=channel&maxResults=50&relevanceLanguage=en"+(pageToken?"&pageToken="+pageToken:"")+"&key="+YOUTUBE_API_KEY);
const d=await r.json();
for(const item of(d.items||[])){
const id=item.id&&item.id.channelId;
const name=item.snippet&&item.snippet.channelTitle;
if(id&&name&&!discoveredChannels.has(id))discoveredChannels.set(id,{name:name,niche:[term.niche]});
}
pageToken=d.nextPageToken||"";
await new Promise(function(r){setTimeout(r,200);});
if(!pageToken)break;
}catch(e){break;}
}
}

const CHANNELS=[...discoveredChannels.entries()].map(function(e){return{id:e[0],name:e[1].name,niche:e[1].niche};});

// Filter out obvious noise
const SKIP=["ugc","india","hindi","tamil","telugu","roblox","minecraft kids","fortnite kids","gaming review ","film breakdown ","fps gaming","fps channel","fps game","movie review channel","review channel"];
const filtered=CHANNELS.filter(function(c){
const n=c.name.toLowerCase();
return !SKIP.some(function(s){return n.includes(s);}) && c.name.length>2 && c.name.length<50;
});

// Subscriber floor (50k) + uploads-playlist pre-pass.
const SUB_FLOOR=50000;
const chanInfo={};
for(let i=0;i<filtered.length;i+=50){
const ids=filtered.slice(i,i+50).map(function(c){return c.id;}).join(",");
try{
const r=await fetch("https://www.googleapis.com/youtube/v3/channels?part=statistics,contentDetails&id="+ids+"&key="+YOUTUBE_API_KEY);
const d=await r.json();
for(const ch of(d.items||[])){
const subs=parseInt((ch.statistics&&ch.statistics.subscriberCount)||0);
const uploads=(ch.contentDetails&&ch.contentDetails.relatedPlaylists&&ch.contentDetails.relatedPlaylists.uploads)||"";
chanInfo[ch.id]={subs:subs,uploads:uploads};
}
await new Promise(function(r){setTimeout(r,100);});
}catch(e){}
}
const eligible=filtered.filter(function(c){const info=chanInfo[c.id];return info&&info.uploads&&info.subs>=SUB_FLOOR;});

// http/https/www + bare TLDs added so URL schemes/hosts are never captured as a "brand"
// (this was the source of the junk "http"/"https" rows on the board).
const NOISE=["YouTube","Google","Twitter","Instagram","Discord","Twitch","Reddit","Amazon","Apple","Microsoft","Steam","PlayStation","Xbox","Nintendo","Patreon","Spotify","Netflix","Subscribe","Channel","Video","Watch","Click","Link","Below","Description","Comment","Like","Share","Merch","Support","Music","Join","Members","Podcast","Facebook","TikTok","Linkedin","http","https","www","com","net","org"];

function extractSponsors(desc,channelName){
if(!desc)return[];
const sponsors=new Set();
const channelDomain=channelName.toLowerCase().replace(/\s+/g,"");
const noiseLower=NOISE.map(function(n){return n.toLowerCase();});
function ok(brand){return brand.length>3&&brand.length<30&&!noiseLower.includes(brand.toLowerCase())&&!/^(https?|www)$/i.test(brand)&&brand.toLowerCase()!==channelDomain;}
// Require the scheme (and optional www.) to be fully consumed BEFORE the captured host label,
// so the capture group can never be "http"/"https"/"www".
const urlPattern=/(?:visit|go to|check out|head to|download|try|sign up(?:\s+at)?|use)\s+(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9][a-zA-Z0-9-]+)\.[a-z]{2,}/gi;
for(const m of [...desc.matchAll(urlPattern)]){
const brand=m[1].charAt(0).toUpperCase()+m[1].slice(1);
if(ok(brand))sponsors.add(brand);
}
const byPattern=/(?:sponsored by|brought to you by|partner(?:ed)? with|in partnership with|thanks? to)\s+([A-Z][a-zA-Z0-9]+(?:\s[A-Z][a-zA-Z0-9]+)?)/g;
for(const m of [...desc.matchAll(byPattern)]){
const brand=m[1].trim();
if(ok(brand))sponsors.add(brand);
}
const codePattern=/(?:use code|promo code|discount code)\s+\w+\s+(?:at|for|on)\s+([A-Z][a-zA-Z0-9]+)/gi;
for(const m of [...desc.matchAll(codePattern)]){
const brand=m[1].trim();
if(ok(brand))sponsors.add(brand);
}
return[...sponsors];
}

// 7-DAY WINDOW (was: latest 5 uploads). Since the scraper runs weekly, scan every upload
// from the last 7 days so a brand's true weekly footprint is captured and a still-active
// brand doesn't drop to Falling just because it wasn't in the last 5 videos.
const WINDOW_DAYS=7;
const MAX_VIDS_PER_CHANNEL=40; // safety cap for hyper-prolific channels (bounds quota/time)
async function getRecentVideoIds(uploadsId,cutoffMs){
if(!uploadsId)return[];
const ids=[];let pageToken="";
try{
for(let page=0;page<3;page++){
const r=await fetch("https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId="+uploadsId+"&maxResults=50&key="+YOUTUBE_API_KEY+(pageToken?"&pageToken="+pageToken:""));
const d=await r.json();
let stop=false;
for(const i of(d.items||[])){
const cd=i.contentDetails||{};
const pub=cd.videoPublishedAt?Date.parse(cd.videoPublishedAt):0;
if(pub&&pub<cutoffMs){stop=true;break;} // uploads playlist is newest-first
if(cd.videoId)ids.push(cd.videoId);
if(ids.length>=MAX_VIDS_PER_CHANNEL){stop=true;break;}
}
pageToken=d.nextPageToken||"";
if(stop||!pageToken)break;
}
}catch(e){}
return ids;
}

async function getVideoDetails(ids){
if(!ids.length)return[];
const out=[];
for(let i=0;i<ids.length;i+=50){
try{
const r=await fetch("https://www.googleapis.com/youtube/v3/videos?part=snippet&id="+ids.slice(i,i+50).join(",")+"&key="+YOUTUBE_API_KEY);
for(const v of(((await r.json()).items)||[]))out.push(v);
}catch(e){}
}
return out;
}

const brandData={};
const today=new Date().toISOString().split("T")[0];
const cutoffMs=Date.now()-WINDOW_DAYS*24*60*60*1000;
let processed=0;

const MAX_CHANNELS=1000;
const channelsToProcess=eligible.slice(0,MAX_CHANNELS);

// Concurrency raised 10 -> 20 so a full 1000-channel, 7-day run completes within the 300s limit.
const CONCURRENCY=20;for(let bi=0;bi<channelsToProcess.length;bi+=CONCURRENCY){const batch=channelsToProcess.slice(bi,bi+CONCURRENCY);await Promise.all(batch.map(async function(channel){
try{
const vids=await getRecentVideoIds(chanInfo[channel.id]&&chanInfo[channel.id].uploads,cutoffMs);
const videos=await getVideoDetails(vids);
for(const v of videos){
for(const s of extractSponsors(v.snippet&&v.snippet.description||"",channel.name)){
const k=s.toLowerCase().replace(/\s+/g,"");
if(!brandData[k])brandData[k]={name:s,channels:new Set(),niches:new Set(),lastSeen:today,weekCount:0};
brandData[k].channels.add(channel.name);
for(const nn of(channel.niche||[]))brandData[k].niches.add(nn);
brandData[k].weekCount++;
brandData[k].lastSeen=today;
}
}
processed++;
}catch(e){processed++;}}));await new Promise(function(r){setTimeout(r,50);});
}

const exRes=await fetch("https://api.monday.com/v2",{method:"POST",headers:{"Content-Type":"application/json","Authorization":MONDAY_API_KEY},body:JSON.stringify({query:"{boards(ids:["+BOARD_ID+"]){items_page(limit:500){items{id name column_values(ids:[\"numeric_mm3swzsf\",\"numeric_mm3szew3\"]){id text}}}}}"})});
const exData=await exRes.json();
const exMap={};
for(const i of(exData&&exData.data&&exData.data.boards&&exData.data.boards[0]&&exData.data.boards[0].items_page&&exData.data.boards[0].items_page.items)||[]){const cv=i.column_values||[];const gv=function(cid){const c=cv.find(function(x){return x.id===cid;});return Number((c&&c.text)||0);};exMap[i.name.toLowerCase()]={id:i.id,rec:gv("numeric_mm3swzsf"),peak:gv("numeric_mm3szew3")};}

// Expanded display-name normalization (keyed on lowercased, space-stripped name).
const DISPLAY={checkout:"Checkout.com","checkout.com":"Checkout.com",buyraycon:"Raycon",raycon:"Raycon",expressvpn:"ExpressVPN",nordvpn:"NordVPN",surfshark:"Surfshark",betterhelp:"BetterHelp",squarespace:"Squarespace",displate:"Displate",saily:"Saily",helixsleep:"Helix Sleep",zocdoc:"Zocdoc",cookunity:"CookUnity",manscaped:"Manscaped",hellofresh:"HelloFresh",factormeals:"Factor",factor:"Factor",incogni:"Incogni",aura:"Aura",skillshare:"Skillshare",audible:"Audible",ridge:"Ridge",keeps:"Keeps",rocketmoney:"Rocket Money",ground:"Ground News",groundnews:"Ground News",established:"Established Titles",shopify:"Shopify",scentbird:"Scentbird",greenchef:"Green Chef",asus:"ASUS",intel:"Intel",chime:"Chime"};
function displayName(name){const k=name.toLowerCase().replace(/\s+/g,"");if(DISPLAY[k])return DISPLAY[k];if(DISPLAY[name.toLowerCase()])return DISPLAY[name.toLowerCase()];return name.charAt(0).toUpperCase()+name.slice(1);}

// Only save brands on 2+ channels - filters out all noise
const brands=Object.values(brandData).filter(function(d){return d.channels.size>=2;}).sort(function(a,b){return b.channels.size-a.channels.size;});
let saved=0;
for(const data of brands){const dn=displayName(data.name);const tier=data.channels.size>=5?"High":data.channels.size>=3?"Mid":"Low";const ex=exMap[dn.toLowerCase()];const trend=!ex?"New":data.channels.size>ex.rec?"Rising":data.channels.size<ex.rec?"Falling":"Steady";const peak=Math.max(ex?ex.peak:0,data.channels.size);const niche=[...data.niches].sort().join("/")||"Gaming/Film";
const cols={text_mm3shz66:dn,numeric_mm3swzsf:data.channels.size,numeric_mm3szew3:peak,date_mm3sx6hp:{date:data.lastSeen},text_mm3ss133:[...data.channels].slice(0,5).join(", "),text_mm3shf6v:niche,color_mm3samv9:{label:tier},color_mm3sgerw:{label:trend}};
const itemName=dn.substring(0,50);
const eid=ex&&ex.id;
try{
if(eid){await fetch("https://api.monday.com/v2",{method:"POST",headers:{"Content-Type":"application/json","Authorization":MONDAY_API_KEY},body:JSON.stringify({query:"mutation{change_multiple_column_values(board_id:"+BOARD_ID+",item_id:"+eid+",column_values:"+JSON.stringify(JSON.stringify(cols))+",create_labels_if_missing:true){id}}"})}); }
else{await fetch("https://api.monday.com/v2",{method:"POST",headers:{"Content-Type":"application/json","Authorization":MONDAY_API_KEY},body:JSON.stringify({query:"mutation{create_item(board_id:"+BOARD_ID+",item_name:"+JSON.stringify(itemName)+",column_values:"+JSON.stringify(JSON.stringify(cols))+",create_labels_if_missing:true){id}}"})}); }
saved++;
}catch(e){}
}

const seenSet=new Set(brands.map(function(b){return displayName(b.name).toLowerCase();}));for(const zk in exMap){if(seenSet.has(zk))continue;try{await fetch("https://api.monday.com/v2",{method:"POST",headers:{"Content-Type":"application/json","Authorization":MONDAY_API_KEY},body:JSON.stringify({query:"mutation{change_multiple_column_values(board_id:"+BOARD_ID+",item_id:"+exMap[zk].id+",column_values:"+JSON.stringify(JSON.stringify({numeric_mm3swzsf:0,color_mm3sgerw:{label:"Falling"}}))+",create_labels_if_missing:true){id}}"})});}catch(e){}}return res.json({message:"Done",windowDays:WINDOW_DAYS,channelsDiscovered:discoveredChannels.size,channelsFiltered:filtered.length,channelsEligible:eligible.length,channelsProcessed:processed,brandsFound:Object.keys(brandData).length,brandsOn2Plus:brands.length,saved,topBrands:brands.slice(0,20).map(function(b){return{name:displayName(b.name),channels:b.channels.size,niche:[...b.niches].sort().join("/"),seenOn:[...b.channels].join(", ")};})});
}
