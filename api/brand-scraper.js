export const config={maxDuration:300};
export default async function handler(req,res){
  const YOUTUBE_API_KEY=process.env.YOUTUBE_API_KEY;
  const MONDAY_API_KEY=process.env.MONDAY_API_KEY;
  const BOARD_ID="18415192682";
  if(!YOUTUBE_API_KEY||!MONDAY_API_KEY)return res.status(500).json({error:"Missing env vars"});

  const CHANNELS=[
    // Verified core channels
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
    {id:"UCVyTR6tFcjuAAhGK7lAr-mQ",name:"CinemaBlend"},
    {id:"UCJx5KP-pCDOG0nNbXKFxsAg",name:"Kinda Funny Games"},
    {id:"UCbu2SsF-Or3Rsn3NxqODImA",name:"IGN"},
    {id:"UCNvSVsen5EPIJ4UXGiGFx9w",name:"GameSpot"},
    {id:"UCOpNcN46UbXVtpKMrmU4Abg",name:"GamesRadar"},
    {id:"UCWPqnFr5I3otMYKHKOG2q2w",name:"KiraTV"},
    {id:"UCmGSJVG3mCRXVOP4yZrU1Dw",name:"GameXplain"},
    {id:"UCdJdEguB1F1CiYe7OEi3SBg",name:"ESL Gaming"},
    {id:"UCkBR3-HnLQHeaMQBbVvDGOw",name:"MoistCr1TiKaL"},
    {id:"UCiFPBiGFBGnSGvbTtMhGolA",name:"Easy Allies"},
    {id:"UCnCoL3KI_n_wSTJzu3pCJkw",name:"Bellular News"},
    {id:"UC8aG3LDTDwNR1UQhSn9uVrw",name:"Upper Echelon Gamez"},
    {id:"UCFmYk0gJrHFLCqpYVSO8vkA",name:"Beyond The Trailer"},
    {id:"UCJx5KP-pCDOG0nNbXKFxsAg",name:"Kinda Funny"},
    {id:"UCipmh9PF_KMN3E4G4-OyxMg",name:"LegacyKillaHD"},
    {id:"UCt7sv-NKh44rHAEb-qCCRvA",name:"Joseph Anderson Core"},
    // Discovered channels
    {id:"UCK9_x1DImhU-eolIay5rb2Q",name:"ACG"},
    {id:"UCNvzD7Z-g64bPXxGzaQaa4g",name:"Gameranx 2"},
    {id:"UC2eEGT06FrWFU6VBnPOR9lg",name:"Girlfriend Reviews"},
    {id:"UCIPPMRA040LQr5QPyJEbmXA",name:"MrBeast Gaming"},
    {id:"UCEQ7KR9enYdQsB6kcMnw0NA",name:"Mortismal Gaming"},
    {id:"UCoZQiN0o7f36H7PaW4fVhFw",name:"Retro Game Corps"},
    {id:"UCyhnYIvIKK_--PiJXCMKxQQ",name:"Joseph Anderson"},
    {id:"UCZ7AeeVbyslLM_8-nVy2B8Q",name:"Skill Up 2"},
    {id:"UCpqXJOEqGS-TCnazcHCo0rA",name:"theRadBrad"},
    {id:"UC0M0rxSz3IF0CsSour1iWmw",name:"Cinemassacre"},
    {id:"UCnbvPS_rXp4PC21PG2k1UVg",name:"Gaming Historian"},
    {id:"UClOGLGPOqlAiLmOvXW5lKbw",name:"MandaloreGaming"},
    {id:"UCD6VugMZKRhSyzWEWA9W2fg",name:"SsethTzeentach"},
    {id:"UCo_IB5145EVNcf8hw1Kku7w",name:"The Game Theorists 2"},
    {id:"UCT6QFE3peNry9PdO5uGj96g",name:"Kinda Funny Games 2"},
    {id:"UCxfr3b8IuHSzu22UHnAvHWg",name:"MoistCr1TiKaL Gaming"},
    {id:"UC477Kvszl9JivqOxN1dFgPQ",name:"Iron Pineapple"},
    {id:"UCRWyPm7MrfotIYF8A8MGV3g",name:"Josh Strife Hayes"},
    {id:"UCY3A_5R_m3PXCn5XDhvBBsg",name:"Adam Millard"},
    {id:"UCPnPgDPqs4eBTTbcPI0q_FQ",name:"Insider Gaming"},
    {id:"UCSJPFQdZwrOutnmSFYtbstA",name:"The Critical Drinker"},
    {id:"UC7v3-2K1N84V67IF-WTRG-Q",name:"Jeremy Jahns 2"},
    {id:"UCY6Ij8zOds0WJEeqCLOnqOQ",name:"Alex Meyers"},
    {id:"UCCYX4s1DCn51Hpf1peHS30Q",name:"Cinema Therapy"},
    {id:"UCYUQQgogVeQY8cMQamhHJcg",name:"CinemaSins"},
    {id:"UCBs2Y3i14e1NWQxOGliatmg",name:"Mother Basement"},
    {id:"UC3ETCazlHenpXEsrEJH-k5A",name:"The Anime Man"},
    {id:"UC76ylFnNS-Tojn1I4PX1kIA",name:"Anime America"},
    {id:"UCqERpXggAprNW8QT_WO1N5Q",name:"Steve Reviews"},
    {id:"UCQxTL5uhg3jYRakna8CvJ5g",name:"Sean Chandler"},
    {id:"UCt_oFAUph4_8P3N_Xs-FGHg",name:"Scamboli Reviews"},
    {id:"UCfGmaA-nXPryTfimsnkLieQ",name:"Chibi Reviews"},
    {id:"UCRWyPm7MrfotIYF8A8MGV3g",name:"Josh Strife Hayes 2"},
  ];

  // Deduplicate by channel ID
  const seen=new Set();
  const uniqueChannels=CHANNELS.filter(function(c){if(seen.has(c.id))return false;seen.add(c.id);return true;});

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

  for(const channel of uniqueChannels){
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
      await new Promise(function(r){setTimeout(r,100);});
    }catch(e){processed++;}
  }

  const exRes=await fetch("https://api.monday.com/v2",{method:"POST",headers:{"Content-Type":"application/json","Authorization":MONDAY_API_KEY},body:JSON.stringify({query:"{boards(ids:["+BOARD_ID+"]){items_page(limit:500){items{id name}}}}"})});
  const exData=await exRes.json();
  const exMap={};
  for(const i of(exData&&exData.data&&exData.data.boards&&exData.data.boards[0]&&exData.data.boards[0].items_page&&exData.data.boards[0].items_page.items)||[])exMap[i.name.toLowerCase()]=i.id;

  // Only save brands appearing on 2+ channels
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

  return res.json({message:"Done",channelsProcessed:processed,uniqueChannels:uniqueChannels.length,brandsFound:Object.keys(brandData).length,brandsOn2PlusChannels:brands.length,saved,topBrands:brands.slice(0,20).map(function(b){return{name:b.name,channels:b.channels.size,seenOn:[...b.channels].join(", ")};})});
}
