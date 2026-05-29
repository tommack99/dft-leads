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

  // Debug: test first search term only
const testTerm=SEARCH_TERMS[0];
try{
  const testR=await fetch("https://www.googleapis.com/youtube/v3/search?part=snippet&q="+encodeURIComponent(testTerm)+"&type=channel&maxResults=5&relevanceLanguage=en&key="+YOUTUBE_API_KEY);
  const testD=await testR.json();
  if(testD.error)return res.json({debug:true,error:testD.error,apiKey:YOUTUBE_API_KEY?"set":"missing"});
  for(const item of(testD.items||[])){
    const id=item.id&&item.id.channelId;
    if(id&&!discoveredIds.has(id)){discoveredIds.add(id);candidates.push({id,name:item.snippet&&item.snippet.channelTitle});}
  }
  if(!candidates.length)return res.json({debug:true,message:"Search returned no channels",term:testTerm,totalResults:testD.pageInfo&&testD.pageInfo.totalResults});
}catch(e){return res.json({debug:true,catchError:e.message});}
