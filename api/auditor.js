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
  const PROMPT="You are a lead qualifier for Digital Fox Talent (DFT), a UK-based creator talent agency. DFT represents YouTubers and content creators in gaming and film. DFT earns money two ways: connecting brands with creators for paid campaigns, and booking talent as guests on shows.\n\nKEEP the post if it shows someone who:\n- Is a brand, marketer, publisher or studio ACTIVELY looking to hire content creators or YouTubers for a paid campaign\n- Is explicitly looking for a talent agency, creator management company, or influencer marketing agency to work with\n- Mentions sourcing UK, US, Australian or Canadian creators\n- Has a real budget signal (any £/$ amount mentioned)\n- Is a publicist or PR professional with talent available for press or guest appearances\n- Is recruiting a senior influencer or creator manager role\n- Is looking for affiliates or content partners for a product launch\n- Explicitly mentions wanting to work with talent managers or agencies\n\nMOVE the post if it is:\n- A job posting based in India, Pakistan, or South/Southeast Asia (look for Indian cities, ₹ symbol, Tamil/Telugu/Kannada etc)\n- A European campaign for Portugal, Germany, France, Greece, Sweden (not DFT markets)\n- General opinion, advice or commentary about influencer marketing\n- A creator or UGC creator promoting themselves or seeking brand deals\n- A tool, platform or SaaS product promoting its services\n- An intern, fresher or junior role\n- Political, legal, spam or completely unrelated content\n\nIMPORTANT: When in doubt, reply KEEP. Only MOVE posts you are very confident are irrelevant to DFT.\n\nPost source: ";
  async function auditItem(item){
    const textCol=item.column_values.find(c=>c.id==="long_text_mm39azh6");
    const sourceCol=item.column_values.find(c=>c.id==="text_mm3fkmwh");
    const postText=textCol?.text||textCol?.value||"";
    const source=sourceCol?.text||"Unknown";
    const prompt=PROMPT+source+"\n\nPost:\n"+postText.substring(0,1000)+"\n\nReply with only KEEP or MOVE.";
    try{
      const r=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json","x-api-key":ANTHROPIC_API_KEY,"anthropic-version":"2023-06-01"},
        body:JSON.stringify({model:"claude-haiku-4-5-20251001",max_tokens:10,messages:[{role:"user",content:prompt}]})
      });
      const d=await r.json();
      return{id:item.id,verdict:(d?.content?.[0]?.text||"KEEP").trim().toUpperCase()};
    }catch(e){return{id:item.id,verdict:"KEEP"};}
  }
  const results=await Promise.all(items.map(auditItem));
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
