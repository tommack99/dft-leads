export const config={maxDuration:300};
export default async function handler(req,res){
  const YOUTUBE_API_KEY=process.env.YOUTUBE_API_KEY;
  const MONDAY_API_KEY=process.env.MONDAY_API_KEY;
  const BOARD_ID="18415381478";
  if(!YOUTUBE_API_KEY||!MONDAY_API_KEY)return res.status(500).json({error:"Missing env vars"});

  // Search terms to find unrepresented creators
  const SEARCH_TERMS=[
    "gaming review youtube","film review youtube","movie analysis youtube",
    "tech review channel","game commentary youtube","indie game youtube",
    "horror movie review youtube","sci fi review youtube","game critique",
    "retro gaming youtube","anime review channel","comic book review youtube",
    "game analysis channel","film essay youtube","gaming podcast",
    "UK gaming youtube","UK film review","British gaming youtuber",
    "Australian gaming youtube","Canadian game review",
    "game lore youtube","movie breakdown youtube","gaming news channel",
  ];

  // Agency signals to detect - if found, skip the channel
  const AGENCY_SIGNALS=[
    "talent agency","represented by","management@","manager@","agent@",
    "inquiries@","booking@","press@","publicity@",
    "united talent","wme","caa ","uta ","paradigm","3arts","night media",
    "loaded","creator corp","amp studios","viewstats","select management",
    "no unsolicited","all inquiries","business only","for business",
  ];

  // Niche detection
  function detectNiche(desc){
    const d=(desc||"").toLowerCase();
    if(d.includes("gaming")||d.includes("game")||d.includes("playstation")||d.includes("xbox")||d.includes("nintendo")||d.includes("steam")||d.includes("esports"))return "Gaming";
    if(d.includes("film")||d.includes("movie")||d.includes("cinema")||d.includes("director")||d.includes("actor")||d.includes("marvel")||d.includes("tv show"))return "Film";
    if(d.includes("tech")||d.includes("technology")||d.includes("gadget")||d.includes("software")||d.includes("hardware")||d.includes("iphone")||d.includes("android"))return "Tech";
    if(d.includes("entertainment")||d.includes("comedy")||d.includes("podcast")||d.includes("streaming")||d.includes("youtube"))return "Entertainment";
    return null;
  }

  // Extract email from text
  function extractEmail(text){
    if(!text)return null;
    const match=text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
    if(!match)return null;
    const email=match[0].toLowerCase();
    // Filter out common platform emails
    const skip=["noreply","no-reply","example.com","youtu.be","youtube.com","google.com","twitter.com","instagram.com","tiktok.com"];
    if(skip.some(s=>email.includes(s)))return null;
    return match[0];
  }

  // Check if channel has agency signals
  function hasAgency(text){
    if(!text)return false;
    const t=text.toLowerCase();
    return AGENCY_SIGNALS.some(s=>t.includes(s));
  }

  // Discover channels
  const discoveredIds=new Set();
  const candidates=[];

  for(const term of SEARCH_TERMS){
    try{
      const r=await fetch("https://www.googleapis.com/youtube/v3/search?part=snippet&q="+encodeURIComponent(term)+"&type=channel&maxResults=20&relevanceLanguage=en&key="+YOUTUBE_API_KEY);
      const d=await r.json();
      for(const item of(d.items||[])){
        const id=item.id&&item.id.channelId;
        if(id&&!discoveredIds.has(id)){
          discoveredIds.add(id);
          candidates.push({id,name:item.snippet&&item.snippet.channelTitle});
        }
      }
      await new Promise(function(r){setTimeout(r,200);});
    }catch(e){}
  }

  // Get detailed channel info in batches of 50
  const qualified=[];
  const BATCH=50;
  for(let i=0;i<Math.min(candidates.length,300);i+=BATCH){
    const batch=candidates.slice(i,i+BATCH);
    const ids=batch.map(function(c){return c.id;}).join(",");
    try{
      const r=await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&id="+ids+"&key="+YOUTUBE_API_KEY);
      const d=await r.json();
      for(const ch of(d.items||[])){
        const subs=parseInt(ch.statistics&&ch.statistics.subscriberCount||0);
        const desc=(ch.snippet&&ch.snippet.description)||"";
        const niche=detectNiche(desc);
        const email=extractEmail(desc);
        const agency=hasAgency(desc);
        // Must: have niche, have email, no agency, 100k-5M subs
        if(!niche||agency||subs<100000||subs>5000000)continue;
        const uploadsId=ch.contentDetails&&ch.contentDetails.relatedPlaylists&&ch.contentDetails.relatedPlaylists.uploads;
        if(!uploadsId)continue;
        qualified.push({id:ch.id,name:ch.snippet.title,desc,subs,email,niche,uploadsId});
      }
    }catch(e){}
    await new Promise(function(r){setTimeout(r,200);});
  }

  // For qualified channels, get avg views of last 10 videos
  let saved=0;
  const today=new Date().toISOString().split("T")[0];

  // Get existing items to avoid duplicates
  const exRes=await fetch("https://api.monday.com/v2",{method:"POST",headers:{"Content-Type":"application/json","Authorization":MONDAY_API_KEY},body:JSON.stringify({query:"{boards(ids:["+BOARD_ID+"]){items_page(limit:500){items{id name}}}}"})});
  const exData=await exRes.json();
  const existingNames=new Set((exData&&exData.data&&exData.data.boards&&exData.data.boards[0]&&exData.data.boards[0].items_page&&exData.data.boards[0].items_page.items||[]).map(function(i){return i.name.toLowerCase();}));

  for(const ch of qualified){
    if(existingNames.has(ch.name.toLowerCase()))continue;
    try{
      // Get last 10 videos for avg views
      const playRes=await fetch("https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId="+ch.uploadsId+"&maxResults=10&key="+YOUTUBE_API_KEY);
      const playData=await playRes.json();
      const videoIds=(playData.items||[]).map(function(i){return i.contentDetails&&i.contentDetails.videoId;}).filter(Boolean);
      if(!videoIds.length)continue;
      const vidRes=await fetch("https://www.googleapis.com/youtube/v3/videos?part=statistics&id="+videoIds.join(",")+"&key="+YOUTUBE_API_KEY);
      const vidData=await vidRes.json();
      const views=(vidData.items||[]).map(function(v){return parseInt(v.statistics&&v.statistics.viewCount||0);});
      const avgViews=views.length?Math.round(views.reduce(function(a,b){return a+b;},0)/views.length):0;
      if(avgViews<50000)continue;
      // Estimate upload frequency from video dates
      const pubDates=(playData.items||[]).map(function(i){return i.contentDetails&&i.contentDetails.videoPublishedAt;}).filter(Boolean);
      let freq="Unknown";
      if(pubDates.length>=2){
        const first=new Date(pubDates[pubDates.length-1]);
        const last=new Date(pubDates[0]);
        const daysBetween=(last-first)/86400000;
        const perMonth=daysBetween>0?(pubDates.length/(daysBetween/30)):0;
        if(perMonth>=8)freq="Weekly+";
        else if(perMonth>=3)freq="Weekly";
        else if(perMonth>=1)freq="Monthly";
        else freq="Infrequent";
      }
      // Save to Monday
      const emailCol=ch.email?{email:ch.email,text:ch.email}:{email:"",text:"Check YouTube"};
      const outreachStatus=ch.email?"Not Started":"Email Needed";
      const cols={link_mm3t777s:{url:"https://youtube.com/channel/"+ch.id,text:ch.name},color_mm3tx56z:{label:ch.niche},numeric_mm3tmrdz:ch.subs,numeric_mm3tr6gy:avgViews,email_mm3t61sv:emailCol,color_mm3t8xqm:{label:freq},color_mm3ta1b0:{label:"No"},color_mm3t98cn:{label:"Unknown"},date_mm3tvd56:{date:today},color_mm3tzck8:{label:outreachStatus}};
      const mutation="mutation{create_item(board_id:"+BOARD_ID+",item_name:"+JSON.stringify(ch.name.substring(0,50))+",column_values:"+JSON.stringify(JSON.stringify(cols))+"){id}}";
      await fetch("https://api.monday.com/v2",{method:"POST",headers:{"Content-Type":"application/json","Authorization":MONDAY_API_KEY},body:JSON.stringify({query:mutation})});
      saved++;
      await new Promise(function(r){setTimeout(r,150);});
    }catch(e){}
  }

  return res.json({message:"Creator scout complete",channelsDiscovered:discoveredIds.size,qualified:qualified.length,saved});
}
