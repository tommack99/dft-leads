export const config={maxDuration:300};
export default async function handler(req,res){
  try{
    const MON=process.env.MONDAY_API_KEY;
    const ANT=process.env.ANTHROPIC_API_KEY;
    if(!MON||!ANT)return res.status(500).json({error:"Missing env vars"});
    const CAM="6162879609";
    const REN="18415465266";
    const GRP="group_mm3tj6eh";
    // Only scan completed groups - no need to check status column
    const DONE_GROUPS=["duplicate_of_complete_and_paid","new_group__1","duplicate_of_uk_campaigns_acti","new_group51388__1"];
    const mHeaders={"Content-Type":"application/json","Authorization":MON};
    let items=[];
    for(const grpId of DONE_GROUPS){
      let cursor=null;
      do{
        // Subitems now carry live links in "LIVE LINKS NEW" (link_mm5dgdx9); legacy links
        // remain in "LIVE LINKS OLD" (file_mm1zd4v9) and are used as a fallback.
        const subCols='column_values(ids:[\\"numbers\\",\\"numeric_mm3vg42g\\",\\"numeric_mm3vrpfr\\",\\"timerange_mm1m50vx\\",\\"link_mm5dgdx9\\",\\"file_mm1zd4v9\\"]){id text value}';
        const q=cursor
          ?("{boards(ids:["+CAM+"]){groups(ids:[\""+grpId+"\"]){items_page(limit:50,cursor:"+JSON.stringify(cursor)+"){cursor items{id name column_values(ids:[\"date_mm1mcn87\",\"dropdown_mm1a3tqp\",\"date__1\"]){id text value}subitems{id name "+subCols+"}}}}}}}")
          :("{boards(ids:["+CAM+"]){groups(ids:[\""+grpId+"\"]){items_page(limit:50){cursor items{id name column_values(ids:[\"date_mm1mcn87\",\"dropdown_mm1a3tqp\",\"date__1\"]){id text value}subitems{id name "+subCols+"}}}}}}}");
        const r1=await fetch("https://api.monday.com/v2",{method:"POST",headers:mHeaders,body:JSON.stringify({query:q})});
        const d1=await r1.json();
        const page=d1&&d1.data&&d1.data.boards&&d1.data.boards[0]&&d1.data.boards[0].groups&&d1.data.boards[0].groups[0]&&d1.data.boards[0].groups[0].items_page;
        if(!page)break;
        items=items.concat(page.items||[]);
        cursor=page.cursor||null;
      }while(cursor);
    }
    const r2=await fetch("https://api.monday.com/v2",{method:"POST",headers:mHeaders,body:JSON.stringify({query:"{boards(ids:["+REN+"]){items_page(limit:500){items{name}}}}"})});
    const d2=await r2.json();
    const existing=new Set((d2&&d2.data&&d2.data.boards&&d2.data.boards[0]&&d2.data.boards[0].items_page&&d2.data.boards[0].items_page.items||[]).map(i=>i.name.toLowerCase()));
    const now=new Date();
    const toProcess=[];
    // Prefer LIVE LINKS NEW, fall back to LIVE LINKS OLD; return first YouTube URL.
    function firstUrl(sub,gs){
      const nw=gs("link_mm5dgdx9");
      const od=gs("file_mm1zd4v9");
      const src=/youtu/.test(nw||"")?nw:od;
      const m=(src||"").match(/https?:\/\/[^\s,]+/);
      return m?m[0]:"";
    }
    for(const item of items){
      const gc=id=>{const c=(item.column_values||[]).find(x=>x.id===id);return c?c.text||"":"";};
      // Get live date from Close Date (date__1) or Deal Creation Date as fallback
      const liveStr=gc("date__1")||gc("date_mm1mcn87");
      if(liveStr&&(now-new Date(liveStr))/(1000*60*60*24*7)<1)continue;
      const advertiser=gc("dropdown_mm1a3tqp")||item.name;
      for(const sub of(item.subitems||[])){
        const gs=id=>{const c=(sub.column_values||[]).find(x=>x.id===id);return c?c.text||"":"";};
        const cost=parseFloat(gs("numbers"))||0;
        if(!cost)continue;
        const creatorPrice=parseFloat(gs("numeric_mm3vg42g"))||0;
        const views=gs("numeric_mm3vrpfr")||"";
        const videoUrl=firstUrl(sub,gs);
        // Get live date from subitem timeline if available
        const subLiveRaw=gs("timerange_mm1m50vx");
        let subLiveStr=liveStr;
        if(subLiveRaw){try{const parsed=JSON.parse(sub.column_values.find(x=>x.id==="timerange_mm1m50vx").value||"{}");if(parsed.to)subLiveStr=parsed.to;}catch(e){}}
        const clientPrice=creatorPrice>0?creatorPrice:cost*1.3;
        const renewal=Math.round(clientPrice*0.5);
        const iname=(advertiser+" x "+sub.name).substring(0,50);
        if(existing.has(iname.toLowerCase()))continue;
        const vn=parseInt((views||"").replace(/,/g,""))||0;
        const ecpm=vn>0&&clientPrice>0?parseFloat(((clientPrice/vn)*1000).toFixed(2)):0;
        toProcess.push({advertiser,creator:sub.name,clientPrice,renewal,iname,views,vn,ecpm,videoUrl,liveStr:subLiveStr||""});
      }
    }
    let added=0;
    for(const p of toProcess){
      let draft="";
      try{
        const prompt="Short renewal email from Margot at Digital Fox Talent. Warm, under 150 words, no em dashes. Advertiser: "+p.advertiser+". Creator: "+p.creator+". Price: $"+Math.round(p.clientPrice)+". Renewal: $"+p.renewal+"."+(p.vn?" Views: "+p.views+". eCPM: $"+p.ecpm+".":"")+(p.videoUrl?" Reference video: "+p.videoUrl+".":"")+" Live: "+p.liveStr+". Pitch the repost. Table: Creator|Original|Renewal|Views|eCPM. Start: Hi [name],";
        const rc=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":ANT,"anthropic-version":"2023-06-01"},body:JSON.stringify({model:"claude-haiku-4-5-20251001",max_tokens:400,messages:[{role:"user",content:prompt}]})});
        const rd=await rc.json();
        draft=rd&&rd.content&&rd.content[0]&&rd.content[0].text||"";
      }catch(e){}
      const subject="Re: "+p.advertiser+" x "+p.creator+" - Renewal Opportunity";
      const fullDraft="SUBJECT: "+subject+" "+(draft||"[Please write manually]");
      const colsObj={text_mm3t6g60:p.advertiser,text_mm3tacsw:p.creator,numeric_mm3tqsff:Math.round(p.clientPrice),numeric_mm3t15r1:p.renewal,numeric_mm3tbpvz:p.vn,numeric_mm3ty8e:p.ecpm,date_mm3t55tj:{date:p.liveStr||"2025-01-01"},long_text_mm3tm4wc:{text:fullDraft}};
      // Source the campaign video link into the renewal "Video URL" column (link_mm3tzq3g).
      if(p.videoUrl)colsObj.link_mm3tzq3g={url:p.videoUrl,text:"Watch"};
      const cols2=JSON.stringify(colsObj);
      const rs=await fetch("https://api.monday.com/v2",{method:"POST",headers:mHeaders,body:JSON.stringify({query:"mutation{create_item(board_id:"+REN+",group_id:"+JSON.stringify(GRP)+",item_name:"+JSON.stringify(p.iname)+",column_values:"+JSON.stringify(cols2)+"){id}}"})});
      const rsd=await rs.json();
      if(rsd&&rsd.data&&rsd.data.create_item&&rsd.data.create_item.id){added++;existing.add(p.iname.toLowerCase());}
      await new Promise(r=>setTimeout(r,200));
    }
    return res.json({message:"Scan complete",scanned:items.length,found:toProcess.length,added});
  }catch(e){return res.status(200).json({error:e.message,stack:e.stack});}
}
