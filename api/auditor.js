export const config={maxDuration:60};
export default async function handler(req,res){
  res.setHeader("Access-Control-Allow-Origin","*");
  if(req.method==="OPTIONS")return res.status(200).end();
  const MONDAY_API_KEY=process.env.MONDAY_API_KEY;
  const ANTHROPIC_API_KEY=process.env.ANTHROPIC_API_KEY;
  const BOARD_ID="18412906853";
  const LATEST_GROUP="topics";
  const REVIEWED_GROUP="group_mm3h36gz";
  if(!MONDAY_API_KEY||!ANTHROPIC_API_KEY)return res.status(500).json({error:"Missing env vars"});
  const mondayRes=await fetch("https://api.monday.com/v2",{
    method:"POST",
    headers:{"Content-Type":"application/json","Authorization":MONDAY_API_KEY},
    body:JSON.stringify({query:`{boards(ids:[${BOARD_ID}]){groups(ids:["${LATEST_GROUP}"]){items_page(limit:100){items{id name column_values(ids:["long_text_mm39azh6","text_mm3fkmwh"]){id value text}}}}}}`})
  });
  const mondayData=await mondayRes.json();
  const items=mondayData?.data?.boards?.[0]?.groups?.[0]?.items_page?.items||[];
  if(!items.length)return res.status(200).json({message:"No items to audit",audited:0});
  let kept=0;let moved=0;
  for(const item of items){
    const textCol=item.column_values.find(c=>c.id==="long_text_mm39azh6");
    const sourceCol=item.column_values.find(c=>c.id==="text_mm3fkmwh");
    const postText=textCol?.text||textCol?.value||"";
    const source=sourceCol?.text||"Unknown";
    const prompt="You are a lead qualifier for Digital Fox Talent (DFT), a UK-based creator talent agency that manages YouTubers and content creators in gaming and film/entertainment. DFT earns money by connecting brands with creators for paid campaigns, and by booking talent as guests on shows."+
"\n\nReview this "+source+" post and decide: KEEP or MOVE."+
"\n\nKEEP if the post is from someone who:\n- Is a brand, publisher, studio or marketer actively looking to hire content creators for a paid campaign\n- Is looking for a talent agency or creator management company\n- Is casting creators or influencers for a paid opportunity\n- Has a real budget and is in the UK, US, Australia or Canada\n- Is a publicist or PR person representing talent available for press/interviews\n- Is hiring an influencer manager role with serious budget signals (e.g. $100K+ mentioned)"+
"\n\nMOVE if the post is:\n- A job posting for an influencer marketing role in India or other non-target markets\n- General advice or opinion about influencer marketing or UGC\n- A creator looking for brand deals or work (not a buyer)\n- A tool, platform or software promoting their service\n- Political, philosophical or unrelated content\n- A duplicate of something already seen\n- A small budget or intern/freelance role\n- Based in India, Southeast Asia or other non-target regions\n\nPost:\n\"\"\"\n"+postText.substring(0,1000)+"\n\"\"\"\n\nReply with only one word: KEEP or MOVE.";
    try{
      const claudeRes=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json","x-api-key":ANTHROPIC_API_KEY,"anthropic-version":"2023-06-01"},
        body:JSON.stringify({model:"claude-haiku-4-5-20251001",max_tokens:10,messages:[{role:"user",content:prompt}]})
      });
      const claudeData=await claudeRes.json();
      const verdict=(claudeData?.content?.[0]?.text||"MOVE").trim().toUpperCase();
      if(verdict==="MOVE"){
        await fetch("https://api.monday.com/v2",{
          method:"POST",
          headers:{"Content-Type":"application/json","Authorization":MONDAY_API_KEY},
          body:JSON.stringify({query:`mutation{move_item_to_group(item_id:${item.id},group_id:"${REVIEWED_GROUP}"){id}}`})
        });
        moved++;
      }else{kept++;}
    }catch(e){kept++;}
  }
  return res.status(200).json({message:"Audit complete",kept,moved,total:items.length});
}
