export const config={maxDuration:60};
export default async function handler(req,res){
  res.setHeader("Access-Control-Allow-Origin","*");
  if(req.method==="OPTIONS")return res.status(200).end();
  if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
  const MONDAY_API_KEY=process.env.MONDAY_API_KEY;
  const APIFY_TOKEN=process.env.APIFY_TOKEN;
  const BOARD_ID="18412906853";
  const body=req.body;
  const datasetId=body.resource&&body.resource.defaultDatasetId;
  if(!datasetId)return res.status(400).json({error:"No datasetId"});
  if(!APIFY_TOKEN)return res.status(500).json({error:"APIFY_TOKEN not set"});
  if(!MONDAY_API_KEY)return res.status(500).json({error:"MONDAY_API_KEY not set"});
  const dataRes=await fetch("https://api.apify.com/v2/datasets/"+datasetId+"/items?token="+APIFY_TOKEN+"&format=json");
  if(!dataRes.ok)return res.status(500).json({error:"Failed to fetch dataset"});
  const posts=await dataRes.json();
  if(!posts||!posts.length)return res.status(200).json({message:"No posts"});
  const existingRes=await fetch("https://api.monday.com/v2",{method:"POST",headers:{"Content-Type":"application/json","Authorization":MONDAY_API_KEY},body:JSON.stringify({query:"{boards(ids:["+BOARD_ID+"]){items_page(limit:1000){items{column_values(ids:[\"link_mm39r70s\"]){value}}}}}"})});
  const existingData=await existingRes.json();
  const existingUrls=new Set();
  const existingItems=existingData?.data?.boards?.[0]?.items_page?.items||[];
  for(const item of existingItems){const val=item.column_values?.[0]?.value;if(val){try{existingUrls.add(JSON.parse(val).url);}catch(e){}}}
  function isBroadlyRelevant(text){
if(!text)return false;
const t=text.toLowerCase();
const jobPostings=["#imhiring","we're hiring","we are hiring","now hiring","currently hiring","i'm hiring","i am hiring","hiring on my team","hiring for my team","looking to hire","apply here","apply now","apply via","apply via the link","send your cv","send your resume","send a cv","send me your cv","join our team","join our growing team","we are recruiting","we are seeking a","seeking a talented","seeking an experienced","position available","job opening","job vacancy","full-time role","part-time role","freelance role available","remote role","immediate joiner","immediate joiners","wfh opportunity","internship","intern role","freshers","fresher","0-1 year","0 to 1 year","based in india only","must be based in india","jaipur","gurgaon","bangalore","mumbai","delhi","hyderabad","pune","chennai","kolkata","amsterdam","netherlands","cricket","icc ","t20 world cup","fifa world cup","unilever"];
for(const j of jobPostings){if(t.includes(j))return false;}
const bad=["my game","our game","i made","we made","wishlist","steam page","steam demo","steam next fest","devlog","just launched my","just released my","how do i market","advice on marketing","unity ","unreal engine","godot","pixel art","game jam","looking for playtesters","looking for beta","looking for artists","looking for programmers","looking for developers","i am a creator","i make content","my youtube channel","my tiktok","my instagram","i'm a creator","im a creator","i'm a ugc","i am a ugc","my ugc content","pan india","pan-india","\u20b9","inr ","tamil","telugu","kannada","malayalam","india-based","what is influencer marketing","influencer marketing is when","what makes it effective","reflecting on","here's what i learned","unpopular opinion","my take on","the truth about","lessons from","thoughts on","portugal","germany","france","greece","sweden","european campaign","i used to","a year ago i","when i started","my follower count","my engagement rate","my content performs","i create content","i produce content","ugc example","ugc tip","how to get brand deals","how i got my first","how brands work","brand deal breakdown","it was fantastic to see","it was great to see","i had the privilege","my biggest takeaway","standing-room-only","i was honored","i had the pleasure","energising about","walking away from","this week i","last week i","breaking:","just published","press release","according to a report","launches new","study finds","research shows","survey reveals","event recap","#worldcup","#cricket","#football","world cup","super bowl"];
for(const d of bad){if(t.includes(d))return false;}
const good=["looking for a talent agency","looking for an agency","need an agency","talent agency","find an agency","recommend an agency","need recommendations for","agency recommendations","looking for content creators","looking for influencers","looking for youtubers","looking for ugc","looking for creators","sourcing creators","sourcing influencers","creators needed","influencers needed","hiring content creators","we are looking for creators","we need creators","brand is looking","client is looking","looking to work with creators","looking to work with influencers","partnering with creators","uk creators","uk-based creators","uk influencers","uk youtubers","uk content creators","british creators","british influencers","british youtubers","us creators","us-based creators","us influencers","us youtubers","us content creators","american creators","american influencers","american youtubers","united states creators","north america creators","us gaming","us youtube","canada creators","canadian creators","canadian youtubers","australian creators","australian influencers","australian youtubers","au creators","new zealand creators","nz creators","paid campaign","paid opportunity","paid collab","paid collaboration","marketing budget","campaign budget","looking to spend","per post","per video","per integration","talent manager","talent managers","reach out to streamers","reach out to youtubers","dm me if you","dm if you are a creator","dm us if","comment below if you","email me if you","get in touch if you","brand deal","sponsor","sponsorship","paid partnership","brand partnership","collab opportunity","collaboration opportunity","brand collab","creator campaign","influencer campaign","creator program","influencer program","does this job even exist"];
for(const p of good){if(t.includes(p))return true;}
return false;
}
function detectSource(post){
    if(post.communityName||(post.dataType==="post"&&post.id&&post.id.startsWith("t3_")))return "Reddit";
    return "LinkedIn";
  }
  function getContact(text,source){
    if(!text)return source==="Reddit"?"Comment on Reddit":"DM on LinkedIn";
    var email=text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
    if(email)return "Email: "+email[0];
    if(source==="Reddit")return "Comment on Reddit post";
    if(/dm me|dm us|message me|inbox me/i.test(text))return "DM on LinkedIn";
    if(/reach out|get in touch|contact me|email me|email us/i.test(text))return "Reach out on LinkedIn";
    if(/apply|submit/i.test(text))return "Apply via link in post";
    return "DM on LinkedIn";
  }
  var saved=0;var skipped=0;var filtered=0;
  for(var i=0;i<posts.length;i++){
    var post=posts[i];
    var source=detectSource(post);
    var text,name,title,postUrl;
    if(source==="Reddit"){text=post.body||"";name=post.username||post.author||"Reddit User";title=post.communityName||"reddit";postUrl=post.url||("https://reddit.com/"+(post.id||""));}
    else{text=post.text||post.content||post.description||"";name=post.author?(post.author.name||post.author.firstName||""):"Unknown";title=post.author?(post.author.headline||post.author.title||""):"";postUrl=post.url||post.linkedinUrl||"";}
    if(!name)name="Unknown";
    if(!isBroadlyRelevant(text)){filtered++;continue;}
    if(postUrl&&existingUrls.has(postUrl)){skipped++;continue;}
    var contact=getContact(text,source);
    var today=new Date().toISOString().split("T")[0];
    var colValues={text_mm39wj8z:name.substring(0,100),text_mm39q5ez:title.substring(0,200),text_mm3fkmwh:source,long_text_mm39azh6:text.substring(0,500),link_mm39r70s:{url:postUrl,text:"View Post"},text_mm39nkvy:contact,date_mm39nc42:{date:today},text_mm45k4ng:(post.query||post.searchQuery||"").toString().substring(0,255)};
    var mutation="mutation{create_item(board_id:"+BOARD_ID+",item_name:"+JSON.stringify(name.substring(0,50))+",column_values:"+JSON.stringify(JSON.stringify(colValues))+"){id}}";
    try{
      var mRes=await fetch("https://api.monday.com/v2",{method:"POST",headers:{"Content-Type":"application/json","Authorization":MONDAY_API_KEY},body:JSON.stringify({query:mutation})});
      var mData=await mRes.json();
      if(mData.data&&mData.data.create_item){saved++;existingUrls.add(postUrl);}else{skipped++;}
    }catch(e){skipped++;}
  }
  return res.status(200).json({message:"Done",saved:saved,skipped:skipped,filtered:filtered,total:posts.length});
}
