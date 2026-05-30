export const config={maxDuration:120};
export default async function handler(req,res){
  const YOUTUBE_API_KEY=process.env.YOUTUBE_API_KEY;
  const MONDAY_API_KEY=process.env.MONDAY_API_KEY;
  const ANTHROPIC_API_KEY=process.env.ANTHROPIC_API_KEY;
  const SUBITEMS_BOARD_ID="6162879732";
  if(!YOUTUBE_API_KEY||!MONDAY_API_KEY)return res.status(500).json({error:"Missing env vars"});

  // Fetch all subitems that have a Live Links value (file_mm1zd4v9)
  let allSubitems=[];
  let cursor=null;
  do{
    const q=cursor
      ?'{ boards(ids:['+SUBITEMS_BOARD_ID+']){ items_page(limit:100,cursor:"'+cursor+'"){ cursor items{ id name column_values(ids:["file_mm1zd4v9","text_mm3ta8gs"]){ id text value } } } } }'
      :'{ boards(ids:['+SUBITEMS_BOARD_ID+']){ items_page(limit:100){ cursor items{ id name column_values(ids:["file_mm1zd4v9","text_mm3ta8gs"]){ id text value } } } } }';
    const r=await fetch("https://api.monday.com/v2",{method:"POST",headers:{"Content-Type":"application/json","Authorization":MONDAY_API_KEY},body:JSON.stringify({query:q})});
    const d=await r.json();
    const page=d&&d.data&&d.data.boards&&d.data.boards[0]&&d.data.boards[0].items_page;
    if(!page)break;
    allSubitems=allSubitems.concat(page.items||[]);
    cursor=page.cursor||null;
  }while(cursor);

  // Filter to subitems that have a YouTube URL in Live Links
  function extractVideoIds(text){
    if(!text)return [];
    const matches=[...text.matchAll(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/g)];
    const ids=[...new Set(matches.map(function(m){return m[1];}))];
    return ids;
  }

  const toUpdate=[];
  for(const item of allSubitems){
    const liveLinksCol=item.column_values.find(function(c){return c.id==="file_mm1zd4v9";});
    const viewCountCol=item.column_values.find(function(c){return c.id==="text_mm3ta8gs";});
    const linkText=liveLinksCol&&(liveLinksCol.text||"");
    const videoIds=extractVideoIds(linkText);
    if(videoIds.length){
      toUpdate.push({itemId:item.id,name:item.name,videoIds,currentViews:viewCountCol&&viewCountCol.text||""});
    }
  }

  if(!toUpdate.length)return res.json({message:"No subitems with YouTube links found",total:allSubitems.length});

  // Fetch view counts from YouTube in batches of 50
  let updated=0;
  let errors=0;
  const BATCH=50;
  for(let i=0;i<toUpdate.length;i+=BATCH){
    const batch=toUpdate.slice(i,i+BATCH);
    const allIds=[...new Set(batch.flatMap(function(b){return b.videoIds;}))].join(",");
    try{
      const ytRes=await fetch("https://www.googleapis.com/youtube/v3/videos?part=statistics&id="+allIds+"&key="+YOUTUBE_API_KEY);
      const ytData=await ytRes.json();
      const statsMap={};
      for(const v of(ytData.items||[])){
        statsMap[v.id]=parseInt(v.statistics&&v.statistics.viewCount||0);
      }
      // Write view counts back to Monday - sum all video views per subitem
      for(const item of batch){
        const totalViews=item.videoIds.reduce(function(sum,id){return sum+(statsMap[id]||0);},0);
        if(totalViews===0)continue;
        const views=totalViews;
        const viewStr=totalViews.toLocaleString("en-US");
        try{
          await fetch("https://api.monday.com/v2",{method:"POST",headers:{"Content-Type":"application/json","Authorization":MONDAY_API_KEY},body:JSON.stringify({query:"mutation{change_column_value(board_id:"+SUBITEMS_BOARD_ID+",item_id:"+item.itemId+",column_id:\"text_mm3ta8gs\",value:"+JSON.stringify(JSON.stringify(viewStr))+"){id}}"})});
          updated++;
          await new Promise(function(r){setTimeout(r,100);});
        }catch(e){errors++;}
      }
    }catch(e){errors+=batch.length;}
  }

  // RENEWAL SCAN - find completed campaigns 1+ week old and add to Renewal Pipeline
  try{
    var CAM="6162879609";
    var REN="18415465266";
    var GRP="group_mm3tj6eh";
    var DONE=["commission paid","complete","completed","done","live","invoiced"];
    var colIds='["deal_value","status","date4","text_mm1zsbnp"]';
    var scolIds='["numbers","text_mm3ta8gs","file_mm1zd4v9"]';
    var campItems=[];
    var campCursor=null;
    do{
      var cq=campCursor
        ?("{boards(ids:["+CAM+"]){items_page(limit:50,cursor:"+JSON.stringify(campCursor)+"){cursor items{id name column_values(ids:"+colIds+"){id text value}subitems{id name column_values(ids:"+scolIds+"){id text value}}}}}}")
        :("{boards(ids:["+CAM+"]){items_page(limit:50){cursor items{id name column_values(ids:"+colIds+"){id text value}subitems{id name column_values(ids:"+scolIds+"){id text value}}}}}}");
      var cr2=await fetch("https://api.monday.com/v2",{method:"POST",headers:{"Content-Type":"application/json","Authorization":MONDAY_API_KEY},body:JSON.stringify({query:cq})});
      var cd2=await cr2.json();
      var cp=cd2&&cd2.data&&cd2.data.boards&&cd2.data.boards[0]&&cd2.data.boards[0].items_page;
      if(!cp)break;
      campItems=campItems.concat(cp.items||[]);
      campCursor=cp.cursor||null;
    }while(campCursor);
    var er=await fetch("https://api.monday.com/v2",{method:"POST",headers:{"Content-Type":"application/json","Authorization":MONDAY_API_KEY},body:JSON.stringify({query:"{boards(ids:["+REN+"]){items_page(limit:500){items{name}}}}"})});
    var ed=await er.json();
    var existing=new Set((ed&&ed.data&&ed.data.boards&&ed.data.boards[0]&&ed.data.boards[0].items_page&&ed.data.boards[0].items_page.items||[]).map(function(i){return i.name.toLowerCase();}));
    var nowDate=new Date();
    var renewAdded=0;
    for(var ri=0;ri<campItems.length;ri++){
      var ritem=campItems[ri];
      var rgc=function(cols,id){var c=(cols||[]).find(function(x){return x.id===id;});return c?c.text||"";};
      var rstatus=rgc(ritem.column_values,"status").toLowerCase();
      if(!DONE.some(function(s){return rstatus.includes(s);}))continue;
      var liveStr=rgc(ritem.column_values,"date4");
      if(!liveStr||(nowDate-new Date(liveStr))/(1000*60*60*24*7)<1)continue;
      var advertiser=rgc(ritem.column_values,"text_mm1zsbnp")||ritem.name;
      var rsubs=ritem.subitems||[];
      for(var rj=0;rj<rsubs.length;rj++){
        var rsub=rsubs[rj];
        var rcost=parseFloat(rgc(rsub.column_values,"numbers"))||0;
        if(!rcost)continue;
        var rviews=rgc(rsub.column_values,"text_mm3ta8gs")||"";
        var clientPrice=rcost*1.3;
        var renewal=Math.round(clientPrice*0.5);
        var iname=(advertiser+" x "+rsub.name).substring(0,50);
        if(existing.has(iname.toLowerCase()))continue;
        var vn=parseInt((rviews||"").replace(/,/g,""))||0;
        var ecpm=vn>0?parseFloat(((clientPrice/vn)*1000).toFixed(2)):0;
        var rdraft="";
        try{
          var rprompt="Draft a short renewal email from Margot at Digital Fox Talent to a brand. Warm, friendly, under 150 words, no em dashes. Advertiser: "+advertiser+". Creator: "+rsub.name+". Client price: $"+Math.round(clientPrice)+". Renewal: $"+renewal+"."+(vn?" Views: "+rviews+". eCPM: $"+ecpm+".":"")+" Live: "+liveStr+". Pitch the repost. Table: Creator|Original|Renewal|Views|eCPM. Start: Hi [name],";
          var rcr=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":ANTHROPIC_API_KEY,"anthropic-version":"2023-06-01"},body:JSON.stringify({model:"claude-haiku-4-5-20251001",max_tokens:400,messages:[{role:"user",content:rprompt}]})});
          var rcd=await rcr.json();
          rdraft=rcd&&rcd.content&&rcd.content[0]&&rcd.content[0].text||"";
        }catch(e){}
        var rsubject="Re: "+advertiser+" x "+rsub.name+" - Renewal Opportunity";
        var rfullDraft="SUBJECT: "+rsubject+"\n\n"+(rdraft||"[Please write manually]");
        var rcols=JSON.stringify({text_mm3t6g60:advertiser,text_mm3tacsw:rsub.name,numeric_mm3tqsff:Math.round(clientPrice),numeric_mm3t15r1:renewal,numeric_mm3tbpvz:vn,numeric_mm3ty8e:ecpm,date_mm3t55tj:{date:liveStr},long_text_mm3tm4wc:{text:rfullDraft}});
        try{
          var rsr=await fetch("https://api.monday.com/v2",{method:"POST",headers:{"Content-Type":"application/json","Authorization":MONDAY_API_KEY},body:JSON.stringify({query:"mutation{create_item(board_id:"+REN+",group_id:"+JSON.stringify(GRP)+",item_name:"+JSON.stringify(iname)+",column_values:"+JSON.stringify(rcols)+"){id}}"})});
          var rsd=await rsr.json();
          if(rsd&&rsd.data&&rsd.data.create_item&&rsd.data.create_item.id){renewAdded++;existing.add(iname.toLowerCase());}
        }catch(e){}
        await new Promise(function(r){setTimeout(r,150);});
      }
    }
  }catch(e){}

  return res.json({
    message:"View count sync complete",
    subitemsScanned:allSubitems.length,
    withYouTubeLinks:toUpdate.length,
    updated,
    errors,
    videos:toUpdate.map(function(t){return{name:t.name,videoIds:t.videoIds};})
  });
}
