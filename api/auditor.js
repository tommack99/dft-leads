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

  const PROMPT_BASE="You are a lead qualifier for Digital Fox Talent (DFT), a UK-based creator talent agency managing YouTubers and content creators in gaming and film/entertainment. DFT earns money connecting brands with creators for paid campaigns, and booking talent as guests on shows.\n\nReview this post and reply with only KEEP or MOVE.\n\nKEEP if: brand/publisher/studio/marketer actively looking to hire creators for paid campaign, looking for a talent agency, casting creators for paid opportunity, has budget in UK/US/Australia/Canada, publicist with talent available for press, serious influencer manager role with $100K+ budget.\n\nMOVE if: influencer marketing job posting in India or non-target markets, general advice or opinion post, creator looking for brand deals, tool or platform promoting itself, political or unrelated content, small budget or intern role, based in India/Southeast Asia.\n\nPost source: ";

  async function auditItem(item){
    const textCol=item.column_values.find(c=>c.id==="long_text_mm39azh6");
    const sourceCol=item.column_values.find(c=>c.id==="text_mm3fkmwh");
    const postText=textCol?.text||textCol?.value||"";
    const source=sourceCol?.text||"Unknown";
    const prompt=PROMPT_BASE+source+"\n\nPost:\n"+postText.substring(0,800);
    try{
      const r=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json","x-api-key":ANTHROPIC_API_KEY,"anthropic-version":"2023-06-01"},
        body:JSON.stringify({model:"claude-haiku-4-5-20251001",max_tokens:10,messages:[{role:"user",content:prompt}]})
      });
      const d=await r.json();
      return{id:item.id,verdict:(d?.content?.[0]?.text||"MOVE").trim().toUpperCase()};
    }catch(e){return{id:item.id,verdict:"KEEP"};}
  }

  // Process all items in parallel
  const results=await Promise.all(items.map(auditItem));

  // Move items in parallel
  let kept=0;let moved=0;
  await Promise.all(results.map(async({id,verdict})=>{
    if(verdict==="MOVE"){
      try{
        await fetch("https://api.monday.com/v2",{
          method:"POST",
          headers:{"Content-Type":"application/json","Authorization":MONDAY_API_KEY},
          body:JSON.stringify({query:`mutation{move_item_to_group(item_id:${id},group_id:"${REVIEWED_GROUP}"){id}}`})
        });
        moved++;
      }catch(e){kept++;}
    }else{kept++;}
  }));

  return res.status(200).json({message:"Audit complete",kept,moved,total:items.length});
}
