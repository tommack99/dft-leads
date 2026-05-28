export const config={maxDuration:120};
export default async function handler(req,res){
  const YOUTUBE_API_KEY=process.env.YOUTUBE_API_KEY;
  const MONDAY_API_KEY=process.env.MONDAY_API_KEY;
  const BOARD_ID="18415192682";
  if(!YOUTUBE_API_KEY||!MONDAY_API_KEY)return res.status(500).json({error:"Missing env vars"});

  const CHANNELS=[
    {id:"UCq3hT5JPPKy87JGbDls_5BQ",name:"Heavy Spoilers"},
    {id:"UCXuqSBlHAE6Xw-yeJA0Tunw",name:"Linus Tech Tips"},
    {id:"UCBcRF18a7Qf58cCRy5xuWwQ",name:"Marques Brownlee"},
    {id:"UCXa_bzvv7Oo1glaW9FldDhQ",name:"Gameranx"},
    {id:"UCg40OxZ1GYh3u3jBntB6DLg",name:"Skill Up"},
    {id:"UCq6VFHwMzcMXbuKyG7SQYIg",name:"penguinz0"},
    {id:"UCgMJGv4cKl-jeWuQ9EquLMQ",name:"Screen Rant"},
    {id:"UCaWd5_7JhbQBe4dknZhsHJg",name:"WatchMojo"},
    {id:"UCuWZNzb-6-NLKH6DYi3SJ7Q",name:"New Rockstars"},
    {id:"UCYzPXprvl5Y-Sf0g4vX-m6g",name:"jacksepticeye"}
  ];

  const SPONSOR_PATTERNS=[
    /(?:this video is (?:sponsored|paid for) by|sponsored by|brought to you by|thanks? to|in partnership with|partner(?:ed)? with)s+([A-Z][A-Za-z0-9\s&\.]+?)(?:\.|,|!|\n|\.|for |to |who |they )/gi,
    /(?:use code|promo code|discount code|coupon code)s+\w+\s+(?:at|for|on|to get)\s+([A-Z][A-Za-z0-9\s&\.]+?)(?:\.|,|!|\n)/gi,
    /(?:check out|visit|head to|go to)\s+([A-Z][A-Za-z0-9\s&\.]+?)(?:\.com|\.io|\.co|\.app|\s+at|\s+for|\s+to)/gi,
    /#[Ss]ponsored\s+([A-Z][A-Za-z0-9\s&\.]+?)(?:\.|,|!|\n)/g,
    /today.s (?:sponsor|video sponsor|episode sponsor)[^A-Z]{0,20}([A-Z][A-Za-z0-9\s&\.]+?)(?:\.|,|!|\n)/gi,
  ];
  const NOISE=["YouTube","Google","Twitter","Instagram","Discord","Twitch","Reddit","Amazon","Apple","Microsoft","Steam","PlayStation","Xbox","Nintendo","Patreon","Spotify","Netflix","Subscribe","Channel","Video","Watch","Click","Link","Below","Description","Comment","Like","Share","Merch","Support","Music","Join","Members","Podcast","If You","We Are","This Video","The Channel","Our Channel","New Video"];

  function extractSponsors(desc){
    if(!desc)return[];
    const sponsors=new Set();
    const NOISE_LOWER=NOISE.map(n=>n.toLowerCase());
    const channelDomains=CHANNELS.map(function(c){return c.name.toLowerCase().replace(/\s+/g,"");});
    // Method 1: Extract brand from sponsor URLs e.g. visit Zocdoc.com/channel or go to nordvpn.com
    const urlPattern=/(?:visit|go to|check out|head to|at|download|try|sign up(?:\s+at)?|use)\s+(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9][a-zA-Z0-9-]+)\.[a-z]{2,}/gi;
    for(const m of [...desc.matchAll(urlPattern)]){
      const brand=m[1].charAt(0).toUpperCase()+m[1].slice(1);
      if(brand.length>2&&brand.length<30&&!NOISE_LOWER.includes(brand.toLowerCase()))sponsors.add(brand);
    }
    // Method 2: "sponsored by X" patterns - look for capitalised brand after keyword
    const byPattern=/(?:sponsored by|brought to you by|partner(?:ed)? with|in partnership with|thanks? to)\s+([A-Z][a-zA-Z0-9]+(?:\s[A-Z][a-zA-Z0-9]+)?)/g;
    for(const m of [...desc.matchAll(byPattern)]){
      const brand=m[1].trim();
      if(brand.length>2&&brand.length<30&&!NOISE_LOWER.includes(brand.toLowerCase()))sponsors.add(brand);
    }
    // Method 3: "use code X at Brand" or "use code X for Brand"
    const codePattern=/(?:use code|promo code|discount code)\s+\w+\s+(?:at|for|on)\s+([A-Z][a-zA-Z0-9]+)/gi;
    for(const m of [...desc.matchAll(codePattern)]){
      const brand=m[1].trim();
      if(brand.length>2&&brand.length<30&&!NOISE_LOWER.includes(brand.toLowerCase()))sponsors.add(brand);
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
        for(const s of extractSponsors(v.snippet&&v.snippet.description||"")){
          const k=s.toLowerCase().replace(/\s+/g,"");
          if(!brandData[k])brandData[k]={name:s,channels:new Set(),lastSeen:today,weekCount:0};
          brandData[k].channels.add(channel.name);
          brandData[k].weekCount++;
          brandData[k].lastSeen=today;
        }
      }
      processed++;
      await new Promise(function(r){setTimeout(r,200);});
    }catch(e){processed++;}
  }

  const exRes=await fetch("https://api.monday.com/v2",{method:"POST",headers:{"Content-Type":"application/json","Authorization":MONDAY_API_KEY},body:JSON.stringify({query:"{boards(ids:["+BOARD_ID+"]){items_page(limit:500){items{id name}}}}"})});
  const exData=await exRes.json();
  const exMap={};
  for(const i of(exData&&exData.data&&exData.data.boards&&exData.data.boards[0]&&exData.data.boards[0].items_page&&exData.data.boards[0].items_page.items)||[])exMap[i.name.toLowerCase()]=i.id;

  const brands=Object.values(brandData).sort(function(a,b){return b.channels.size-a.channels.size;});
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

  return res.json({message:"Done",processed,brandsFound:brands.length,saved,topBrands:brands.slice(0,15).map(function(b){return{name:b.name,channels:b.channels.size,seenOn:[...b.channels].join(", ")};})});
}
