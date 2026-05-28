export const config={maxDuration:300};
export default async function handler(req,res){
  const YOUTUBE_API_KEY=process.env.YOUTUBE_API_KEY;
  if(!YOUTUBE_API_KEY)return res.status(500).json({error:"No API key"});

  // Search terms across gaming, film and adjacent verticals
  const SEARCH_TERMS=[
    // Gaming
    "gaming review channel","game walkthrough youtube","video game analysis",
    "gaming news youtube","indie game review","RPG game review",
    "FPS gaming channel","game lore explained","game breakdown youtube",
    "gaming youtuber review","esports youtube channel","game trailer reaction",
    "open world game review","horror game youtube","strategy game review",
    "retro gaming youtube","game commentary channel","gaming reaction youtube",
    "speedrun gaming youtube","game ranking youtube",
    // Film & Entertainment
    "movie review youtube channel","film analysis youtube",
    "comic book movie review","Marvel explained youtube",
    "horror movie review channel","sci-fi movie review",
    "film breakdown youtube","movie reaction channel",
    "cinema review youtube","blockbuster movie review",
    "superhero movie youtube","Star Wars youtube channel",
    "anime review youtube","movie ranking youtube",
    "TV show review youtube","streaming review channel",
    "documentary review youtube","thriller movie review",
    "action movie review youtube","film theory youtube",
    // Tech adjacent
    "tech review youtube channel","smartphone review youtube",
    "PC gaming setup youtube","computer hardware review",
    "gadget review youtube",
    // UK specific
    "UK gaming youtube channel","UK film review youtube",
    "British gaming youtuber","UK movie review channel",
    "UK tech review youtube"
  ];

  const discovered=new Map();

  for(const term of SEARCH_TERMS){
    try{
      const r=await fetch("https://www.googleapis.com/youtube/v3/search?part=snippet&q="+encodeURIComponent(term)+"&type=channel&maxResults=20&relevanceLanguage=en&key="+YOUTUBE_API_KEY);
      const d=await r.json();
      for(const item of(d.items||[])){
        const id=item.id&&item.id.channelId;
        const name=item.snippet&&item.snippet.channelTitle;
        if(id&&name&&!discovered.has(id))discovered.set(id,name);
      }
      await new Promise(function(r){setTimeout(r,200);});
    }catch(e){}
  }

  const channels=[...discovered.entries()].map(function(e){return{id:e[0],name:e[1]};});

  return res.json({
    message:"Discovery complete",
    total:channels.length,
    searchTermsUsed:SEARCH_TERMS.length,
    channels:channels
  });
}
