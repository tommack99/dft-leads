export const config={maxDuration:300};
// DISCOVERY. Finds new YouTube creator channels and APPENDS them to the channel catalog
// (board 18421642067). Runs on its own days so it has the full YouTube quota to itself.
// The weekly scan (api/brand-scraper.js) then reads the catalog — the two never compete.
// (Split out 2026-07-18; grows the catalog toward the 1,000-channel target.)
export default async function handler(req,res){
const YOUTUBE_API_KEY=process.env.YOUTUBE_API_KEY;
const MONDAY_API_KEY=process.env.MONDAY_API_KEY;
const CATALOG_BOARD="18421642067";
const CAT_YTID="text_mm57h9s4",CAT_NICHE="text_mm57h3g2",CAT_SUBS="numeric_mm57y38z",CAT_DATE="date_mm57pte3",CAT_SRC="text_mm578q7p";
if(!YOUTUBE_API_KEY||!MONDAY_API_KEY)return res.status(500).json({error:"Missing env vars"});
const sleep=function(ms){return new Promise(function(r){setTimeout(r,ms);});};
async function monday(q){const r=await fetch("https://api.monday.com/v2",{method:"POST",headers:{"Content-Type":"application/json","Authorization":MONDAY_API_KEY},body:JSON.stringify({query:q})});return r.json();}

const SUB_FLOOR=50000;
const MAX_NEW_PER_RUN=250;   // bound Monday write time so a run never approaches 300s
const PAGES_PER_TERM=2;      // widen the unique-channel catch (dedicated quota day)

// Niche-tagged search terms (Gaming / Film / Tech), broadened to grow toward 1,000 channels.
const SEARCH_TERMS=[
{q:"RPG game review youtube",niche:"Gaming"},{q:"soulslike game youtube",niche:"Gaming"},{q:"strategy game youtube",niche:"Gaming"},
{q:"simulation game youtube",niche:"Gaming"},{q:"sim racing youtube",niche:"Gaming"},{q:"fighting game youtube",niche:"Gaming"},
{q:"MMO game youtube",niche:"Gaming"},{q:"survival horror game youtube",niche:"Gaming"},{q:"indie game youtube",niche:"Gaming"},
{q:"speedrun youtube",niche:"Gaming"},{q:"retro gaming youtube",niche:"Gaming"},{q:"handheld emulation youtube",niche:"Gaming"},
{q:"esports youtube channel",niche:"Gaming"},{q:"game design youtube",niche:"Gaming"},{q:"video game documentary youtube",niche:"Gaming"},
{q:"tabletop rpg youtube",niche:"Gaming"},{q:"board game review youtube",niche:"Gaming"},{q:"warhammer hobby youtube",niche:"Gaming"},
{q:"open world game review youtube",niche:"Gaming"},{q:"roguelike game youtube",niche:"Gaming"},{q:"JRPG youtube",niche:"Gaming"},
{q:"movie review youtube",niche:"Film"},{q:"film video essay youtube",niche:"Film"},{q:"movie reaction youtube",niche:"Film"},
{q:"tv series review youtube",niche:"Film"},{q:"horror movie youtube",niche:"Film"},{q:"sci fi movie youtube",niche:"Film"},{q:"filmmaking youtube",niche:"Film"},
{q:"anime review youtube",niche:"Film"},{q:"comic book youtube",niche:"Film"},{q:"superhero movie youtube",niche:"Film"},{q:"streaming tv review youtube",niche:"Film"},
{q:"pc building youtube",niche:"Tech"},{q:"gaming hardware review youtube",niche:"Tech"},{q:"tech review youtube",niche:"Tech"},
{q:"smartphone review youtube",niche:"Tech"},{q:"laptop review youtube",niche:"Tech"},{q:"consumer tech youtube",niche:"Tech"},
{q:"gadget review youtube",niche:"Tech"},{q:"tech news youtube",niche:"Tech"},{q:"pc gaming setup youtube",niche:"Tech"},
{q:"UK gaming youtube",niche:"Gaming"},{q:"British film youtube",niche:"Film"},{q:"Australian gaming youtube",niche:"Gaming"},{q:"Canadian gaming youtube",niche:"Gaming"},
];

const TECH_SEEDS=new Set(["Linus Tech Tips","Marques Brownlee","Austin Evans","Dave2D","Mrwhosetheboss"]);
const FILM_SEEDS=new Set(["Heavy Spoilers","Screen Rant","WatchMojo","New Rockstars","Dead Meat","Emergency Awesome","Jeremy Jahns","Chris Stuckmann","Gigguk","Looper","CinemaSins","Cinema Therapy","Alex Meyers","The Critical Drinker","Mother Basement","The Anime Man","Anime America","Steve Reviews","Sean Chandler","Wisecrack","Like Stories Of Old","Folding Ideas","Now You See It","Just Write","CinemaBlend","Blockbuster Reviews","Chibi Reviews","Star Wars Theory"]);
function seedNiche(name){if(TECH_SEEDS.has(name))return["Tech"];if(FILM_SEEDS.has(name))return["Film"];return["Gaming","Film"];}
const SEED_CHANNELS=[
{id:"UCq3hT5JPPKy87JGbDls_5BQ",name:"Heavy Spoilers"},{id:"UCXuqSBlHAE6Xw-yeJA0Tunw",name:"Linus Tech Tips"},{id:"UCBcRF18a7Qf58cCRy5xuWwQ",name:"Marques Brownlee"},
{id:"UCXa_bzvv7Oo1glaW9FldDhQ",name:"Gameranx"},{id:"UCg40OxZ1GYh3u3jBntB6DLg",name:"Skill Up"},{id:"UCq6VFHwMzcMXbuKyG7SQYIg",name:"penguinz0"},
{id:"UCgMJGv4cKl-jeWuQ9EquLMQ",name:"Screen Rant"},{id:"UCaWd5_7JhbQBe4dknZhsHJg",name:"WatchMojo"},{id:"UCuWZNzb-6-NLKH6DYi3SJ7Q",name:"New Rockstars"},
{id:"UCYzPXprvl5Y-Sf0g4vX-m6g",name:"jacksepticeye"},{id:"UC7_YxT-KID8kRbqZo7MyscQ",name:"Markiplier"},{id:"UCTfAlnSPgxUd0yIHHorPzsQ",name:"Asmongold TV"},
{id:"UCo8bcnLyZH8tBIH9V1mLgqQ",name:"The Game Theorists"},{id:"UCsvn_Po0SmunchJYtttWpOxMg",name:"videogamedunkey"},{id:"UCR1D15p_vdP3HkrH8wgjQRg",name:"Internet Historian"},
{id:"UC0fDG3byEcMtbOqPMymDNbw",name:"Noclip"},{id:"UCs3A-5be7MuCDDNnPgAUBcA",name:"NakeyJakey"},{id:"UCi3T_1Jv9Pf3wJnMGBnRFrg",name:"Dead Meat"},
{id:"UCDiFRMQWpcp8_KD4vwIVicw",name:"Emergency Awesome"},{id:"UCItEBhiTrNHbkTkVHLNNbAg",name:"Jeremy Jahns"},{id:"UCPmHkzKn-BqtCQNmqaaEMww",name:"Chris Stuckmann"},
{id:"UC8UcOUi8Eo5TJpfYFChpxOA",name:"Gigguk"},{id:"UCGPItl9gZqPKPCNaltqFtxQ",name:"Looper"},{id:"UCJx5KP-pCDOG0nNbXKFxsAg",name:"Kinda Funny Games"},
{id:"UCbu2SsF-Or3Rsn3NxqODImA",name:"IGN"},{id:"UCNvSVsen5EPIJ4UXGiGFx9w",name:"GameSpot"},{id:"UCmGSJVG3mCRXVOP4yZrU1Dw",name:"GameXplain"},
{id:"UCdJdEguB1F1CiYe7OEi3SBg",name:"ESL Gaming"},{id:"UCkBR3-HnLQHeaMQBbVvDGOw",name:"MoistCr1TiKaL"},{id:"UCiFPBiGFBGnSGvbTtMhGolA",name:"Easy Allies"},
{id:"UCnCoL3KI_n_wSTJzu3pCJkw",name:"Bellular News"},{id:"UC8aG3LDTDwNR1UQhSn9uVrw",name:"Upper Echelon Gamez"},{id:"UCK9_x1DImhU-eolIay5rb2Q",name:"ACG"},
{id:"UC2eEGT06FrWFU6VBnPOR9lg",name:"Girlfriend Reviews"},{id:"UCIPPMRA040LQr5QPyJEbmXA",name:"MrBeast Gaming"},{id:"UCEQ7KR9enYdQsB6kcMnw0NA",name:"Mortismal Gaming"},
{id:"UCoZQiN0o7f36H7PaW4fVhFw",name:"Retro Game Corps"},{id:"UCyhnYIvIKK_--PiJXCMKxQQ",name:"Joseph Anderson"},{id:"UCpqXJOEqGS-TCnazcHCo0rA",name:"theRadBrad"},
{id:"UC0M0rxSz3IF0CsSour1iWmw",name:"Cinemassacre"},{id:"UCnbvPS_rXp4PC21PG2k1UVg",name:"Gaming Historian"},{id:"UClOGLGPOqlAiLmOvXW5lKbw",name:"MandaloreGaming"},
{id:"UCD6VugMZKRhSyzWEWA9W2fg",name:"SsethTzeentach"},{id:"UCxfr3b8IuHSzu22UHnAvHWg",name:"MoistCr1TiKaL Gaming"},{id:"UC477Kvszl9JivqOxN1dFgPQ",name:"Iron Pineapple"},
{id:"UCRWyPm7MrfotIYF8A8MGV3g",name:"Josh Strife Hayes"},{id:"UCY3A_5R_m3PXCn5XDhvBBsg",name:"Adam Millard"},{id:"UCPnPgDPqs4eBTTbcPI0q_FQ",name:"Insider Gaming"},
{id:"UCt_oFAUph4_8P3N_Xs-FGHg",name:"Scamboli Reviews"},{id:"UCfGmaA-nXPryTfimsnkLieQ",name:"Chibi Reviews"},{id:"UCAYF6ZY9gWBR1GW3R7PX7yw",name:"Majuular"},
{id:"UCFOlioIjE_FnKOrd9Ac-Iww",name:"Rye Games"},{id:"UCs8lYkna2S6DkcHO9o2008A",name:"Roanoke Gaming"},{id:"UCSCoziKHqjqbox3Fv3Pb4BA",name:"theScore esports"},
{id:"UCSJPFQdZwrOutnmSFYtbstA",name:"The Critical Drinker"},{id:"UCY6Ij8zOds0WJEeqCLOnqOQ",name:"Alex Meyers"},{id:"UCCYX4s1DCn51Hpf1peHS30Q",name:"Cinema Therapy"},
{id:"UCYUQQgogVeQY8cMQamhHJcg",name:"CinemaSins"},{id:"UCBs2Y3i14e1NWQxOGliatmg",name:"Mother Basement"},{id:"UC3ETCazlHenpXEsrEJH-k5A",name:"The Anime Man"},
{id:"UC76ylFnNS-Tojn1I4PX1kIA",name:"Anime America"},{id:"UCqERpXggAprNW8QT_WO1N5Q",name:"Steve Reviews"},{id:"UCQxTL5uhg3jYRakna8CvJ5g",name:"Sean Chandler"},
{id:"UCXi6_LknvHkNLDJ5fEv8XbA",name:"Wisecrack"},{id:"UCkFuXPHp-8WO7uZqLKTTsMw",name:"Like Stories Of Old"},{id:"UCzwQYUVCpZqtN93H8RR44Qw",name:"Folding Ideas"},
{id:"UCi8e0iOVk1fEOogdfu4YgfA",name:"Now You See It"},{id:"UCTLkMQAiJ9AqUMwXKBtJlyA",name:"Just Write"},{id:"UCVyTR6tFcjuAAhGK7lAr-mQ",name:"CinemaBlend"},
{id:"UCuIRv8rLfdagGkcyEJcMi6A",name:"Blockbuster Reviews"},{id:"UCGhs9S33RAeT5DEuKTO4Oew",name:"Force Gaming"},{id:"UCZMF14eNxvuReRTceX_mbqQ",name:"The Game Overanalyser"},
{id:"UCVdDUN69YsAXPxh2y71sMtQ",name:"I Finished A Video Game"},{id:"UCjKSoJlPgcK6BmoSqXpj5xQ",name:"Action Button"},{id:"UCeZLO2VgbZHeDcongKzzfOw",name:"8-bit Music Theory"},
{id:"UCDC7X5gNh2LxQ2PnN_OKD5g",name:"NeoGamer"},{id:"UCJfJWct8jN1RpCuVWk3zHTA",name:"Daryl Talks Games"},{id:"UCRW9giz4WKZSVssQWdd5pLg",name:"Video Game Analysis"},
{id:"UCBRdH7MGiy3EmNG1GndsdIg",name:"Avalanche Reviews"},{id:"UC5c-DuzPdH9iaWYdI0v0uzw",name:"Star Wars Theory"},
];

// ---- load existing catalog IDs (paginated) to dedupe ----
async function loadCatalogIds(){
const ids=new Set();let cursor=null;
for(let p=0;p<12;p++){
const q=cursor
?"{next_items_page(limit:250,cursor:"+JSON.stringify(cursor)+"){cursor items{column_values(ids:[\""+CAT_YTID+"\"]){id text}}}}"
:"{boards(ids:["+CATALOG_BOARD+"]){items_page(limit:250){cursor items{column_values(ids:[\""+CAT_YTID+"\"]){id text}}}}}";
let d;try{d=await monday(q);}catch(e){break;}
const page=cursor?(d&&d.data&&d.data.next_items_page):(d&&d.data&&d.data.boards&&d.data.boards[0]&&d.data.boards[0].items_page);
if(!page)break;
for(const it of(page.items||[])){for(const cv of(it.column_values||[]))if(cv.id===CAT_YTID&&(cv.text||"").trim())ids.add((cv.text||"").trim());}
cursor=page.cursor;if(!cursor)break;
}
return ids;
}
const catIds=await loadCatalogIds();

// ---- gather candidates: seeds + search (deduped against catalog) ----
const cand=new Map();
for(const c of SEED_CHANNELS){if(!catIds.has(c.id)&&!cand.has(c.id))cand.set(c.id,{name:c.name,niche:seedNiche(c.name),src:"Seed"});}
for(const term of SEARCH_TERMS){
let pageToken="";
for(let page=0;page<PAGES_PER_TERM;page++){
try{
const r=await fetch("https://www.googleapis.com/youtube/v3/search?part=snippet&q="+encodeURIComponent(term.q)+"&type=channel&maxResults=50&relevanceLanguage=en"+(pageToken?"&pageToken="+pageToken:"")+"&key="+YOUTUBE_API_KEY);
const d=await r.json();
for(const item of(d.items||[])){const id=item.id&&item.id.channelId;const name=item.snippet&&item.snippet.channelTitle;if(id&&name&&!catIds.has(id)&&!cand.has(id))cand.set(id,{name:name,niche:[term.niche],src:"Discovered"});}
pageToken=d.nextPageToken||"";await sleep(200);if(!pageToken)break;
}catch(e){break;}
}
}

const SKIP=["ugc","india","hindi","tamil","telugu","roblox","minecraft kids","fortnite kids","gaming review ","film breakdown ","fps gaming","fps channel","fps game","movie review channel","review channel"];
const candArr=[...cand.entries()].map(function(e){return{id:e[0],name:e[1].name,niche:e[1].niche,src:e[1].src};}).filter(function(c){const n=c.name.toLowerCase();return !SKIP.some(function(s){return n.includes(s);})&&c.name.length>2&&c.name.length<50;});

// ---- subscriber floor via batched channels.list (statistics only; uploads playlist is derived from id later) ----
const eligible=[];
for(let i=0;i<candArr.length;i+=50){
const slice=candArr.slice(i,i+50);
try{
const r=await fetch("https://www.googleapis.com/youtube/v3/channels?part=statistics&id="+slice.map(function(c){return c.id;}).join(",")+"&key="+YOUTUBE_API_KEY);
const d=await r.json();const subs={};for(const ch of(d.items||[]))subs[ch.id]=parseInt((ch.statistics&&ch.statistics.subscriberCount)||0);
for(const c of slice){const s=subs[c.id]||0;if(s>=SUB_FLOOR){c.subs=s;eligible.push(c);}}
}catch(e){}
await sleep(100);
}
eligible.sort(function(a,b){return b.subs-a.subs;}); // add the biggest channels first

// ---- append new channels to the catalog (capped per run to bound write time) ----
const today=new Date().toISOString().split("T")[0];
const toAdd=eligible.slice(0,MAX_NEW_PER_RUN);
let added=0;
for(const c of toAdd){
const cols={};cols[CAT_YTID]=c.id;cols[CAT_NICHE]=c.niche.join("/");cols[CAT_SUBS]=c.subs;cols[CAT_DATE]={date:today};cols[CAT_SRC]=c.src;
try{await monday("mutation{create_item(board_id:"+CATALOG_BOARD+",item_name:"+JSON.stringify(c.name.substring(0,80))+",column_values:"+JSON.stringify(JSON.stringify(cols))+",create_labels_if_missing:true){id}}");added++;}catch(e){}
await sleep(30);
}

return res.json({message:"Discovery complete",catalogBefore:catIds.size,candidates:candArr.length,eligible50k:eligible.length,addedThisRun:added,catalogAfter:catIds.size+added,cappedAt:MAX_NEW_PER_RUN});
}
