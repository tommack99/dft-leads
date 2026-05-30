export const config={maxDuration:120};
export default async function handler(req,res){
  const YOUTUBE_API_KEY=process.env.YOUTUBE_API_KEY;
  const MONDAY_API_KEY=process.env.MONDAY_API_KEY;
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

  return res.json({
    message:"View count sync complete",
    subitemsScanned:allSubitems.length,
    withYouTubeLinks:toUpdate.length,
    updated,
    errors,
    videos:toUpdate.map(function(t){return{name:t.name,videoIds:t.videoIds};})
  });
}
