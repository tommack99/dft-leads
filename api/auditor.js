export const config={maxDuration:120};
export default async function handler(req,res){
  const MON=process.env.MONDAY_API_KEY;
  const ANT=process.env.ANTHROPIC_API_KEY;
  if(!MON||!ANT)return res.status(500).json({error:"Missing env vars"});
  const BOARD="18412906853";
  const LATEST="topics";
  const REVIEWED="group_mm3h36gz";
  const SCORE_COL="rating_mm3vw2sy";
  const r=await fetch("https://api.monday.com/v2",{method:"POST",headers:{"Content-Type":"application/json","Authorization":MON},body:JSON.stringify({query:"{boards(ids:["+BOARD+"]){groups(ids:[\""+LATEST+"\"]){items_page(limit:50){items{id name column_values(ids:[\"long_text_mm39azh6\",\""+SCORE_COL+"\"]) {id text}}}}}}"})});
  const d=await r.json();
  const items=(d&&d.data&&d.data.boards&&d.data.boards[0]&&d.data.boards[0].groups&&d.data.boards[0].groups[0]&&d.data.boards[0].groups[0].items_page&&d.data.boards[0].groups[0].items_page.items)||[];
  const unscored=items.filter(item=>{const s=item.column_values.find(c=>c.id===SCORE_COL);return !s||!s.text;});
  if(!unscored.length)return res.json({message:"Auditor complete",processed:0,moved:0,scored:0});
  const itemList=unscored.map((item,i)=>{
    const textCol=item.column_values.find(c=>c.id==="long_text_mm39azh6");
    const text=textCol?textCol.text||"":"";
    return (i+1)+". NAME: "+item.name+"\nPOST: "+text.substring(0,300);
  }).join("\n\n---\n\n");
  const prompt="You are auditing LinkedIn/Reddit posts for Digital Fox Talent, a YouTube creator talent agency managing gaming, entertainment and pop culture creators for paid brand sponsorships.\n\nScore each post 1-5:\n5 = Brand/buyer with named budget, specific creator requirement, explicitly seeking agency or talent manager.\n4 = Brand/buyer actively seeking creators or agencies for paid campaign. Strong intent.\n3 = Someone seeking talent manager or agency recommendations. Moderate fit.\n2 = Adjacent but unclear intent or poor fit (wrong niche, TikTok-only, no budget signals).\n1 = Should be filtered - job posting, self-promotion, commentary, wrong geography.\n\nRespond ONLY with valid JSON array:\n[{id:ITEM_ID,score:N,action:KEEP|REVIEW,reason:brief}]\n\nItems:\n"+itemList+"\n\nIDs in order: "+unscored.map(i=>i.id).join(", ");
  let scores=[];
  try{
    const cr=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":ANT,"anthropic-version":"2023-06-01"},body:JSON.stringify({model:"claude-haiku-4-5-20251001",max_tokens:1000,messages:[{role:"user",content:prompt}]})});
    const cd=await cr.json();
    const text=cd&&cd.content&&cd.content[0]&&cd.content[0].text||"[]";
    const clean=text.replace(/```json|```/g,"").trim();
    scores=JSON.parse(clean).map((s,i)=>({...s,id:unscored[i]?unscored[i].id:s.id}));
  }catch(e){return res.status(200).json({error:"Claude failed: "+e.message});}
  let moved=0;let scored=0;
  for(const s of scores){
    if(!s.id)continue;
    try{
      await fetch("https://api.monday.com/v2",{method:"POST",headers:{"Content-Type":"application/json","Authorization":MON},body:JSON.stringify({query:"mutation{change_multiple_column_values(board_id:"+BOARD+",item_id:"+s.id+",column_values:"+JSON.stringify(JSON.stringify({[SCORE_COL]:{rating:s.score||1}}))+"){ id}}"})});
      scored++;
    }catch(e){}
    if(s.action==="REVIEW"){
      try{
        await fetch("https://api.monday.com/v2",{method:"POST",headers:{"Content-Type":"application/json","Authorization":MON},body:JSON.stringify({query:"mutation{move_item_to_group(item_id:"+s.id+",group_id:\""+REVIEWED+"\"){id}}"})});
        moved++;
      }catch(e){}
    }
    await new Promise(r=>setTimeout(r,150));
  }
  return res.json({message:"Auditor complete",processed:unscored.length,scored,moved,scores:scores.map(s=>({id:s.id,score:s.score,action:s.action,reason:s.reason}))});
}
