export const config={maxDuration:300};
export default async function handler(req,res){
  res.setHeader("Access-Control-Allow-Origin","*");
  if(req.method==="OPTIONS")return res.status(200).end();
  const YOUTUBE_API_KEY=process.env.YOUTUBE_API_KEY;
  const MONDAY_API_KEY=process.env.MONDAY_API_KEY;
  const BOARD_ID="18415192682";
  if(!YOUTUBE_API_KEY||!MONDAY_API_KEY)return res.status(500).json({error:"Missing env vars"});

  // Channel names to search for - YouTube will resolve to real IDs
  const CHANNEL_NAMES=[
    "IGN","GameSpot","Gameranx","Skill Up","ACG","Asmongold TV",
    "penguinz0","Markiplier","jacksepticeye","The Game Theorists",
    "NakeyJakey","Internet Historian","videogamedunkey","MoistCr1TiKaL",
    "DanTDM","YogsCast","Outside Xbox","Easy Allies","Noclip",
    "Screen Junkies","New Rockstars","Heavy Spoilers","Chris Stuckmann",
    "Jeremy Jahns","Dead Meat","Star Wars Theory","Emergency Awesome",
    "Beyond The Trailer","Collider Videos","Comics Explained",
    "WatchMojo.com","Looper","Screen Rant","Gigguk","The Anime Man",
    "Nerdwriter1","Wisecrack","Linus Tech Tips","Marques Brownlee",
    "Unbox Therapy","Dave2D","GameXplain","ACG","Kotaku",
    "Polygon","The Escapist","Outside Xtra","Kinda Funny Games",
    "IGN UK","GamesRadar"
  ];

  const SPONSOR_PATTERNS=[
    /(?:sponsored by|brought to you by|thanks? to|partner(?:ed)? with|in partnership with)s+([A-Z][A-Za-z0-9\s&\.]+?)(?:\.|,|!|\n|for |to )/gi,
    /(?:use code|promo code|discount code)s+\w+\s+(?:at|for|on)\s+([A-Z][A-Za-z0-9\s&\.]+?)(?:\.|,|!|\n)/gi,
    /\[?[Ss]ponsored?\]?\s*:?\s*([A-Z][A-Za-z0-9\s&\.]+?)(?:\.|,|!|\n)/g,
  ];
  const NOISE=["YouTube","Google","Twitter","Instagram","Discord","Twitch","Reddit","Amazon","Apple","Microsoft","Steam","PlayStation","Xbox","Nintendo","Patreon","Spotify","Netflix","Subscribe","Channel","Video","Watch","Click","Link","Below","Description","Comment","Like","Share","Merch","Twitch","Support"];

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

  // Search for channel by name to get real channel ID
  async function findChannelId(name){
    const r=await fetch(`https://www.googleapis.com/youtube/v3/search?part=id,snippet&q=${encodeURIComponent(name)}&type=channel&maxResults=1&key=${YOUTUBE_API_KEY}`);
    if(!r.ok)return null;
    const d=await r.json();
    return d.items?.[0]?.id?.channelId||null;
  }

  async function getChannelVideos(channelId){
    const since=new Date(Date.now()-7*24*60*60*1000).toISOString();
    const r=await fetch(`https://www.googleapis.com/youtube/v3/search?part=id&channelId=${channelId}&type=video&publishedAfter=${since}&maxResults=5&order=date&key=${YOUTUBE_API_KEY}`);
    if(!r.ok)return[];
    const d=await r.json();
    return(d.items||[]).map(i=>i.id?.videoId).filter(Boolean);
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

  for(const name of CHANNEL_NAMES){
    try{
      const channelId=await findChannelId(name);
      if(!channelId){processed++;await new Promise(r=>setTimeout(r,100));continue;}
      const vids=await getChannelVideos(channelId);
      if(!vids.length){processed++;await new Promise(r=>setTimeout(r,100));continue;}
      const videos=await getVideoDetails(vids);
      for(const v of videos){
        const ch=v.snippet?.channelTitle||name;
        for(const s of extractSponsors(v.snippet?.description||"")){
          const k=s.toLowerCase().replace(/\s+/g,"");
          if(!brandData[k])brandData[k]={name:s,channels:new Set(),lastSeen:today,weekCount:0};
          brandData[k].channels.add(ch);
          brandData[k].weekCount++;
          brandData[k].lastSeen=today;
        }
      }
      processed++;
      await new Promise(r=>setTimeout(r,100));
    }catch(e){processed++;}
  }

  // Fetch existing board items
  const exRes=await fetch("https://api.monday.com/v2",{method:"POST",headers:{"Content-Type":"application/json","Authorization":MONDAY_API_KEY},body:JSON.stringify({query:`{boards(ids:[${BOARD_ID}]){items_page(limit:500){items{id name}}}}`})});
  const exData=await exRes.json();
  const exMap={};
  for(const i of exData?.data?.boards?.[0]?.items_page?.items||[])exMap[i.name.toLowerCase()]=i.id;

  let saved=0;
  for(const[,data] of Object.entries(brandData)){
    if(data.channels.size<1)continue;
    const cols={
      text_mm3shz66:data.name,
      numeric_mm3swzsf:data.channels.size,
      numeric_mm3szew3:data.weekCount,
      date_mm3sx6hp:{date:data.lastSeen},
      text_mm3ss133:[...data.channels].slice(0,5).join(", "),
      text_mm3shf6v:"Gaming/Film"
    };
    const itemName=data.name.substring(0,50);
    const eid=exMap[data.name.toLowerCase()];
    try{
      if(eid){
        await fetch("https://api.monday.com/v2",{method:"POST",headers:{"Content-Type":"application/json","Authorization":MONDAY_API_KEY},body:JSON.stringify({query:`mutation{change_multiple_column_values(board_id:${BOARD_ID},item_id:${eid},column_values:${JSON.stringify(JSON.stringify(cols))}){id}}`})});
      }else{
        await fetch("https://api.monday.com/v2",{method:"POST",headers:{"Content-Type":"application/json","Authorization":MONDAY_API_KEY},body:JSON.stringify({query:`mutation{create_item(board_id:${BOARD_ID},item_name:${JSON.stringify(itemName)},column_values:${JSON.stringify(JSON.stringify(cols))}){id}}`})});
      }
      saved++;
    }catch(e){}
  }

  return res.status(200).json({message:"Done",processed,brandsFound:Object.keys(brandData).length,brandsWith2PlusChannels:saved});
}
