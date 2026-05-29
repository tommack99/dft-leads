export const config={maxDuration:300};
export default async function handler(req,res){
  const YOUTUBE_API_KEY=process.env.YOUTUBE_API_KEY;
  const MONDAY_API_KEY=process.env.MONDAY_API_KEY;
  const BOARD_ID="18415381478";
  const GROUP_ID="topics";
  if(!YOUTUBE_API_KEY||!MONDAY_API_KEY)return res.status(500).json({error:"Missing env vars"});

  const SEARCH_TERMS=[
    "gaming review youtube","film review youtube","movie analysis youtube",
    "tech review channel","game commentary youtube","indie game youtube",
    "horror movie review youtube","sci fi review youtube","game critique",
    "retro gaming youtube","comic book review youtube","game analysis channel",
    "film essay youtube","gaming podcast","UK gaming youtube",
    "UK film review","British gaming youtuber","Australian gaming youtube",
    "Canadian game review","game lore youtube","movie breakdown youtube",
    "gaming news channel",
  ];

  const AGENCY_SIGNALS=[
    "talent agency","represented by","management@","manager@","agent@",
    "inquiries@","booking@","press@","publicity@","united talent","wme",
    "caa ","uta ","paradigm","3arts","night media","loaded","creator corp",
    "amp studios","select management","no unsolicited","all inquiries",
    "business only","for business",
  ];

  function detectNiche(desc){
    const d=(desc||"").toLowerCase();
    if(d.includes("gaming")||d.includes("game")||d.includes("playstation")||d.includes("xbox")||d.includes("nintendo")||d.includes("steam")||d.includes("esports"))return"Gaming";
    if(d.includes("film")||d.includes("movie")||d.includes("cinema")||d.includes("marvel")||d.includes("tv show")||d.includes("director"))return"Film";
    if(d.includes("tech")||d.includes("technology")||d.includes("gadget")||d.includes("software")||d.includes("hardware")||d.includes("iphone"))return"Tech";
    if(d.includes("entertainment")||d.includes("comedy")||d.includes("podcast")||d.includes("streaming"))return"Entertainment";
    return null;
  }

  function extractEmail(text){
    if(!text)return null;
    const m=text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
    if(!m)return null;
    const e=m[0].toLowerCase();
    const skip=["noreply","no-reply","example","youtu","google","twitter","instagram","tiktok"];
    if(skip.some(function(s){return e.includes(s);}))return null;
    return m[0];
  }

  function hasAgency(text){
    if(!text)return false;
    const t=text.toLowerCase();
    return AGENCY_SIGNALS.some(function(s){return t.includes(s);});
  }

  // Step 1: Discover channels via YouTube search
  const discovered=new Map();
  for(const term of SEARCH_TERMS){
    try{
      const r=await fetch("https://www.googleapis.com/youtube/v3/search?part=snippet&q="+encodeURIComponent(term)+"&type=channel&maxResults=15&relevanceLanguage=en&key="+YOUTUBE_API_KEY);
      const d=await r.json();
      if(d.error)continue;
      for(const item of(d.items||[])){
        const id=item.id&&item.id.channelId;
        const name=item.snippet&&item.snippet.channelTitle;
        if(id&&name&&!discovered.has(id))discovered.set(id,name);
      }
      await new Promise(function(r){setTimeout(r,200);});
    }catch(e){}
  }

  // Step 2: Get channel details in batches of 50
  const candidates=[...discovered.entries()].map(function(e){return{id:e[0],name:e[1]};});
  const qualified=[];
  for(let i=0;i<Math.min(candidates.length,300);i+=50){
    const batch=candidates.slice(i,i+50);
    const ids=batch.map(function(c){return c.id;}).join(",");
    try{
      const r=await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&id="+ids+"&key="+YOUTUBE_API_KEY);
      const d=await r.json();
      for(const ch of(d.items||[])){
        const subs=parseInt(ch.statistics&&ch.statistics.subscriberCount||0);
        const desc=(ch.snippet&&ch.snippet.description)||"";
        const niche=detectNiche(desc);
        const agency=hasAgency(desc);
        if(!niche||agency||subs<100000||subs>5000000)continue;
        const uploadsId=ch.contentDetails&&ch.contentDetails.relatedPlaylists&&ch.contentDetails.relatedPlaylists.uploads;
        if(!uploadsId)continue;
        qualified.push({id:ch.id,name:ch.snippet.title,desc,subs,niche,uploadsId,email:extractEmail(desc)});
      }
    }catch(e){}
    await new Promise(function(r){setTimeout(r,200);});
  }

  // Step 3: Get existing items to avoid duplicates
  const exRes=await fetch("https://api.monday.com/v2",{method:"POST",headers:{"Content-Type":"application/json","Authorization":MONDAY_API_KEY},body:JSON.stringify({query:"{boards(ids:["+BOARD_ID+"]){items_page(limit:500){items{name}}}}"})});
  const exData=await exRes.json();
  const existing=new Set((exData&&exData.data&&exData.data.boards&&exData.data.boards[0]&&exData.data.boards[0].items_page&&exData.data.boards[0].items_page.items||[]).map(function(i){return i.name.toLowerCase();}));

  // Step 4: Check avg views and save qualifying channels
  let saved=0;
  const today=new Date().toISOString().split("T")[0];

  for(const ch of qualified){
    if(existing.has(ch.name.toLowerCase()))continue;
    try{
      // Get last 10 video IDs
      const playRes=await fetch("https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId="+ch.uploadsId+"&maxResults=10&key="+YOUTUBE_API_KEY);
      const playData=await playRes.json();
      const videoIds=(playData.items||[]).map(function(i){return i.contentDetails&&i.contentDetails.videoId;}).filter(Boolean);
      if(!videoIds.length)continue;

      // Get view counts
      const vidRes=await fetch("https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails&id="+videoIds.join(",")+"&key="+YOUTUBE_API_KEY);
      const vidData=await vidRes.json();
      const views=(vidData.items||[]).map(function(v){return parseInt(v.statistics&&v.statistics.viewCount||0);});
      const avgViews=views.length?Math.round(views.reduce(function(a,b){return a+b;},0)/views.length):0;
      if(avgViews<50000)continue;

      // Upload frequency
      const pubDates=(playData.items||[]).map(function(i){return i.contentDetails&&i.contentDetails.videoPublishedAt;}).filter(Boolean);
      let freq="Unknown";
      if(pubDates.length>=2){
        const daysBetween=(new Date(pubDates[0])-new Date(pubDates[pubDates.length-1]))/86400000;
        const perMonth=daysBetween>0?(pubDates.length/(daysBetween/30)):0;
        freq=perMonth>=8?"Weekly+":perMonth>=3?"Weekly":perMonth>=1?"Monthly":"Infrequent";
      }

      // Save to Monday - only safe column types
      const notesText="Niche: "+ch.niche+" | Uploads: "+freq+" | Subs: "+ch.subs.toLocaleString()+(ch.email?"":"\n\nEMAIL NEEDED - check YouTube About page");
      const colVals=JSON.stringify({
        "link_mm3t777s":{"url":"https://youtube.com/channel/"+ch.id,"text":ch.name},
        "numeric_mm3tmrdz":ch.subs,
        "numeric_mm3tr6gy":avgViews,
        "date_mm3tvd56":{"date":today},
        "long_text_mm3tqaqs":{"text":(ch.email||"Check YouTube - click View Email Address")+"\n\n"+notesText}
      });

      const mutation="mutation{create_item(board_id:"+BOARD_ID+",group_id:\""+GROUP_ID+"\",item_name:"+JSON.stringify(ch.name.substring(0,50))+",column_values:"+JSON.stringify(colVals)+"){id}}";
      const saveRes=await fetch("https://api.monday.com/v2",{method:"POST",headers:{"Content-Type":"application/json","Authorization":MONDAY_API_KEY},body:JSON.stringify({query:mutation})});
      const saveData=await saveRes.json();
      if(saveData&&saveData.data&&saveData.data.create_item&&saveData.data.create_item.id)saved++;
      await new Promise(function(r){setTimeout(r,150);});
    }catch(e){}
  }

  return res.json({
    message:"Creator scout complete",
    channelsDiscovered:discovered.size,
    qualified:qualified.length,
    saved
  });
}
