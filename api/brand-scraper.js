export const config={maxDuration:60};
export default async function handler(req,res){
  const YOUTUBE_API_KEY=process.env.YOUTUBE_API_KEY;
  if(!YOUTUBE_API_KEY)return res.status(500).json({error:"No API key"});
  const channelId="UCFmYk0gJrHFLCqpYVSO8vkA";
  const since=new Date(Date.now()-14*24*60*60*1000).toISOString();
  const searchRes=await fetch("https://www.googleapis.com/youtube/v3/search?part=id,snippet&channelId="+channelId+"&type=video&publishedAfter="+since+"&maxResults=10&order=date&key="+YOUTUBE_API_KEY);
  const searchData=await searchRes.json();
  if(!searchRes.ok)return res.json({step:"search failed",status:searchRes.status,error:searchData});
  const videoIds=(searchData.items||[]).map(function(i){return i.id&&i.id.videoId;}).filter(Boolean);
  if(!videoIds.length)return res.json({step:"no videos",since,total:searchData.pageInfo&&searchData.pageInfo.totalResults});
  const detailRes=await fetch("https://www.googleapis.com/youtube/v3/videos?part=snippet&id="+videoIds.join(",")+"&key="+YOUTUBE_API_KEY);
  const detailData=await detailRes.json();
  const videos=(detailData.items||[]).map(function(v){return {title:v.snippet&&v.snippet.title,desc:(v.snippet&&v.snippet.description||"").substring(0,500)};});
  return res.json({videoCount:videos.length,videos:videos});
}
