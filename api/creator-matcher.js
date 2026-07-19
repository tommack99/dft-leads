export const config={maxDuration:300};
// CREATOR MATCHER for the Studio/Dev Upcoming Releases board (18415007170).
// Two jobs each weekly run:
//  1) PREP (source-once): for releases 0-120 days out with no Suggested Creators yet, scan DFT
//     roster creators' recent uploads for videos on that release's IP, and write creators + videos.
//     Set Outreach Window = "Reach out now" if already <=ALERT_DAYS out, else "Prep window".
//  2) ALERT FLIP: any release 0-ALERT_DAYS days out whose window is not already
//     "Reach out now"/"Launched" is flipped to "Reach out now" (creators were matched earlier during
//     prep) -> this status change fires the team alert email.
// Net effect: the team is alerted ALERT_DAYS (30) days before release, fully prepped
// (creators matched + contact enriched). Runs weekly AFTER enrichment.
export default async function handler(req,res){
const YT=process.env.YOUTUBE_API_KEY;
const MK=process.env.MONDAY_API_KEY;
const RELEASE_BOARD="18415007170";
const ROSTER_BOARD="6160485039";
const REL_DATE="date_mm3rpkm4",REL_WINDOW="color_mm5cpevg",REL_CREATORS="long_text_mm5cfcfd",REL_VIDEOS="long_text_mm5cwn40";
const ROSTER_GROUPS=["new_group__1","group_mks8q6fd"];
const R_HANDLE="text_mm4gvn92",R_YT="text_mkwxvv88";
const ALERT_DAYS=30;   // fire "Reach out now" (the team alert) this many days before release
const PREP_MAX=120;    // begin matching creators once a release is within this many days
if(!YT||!MK)return res.status(500).json({error:"Missing env vars"});
const sleep=function(ms){return new Promise(function(r){setTimeout(r,ms);});};
async function monday(q){const r=await fetch("https://api.monday.com/v2",{method:"POST",headers:{"Content-Type":"application/json","Authorization":MK},body:JSON.stringify({query:q})});return r.json();}
async function yt(endpoint,params){const u="https://www.googleapis.com/youtube/v3/"+endpoint+"?"+Object.keys(params).filter(function(k){return params[k]!=null;}).map(function(k){return k+"="+encodeURIComponent(params[k]);}).join("&")+"&key="+YT;try{return await (await fetch(u)).json();}catch(e){return{};}}

// ---- IP keyword logic ----
function keywordsFor(title){
let t=title.toLowerCase().replace(/\(.*?\)/g," ").replace(/[^a-z0-9\s]/g," ").replace(/\s+/g," ").trim();
t=t.replace(/\s+(\d+|[ivx]+)$/,"").trim(); // drop trailing sequel number / roman numeral
const stop=new Set(["the","of","a","an","and","part","chapter","edition","remake","remastered","remaster","new"]);
const words=t.split(" ").filter(function(w){return w&&!stop.has(w)&&!/^\d+$/.test(w);});
const first=words.find(function(w){return w.length>=4;})||"";
return{first:first,phrase:words.join(" ")};
}
function titleMatches(videoTitle,kw){
const v=(videoTitle||"").toLowerCase();
if(kw.phrase&&kw.phrase.length>=5&&v.indexOf(kw.phrase)>=0)return true;
if(kw.first&&kw.first.length>=4&&new RegExp("\\b"+kw.first+"\\b").test(v))return true;
return false;
}

// ---- Step 1: read releases (date, creators, window); build prep + flip target lists ----
const relRes=await monday("{boards(ids:["+RELEASE_BOARD+"]){items_page(limit:200){items{id name column_values(ids:[\""+REL_DATE+"\",\""+REL_CREATORS+"\",\""+REL_WINDOW+"\"]){id text}}}}}");
const relItems=(relRes&&relRes.data&&relRes.data.boards&&relRes.data.boards[0]&&relRes.data.boards[0].items_page&&relRes.data.boards[0].items_page.items)||[];
const today=Date.now();
const matchTargets=[]; // 0-120d, no creators yet -> match creators (source once)
const flipTargets=[];  // 0-ALERT_DAYS, not yet "Reach out now"/"Launched" -> fire alert
for(const it of relItems){
let dateTxt="",creators="",windowTxt="";
for(const cv of(it.column_values||[])){if(cv.id===REL_DATE)dateTxt=(cv.text||"").trim();if(cv.id===REL_CREATORS)creators=(cv.text||"").trim();if(cv.id===REL_WINDOW)windowTxt=(cv.text||"").trim();}
if(!dateTxt)continue;
const days=Math.round((Date.parse(dateTxt)-today)/86400000);
if(days<0)continue; // launched -> handled by the sourcing task
if(days<=PREP_MAX&&!creators)matchTargets.push({id:it.id,name:it.name,days:days,kw:keywordsFor(it.name)});
if(days<=ALERT_DAYS&&windowTxt!=="Reach out now"&&windowTxt!=="Launched")flipTargets.push({id:it.id,name:it.name,days:days});
}
if(!matchTargets.length&&!flipTargets.length)return res.json({message:"No releases to match or flip",checked:relItems.length});

// ---- Step 2: read roster creators (only needed if we have prep work) ----
const creators=[];
if(matchTargets.length){
const rosterRes=await monday("{boards(ids:["+ROSTER_BOARD+"]){groups(ids:["+ROSTER_GROUPS.map(function(g){return "\""+g+"\"";}).join(",")+"]){items_page(limit:200){items{name column_values(ids:[\""+R_HANDLE+"\",\""+R_YT+"\"]){id text}}}}}}");
for(const grp of((rosterRes&&rosterRes.data&&rosterRes.data.boards&&rosterRes.data.boards[0]&&rosterRes.data.boards[0].groups)||[])){
for(const it of(grp.items_page&&grp.items_page.items||[])){
let handle="",yturl="";for(const cv of(it.column_values||[])){if(cv.id===R_HANDLE)handle=(cv.text||"").trim();if(cv.id===R_YT)yturl=(cv.text||"").trim();}
let resolve=null;const u=yturl||"";
let m=u.match(/youtube\.com\/channel\/(UC[\w-]+)/i);if(m)resolve=["channel",m[1]];
else{m=u.match(/youtube\.com\/@([\w.\-]+)/i);if(m)resolve=["handle",m[1]];else{m=u.match(/youtube\.com\/user\/([\w.\-]+)/i);if(m)resolve=["user",m[1]];}}
if(!resolve&&handle)resolve=["handle",handle.replace(/^@/,"").split(/\s+/)[0]];
if(resolve)creators.push({name:it.name,handle:handle||("@"+ (resolve[1]||"")),resolve:resolve});
}
}
// ---- Step 3: resolve uploads playlist + enumerate recent uploads ----
async function uploadsPlaylist(resolve){
if(resolve[0]==="channel")return "UU"+resolve[1].slice(2);
const body=resolve[0]==="user"?await yt("channels",{part:"contentDetails",forUsername:resolve[1]}):await yt("channels",{part:"contentDetails",forHandle:resolve[1]});
const items=body.items||[];return items.length?items[0].contentDetails.relatedPlaylists.uploads:null;
}
const MAX_VIDS=150;
for(const c of creators){
try{
const pid=await uploadsPlaylist(c.resolve);c.videos=[];
if(!pid)continue;
let token="";
for(let p=0;p<3;p++){
const d=await yt("playlistItems",{part:"snippet",playlistId:pid,maxResults:50,pageToken:token||null});
for(const i of(d.items||[])){const sn=i.snippet||{};const vid=sn.resourceId&&sn.resourceId.videoId;if(vid)c.videos.push({title:sn.title||"",url:"https://www.youtube.com/watch?v="+vid});}
token=d.nextPageToken||"";if(!token||c.videos.length>=MAX_VIDS)break;
}
}catch(e){c.videos=[];}
await sleep(20);
}
}

// ---- Step 4: PREP pass — match creators, write creators + videos, set window ----
const report=[];const matchedIds=new Set();
for(const t of matchTargets){
matchedIds.add(t.id);
const hits=[];
for(const c of creators){
if(!c.videos||!c.videos.length)continue;
const vids=c.videos.filter(function(v){return titleMatches(v.title,t.kw);});
if(vids.length)hits.push({name:c.name,handle:c.handle,count:vids.length,videos:vids.slice(0,2)});
}
hits.sort(function(a,b){return b.count-a.count;});
const top=hits.slice(0,6);
let creatorsText,videosText;
if(top.length){
creatorsText=top.map(function(h){return h.name+" ("+h.handle+") — "+h.count+" video"+(h.count>1?"s":"")+" on this IP";}).join("\n");
const vlines=[];for(const h of top){for(const v of h.videos){vlines.push(h.name+": "+v.title+" — "+v.url);}}
videosText=vlines.slice(0,10).join("\n");
}else{
creatorsText="No roster creators have covered this IP yet — review for genre fit.";
videosText="";
}
// If already within the alert window, go straight to "Reach out now"; otherwise hold at "Prep window".
const windowLabel=t.days<=ALERT_DAYS?"Reach out now":"Prep window";
const cols={};cols[REL_CREATORS]={text:creatorsText};cols[REL_VIDEOS]={text:videosText};cols[REL_WINDOW]={label:windowLabel};
try{await monday("mutation{change_multiple_column_values(board_id:"+RELEASE_BOARD+",item_id:"+t.id+",column_values:"+JSON.stringify(JSON.stringify(cols))+",create_labels_if_missing:true){id}}");}catch(e){}
report.push({release:t.name,days:t.days,window:windowLabel,creatorsMatched:top.length,topCreators:top.map(function(h){return h.name+"("+h.count+")";})});
}

// ---- Step 5: ALERT FLIP pass — items prepped earlier that are now within ALERT_DAYS ----
let flipped=0;
for(const f of flipTargets){
if(matchedIds.has(f.id))continue; // already set in the prep pass this run
const cols={};cols[REL_WINDOW]={label:"Reach out now"};
try{await monday("mutation{change_multiple_column_values(board_id:"+RELEASE_BOARD+",item_id:"+f.id+",column_values:"+JSON.stringify(JSON.stringify(cols))+",create_labels_if_missing:true){id}}");flipped++;}catch(e){}
await sleep(20);
}

return res.json({message:"Creator matching + "+ALERT_DAYS+"-day alert flip complete",rosterCreators:creators.length,prepped:report.length,flippedToReachOutNow:flipped,report:report});
}
