export const config={maxDuration:300};
export default async function handler(req,res){
  const YOUTUBE_API_KEY=process.env.YOUTUBE_API_KEY;
  const MONDAY_API_KEY=process.env.MONDAY_API_KEY;
  const BOARD_ID="18415192682";
  if(!YOUTUBE_API_KEY||!MONDAY_API_KEY)return res.status(500).json({error:"Missing env vars"});

  const CHANNELS=[
    // Gaming - Tier 1
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
    {id:"UC5c-DuzPdH9iaWYdI0v0uzw",name:"Star Wars Theory"},
    {id:"UCDiFRMQWpcp8_KD4vwIVicw",name:"Emergency Awesome"},
    {id:"UCItEBhiTrNHbkTkVHLNNbAg",name:"Jeremy Jahns"},
    {id:"UCPmHkzKn-BqtCQNmqaaEMww",name:"Chris Stuckmann"},
    {id:"UC8UcOUi8Eo5TJpfYFChpxOA",name:"Gigguk"},
    {id:"UCGPItl9gZqPKPCNaltqFtxQ",name:"Looper"},
    {id:"UCFmYk0gJrHFLCqpYVSO8vkA",name:"Beyond The Trailer"},
    {id:"UCVyTR6tFcjuAAhGK7lAr-mQ",name:"CinemaBlend"},
    {id:"UCJx5KP-pCDOG0nNbXKFxsAg",name:"Kinda Funny Games"},
    {id:"UCbu2SsF-Or3Rsn3NxqODImA",name:"IGN"},
    {id:"UCNvSVsen5EPIJ4UXGiGFx9w",name:"GameSpot"},
    {id:"UCOpNcN46UbXVtpKMrmU4Abg",name:"GamesRadar"},
    {id:"UCWPqnFr5I3otMYKHKOG2q2w",name:"KiraTV"},
    {id:"UCVg9nCmmfIyP4QcGOnZZ9Qg",name:"Screen Junkies"},
    {id:"UCGaVdbSav8xWuFWTadK6loA",name:"WatchMojo UK"},
    {id:"UC4uD0_ncNh86RoNE5mMaJJA",name:"Looper Movies"},
    {id:"UCXi6_LknvHkNLDJ5fEv8XbA",name:"Wisecrack"},
    {id:"UCkFuXPHp-8WO7uZqLKTTsMw",name:"Like Stories of Old"},
    {id:"UCzWQYUVCpZqtN93H8RR44Qw",name:"Folding Ideas"},
    {id:"UCi8e0iOVk1fEOogdfu4YgfA",name:"Now You See It"},
    {id:"UCTLkMQAiJ9AqUMwXKBtJlyA",name:"Just Write"},
    {id:"UCmGSJVG3mCRXVOP4yZrU1Dw",name:"GameXplain"},
    {id:"UCddiUEpeqJcYeBxX1IVBKvQ",name:"The Game Theorists 2"},
    {id:"UC4w1YQAJMWOz4qtxinq55LQ",name:"Easy Allies"},
    {id:"UCt7sv-NKh44rHAEb-qCCRvA",name:"Joseph Anderson"},
    {id:"UCnCoL3KI_n_wSTJzu3pCJkw",name:"Bellular News"},
    {id:"UC8aG3LDTDwNR1UQhSn9uVrw",name:"Upper Echelon Gamez"},
    {id:"UCdJdEguB1F1CiYe7OEi3SBg",name:"ESL Gaming"},
    {id:"UCkBR3-HnLQHeaMQBbVvDGOw",name:"MoistCr1TiKaL"},
    {id:"UCiFPBiGFBGnSGvbTtMhGolA",name:"Easy Allies 2"},
    {id:"UCPmHkzKn-BqtCQNmqaaEMww",name:"Chris Stuckmann 2"},
    {id:"UCipmh9PF_KMN3E4G4-OyxMg",name:"LegacyKillaHD"},
  ];

  const NOISE=["YouTube","Google","Twitter","Instagram","Discord","Twitch","Reddit","Amazon","Apple","Microsoft","Steam","PlayStation","Xbox","Nintendo","Patreon","Spotify","Netflix","Subscribe","Channel","Video","Watch","Click","Link","Below","Description","Comment","Like","Share","Merch","Support","Music","Join","Members","Podcast","If You","We Are","This Video","The Channel","Our Channel","New Video","Check Out","Find Us","Follow Us","Facebook","TikTok","Linkedin"];

  function extractSponsors(desc,channelName){
    if(!desc)return[];
    const sponsors=new Set();
    const channelDomain=channelName.toLowerCase().replace(/\s+/g,"");
    const noiseLower=NOISE.map(function(n){return n.toLowerCase();});
    const urlPattern=/(?:visit|go to|check out|head to|at|download|try|sign up(?:\s+at)?|use)\s+(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9][a-zA-Z0-9-]+)\.[a-z]{2,}/gi;
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
    const chanRes=await fetch("https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id="+channelId+"&key="+YOUTUBE_API_KEY);
    const chanData=await chanRes.json();
    if(!chanData.items||!chanData.items.length)return[];
    const uploadsId=chanData.items[0].contentDetails.relatedPlaylists.uploads;
    const playRes=await fetch("https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId="+uploadsId+"&maxResults=5&key="+YOUTUBE_API_KEY);
    const playData=await playRes.json();
    return(playData.items||[]).map(function(i){return i.contentDetails&&i.contentDetails.videoId;}).filter(Boolean);
  }

  async function getVideoDetails(ids){
    if(!ids.length)return[];
    const r=await fetch("https://www.googleapis.com/youtube/v3/videos?part=snippet&id="+ids.join(",")+"&key="+YOUTUBE_API_KEY);
    return((await r.json()).items||[]);
  }

  const brandData={};
  const today=new Date().toISOString().split("T")[0];
  let processed=0;

  for(const channel of CHANNELS){
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
      await new Promise(function(r){setTimeout(r,150);});
    }catch(e){processed++;}
  }

  const exRes=await fetch("https://api.monday.com/v2",{method:"POST",headers:{"Content-Type":"application/json","Authorization":MONDAY_API_KEY},body:JSON.stringify({query:"{boards(ids:["+BOARD_ID+"]){items_page(limit:500){items{id name}}}}"})});
  const exData=await exRes.json();
  const exMap={};
  for(const i of(exData&&exData.data&&exData.data.boards&&exData.data.boards[0]&&exData.data.boards[0].items_page&&exData.data.boards[0].items_page.items)||[])exMap[i.name.toLowerCase()]=i.id;

  const brands=Object.values(brandData).sort(function(a,b){return b.channels.size-a.channels.size;});
  let saved=0;
  for(const data of brands){
    const budgetTier=data.channels.size>=10?"Very High":data.channels.size>=5?"High":data.channels.size>=3?"Medium":"Low";
    const cols={text_mm3shz66:data.name,numeric_mm3swzsf:data.channels.size,numeric_mm3szew3:data.weekCount,date_mm3sx6hp:{date:data.lastSeen},text_mm3ss133:[...data.channels].slice(0,5).join(", "),text_mm3shf6v:"Gaming/Film"};
    const itemName=data.name.substring(0,50);
    const eid=exMap[data.name.toLowerCase()];
    try{
      if(eid){await fetch("https://api.monday.com/v2",{method:"POST",headers:{"Content-Type":"application/json","Authorization":MONDAY_API_KEY},body:JSON.stringify({query:"mutation{change_multiple_column_values(board_id:"+BOARD_ID+",item_id:"+eid+",column_values:"+JSON.stringify(JSON.stringify(cols))+"){id}}"})}); }
      else{await fetch("https://api.monday.com/v2",{method:"POST",headers:{"Content-Type":"application/json","Authorization":MONDAY_API_KEY},body:JSON.stringify({query:"mutation{create_item(board_id:"+BOARD_ID+",item_name:"+JSON.stringify(itemName)+",column_values:"+JSON.stringify(JSON.stringify(cols))+"){id}}"})}); }
      saved++;
    }catch(e){}
  }

  return res.json({message:"Done",processed,brandsFound:brands.length,saved,topBrands:brands.slice(0,20).map(function(b){return{name:b.name,channels:b.channels.size,seenOn:[...b.channels].join(", ")};})});
}
