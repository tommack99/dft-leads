export const config={maxDuration:300};
export default async function handler(req,res){
  var MON=process.env.MONDAY_API_KEY;
  var ANT=process.env.ANTHROPIC_API_KEY;
  if(!MON||!ANT)return res.status(500).json({error:"Missing env vars"});
  var CAM="6162879609";
  var REN="18415465266";
  var GRP="group_mm3tj6eh";
  var DONE=["commission paid","complete","completed","done","live","invoiced"];
  var colIds='["deal_value","status","date4","text_mm1zsbnp"]';
  var scolIds='["numbers","text_mm3ta8gs","file_mm1zd4v9"]';

  async function mon(q){
    var r=await fetch("https://api.monday.com/v2",{method:"POST",headers:{"Content-Type":"application/json","Authorization":MON},body:JSON.stringify({query:q})});
    return r.json();
  }

  var items=[];
  var cursor=null;
  do{
    var q=cursor
      ?("{boards(ids:["+CAM+"]){items_page(limit:50,cursor:"+JSON.stringify(cursor)+"){cursor items{id name column_values(ids:"+colIds+"){id text value}subitems{id name column_values(ids:"+scolIds+"){id text value}}}}}}")
      :("{boards(ids:["+CAM+"]){items_page(limit:50){cursor items{id name column_values(ids:"+colIds+"){id text value}subitems{id name column_values(ids:"+scolIds+"){id text value}}}}}}");
    var d=await mon(q);
    var page=d&&d.data&&d.data.boards&&d.data.boards[0]&&d.data.boards[0].items_page;
    if(!page)break;
    items=items.concat(page.items||[]);
    cursor=page.cursor||null;
  }while(cursor);

  var ed=await mon("{boards(ids:["+REN+"]){items_page(limit:500){items{name}}}}");
  var existing=new Set((ed&&ed.data&&ed.data.boards&&ed.data.boards[0]&&ed.data.boards[0].items_page&&ed.data.boards[0].items_page.items||[]).map(function(i){return i.name.toLowerCase();}));
  var now=new Date();
  var added=0;

  for(var i=0;i<items.length;i++){
    var item=items[i];
    var gc=function(cols,id){var c=(cols||[]).find(function(x){return x.id===id;});return c?c.text||"";};
    var status=gc(item.column_values,"status").toLowerCase();
    if(!DONE.some(function(s){return status.includes(s);}))continue;
    var liveStr=gc(item.column_values,"date4");
    if(!liveStr||(now-new Date(liveStr))/(1000*60*60*24*7)<1)continue;
    var advertiser=gc(item.column_values,"text_mm1zsbnp")||item.name;
    var subs=item.subitems||[];
    for(var j=0;j<subs.length;j++){
      var sub=subs[j];
      var cost=parseFloat(gc(sub.column_values,"numbers"))||0;
      if(!cost)continue;
      var views=gc(sub.column_values,"text_mm3ta8gs")||"";
      var clientPrice=cost*1.3;
      var renewal=Math.round(clientPrice*0.5);
      var iname=(advertiser+" x "+sub.name).substring(0,50);
      if(existing.has(iname.toLowerCase()))continue;
      var vn=parseInt((views||"").replace(/,/g,""))||0;
      var ecpm=vn>0?parseFloat(((clientPrice/vn)*1000).toFixed(2)):0;
      var draft="";
      try{
        var prompt="Draft a short renewal email from Margot at Digital Fox Talent to a brand. Warm, friendly, under 150 words, no em dashes. Advertiser: "+advertiser+". Creator: "+sub.name+". Client price: $"+Math.round(clientPrice)+". Renewal (50% off): $"+renewal+"."+(vn?" Views: "+views+". eCPM: $"+ecpm+".":"")+" Live: "+liveStr+". Pitch the repost. Table: Creator|Original|Renewal|Views|eCPM. Start: Hi [name],";
        var cr=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":ANT,"anthropic-version":"2023-06-01"},body:JSON.stringify({model:"claude-haiku-4-5-20251001",max_tokens:400,messages:[{role:"user",content:prompt}]})});
        var cd=await cr.json();
        draft=cd&&cd.content&&cd.content[0]&&cd.content[0].text||"";
      }catch(e){}
      var subject="Re: "+advertiser+" x "+sub.name+" - Renewal Opportunity";
      var fullDraft="SUBJECT: "+subject+"\n\n"+(draft||"[Please write manually]");
      var cols=JSON.stringify({text_mm3t6g60:advertiser,text_mm3tacsw:sub.name,numeric_mm3tqsff:Math.round(clientPrice),numeric_mm3t15r1:renewal,numeric_mm3tbpvz:vn,numeric_mm3ty8e:ecpm,date_mm3t55tj:{date:liveStr},long_text_mm3tm4wc:{text:fullDraft}});
      try{
        var sr=await mon("mutation{create_item(board_id:"+REN+",group_id:"+JSON.stringify(GRP)+",item_name:"+JSON.stringify(iname)+",column_values:"+JSON.stringify(cols)+"){id}}");
        if(sr&&sr.data&&sr.data.create_item&&sr.data.create_item.id)added++;
      }catch(e){}
      await new Promise(function(r){setTimeout(r,200);});
    }
  }
  return res.json({message:"Scan complete",scanned:items.length,added:added});
}
