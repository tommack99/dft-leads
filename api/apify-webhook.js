        export const config={maxDuration:60};
export default async function handler(req,res){
                        res.setHeader('Access-Control-Allow-Origin','*');
                        if(req.method==='OPTIONS')return res.status(200).end();
                        if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
                        const MONDAY_API_KEY=process.env.MONDAY_API_KEY;
                        const APIFY_TOKEN=process.env.APIFY_TOKEN;
                        const BOARD_ID='18412906853';
                        const body=req.body;
                        const datasetId=body.resource&&body.resource.defaultDatasetId;
                        if(!datasetId)return res.status(400).json({error:'No datasetId'});
                        if(!APIFY_TOKEN)return res.status(500).json({error:'APIFY_TOKEN not set'});
                        if(!MONDAY_API_KEY)return res.status(500).json({error:'MONDAY_API_KEY not set'});
                        const dataRes=await fetch('https://api.apify.com/v2/datasets/'+datasetId+'/items?token='+APIFY_TOKEN+'&format=json');
                        if(!dataRes.ok)return res.status(500).json({error:'Failed to fetch dataset'});
                        const posts=await dataRes.json();
                        if(!posts||!posts.length)return res.status(200).json({message:'No posts'});
                        function detectSource(post){
                                                if(post.communityName||(post.dataType==='post'&&post.id&&post.id.startsWith('t3_')))return 'Reddit';
                                                return 'LinkedIn';
                        }
                        function getContact(text,source){
                                                if(!text)return source==='Reddit'?'Comment on Reddit':'DM on LinkedIn';
                                                var email=text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
                                                if(email)return 'Email: '+email[0];
                                                if(source==='Reddit')return 'Comment on Reddit post';
                                                if(/dm me|dm us|message me|inbox me/i.test(text))return 'DM on LinkedIn';
                                                if(/reach out|get in touch|contact me|email me|email us/i.test(text))return 'Reach out on LinkedIn';
                                                if(/apply|submit/i.test(text))return 'Apply via link in post';
                                                return 'DM on LinkedIn';
                        }
                        var saved=0;var skipped=0;
                        for(var i=0;i<posts.length;i++){
                                                var post=posts[i];
                                                var source=detectSource(post);
                                                var text,name,title,postUrl;
                                                if(source==='Reddit'){
                                                                                text=post.body||'';
                                                                                name=post.username||post.author||'Reddit User';
                                                                                title='r/'+(post.communityName||'reddit');
                                                                                postUrl=post.url||('https://reddit.com/'+(post.id||''));
                                                }else{
                                                                                text=post.text||post.content||post.description||'';
                                                                                name=post.author?(post.author.name||post.author.firstName||''):'Unknown';
                                                                                title=post.author?(post.author.headline||post.author.title||''):'';
                                                                                postUrl=post.url||post.linkedinUrl||'';
                                                }
                                                if(!name)name='Unknown';
                                                var contact=getContact(text,source);
                                                var colValues={
                                                                                text_mm39wj8z:name.substring(0,100),
                                                                                text_mm39q5ez:title.substring(0,200),
                                                                                color_mm3j286d:{label:source},
                                                                                long_text_mm39azh6:text.substring(0,500),
                                                                                link_mm39r70s:{url:postUrl,text:'View Post'},
                                                                                text_mm39nkvy:contact,
                                                                                date_mm39nc42:{date:new Date().toISOString().split('T')[0]}
                                                        };
                                                var mutation='mutation{create_item(board_id:'+BOARD_ID+',item_name:'+JSON.stringify(name.substring(0,50))+',column_values:'+JSON.stringify(JSON.stringify(colValues))+'){id}}';
                                                try{
                                                                                var mRes=await fetch('https://api.monday.com/v2',{
                                                                                                                        method:'POST',
                                                                                                                        headers:{'Content-Type':'application/json','Authorization':MONDAY_API_KEY},
                                                                                                                        body:JSON.stringify({query:mutation})
                                                                                        });
                                                                                var mData=await mRes.json();
                                                                                if(mData.data&&mData.data.create_item){saved++;}else{skipped++;}
                                                }catch(e){skipped++;}
                        }
                        return res.status(200).json({message:'Done',saved:saved,skipped:skipped,total:posts.length});
        }if(!MONDAY_API_KEY)return res.status(500).json({error:'MONDAY_API_KEY not set'});
        const dataRes=await fetch('https://api.apify.com/v2/datasets/'+datasetId+'/items?token='+APIFY_TOKEN+'&format=json');
        if(!dataRes.ok)return res.status(500).json({error:'Failed to fetch dataset'});
        const posts=await dataRes.json();
        if(!posts||!posts.length)return res.status(200).json({message:'No posts'});
        function isGenuineBrief(text){
                if(!text)return false;
                var t=text.toLowerCase();
                var hasOutreach=['dm me','dm us','message me','reach out','get in touch','contact me','email me','email us','apply','submit','inbox me'].some(function(k){return t.includes(k);});
                var hasBudget=['paid','budget','sponsored','fee','rate','compensation','payment','paying','we pay','commission'].some(function(k){return t.includes(k);});
                var hasCreator=['youtube creator','youtuber','youtube channel','youtube influencer'].some(function(k){return t.includes(k);});
                                return true; // keywords handle filtering
        }
        function getContact(text){
                if(!text)return 'DM on LinkedIn';
                var email=text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
                if(email)return 'Email: '+email[0];
                if(/dm me|dm us|message me|inbox me/i.test(text))return 'DM on LinkedIn';
                if(/reach out|get in touch|contact me|email me|email us/i.test(text))return 'Reach out on LinkedIn';
                if(/apply|submit/i.test(text))return 'Apply via link in post';
                return 'DM on LinkedIn';
        }
        async function push(post){
                try{
                        var fi=post.author?(post.author.info||''):'';
                        var co=fi.includes(' at ')?fi.split(' at ').pop():'';
                        var jt=fi.includes(' at ')?fi.split(' at ')[0]:fi;
                        var nm=post.author?(post.author.name||'Unknown'):'Unknown';
                        var pu=post.author?(post.author.linkedinUrl||''):'';
                        var po=post.linkedinUrl||'';
                        var ct=(post.content||'').substring(0,2000);
                        var sq=post.searchQuery&&post.searchQuery.term?post.searchQuery.term:'';
                        var cv={text_mm39wj8z:nm,text_mm39xss9:co,text_mm39q5ez:jt,long_text_mm39azh6:ct,text_mm39nkvy:getContact(post.content||''),text_mm3fkmwh:'LinkedIn - '+sq,date_mm39nc42:{date:new Date().toISOString().split('T')[0]}};
                        if(po)cv.link_mm39r70s={url:po,text:'View Post'};
                        if(pu)cv.link_mm394fyb={url:pu,text:nm};
                        var inm=nm+(co?' - '+co:'');
                        var mut='mutation { create_item(board_id: '+BOARD_ID+', item_name: '+JSON.stringify(inm)+', column_values: '+JSON.stringify(JSON.stringify(cv))+') { id } }';
                        var mr=await fetch('https://api.monday.com/v2',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+MONDAY_API_KEY,'API-Version':'2024-01'},body:JSON.stringify({query:mut})});
                        var md=await mr.json();
                        return !md.errors;
                }catch(e){return false;}
        }
        var pushed=0,skipped=0;
        for(var i=0;i<posts.length;i+=10){
                var batch=posts.slice(i,i+10).filter(function(p){if(!isGenuineBrief(p.content)){skipped++;return false;}return true;});
                if(batch.length){var r=await Promise.all(batch.map(push));pushed+=r.filter(Boolean).length;}
        }
        return res.status(200).json({message:'Done: '+pushed+' pushed, '+skipped+' skipped'});
}
