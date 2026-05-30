export const config={maxDuration:300};
export default async function handler(req,res){
  try{
    const MON=process.env.MONDAY_API_KEY;
    const ANT=process.env.ANTHROPIC_API_KEY;
    if(!MON||!ANT)return res.status(500).json({error:"Missing env vars"});
    const CAM="6162879609";
    const REN="18415465266";
    const GRP="group_mm3tj6eh";
    const DONE=["commission paid","complete","completed","done","live","invoiced"];
    const colIds='["deal_value","status","date4","text_mm1zsbnp"]';
    const scolIds='["numbers","text_mm3ta8gs","file_mm1zd4v9"]';
    const mHeaders={"Content-Type":"application/json","Authorization":MON};
    let items=[];
    let cursor=null;
    do{
      const q=cursor
        ?("{boards(ids:["+CAM+"]){items_page(limit:50,cursor:"+JSON.stringify(cursor)+"){cursor items{id name column_values(ids:"+colIds+"){id text value}subitems{id name column_values(ids:"+scolIds+"){id text value}}}}}}")
        :("{boards(ids:["+CAM+"]){items_page(limit:50){cursor items{id name column_values(ids:"+colIds+"){id text value}subitems{id name column_values(ids:"+scolIds+"){id text value}}}}}}");
      const r1=await fetch("https://api.monday.com/v2",{method:"POST",headers:mHeaders,body:JSON.stringify({query:q})});
      const d1=await r1.json();
      const page=d1&&d1.data&&d1.data.boards&&d1.data.boards[0]&&d1.data.boards[0].items_page;
      if(!page)break;
      items=items.concat(page.items||[]);
      cursor=page.cursor||null;
    }while(cursor);
    const r2=await fetch("https://api.monday.com/v2",{method:"POST",headers:mHeaders,body:JSON.stringify({query:"{boards(ids:["+REN+"]){items_page(limit:500){items{name}}}}"})});
    const d2=await r2.json();
    const existing=new Set((d2&&d2.data&&d2.data.boards&&d2.data.boards[0]&&d2.data.boards[0].items_page&&d2.data.boards[0].items_page.items||[]).map(i=>i.name.toLowerCase()));
    const now=new Date();
    const toProcess=[];
    for(const item of items){
      const cols=item.column_values||[];
      const gc=id=>{const c=cols.find(x=>x.id===id);return c?c.text||"":"";};
      const status=gc("status").toLowerCase();
      if(!DONE.some(s=>status.includes(s)))continue;
      const liveStr=gc("date4");
      if(!liveStr||(now-new Date(liveStr))/(1000*60*60*24*7)<1)continue;
      const advertiser=gc("text_mm1zsbnp")||item.name;
      for(const sub of(item.subitems||[])){
        const scols=sub.column_values||[];
        const gs=id=>{const c=scols.find(x=>x.id===id);return c?c.text||"":"";};
        const cost=parseFloat(gs("numbers"))||0;
        if(!cost)continue;
        const views=gs("text_mm3ta8gs")||"";
        const clientPrice=cost*1.3;
        const renewal=Math.round(clientPrice*0.5);
        const iname=(advertiser+" x "+sub.name).substring(0,50);
        if(existing.has(iname.toLowerCase()))continue;
        const vn=parseInt((views||"").replace(/,/g,""))||0;
        const ecpm=vn>0?parseFloat(((clientPrice/vn)*1000).toFixed(2)):0;
        toProcess.push({advertiser,creator:sub.name,clientPrice,renewal,iname,views,vn,ecpm,liveStr});
      }
    }
    let added=0;
    for(const p of toProcess){
      let draft="";
      try{
        const prompt="Short renewal email from Margot at Digital Fox Talent. Warm, under 150 words, no em dashes. Advertiser: "+p.advertiser+". Creator: "+p.creator+". Price: $"+Math.round(p.clientPrice)+". Renewal: $"+p.renewal+"."+(p.vn?" Views: "+p.views+". eCPM: $"+p.ecpm+".":"")+" Live: "+p.liveStr+". Table: Creator|Original|Renewal|Views|eCPM. Start: Hi [name],";
        const rc=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":ANT,"anthropic-version":"2023-06-01"},body:JSON.stringify({model:"claude-haiku-4-5-20251001",max_tokens:400,messages:[{role:"user",content:prompt}]})});
        const rd=await rc.json();
        draft=rd&&rd.content&&rd.content[0]&&rd.content[0].text||"";
      }catch(e){}
      const subject="Re: "+p.advertiser+" x "+p.creator+" - Renewal Opportunity";
      const fullDraft="SUBJECT: "+subject+" "+(draft||"[Please write manually]");
      const cols2=JSON.stringify({text_mm3t6g60:p.advertiser,text_mm3tacsw:p.creator,numeric_mm3tqsff:Math.round(p.clientPrice),numeric_mm3t15r1:p.renewal,numeric_mm3tbpvz:p.vn,numeric_mm3ty8e:p.ecpm,date_mm3t55tj:{date:p.liveStr},long_text_mm3tm4wc:{text:fullDraft}});
      const rs=await fetch("https://api.monday.com/v2",{method:"POST",headers:mHeaders,body:JSON.stringify({query:"mutation{create_item(board_id:"+REN+",group_id:"+JSON.stringify(GRP)+",item_name:"+JSON.stringify(p.iname)+",column_values:"+JSON.stringify(cols2)+"){id}}"})});
      const rsd=await rs.json();
      if(rsd&&rsd.data&&rsd.data.create_item&&rsd.data.create_item.id){added++;existing.add(p.iname.toLowerCase());}
      await new Promise(r=>setTimeout(r,200));
    }
    return res.json({message:"Scan complete",scanned:items.length,found:toProcess.length,added});
  }catch(e){return res.status(200).json({error:e.message,stack:e.stack});}
}
