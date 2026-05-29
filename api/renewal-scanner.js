export const config={maxDuration:300};
export default async function handler(req,res){
  const MONDAY_API_KEY=process.env.MONDAY_API_KEY;
  const ANTHROPIC_API_KEY=process.env.ANTHROPIC_API_KEY;
  const CAMPAIGNS_BOARD_ID="6162879609";
  const RENEWAL_BOARD_ID="18415465266";
  const RENEWAL_GROUP_ID="group_mm3tj6eh";
  if(!MONDAY_API_KEY||!ANTHROPIC_API_KEY)return res.status(500).json({error:"Missing env vars"});

  const COMPLETE_STATUSES=["commission paid","complete","completed","done","live","invoiced"];

  // Fetch all campaigns
  let allItems=[];
  let cursor=null;
  do{
    const q=cursor
      ?"{ boards(ids:["+CAMPAIGNS_BOARD_ID+"]){ items_page(limit:50,cursor:\""+cursor+"\"){ cursor items{ id name column_values(ids:[\"deal_value\",\"status\",\"date4\",\"text_mm1zsbnp\"]){ id text value } subitems{ id name column_values(ids:[\"numbers\",\"text_mm3ta8gs\",\"file_mm1zd4v9\"]){ id text value } } } } } }"
      :"{ boards(ids:["+CAMPAIGNS_BOARD_ID+"]){ items_page(limit:50){ cursor items{ id name column_values(ids:[\"deal_value\",\"status\",\"date4\",\"text_mm1zsbnp\"]){ id text value } subitems{ id name column_values(ids:[\"numbers\",\"text_mm3ta8gs\",\"file_mm1zd4v9\"]){ id text value } } } } } }";
    const r=await fetch("https://api.monday.com/v2",{method:"POST",headers:{"Content-Type":"application/json","Authorization":MONDAY_API_KEY},body:JSON.stringify({query:q})});
    const d=await r.json();
    const page=d&&d.data&&d.data.boards&&d.data.boards[0]&&d.data.boards[0].items_page;
    if(!page)break;
    allItems=allItems.concat(page.items||[]);
    cursor=page.cursor||null;
  }while(cursor);

  // Get existing renewal items to avoid duplicates
  const exRes=await fetch("https://api.monday.com/v2",{method:"POST",headers:{"Content-Type":"application/json","Authorization":MONDAY_API_KEY},body:JSON.stringify({query:"{boards(ids:["+RENEWAL_BOARD_ID+"]){items_page(limit:500){items{name}}}}"})});
  const exData=await exRes.json();
  const existing=new Set((exData&&exData.data&&exData.data.boards&&exData.data.boards[0]&&exData.data.boards[0].items_page&&exData.data.boards[0].items_page.items||[]).map(function(i){return i.name.toLowerCase();}));

  const today=new Date();
  let added=0;

  for(const item of allItems){
    function getCol(id){const c=item.column_values.find(function(x){return x.id===id;});return c?c.text||"";}
    const status=getCol("status").toLowerCase();
    const isComplete=COMPLETE_STATUSES.some(function(s){return status.includes(s);});
    if(!isComplete)continue;
    const liveDateStr=getCol("date4");
    if(!liveDateStr)continue;
    const weeksSinceLive=(today-new Date(liveDateStr))/(1000*60*60*24*7);
    if(weeksSinceLive<1)continue;
    const advertiser=getCol("text_mm1zsbnp")||item.name;

    for(const sub of(item.subitems||[])){
      function getSubCol(id){const c=sub.column_values.find(function(x){return x.id===id;});return c?c.text||"";}
      const creatorCost=parseFloat(getSubCol("numbers"))||0;
      if(!creatorCost)continue;
      const creator=sub.name;
      const views=getSubCol("text_mm3ta8gs")||"";
      const videoUrl=getSubCol("file_mm1zd4v9")||"";
      const clientPrice=creatorCost*1.3;
      const renewalOffer=Math.round(clientPrice*0.5);
      const itemName=(advertiser+" x "+creator).substring(0,50);
      if(existing.has(itemName.toLowerCase()))continue;
      const viewNum=parseInt((views||"").replace(/,/g,""))||0;
      const ecpm=viewNum>0?parseFloat(((clientPrice/viewNum)*1000).toFixed(2)):0;

      // Generate email draft with Claude
      let emailDraft="";
      try{
        const promptLines=[
          "You are drafting a renewal outreach email on behalf of Digital Fox Talent (DFT), a creator talent agency.",
          "Write a short, warm, professional email from Margot at DFT to a brand contact.",
          "Friendly and conversational tone - not overly salesy. Under 150 words. No em dashes.",
          "",
          "Campaign: "+item.name,
          "Advertiser: "+advertiser,
          "Creator: "+creator,
          "Original client price: $"+clientPrice.toFixed(0),
          "Renewal offer (50% off): $"+renewalOffer,
          views?"Views: "+views:"",
          ecpm?"eCPM: $"+ecpm:"",
          "Live date: "+liveDateStr,
          "",
          "Pitch the 50% repost offer. Mention performance if views available.",
          "Include a table: Creator | Original Price | Renewal Price | Views | eCPM",
          "",
          "Write only the email body. Start with Hi [first name],"
        ];
        const prompt=promptLines.filter(function(l){return l!==undefined;}).join("\n");
        const cr=await fetch("https://api.anthropic.com/v1/messages",{
          method:"POST",
          headers:{"Content-Type":"application/json","x-api-key":ANTHROPIC_API_KEY,"anthropic-version":"2023-06-01"},
          body:JSON.stringify({model:"claude-haiku-4-5-20251001",max_tokens:400,messages:[{role:"user",content:prompt}]})
        });
        const cd=await cr.json();
        emailDraft=cd&&cd.content&&cd.content[0]&&cd.content[0].text||"";
      }catch(e){}

      const subject="Re: "+advertiser+" x "+creator+" - Renewal Opportunity";
      const fullDraft=emailDraft?"SUBJECT: "+subject+"\n\n"+emailDraft:"SUBJECT: "+subject+"\n\n[Draft generation failed - please write manually]";

      const colVals=JSON.stringify({
        "text_mm3t6g60":advertiser,
        "text_mm3tacsw":creator,
        "numeric_mm3tqsff":clientPrice,
        "numeric_mm3t15r1":renewalOffer,
        "numeric_mm3tbpvz":viewNum,
        "numeric_mm3ty8e":ecpm,
        "date_mm3t55tj":{"date":liveDateStr},
        "long_text_mm3tm4wc":{"text":fullDraft}
      });

      try{
        const mutation="mutation{create_item(board_id:"+RENEWAL_BOARD_ID+",group_id:\""+RENEWAL_GROUP_ID+"\",item_name:"+JSON.stringify(itemName)+",column_values:"+JSON.stringify(colVals)+"){id}}";
        const saveRes=await fetch("https://api.monday.com/v2",{method:"POST",headers:{"Content-Type":"application/json","Authorization":MONDAY_API_KEY},body:JSON.stringify({query:mutation})});
        const saveData=await saveRes.json();
        if(saveData&&saveData.data&&saveData.data.create_item&&saveData.data.create_item.id)added++;
      }catch(e){}
      await new Promise(function(r){setTimeout(r,200);});
    }
  }

  return res.json({message:"Renewal scan complete",campaignsScanned:allItems.length,renewalsAdded:added});
}
