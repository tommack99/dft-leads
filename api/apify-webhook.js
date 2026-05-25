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
  const existingRes=await fetch("https://api.monday.com/v2",{method:"POST",headers:{"Content-Type":"application/json","Authorization":MONDAY_API_KEY},body:JSON.stringify({query:"{boards(ids:["+BOARD_ID+"]){items_page(limit:500){items{column_values(ids:[\"link_mm39r70s\"]){value}}}}}"})}); 
  const existingData=await existingRes.json();
  const existingUrls=new Set();
  const existingItems=existingData?.data?.boards?.[0]?.items_page?.items||[];
  for(const item of existingItems){const val=item.column_values?.[0]?.value;if(val){try{existingUrls.add(JSON.parse(val).url);}catch(e){}}}
  function isRelevant(text){
    if(!text)return false;
    const t=text.toLowerCase();
    const bad=["my game","our game","i made","we made","wishlist","steam page","steam demo","steam next fest","devlog","just launched","just released","how do i market","advice on marketing","unity ","unreal engine","godot","pixel art","game jam","looking for playtesters","looking for beta","looking for artists","looking for programmers","looking for developers","i am a creator","i make content","my youtube channel","my tiktok","my instagram"];
    for(const d of bad){if(t.includes(d))return false;}
    const good=["looking for content creators","looking for influencers","looking for youtubers","looking for ugc","looking for creators","creators needed","influencers needed","sourcing creators","sourcing influencers","hiring content creators","hiring influencers","casting call","ugc creators","brand collab","creator campaign","influencer campaign","influencer marketing campaign","we are looking for creators","we need creators","brand is looking","client is looking","looking to work with creators","looking to work with influencers","partnering with creators","paid campaign","paid opportunity","paid collab","paid collaboration","does this job even exist","talent manager","creator manager","influencer manager","reach out to streamers","reach out to youtubers","dm me if you","dm if you are a creator","dm us if","comment below if you","looking to spend","marketing budget","campaign budget","need recommendations for","looking for an agency","talent agency"];
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
    if(!isRelevant(text)){filtered++;continue;}
    if(postUrl&&existingUrls.has(postUrl)){skipped++;continue;}
    var contact=getContact(text,source);
    var colValues={text_mm39wj8z:name.substring(0,100),text_mm39q5ez:title.substring(0,200),text_mm3fkmwh:source,long_text_mm39azh6:text.substring(0,500),link_mm39r70s:{url:postUrl,text:"View Post"},text_mm39nkvy:contact,date_mm39nc42:{date:new Date().toISOString().split("T")[0]}};
    var mutation="mutation{create_item(board_id:"+BOARD_ID+",item_name:"+JSON.stringify(name.substring(0,50))+",column_values:"+JSON.stringify(JSON.stringify(colValues))+"){id}}";
    try{
      var mRes=await fetch("https://api.monday.com/v2",{method:"POST",headers:{"Content-Type":"application/json","Authorization":MONDAY_API_KEY},body:JSON.stringify({query:mutation})});
      var mData=await mRes.json();
      if(mData.data&&mData.data.create_item){saved++;existingUrls.add(postUrl);}else{skipped++;}
    }catch(e){skipped++;}
  }
  return res.status(200).json({message:"Done",saved:saved,skipped:skipped,filtered:filtered,total:posts.length});
}
