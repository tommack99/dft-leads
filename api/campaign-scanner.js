export const config={maxDuration:300};
export default async function handler(req,res){
  const MON=process.env.MONDAY_API_KEY;
  const ANT=process.env.ANTHROPIC_API_KEY;
  if(!MON||!ANT)return res.status(500).json({error:"Missing env vars"});
  const CAM="6162879609";
  const REN="18415465266";
  const GRP="group_mm3tj6eh";
  const DONE=["commission paid","complete","completed","done","live","invoiced"];
  async function mq(query){
    const r=await fetch("https://api.monday.com/v2",{method:"POST",headers:{"Content-Type":"application/json","Authorization":MON},body:JSON.stringify({query:query})});
    return r.json();
  }
  let items=[];
  let cursor=null;
  do{
    const colIds=JSON.stringify(["deal_value","status","date4","text_mm1zsbnp"]);
    const scolIds=JSON.stringify(["numbers","text_mm3ta8gs","file_mm1zd4v9"]);
    const q=cursor
      ?"{boards(ids:["+CAM+"]){items_page(limit:50,cursor:"+JSON.stringify(cursor)+"){cursor items{id name column_values(ids:"+colIds+"){id text value}subitems{id name column_values(ids:"+scolIds+"){id text value}}}}}}"
      :"{boards(ids:["+CAM+"]){items_page(limit:50){cursor items{id name column_values(ids:"+colIds+"){id text value}subitems{id name column_values(ids:"+scolIds+"){id text value}}}}}}";
    const d=await mq(q);
    const page=d&&d.data&&d.data.boards&&d.data.boards[0]&&d.data.boards[0].items_page;
    if(!page)break;
    items=items.concat(page.items||[]);
    cursor=page.cursor||null;
  }while(cursor);
  const ed=await mq("{boards(ids:["+REN+"]){items_page(limit:500){items{name}}}}");
  const existing=new Set((ed&&ed.data&&ed.data.boards&&ed.data.boards[0]&&ed.data.boards[0].items_page&&ed.data.boards[0].items_page.items||[]).map(function(i){return i.name.toLowerCase();}));
  const now=new Date();
  let added=0;
  for(const item of items){
    const gc=function(id){const c=item.column_values.find(function(x){return x.id===id;});return c?c.text||"";};
    if(!DONE.some(function(s){return gc("status").toLowerCase().includes(s);}))continue;
    const liveStr=gc("date4");
    if(!liveStr||(now-new Date(liveStr))/(1000*60*60*24*7)<1)continue;
    const advertiser=gc("text_mm1zsbnp")||item.name;
    for(const sub of(item.subitems||[])){
      const gs=function(id){const c=sub.column_values.find(function(x){return x.id===id;});return c?c.text||"";};
      const cost=parseFloat(gs("numbers"))||0;
      if(!cost)continue;
      const creator=sub.name;
      const views=gs("text_mm3ta8gs")||"";
      const clientPrice=cost*1.3;
      const renewal=Math.round(clientPrice*0.5);
      const iname=(advertiser+" x "+creator).substring(0,50);
      if(existing.has(iname.toLowerCase()))continue;
      const vn=parseInt((views||"").replace(/,/g,""))||0;
      const ecpm=vn>0?parseFloat(((clientPrice/vn)*1000).toFixed(2)):0;
      let draft="";
      try{
        const prompt="Draft a short renewal email from Margot at Digital Fox Talent to a brand contact. Warm and friendly, under 150 words, no em dashes. Campaign: "+item.name+". Advertiser: "+advertiser+". Creator: "+creator+". Original client price: $"+clientPrice.toFixed(0)+". Renewal offer (50% off): $"+renewal+"."+(vn?" Views: "+views+". eCPM: $"+ecpm+".":"")+" Live date: "+liveStr+". Pitch the 50% repost offer. Include table: Creator | Original | Renewal | Views | eCPM. Start with: Hi [first name],";
        const cr=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":ANT,"anthropic-version":"2023-06-01"},body:JSON.stringify({model:"claude-haiku-4-5-20251001",max_tokens:400,messages:[{role:"user",content:prompt}]})});
        const cd=await cr.json();
        draft=cd&&cd.content&&cd.content[0]&&cd.content[0].text||"";
      }catch(e){}
      const subject="Re: "+advertiser+" x "+creator+" - Renewal Opportunity";
      const fullDraft="SUBJECT: "+subject+"\n\n"+(draft||"[Please write manually]");
      const cols=JSON.stringify({text_mm3t6g60:advertiser,text_mm3tacsw:creator,numeric_mm3tqsff:clientPrice,numeric_mm3t15r1:renewal,numeric_mm3tbpvz:vn,numeric_mm3ty8e:ecpm,date_mm3t55tj:{date:liveStr},long_text_mm3tm4wc:{text:fullDraft}});
      try{
        const sr=await mq("mutation{create_item(board_id:"+REN+",group_id:"+JSON.stringify(GRP)+",item_name:"+JSON.stringify(iname)+",column_values:"+JSON.stringify(cols)+"){id}}");
        if(sr&&sr.data&&sr.data.create_item&&sr.data.create_item.id)added++;
      }catch(e){}
      await new Promise(function(r){setTimeout(r,200);});
    }
  }
  return res.json({message:"Scan complete",campaignsScanned:items.length,renewalsAdded:added});
}
