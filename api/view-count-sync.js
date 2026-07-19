export const config={maxDuration:120};
export default async function handler(req,res){
  const YOUTUBE_API_KEY=process.env.YOUTUBE_API_KEY;
  const MONDAY_API_KEY=process.env.MONDAY_API_KEY;
  const SUBITEMS_BOARD_ID="6162879732";
  if(!YOUTUBE_API_KEY||!MONDAY_API_KEY)return res.status(500).json({error:"Missing env vars"});

  // Fetch all subitems that have a Live Links value.
  // Links now live in "LIVE LINKS NEW" (link_mm5dgdx9); we still read the legacy
  // "LIVE LINKS OLD" (file_mm1zd4v9) as a fallback for campaigns not yet migrated.
  let allSubitems=[];
  let cursor=null;
  do{
    const q=cursor
      ?'{ boards(ids: ['+SUBITEMS_BOARD_ID+']){ items_page(limit:100,cursor:"'+cursor+'"){ cursor items{ id name column_values(ids:["link_mm5dgdx9","file_mm1zd4v9","numeric_mm3vg42g"]){ id text value } } } } }'
      :'{ boards(ids: ['+SUBITEMS_BOARD_ID+']){ items_page(limit:100){ cursor items{ id name column_values(ids:["link_mm5dgdx9","file_mm1zd4v9","numeric_mm3vg42g"]){ id text value } } } } }';
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
    const ids=[...new Set(matches.map(m=>m[1]))];
    return ids;
  }

  const toUpdate=[];
  for(const item of allSubitems){
    const newLinksCol=item.column_values.find(c=>c.id==="link_mm5dgdx9");
    const oldLinksCol=item.column_values.find(c=>c.id==="file_mm1zd4v9");
    const priceCol=item.column_values.find(c=>c.id==="numeric_mm3vg42g");
    const newText=(newLinksCol&&newLinksCol.text)||"";
    const oldText=(oldLinksCol&&oldLinksCol.text)||"";
    // Prefer LIVE LINKS NEW; fall back to LIVE LINKS OLD for legacy rows.
    const linkText=extractVideoIds(newText).length?newText:oldText;
    const videoIds=extractVideoIds(linkText);
    const creatorPrice=priceCol&&priceCol.text?parseFloat(priceCol.text)||0:0;
    if(videoIds.length){
      toUpdate.push({itemId:item.id,name:item.name,videoIds,creatorPrice});
    }
  }

  if(!toUpdate.length)return res.json({message:"View count sync complete",found:0,updated:0});

  // Fetch all unique video IDs from YouTube in batches of 50
  const allVideoIds=[...new Set(toUpdate.flatMap(t=>t.videoIds))];
  const statsMap={};
  for(let i=0;i<allVideoIds.length;i+=50){
    const batch=allVideoIds.slice(i,i+50);
    const ytRes=await fetch("https://www.googleapis.com/youtube/v3/videos?part=statistics&id="+batch.join(",")+"&key="+YOUTUBE_API_KEY);
    const ytData=await ytRes.json();
    for(const v of(ytData.items||[])){
      statsMap[v.id]=parseInt(v.statistics&&v.statistics.viewCount||0);
    }
  }

  // Write view counts and CPM back to Monday
  let updated=0;
  for(const item of toUpdate){
    const totalViews=item.videoIds.reduce((sum,id)=>sum+(statsMap[id]||0),0);
    if(totalViews===0)continue;
    const cpm=item.creatorPrice>0?parseFloat(((item.creatorPrice/totalViews)*1000).toFixed(2)):null;
    const colValues={numeric_mm3vrpfr:totalViews};
    if(cpm!==null)colValues.numeric_mm1m53kk=cpm;
    try{
      const mut=await fetch("https://api.monday.com/v2",{method:"POST",headers:{"Content-Type":"application/json","Authorization":MONDAY_API_KEY},body:JSON.stringify({query:"mutation{change_multiple_column_values(board_id:"+SUBITEMS_BOARD_ID+",item_id:"+item.itemId+",column_values:"+JSON.stringify(JSON.stringify(colValues))+"){id}}"})});
      const md=await mut.json();
      if(md&&md.data&&md.data.change_multiple_column_values)updated++;
    }catch(e){}
    await new Promise(r=>setTimeout(r,100));
  }

  return res.json({message:"View count sync complete",found:toUpdate.length,updated,videos:toUpdate.map(t=>({name:t.name,videoIds:t.videoIds,creatorPrice:t.creatorPrice}))});
}
