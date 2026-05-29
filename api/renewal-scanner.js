export const config={maxDuration:120};
export default async function handler(req,res){
  const MONDAY_API_KEY=process.env.MONDAY_API_KEY;
  const CAMPAIGNS_BOARD_ID="6162879609";
  const RENEWAL_BOARD_ID="18415465266";
  const RENEWAL_GROUP_ID="group_mm3tj6eh"; // Ready to Renew
  if(!MONDAY_API_KEY)return res.status(500).json({error:"Missing env vars"});

  // Statuses that indicate a completed campaign
  const COMPLETE_STATUSES=["commission paid","complete","completed","done","live","invoiced"];

  // Get all campaigns from the main board
  let allItems=[];
  let cursor=null;
  do{
    const q=cursor
      ?"{ boards(ids:["+CAMPAIGNS_BOARD_ID+"]){ items_page(limit:100,cursor:\""+cursor+"\"){ cursor items{ id name column_values(ids:[\"deal_value\",\"status\",\"date4\",\"text_mm1zsbnp\",\"connect_boards_mm1zna55\"]){ id text value } subitems{ id name column_values(ids:[\"numbers\",\"text_mm3ta8gs\",\"file_mm1zd4v9\"]){ id text value } } } } } }"
      :"{ boards(ids:["+CAMPAIGNS_BOARD_ID+"]){ items_page(limit:100){ cursor items{ id name column_values(ids:[\"deal_value\",\"status\",\"date4\",\"text_mm1zsbnp\",\"connect_boards_mm1zna55\"]){ id text value } subitems{ id name column_values(ids:[\"numbers\",\"text_mm3ta8gs\",\"file_mm1zd4v9\"]){ id text value } } } } } }";
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
  const skipped=[];

  for(const item of allItems){
    function getCol(id){const c=item.column_values.find(function(x){return x.id===id;});return c?c.text||"":"";}

    const status=getCol("status").toLowerCase();
    const isComplete=COMPLETE_STATUSES.some(function(s){return status.includes(s);});
    if(!isComplete)continue;

    // Check live date - must be at least 1 week ago
    const liveDateStr=getCol("date4");
    if(!liveDateStr)continue;
    const liveDate=new Date(liveDateStr);
    const weeksSinceLive=(today-liveDate)/(1000*60*60*24*7);
    if(weeksSinceLive<1)continue;

    const totalPrice=parseFloat(getCol("deal_value"))||0;
    const advertiser=getCol("text_mm1zsbnp")||item.name;
    const renewalKey=(item.name+" renewal").toLowerCase();
    if(existing.has(renewalKey))continue;

    // Process each subitem (creator) separately
    for(const sub of(item.subitems||[])){
      function getSubCol(id){const c=sub.column_values.find(function(x){return x.id===id;});return c?c.text||"":"";}
      const creatorCost=parseFloat(getSubCol("numbers"))||0;
      if(!creatorCost)continue;
      const creator=sub.name;
      const views=getSubCol("text_mm3ta8gs")||"";
      const videoUrl=getSubCol("file_mm1zd4v9")||"";
      const renewalOffer=Math.round(creatorCost*1.3*0.5); // 30% margin then 50% off
      const itemName=(advertiser+" x "+creator).substring(0,50);
      if(existing.has(itemName.toLowerCase()))continue;

      // Calculate eCPM if views available
      let ecpm="";
      const viewNum=parseInt((views||"").replace(/,/g,""));
      if(viewNum>0&&creatorCost>0){
        ecpm=((creatorCost*1.3/viewNum)*1000).toFixed(2);
      }

      const colVals=JSON.stringify({
        "text_mm3t6g60":advertiser,
        "text_mm3tacsw":creator,
        "numeric_mm3tqsff":creatorCost*1.3,
        "numeric_mm3t15r1":renewalOffer,
        "numeric_mm3tbpvz":viewNum||0,
        "numeric_mm3ty8e":ecpm?parseFloat(ecpm):0,
        "date_mm3t55tj":{"date":liveDateStr},
        "link_mm3tzq3g":videoUrl?{"url":videoUrl,"text":creator+" video"}:{"url":"","text":""},
      });

      try{
        const mutation="mutation{create_item(board_id:"+RENEWAL_BOARD_ID+",group_id:\""+RENEWAL_GROUP_ID+"\",item_name:"+JSON.stringify(itemName)+",column_values:"+JSON.stringify(colVals)+"){id}}";
        const saveRes=await fetch("https://api.monday.com/v2",{method:"POST",headers:{"Content-Type":"application/json","Authorization":MONDAY_API_KEY},body:JSON.stringify({query:mutation})});
        const saveData=await saveRes.json();
        if(saveData&&saveData.data&&saveData.data.create_item&&saveData.data.create_item.id)added++;
      }catch(e){skipped.push(itemName);}
      await new Promise(function(r){setTimeout(r,150);});
    }
  }

  return res.json({message:"Renewal scan complete",campaignsScanned:allItems.length,renewalsAdded:added,skipped});
}
