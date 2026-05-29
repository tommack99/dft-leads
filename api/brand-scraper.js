export const config={maxDuration:300};
export default async function handler(req,res){
  const YOUTUBE_API_KEY=process.env.YOUTUBE_API_KEY;
  const MONDAY_API_KEY=process.env.MONDAY_API_KEY;
  const BOARD_ID="18415192682";
  if(!YOUTUBE_API_KEY||!MONDAY_API_KEY)return res.status(500).json({error:"Missing env vars"});

  const CHANNELS=[
    // Gaming Tier 1 - Major channels
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
    {id:"UCJx5KP-pCDOG0nNbXKFxsAg",name:"Kinda Funny Games"},
    {id:"UCbu2SsF-Or3Rsn3NxqODImA",name:"IGN"},
    {id:"UCNvSVsen5EPIJ4UXGiGFx9w",name:"GameSpot"},
    {id:"UCOpNcN46UbXVtpKMrmU4Abg",name:"GamesRadar"},
    {id:"UCmGSJVG3mCRXVOP4yZrU1Dw",name:"GameXplain"},
    {id:"UCdJdEguB1F1CiYe7OEi3SBg",name:"ESL Gaming"},
    {id:"UCkBR3-HnLQHeaMQBbVvDGOw",name:"MoistCr1TiKaL"},
    {id:"UCiFPBiGFBGnSGvbTtMhGolA",name:"Easy Allies"},
    {id:"UCnCoL3KI_n_wSTJzu3pCJkw",name:"Bellular News"},
    {id:"UC8aG3LDTDwNR1UQhSn9uVrw",name:"Upper Echelon Gamez"},
    {id:"UCFmYk0gJrHFLCqpYVSO8vkA",name:"Beyond The Trailer"},
    {id:"UCipmh9PF_KMN3E4G4-OyxMg",name:"LegacyKillaHD"},
    // Gaming Tier 2 - Discovered
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
    {id:"UC8A3Zig-dNx2kZmy1FovTEA",name:"Video Game Animation Study"},
    {id:"UCZMF14eNxvuReRTceX_mbqQ",name:"The Game Overanalyser"},
    {id:"UCVdDUN69YsAXPxh2y71sMtQ",name:"I Finished A Video Game"},
    {id:"UCjKSoJlPgcK6BmoSqXpj5xQ",name:"Action Button"},
    {id:"UCeZLO2VgbZHeDcongKzzfOw",name:"8-bit Music Theory"},
    {id:"UCDC7X5gNh2LxQ2PnN_OKD5g",name:"NeoGamer"},
    {id:"UCJfJWct8jN1RpCuVWk3zHTA",name:"Daryl Talks Games"},
    {id:"UCRW9giz4WKZSVssQWdd5pLg",name:"Video Game Analysis"},
    {id:"UCBRdH7MGiy3EmNG1GndsdIg",name:"Avalanche Reviews"},
    {id:"UCt_oFAUph4_8P3N_Xs-FGHg",name:"Scamboli Reviews"},
    {id:"UCfGmaA-nXPryTfimsnkLieQ",name:"Chibi Reviews"},
    {id:"UC4jtzyM5YeRq_A2dbezV9Iw",name:"Jay RPG"},
    {id:"UCAYF6ZY9gWBR1GW3R7PX7yw",name:"Majuular"},
    {id:"UCFOlioIjE_FnKOrd9Ac-Iww",name:"Rye Games"},
    {id:"UCMQMUN6tk9STkYHNrdhNouw",name:"The RPG Fanatic"},
    {id:"UCs8lYkna2S6DkcHO9o2008A",name:"Roanoke Gaming"},
    {id:"UCSCoziKHqjqbox3Fv3Pb4BA",name:"theScore esports"},
    {id:"UCT6QFE3peNry9PdO5uGj96g",name:"Kinda Funny"},
    {id:"UCKiDtCzQu_NY7sw5sQm-0ZA",name:"Hot Pepper Gaming"},
    {id:"UCddiUEpeqJcYeBxX1IVBKvQ",name:"The Game Theorists 2"},
    {id:"UC4w1YQAJMWOz4qtxinq55LQ",name:"Easy Allies 2"},
    {id:"UCt7sv-NKh44rHAEb-qCCRvA",name:"Joseph Anderson 2"},
    {id:"UCnCoL3KI_n_wSTJzu3pCJkw",name:"Bellular Gaming"},
    {id:"UC8gA9gNwQyx7T3pJUap28Ww",name:"Skill Up 2"},
    {id:"UCWPqnFr5I3otMYKHKOG2q2w",name:"KiraTV"},
    {id:"UCVg9nCmmfIyP4QcGOnZZ9Qg",name:"Screen Junkies"},
    // Film & Entertainment
    {id:"UCSJPFQdZwrOutnmSFYtbstA",name:"The Critical Drinker"},
    {id:"UC7v3-2K1N84V67IF-WTRG-Q",name:"Jeremy Jahns Film"},
    {id:"UCY6Ij8zOds0WJEeqCLOnqOQ",name:"Alex Meyers"},
    {id:"UCCYX4s1DCn51Hpf1peHS30Q",name:"Cinema Therapy"},
    {id:"UCYUQQgogVeQY8cMQamhHJcg",name:"CinemaSins"},
    {id:"UCBs2Y3i14e1NWQxOGliatmg",name:"Mother Basement"},
    {id:"UC3ETCazlHenpXEsrEJH-k5A",name:"The Anime Man"},
    {id:"UC76ylFnNS-Tojn1I4PX1kIA",name:"Anime America"},
    {id:"UCqERpXggAprNW8QT_WO1N5Q",name:"Steve Reviews"},
    {id:"UCq_LLiCjmHyAuk0SnKfjWlw",name:"Matt Movie Reviews"},
    {id:"UCQxTL5uhg3jYRakna8CvJ5g",name:"Sean Chandler"},
    {id:"UCbiOAho0h23IMInURiESx1w",name:"Dan Murrell"},
    {id:"UCCCqEeDAUf4Mg0GgEN658tkA",name:"Chris Stuckmann Film"},
    {id:"UCCyCYLy5nJvNfz4eiD2gn-g",name:"Cinema Prism"},
    {id:"UCIWu-Sm1ywDVjqyHvku6peg",name:"Primms Hood Cinema"},
    {id:"UCzRJ32scbEWL81e-eEIOh7Q",name:"Film Breakdown"},
    {id:"UCqjtc7Be4e8DCsTLPi46IKg",name:"Cinema Review"},
    {id:"UCEMECcqKDyCvPGllKz_8Yug",name:"Breakdowns And Blockbusters"},
    {id:"UCuIRv8rLfdagGkcyEJcMi6A",name:"Blockbuster Reviews"},
    {id:"UCXi6_LknvHkNLDJ5fEv8XbA",name:"Wisecrack"},
    {id:"UCkFuXPHp-8WO7uZqLKTTsMw",name:"Like Stories Of Old"},
    {id:"UCzwQYUVCpZqtN93H8RR44Qw",name:"Folding Ideas"},
    {id:"UCi8e0iOVk1fEOogdfu4YgfA",name:"Now You See It"},
    {id:"UCTLkMQAiJ9AqUMwXKBtJlyA",name:"Just Write"},
    {id:"UCGaVdbSav8xWuFWTadK6loA",name:"WatchMojo 2"},
    {id:"UCGa9ISNr45w6MSjsHDcmZ_w",name:"Screen Culture"},
    {id:"UCHZWtFQKVe2ddZ1xlTU3H9A",name:"Blockbuster Recaps"},
    {id:"UCuqwxcPPPAYf6BAPiu5KIxg",name:"Blockbuster Reviews 2"},
    {id:"UCVyTR6tFcjuAAhGK7lAr-mQ",name:"CinemaBlend"},
    {id:"UCGPItl9gZqPKPCNaltqFtxQ",name:"Looper 2"},
    {id:"UCPPIdMSH_ZYDAc438VKFjIQ",name:"Movie Review"},
    {id:"UCqRFRxmLQmdrdn-57MPmsTg",name:"Deep Dive Movie Reviews"},
    {id:"UCzBKlb5X36fLD4m9SSCL1w",name:"THE RANKING GAME"},
    {id:"UC51tRQjet4Z45Of3n1Qxn8A",name:"Brandon Tenold"},
    {id:"UCtsFXBPj9u89bGwWAZaq2qQ",name:"Scifi Movie News"},
    {id:"UCY79tJIy3UTRwLiG69wkpCA",name:"The Intergalactic Review"},
    {id:"UCYv6jDF7-FN855IkrNBIaaw",name:"Science Fiction Journey"},
    {id:"UCresRFKW5d1r_GiShCE3SUA",name:"Sinister Cinema Reviews"},
    {id:"UCRvTQgaKQ4AKsxKf0rZUtuQ",name:"Movie Matters"},
    // Tech & Gaming Adjacent
    {id:"UCXuqSBlHAE6Xw-yeJA0Tunw",name:"Linus Tech Tips 2"},
    {id:"UCVog_ork5bFbMDHmTorHdyg",name:"MKBHD Clips"},
    {id:"UCGhs9S33RAeT5DEuKTO4Oew",name:"Force Gaming"},
    {id:"UCPnPgDPqs4eBTTbcPI0q_FQ",name:"Insider Gaming 2"},
    {id:"UCrA0lLFM3CTixXFQWF-TzcA",name:"Definitely Not Definitive"},
    {id:"UCtRDjvmnxgv6nNL6h696UYg",name:"Dwayne N Jazz"},
    {id:"UCHdTVw89QU6coU1MgN-9RHA",name:"GorTheMovieGod"},
    {id:"UCwOj_g5BJXjrcqKszOZAAYA",name:"Late to the Party"},
    {id:"UCiCUz1bHid4H9mu6g2IOjXg",name:"The Media Knights"},
    {id:"UCrx7A9aUmICiTATyfwfJjNg",name:"IPOND TV"},
    {id:"UCgLOBo3BpsarmqaU6akq7wg",name:"The Cyber Nerds Gaming"},
    {id:"UCnvJVzZFFEjX9fNZFXzQbfw",name:"Blind Wave Gaming"},
    {id:"UCQ29hMgpbMgjsfl-iPmzoGw",name:"Marco Reaction Trailers"},
    {id:"UCvInsdoSCTRGQNuXe7kMjhQ",name:"Gamers React"},
    {id:"UCstAuPR0Ynr_Z9G0XJXSFiA",name:"Sci-fi Recapped"},
    {id:"UCaQzrAsUEoNurVzlvarVKNg",name:"AI Movie Review"},
    {id:"UCiS47Sjt3-OE8XFU7oXi2ow",name:"Gaming Reactions"},
    {id:"UCJHLxUvrocItbDjMsCGTJkQ",name:"Ranking Game"},
    {id:"UCn_DyklXWRK2Wpzj6PYBgIg",name:"The Ranking Game"},
    {id:"UC-dLeW6Ogi7UaWBpyxBOORg",name:"Gaming Ranked"},
    // DFT Creator channels
    {id:"UCuWZNzb-6-NLKH6DYi3SJ7Q",name:"New Rockstars 2"},
    {id:"UCdKuPY64fEpI4cdlBSyvEJw",name:"Rocket League Esports"},
    {id:"UCgc9r12bKja3XTBd27YU1Cw",name:"Being Esports"},
    {id:"UCHXa_bzvv7Oo1glaW9FldDhQ",name:"Gameranx 2"},
  ];

  const seen=new Set();
  const CHANNELS_DEDUPED=CHANNELS.filter(function(c){if(seen.has(c.id))return false;seen.add(c.id);return true;});

  const NOISE=["YouTube","Google","Twitter","Instagram","Discord","Twitch","Reddit","Amazon","Apple","Microsoft","Steam","PlayStation","Xbox","Nintendo","Patreon","Spotify","Netflix","Subscribe","Channel","Video","Watch","Click","Link","Below","Description","Comment","Like","Share","Merch","Support","Music","Join","Members","Podcast","Facebook","TikTok","Linkedin","Check Out","Find Us","Follow Us"];

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

  for(const channel of CHANNELS_DEDUPED){
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

  // Only save brands on 2+ channels
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

  return res.json({message:"Done",channelsProcessed:processed,totalChannels:CHANNELS_DEDUPED.length,brandsFound:Object.keys(brandData).length,brandsOn2Plus:brands.length,saved,topBrands:brands.slice(0,20).map(function(b){return{name:b.name,channels:b.channels.size,seenOn:[...b.channels].join(", ")};})});
}
