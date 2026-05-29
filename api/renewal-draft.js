export const config={maxDuration:60};
export default async function handler(req,res){
  res.setHeader("Access-Control-Allow-Origin","*");
  if(req.method==="GET"||req.method==="OPTIONS")return res.status(200).json({status:"ok"});
  const body=req.body||{};
  if(body.challenge)return res.status(200).json({challenge:body.challenge});
  const MONDAY_API_KEY=process.env.MONDAY_API_KEY;
  const ANTHROPIC_API_KEY=process.env.ANTHROPIC_API_KEY;
  const RENEWAL_BOARD_ID="18415465266";
  if(!MONDAY_API_KEY||!ANTHROPIC_API_KEY)return res.status(500).json({error:"Missing env vars"});
  const itemId=body.event&&body.event.pulseId;
  if(!itemId)return res.status(200).json({status:"no item"});
  const mondayRes=await fetch("https://api.monday.com/v2",{
    method:"POST",
    headers:{"Content-Type":"application/json","Authorization":MONDAY_API_KEY},
    body:JSON.stringify({query:"{items(ids:["+itemId+"]){name column_values(ids:[\"text_mm3t6g60\",\"text_mm3twr2z\",\"text_mm3tacsw\",\"numeric_mm3tqsff\",\"numeric_mm3t15r1\",\"link_mm3tzq3g\",\"numeric_mm3tbpvz\",\"numeric_mm3ty8e\",\"date_mm3t55tj\",\"color_mm3t2p7z\"]){id text value}}}"})
  });
  const mondayData=await mondayRes.json();
  const item=mondayData&&mondayData.data&&mondayData.data.items&&mondayData.data.items[0];
  if(!item)return res.status(200).json({status:"item not found"});
  function getCol(id){const c=item.column_values.find(function(x){return x.id===id;});return c?c.text||"";}
  const campaignName=item.name;
  const advertiser=getCol("text_mm3t6g60");
  const contactName=getCol("text_mm3twr2z");
  const creator=getCol("text_mm3tacsw");
  const originalPrice=getCol("numeric_mm3tqsff");
  const renewalOffer=getCol("numeric_mm3t15r1");
  const views=getCol("numeric_mm3tbpvz");
  const ecpm=getCol("numeric_mm3ty8e");
  const liveDate=getCol("date_mm3t55tj");
  const campaignType=getCol("color_mm3t2p7z");
  const firstName=contactName?contactName.split(" ")[0]:"there";
  const isBlock=campaignType&&campaignType.toLowerCase().includes("block");
  const promptLines=[
    "You are drafting a renewal outreach email on behalf of Digital Fox Talent (DFT), a creator talent agency.",
    "Write a short, warm, professional email from Margot at DFT to a brand contact.",
    "The tone should be friendly and conversational - not overly salesy. Keep it under 150 words. Do not use em dashes.",
    "",
    "Campaign details:",
    "Campaign: "+campaignName,
    "Advertiser: "+advertiser,
    "Contact: "+firstName,
    "Creator: "+creator,
    "Original price: $"+originalPrice,
    "Renewal offer (50% off repost): $"+renewalOffer,
    views?"Views so far: "+views:"",
    ecpm?"eCPM: $"+ecpm:"",
    liveDate?"Live date: "+liveDate:"",
    "",
    isBlock
      ?"This is a block booking - check in on performance and ask about booking next quarter."
      :"Pitch the 50% repost offer. Include a table: Creator | Price | Views | eCPM",
    "",
    "Write only the email body. Start with Hi "+firstName+","
  ];
  const prompt=promptLines.filter(function(l){return l!==undefined;}).join("\n");
  const claudeRes=await fetch("https://api.anthropic.com/v1/messages",{
    method:"POST",
    headers:{"Content-Type":"application/json","x-api-key":ANTHROPIC_API_KEY,"anthropic-version":"2023-06-01"},
    body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:500,messages:[{role:"user",content:prompt}]})
  });
  const claudeData=await claudeRes.json();
  const emailDraft=claudeData&&claudeData.content&&claudeData.content[0]&&claudeData.content[0].text||"";
  if(!emailDraft)return res.status(500).json({error:"Failed to generate draft"});
  const subject="Re: "+advertiser+" x "+creator+" - Renewal Opportunity";
  const fullDraft="SUBJECT: "+subject+"\n\n"+emailDraft;
  await fetch("https://api.monday.com/v2",{method:"POST",headers:{"Content-Type":"application/json","Authorization":MONDAY_API_KEY},body:JSON.stringify({query:"mutation{change_multiple_column_values(board_id:"+RENEWAL_BOARD_ID+",item_id:"+itemId+",column_values:"+JSON.stringify(JSON.stringify({long_text_mm3tm4wc:{text:fullDraft}}))+"){id}}"})});
  await fetch("https://api.monday.com/v2",{method:"POST",headers:{"Content-Type":"application/json","Authorization":MONDAY_API_KEY},body:JSON.stringify({query:"mutation{create_update(item_id:"+itemId+",body:"+JSON.stringify("Email draft ready:\n\n"+fullDraft)+"){id}}"})});
  return res.json({message:"Draft generated",advertiser,creator});
}
