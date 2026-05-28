export const config={maxDuration:60};
export default async function handler(req,res){
  const YOUTUBE_API_KEY=process.env.YOUTUBE_API_KEY;
  if(!YOUTUBE_API_KEY)return res.status(500).json({error:"No API key"});
  const channelId="UCFmYk0gJrHFLCqpYVSO8vkA";
  const chanRes=await fetch("https://www.googleapis.com/youtube/v3/channels?part=contentDetails,snippet&id="+channelId+"&key="+YOUTUBE_API_KEY);
  const chanData=await chanRes.json();
  if(!chanRes.ok||!chanData.items||!chanData.items.length)return res.json({step:"channel failed",data:chanData});
  const title=chanData.items[0].snippet.title;
  const uploadsId=chanData.items[0].contentDetails.relatedPlaylists.uploads;
  const playRes=await fetch("https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails,snippet&playlistId="+uploadsId+"&maxResults=10&key="+YOUTUBE_API_KEY);
  const playData=await playRes.json();
  if(!playRes.ok)return res.json({step:"playlist failed",data:playData});
  const videoIds=(playData.items||[]).map(function(i){return i.contentDetails&&i.contentDetails.videoId;}).filter(Boolean);
  if(!videoIds.length)return res.json({step:"no videos",title,uploadsId});
  const detailRes=await fetch("https://www.googleapis.com/youtube/v3/videos?part=snippet&id="+videoIds.join(",")+"&key="+YOUTUBE_API_KEY);
  const detailData=await detailRes.json();
  const videos=(detailData.items||[]).map(function(v){return{title:v.snippet.title,published:v.snippet.publishedAt,desc:(v.snippet.description||"").substring(0,600)};});
  return res.json({channel:title,videoCount:videos.length,videos:videos});
}
