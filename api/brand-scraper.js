export const config={maxDuration:300};
export default async function handler(req,res){
  res.setHeader("Access-Control-Allow-Origin","*");
  if(req.method==="OPTIONS")return res.status(200).end();
  const YOUTUBE_API_KEY=process.env.YOUTUBE_API_KEY;
  const MONDAY_API_KEY=process.env.MONDAY_API_KEY;
  const BOARD_ID="18415192682";
  if(!YOUTUBE_API_KEY||!MONDAY_API_KEY)return res.status(500).json({error:"Missing env vars"});
  const CHANNELS=[
    "UCsvn_Po0SmunchJYtttWpOxMg","UCbu2SsF-Or3Rsn3NxqODImA","UCXa_bzvv7Oo1glaW9FldDhQ",
    "UC_ML5xP23TOWKUcc-oAE_Eg","UCOpNcN46UbXVtpKMrmU4Abg","UCg40OxZ1GYh3u3jBntB6DLg",
    "UCX6OQ3DkcsbYNE6H8uQQuVA","UCkBR3-HnLQHeaMQBbVvDGOw","UCBcRF18a7Qf58cCRy5xuWwQ",
    "UCpqXJOEqGS-TCnazcHCo0rA","UCJ6td3C9QlkB9cgHBVPpnBg","UCddiUEpeqJcYeBxX1IVBKvQ",
    "UC4w1YQAJMWOz4qtxinq55LQ","UCmGSJVG3mCRXVOP4yZrU1Dw","UCt7sv-NKh44rHAEb-qCCRvA",
    "UCuWZNzb-6-NLKH6DYi3SJ7Q","UCvqt8j7DfPmveJp3UOk9XTg","UCFmYk0gJrHFLCqpYVSO8vkA",
    "UCi8e0iOVk1fEOogdfu4YgfA","UCVyTR6tFcjuAAhGK7lAr-mQ","UCGaVdbSav8xWuFWTadK6loA",
    "UC4uD0_ncNh86RoNE5mMaJJA","UCKy1dAqELo0zrOtPkf0sTMw","UCXi6_LknvHkNLDJ5fEv8XbA",
    "UCTLkMQAiJ9AqUMwXKBtJlyA","UCzWQYUVCpZqtN93H8RR44Qw","UCVg9nCmmfIyP4QcGOnZZ9Qg",
    "UCYnD3QMGRowTf5SqHxJnXPg","UCNvSVsen5EPIJ4UXGiGFx9w","UCuWZNzb-6-NLKH6DYi3SJ7Q"
  ];
  const SPONSOR_PATTERNS=[
    /(?:sponsored by|brought to you by|thanks? to|partner(?:ed)? with|in partnership with)s+([A-Z][A-Za-z0-9\s&\.]+?)(?:\.|,|!|\n|for |to )/gi,
    /(?:use code|promo code|discount code)s+\w+\s+(?:at|for|on)\s+([A-Z][A-Za-z0-9\s&\.]+?)(?:\.|,|!|\n)/gi,
    /\[?[Ss]ponsored?\]?\s*:?\s*([A-Z][A-Za-z0-9\s&\.]+?)(?:\.|,|!|\n)/g,
  ];
  const NOISE=["YouTube","Google","Twitter","Instagram","Discord","Twitch","Reddit","Amazon","Apple","Microsoft","Steam","PlayStation","Xbox","Nintendo","Patreon","Spotify","Netflix","Subscribe","Channel","Video","Watch","Click","Link","Below","Description","Comment","Like","Share"];
  function extractSponsors(desc){
    if(!desc)return[];
    const sponsors=new Set();
    for(const p of SPONSOR_PATTERNS){
      for(const m of [...desc.matchAll(p)]){
        const b=m[1]?.trim().replace(/\s+/g," ");
        if(b&&b.length>2&&b.length<50&&!NOISE.some(n=>b.toLowerCase().includes(n.toLowerCase())))sponsors.add(b);
      }
    }
    return[...sponsors];
  }
  async function getChannelVideos(cid){
    const since=new Date(Date.now()-7*24*60*60*1000).toISOString();
    const r=await fetch(`https://www.googleapis.com/youtube/v3/search?part=id&channelId=${cid}&type=video&publishedAfter=${since}&maxResults=5&key=${YOUTUBE_API_KEY}`);
    if(!r.ok)return[];
    const d=await r.json();
    return(d.items||[]).map(i=>i.id.videoId).filter(Boolean);
  }
  async function getVideoDetails(ids){
    if(!ids.length)return[];
    const r=await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${ids.join(",")}&key=${YOUTUBE_API_KEY}`);
    if(!r.ok)return[];
    return(await r.json()).items||[];
  }
  const brandData={};
  const today=new Date().toISOString().split("T")[0];
  let processed=0;
  for(const cid of CHANNELS){
    try{
      const vids=await getChannelVideos(cid);
      const videos=await getVideoDetails(vids);
      for(const v of videos){
        const ch=v.snippet?.channelTitle||cid;
        for(const s of extractSponsors(v.snippet?.description||"")){
          const k=s.toLowerCase().replace(/\s+/g,"");
          if(!brandData[k])brandData[k]={name:s,channels:new Set(),lastSeen:today,weekCount:0};
          brandData[k].channels.add(ch);
          brandData[k].weekCount++;
          brandData[k].lastSeen=today;
        }
      }
      processed++;
      await new Promise(r=>setTimeout(r,150));
    }catch(e){processed++;}
  }
  const exRes=await fetch("https://api.monday.com/v2",{method:"POST",headers:{"Content-Type":"application/json","Authorization":MONDAY_API_KEY},body:JSON.stringify({query:`{boards(ids:[${BOARD_ID}]){items_page(limit:500){items{id name}}}}`})});
  const exData=await exRes.json();
  const exMap={};
  for(const i of exData?.data?.boards?.[0]?.items_page?.items||[])exMap[i.name.toLowerCase()]=i.id;
  let saved=0;
  for(const[,data] of Object.entries(brandData)){
    if(data.channels.size<2)continue;
    const cols={text_mm3shz66:data.name,numeric_mm3swzsf:data.channels.size,numeric_mm3szew3:data.weekCount,date_mm3sx6hp:{date:data.lastSeen},text_mm3ss133:[...data.channels].slice(0,5).join(", "),text_mm3shf6v:"Gaming/Film"};
    const name=data.name.substring(0,50);
    const eid=exMap[data.name.toLowerCase()];
    try{
      if(eid){await fetch("https://api.monday.com/v2",{method:"POST",headers:{"Content-Type":"application/json","Authorization":MONDAY_API_KEY},body:JSON.stringify({query:`mutation{change_multiple_column_values(board_id:${BOARD_ID},item_id:${eid},column_values:${JSON.stringify(JSON.stringify(cols))}){id}}`})});}
      else{await fetch("https://api.monday.com/v2",{method:"POST",headers:{"Content-Type":"application/json","Authorization":MONDAY_API_KEY},body:JSON.stringify({query:`mutation{create_item(board_id:${BOARD_ID},item_name:${JSON.stringify(name)},column_values:${JSON.stringify(JSON.stringify(cols))}){id}}`})});}
      saved++;
    }catch(e){}
  }
  return res.status(200).json({message:"Done",processed,brandsFound:Object.keys(brandData).length,saved});
}
