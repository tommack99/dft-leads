export const config={maxDuration:300};
export default async function handler(req,res){
  const YOUTUBE_API_KEY=process.env.YOUTUBE_API_KEY;
  const MONDAY_API_KEY=process.env.MONDAY_API_KEY;
  const BOARD_ID="18415192682";
  if(!YOUTUBE_API_KEY||!MONDAY_API_KEY)return res.status(500).json({error:"Missing env vars"});

  // Step 1: Discover channels dynamically via YouTube search
  const SEARCH_TERMS=[
    "gaming review channel","game analysis youtube","gaming news channel",
    "film review youtube","movie breakdown channel","comic book movie review",
    "tech review gaming","game walkthrough commentary","esports highlights channel",
    "anime review youtube","horror movie review","sci fi movie review",
    "indie game review channel","RPG game review","game lore explained",
    "film theory youtube","movie reaction channel","gaming commentary",
    "retro gaming channel","game critique youtube","streaming review channel",
    "superhero movie youtube","Star Wars review channel","gaming podcast youtube",
    "board game review youtube","tabletop gaming channel","game speedrun channel",
    "fighting game youtube","strategy game review","open world game review",
    "UK gaming youtube","UK film review youtube","British gaming youtuber",
    "Australian gaming youtube","Canadian game review","gaming couple youtube",
    "film analysis essay youtube","video essay gaming","documentary gaming youtube",
    "game soundtrack review","game photography youtube","game art youtube",
    "game history youtube","gaming culture youtube","game journalism youtube",
    "movie podcast youtube","film podcast review","cinema analysis youtube",
    "video game music youtube","gaming highlight reel","game clip channel",
  ];

  const discoveredChannels=new Map();

  // Add our verified seed channels first
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
    {id:"UCDiFRMQWpcp8_KD4vwIVicw",name:"Emergency Awesome 2"},
  ];
  for(const c of SEED_CHANNELS)discoveredChannels.set(c.id,c.name);

  // Step 2: Search YouTube for more channels (uses quota but runs weekly)
  // Limit to 20 search terms to conserve quota (100 units each = 2000 units)
  const searchTermsToRun=SEARCH_TERMS.slice(0,20);
  for(const term of searchTermsToRun){
    try{
      const r=await fetch("https://www.googleapis.com/youtube/v3/search?part=snippet&q="+encodeURIComponent(term)+"&type=channel&maxResults=15&relevanceLanguage=en&key="+YOUTUBE_API_KEY);
      const d=await r.json();
      for(const item of(d.items||[])){
        const id=item.id&&item.id.channelId;
        const name=item.snippet&&item.snippet.channelTitle;
        if(id&&name&&!discoveredChannels.has(id))discoveredChannels.set(id,name);
      }
      await new Promise(function(r){setTimeout(r,200);});
    }catch(e){}
  }

  const CHANNELS=[...discoveredChannels.entries()].map(function(e){return{id:e[0],name:e[1]};});

  // Filter out obvious noise
  const SKIP=["ugc","india","hindi","tamil","telugu","roblox","minecraft kids","fortnite kids","gaming review ","film breakdown ","fps gaming","fps channel","fps game","movie review channel","review channel"];
  const filtered=CHANNELS.filter(function(c){
    const n=c.name.toLowerCase();
    return !SKIP.some(function(s){return n.includes(s);}) && c.name.length>2 && c.name.length<50;
  });

  const NOISE=["YouTube","Google","Twitter","Instagram","Discord","Twitch","Reddit","Amazon","Apple","Microsoft","Steam","PlayStation","Xbox","Nintendo","Patreon","Spotify","Netflix","Subscribe","Channel","Video","Watch","Click","Link","Below","Description","Comment","Like","Share","Merch","Support","Music","Join","Members","Podcast","Facebook","TikTok","Linkedin"];

  function extractSponsors(desc,channelName){
    if(!desc)return[];
    const sponsors=new Set();
    const channelDomain=channelName.toLowerCase().replace(/\s+/g,"");
    const noiseLower=NOISE.map(function(n){return n.toLowerCase();});
    const urlPattern=/(?:visit|go to|check out|head to|download|try|sign up(?:\s+at)?|use)\s+(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9][a-zA-Z0-9-]+)\.[a-z]{2,}/gi;
    for(const m of [...desc.matchAll(urlPattern)]){
      const brand=m[1].charAt(0).toUpperCase()+m[1].slice(1);
      if(brand.length>3&&brand.length<30&&!noiseLower.includes(brand.toLowerCase())&&brand.toLowerCase()!==channelDomain)sponsors.add(brand);
    }
    const byPattern=/(?:sponsored by|brought to you by|partner(?:ed)? with|in partnership with|thanks? to)\s+([A-Z][a-zA-Z0-9]+(?:\s[A-Z][a-zA-Z0-9]+)?)/g;
    for(const m of [...desc.matchAll(byPattern)]){
      const brand=m[1].trim();
      if(brand.length>3&&brand.length<30&&!noiseLower.includes(brand.toLowerCase())&&brand.toLowerCase()!==channelDomain)sponsors.add(brand);
    }
    const codePattern=/(?:use code|promo code|discount code)\s+\w+\s+(?:at|for|on)\s+([A-Z][a-zA-Z0-9]+)/gi;
    for(const m of [...desc.matchAll(codePattern)]){
      const brand=m[1].trim();
      if(brand.length>3&&brand.length<30&&!noiseLower.includes(brand.toLowerCase())&&brand.toLowerCase()!==channelDomain)sponsors.add(brand);
    }
    return[...sponsors];
  }

  async function getChannelVideos(channelId){
    try{
      const chanRes=await fetch("https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id="+channelId+"&key="+YOUTUBE_API_KEY);
      const chanData=await chanRes.json();
      if(!chanData.items||!chanData.items.length)return[];
      const uploadsId=chanData.items[0].contentDetails.relatedPlaylists.uploads;
      const playRes=await fetch("https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId="+uploadsId+"&maxResults=5&key="+YOUTUBE_API_KEY);
      const playData=await playRes.json();
      return(playData.items||[]).map(function(i){return i.contentDetails&&i.contentDetails.videoId;}).filter(Boolean);
    }catch(e){return[];}
  }

  async function getVideoDetails(ids){
    if(!ids.length)return[];
    try{
      const r=await fetch("https://www.googleapis.com/youtube/v3/videos?part=snippet&id="+ids.join(",")+"&key="+YOUTUBE_API_KEY);
      return((await r.json()).items||[]);
    }catch(e){return[];}
  }

  const brandData={};
  const today=new Date().toISOString().split("T")[0];
  let processed=0;

  // Process channels in batches to avoid timeout
  const MAX_CHANNELS=300;
  const channelsToProcess=filtered.slice(0,MAX_CHANNELS);

  for(const channel of channelsToProcess){
    try{
      const vids=await getChannelVideos(channel.id);
      const videos=await getVideoDetails(vids);
      for(const v of videos){
        for(const s of extractSponsors(v.snippet&&v.snippet.description||"",channel.name)){
          const k=s.toLowerCase().replace(/\s+/g,"");
          if(!brandData[k])brandData[k]={name:s,channels:new Set(),lastSeen:today,weekCount:0};
          brandData[k].channels.add(channel.name);
          brandData[k].weekCount++;
          brandData[k].lastSeen=today;
        }
      }
      processed++;
      await new Promise(function(r){setTimeout(r,80);});
    }catch(e){processed++;}
  }

  const exRes=await fetch("https://api.monday.com/v2",{method:"POST",headers:{"Content-Type":"application/json","Authorization":MONDAY_API_KEY},body:JSON.stringify({query:"{boards(ids:["+BOARD_ID+"]){items_page(limit:500){items{id name}}}}"})});
  const exData=await exRes.json();
  const exMap={};
  for(const i of(exData&&exData.data&&exData.data.boards&&exData.data.boards[0]&&exData.data.boards[0].items_page&&exData.data.boards[0].items_page.items)||[])exMap[i.name.toLowerCase()]=i.id;

  // Only save brands on 2+ channels - filters out all noise
  const brands=Object.values(brandData).filter(function(d){return d.channels.size>=2;}).sort(function(a,b){return b.channels.size-a.channels.size;});
  let saved=0;
  for(const data of brands){
    const cols={text_mm3shz66:data.name,numeric_mm3swzsf:data.channels.size,numeric_mm3szew3:data.weekCount,date_mm3sx6hp:{date:data.lastSeen},text_mm3ss133:[...data.channels].slice(0,5).join(", "),text_mm3shf6v:"Gaming/Film"};
    const itemName=data.name.substring(0,50);
    const eid=exMap[data.name.toLowerCase()];
    try{
      if(eid){await fetch("https://api.monday.com/v2",{method:"POST",headers:{"Content-Type":"application/json","Authorization":MONDAY_API_KEY},body:JSON.stringify({query:"mutation{change_multiple_column_values(board_id:"+BOARD_ID+",item_id:"+eid+",column_values:"+JSON.stringify(JSON.stringify(cols))+"){id}}"})}); }
      else{await fetch("https://api.monday.com/v2",{method:"POST",headers:{"Content-Type":"application/json","Authorization":MONDAY_API_KEY},body:JSON.stringify({query:"mutation{create_item(board_id:"+BOARD_ID+",item_name:"+JSON.stringify(itemName)+",column_values:"+JSON.stringify(JSON.stringify(cols))+"){id}}"})}); }
      saved++;
    }catch(e){}
  }

  return res.json({message:"Done",channelsDiscovered:discoveredChannels.size,channelsFiltered:filtered.length,channelsProcessed:processed,brandsFound:Object.keys(brandData).length,brandsOn2Plus:brands.length,saved,topBrands:brands.slice(0,20).map(function(b){return{name:b.name,channels:b.channels.size,seenOn:[...b.channels].join(", ")};})});
}
