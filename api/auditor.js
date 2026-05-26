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
    const prompt="You are a lead qualification assistant for Digital Fox Talent, a creator talent agency that connects brands with YouTube, TikTok, and gaming/film content creators for paid campaigns.\n\nAssess whether the following "+source+" post represents a GENUINE INBOUND LEAD - meaning a brand, startup, publisher, or marketer who is actively looking to hire or commission content creators for a paid campaign, or looking for a talent agency/manager to help them find creators.\n\nPost:\n\"\"\"\n"+postText.substring(0,1000)+"\n\"\"\"\n\nReply with only one word: KEEP or MOVE.\n- KEEP if: they are actively sourcing creators, running a campaign, have a budget, looking for a talent agency, or looking to hire influencers/YouTubers/streamers for paid work.\n- MOVE if: they are a creator looking for work, asking general advice, sharing tips, discussing the industry, promoting their own product/tool, or otherwise not an active buyer.";
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
