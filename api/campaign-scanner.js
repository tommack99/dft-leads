export const config={maxDuration:300};
export default async function handler(req,res){
  try{
    var MON=process.env.MONDAY_API_KEY;
    var ANT=process.env.ANTHROPIC_API_KEY;
    if(!MON||!ANT)return res.status(500).json({error:"Missing env vars"});
    var CAM="6162879609";
    var REN="18415465266";
    var GRP="group_mm3tj6eh";
    var DONE=["commission paid","complete","completed","done","live","invoiced"];
    var colIds='["deal_value","status","date4","text_mm1zsbnp"]';
    var scolIds='["numbers","text_mm3ta8gs","file_mm1zd4v9"]';
    var mHeaders={"Content-Type":"application/json","Authorization":MON};
    var items=[];
    var cursor=null;
    do{
      var q=cursor
        ?("{boards(ids:["+CAM+"]){items_page(limit:50,cursor:"+JSON.stringify(cursor)+"){cursor items{id name column_values(ids:"+colIds+"){id text value}subitems{id name column_values(ids:"+scolIds+"){id text value}}}}}}")
        :("{boards(ids:["+CAM+"]){items_page(limit:50){cursor items{id name column_values(ids:"+colIds+"){id text value}subitems{id name column_values(ids:"+scolIds+"){id text value}}}}}}");
      var r1=await fetch("https://api.monday.com/v2",{method:"POST",headers:mHeaders,body:JSON.stringify({query:q})});
      var d1=await r1.json();
      var page=d1&&d1.data&&d1.data.boards&&d1.data.boards[0]&&d1.data.boards[0].items_page;
      if(!page)break;
      items=items.concat(page.items||[]);
      cursor=page.cursor||null;
    }while(cursor);
    var r2=await fetch("https://api.monday.com/v2",{method:"POST",headers:mHeaders,body:JSON.stringify({query:"{boards(ids:["+REN+"]){items_page(limit:500){items{name}}}}"})});
    var d2=await r2.json();
    var existing=new Set((d2&&d2.data&&d2.data.boards&&d2.data.boards[0]&&d2.data.boards[0].items_page&&d2.data.boards[0].items_page.items||[]).map(function(i){return i.name.toLowerCase();}));
    var now=new Date();
    var toProcess=[];
    items.forEach(function(item){
      var gc=function(id){var c=(item.column_values||[]).find(function(x){return x.id===id;});return c?c.text||"";};
      if(!DONE.some(function(s){return gc("status").toLowerCase().includes(s);}))return;
      var liveStr=gc("date4");
      if(!liveStr||(now-new Date(liveStr))/(1000*60*60*24*7)<1)return;
      var advertiser=gc("text_mm1zsbnp")||item.name;
      (item.subitems||[]).forEach(function(sub){
        var gs=function(id){var c=(sub.column_values||[]).find(function(x){return x.id===id;});return c?c.text||"";};
        var cost=parseFloat(gs("numbers"))||0;
        if(!cost)return;
        var views=gs("text_mm3ta8gs")||"";
        var clientPrice=cost*1.3;
        var renewal=Math.round(clientPrice*0.5);
        var iname=(advertiser+" x "+sub.name).substring(0,50);
        if(existing.has(iname.toLowerCase()))return;
        var vn=parseInt((views||"").replace(/,/g,""))||0;
        var ecpm=vn>0?parseFloat(((clientPrice/vn)*1000).toFixed(2)):0;
        toProcess.push({advertiser:advertiser,creator:sub.name,clientPrice:clientPrice,renewal:renewal,iname:iname,views:views,vn:vn,ecpm:ecpm,liveStr:liveStr});
      });
    });
    var added=0;
    for(var i=0;i<toProcess.length;i++){
      var p=toProcess[i];
      var draft="";
      try{
        var prompt="Short renewal email from Margot at Digital Fox Talent. Warm, under 150 words, no em dashes. Advertiser: "+p.advertiser+". Creator: "+p.creator+". Price: $"+Math.round(p.clientPrice)+". Renewal: $"+p.renewal+"."+(p.vn?" Views: "+p.views+". eCPM: $"+p.ecpm+".":"")+" Live: "+p.liveStr+". Table: Creator|Original|Renewal|Views|eCPM. Start: Hi [name],";
        var rc=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":ANT,"anthropic-version":"2023-06-01"},body:JSON.stringify({model:"claude-haiku-4-5-20251001",max_tokens:400,messages:[{role:"user",content:prompt}]})});
        var rd=await rc.json();
        draft=rd&&rd.content&&rd.content[0]&&rd.content[0].text||"";
      }catch(e){}
      var subject="Re: "+p.advertiser+" x "+p.creator+" - Renewal Opportunity";
      var fullDraft="SUBJECT: "+subject+" "+(draft||"[Please write manually]");
      var cols=JSON.stringify({text_mm3t6g60:p.advertiser,text_mm3tacsw:p.creator,numeric_mm3tqsff:Math.round(p.clientPrice),numeric_mm3t15r1:p.renewal,numeric_mm3tbpvz:p.vn,numeric_mm3ty8e:p.ecpm,date_mm3t55tj:{date:p.liveStr},long_text_mm3tm4wc:{text:fullDraft}});
      var rs=await fetch("https://api.monday.com/v2",{method:"POST",headers:mHeaders,body:JSON.stringify({query:"mutation{create_item(board_id:"+REN+",group_id:"+JSON.stringify(GRP)+",item_name:"+JSON.stringify(p.iname)+",column_values:"+JSON.stringify(cols)+"){id}}"})});
      var rsd=await rs.json();
      if(rsd&&rsd.data&&rsd.data.create_item&&rsd.data.create_item.id){added++;existing.add(p.iname.toLowerCase());}
      await new Promise(function(r){setTimeout(r,200);});
    }
    return res.json({message:"Scan complete",scanned:items.length,found:toProcess.length,added:added});
  }catch(e){return res.status(200).json({error:e.message,stack:e.stack});}
}
