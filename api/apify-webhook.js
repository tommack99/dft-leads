export const config = { maxDuration: 60 };
export default async function handler(req, res) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        if (req.method === 'OPTIONS') return res.status(200).end();
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
        const MONDAY_API_KEY = process.env.MONDAY_API_KEY;
        const APIFY_TOKEN = process.env.APIFY_TOKEN;
        const BOARD_ID = '18412906853';
        const body = req.body;
        const datasetId = body.resource && body.resource.defaultDatasetId;
        if (!datasetId) return res.status(400).json({ error: 'No datasetId' });
        if (!APIFY_TOKEN) return res.status(500).json({ error: 'APIFY_TOKEN not set' });
        if (!MONDAY_API_KEY) return res.status(500).json({ error: 'MONDAY_API_KEY not set' });
        const dataRes = await fetch('https://api.apify.com/v2/datasets/' + datasetId + '/items?token=' + APIFY_TOKEN + '&format=json');
        if (!dataRes.ok) return res.status(500).json({ error: 'Failed to fetch dataset' });
        const posts = await dataRes.json();
        if (!posts || !posts.length) return res.status(200).json({ message: 'No posts' });
        const vm = { 'seeking youtube creators brand partnership':'Broad','hiring influencers sponsored content':'Broad','looking for content creators campaign':'Broad','youtube sponsorship opportunity apply':'Broad','ugc creators wanted brand deal':'Broad','influencer marketing campaign budget':'Broad','youtube gaming creators brand deal':'Gaming','seeking gaming influencers campaign':'Gaming','gaming youtubers sponsorship opportunity':'Gaming','pc gaming content creators wanted':'Gaming','film youtube creators partnership':'Movies / Film','movie campaign youtube influencers':'Movies / Film','anime sci-fi youtube influencers brand deal':'Movies / Film','streaming service content creators':'TV / Streaming','entertainment brand youtubers sponsorship':'TV / Streaming','hiring influencer marketing manager':'Job Signal','creator partnerships manager role':'Job Signal','youtube partnerships job':'Job Signal','influencer campaign manager hiring':'Job Signal','brand partnerships creator role':'Job Signal' };
        function getContact(text) {
                  if (!text) return 'DM on LinkedIn';
                  var e = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
                  if (e) return 'Email: ' + e[0];
                  if (/dm me|message me|inbox me/i.test(text)) return 'DM on LinkedIn';
                  if (/reach out|get in touch|contact me/i.test(text)) return 'Reach out on LinkedIn';
                  if (/apply|submit|form/i.test(text)) return 'Apply via link in post';
                  return 'DM on LinkedIn';
        }
        async function push(post) {
                  try {
                              var fi = post.author ? (post.author.info || '') : '';
                              var co = fi.includes(' at ') ? fi.split(' at ').pop() : '';
                              var jt = fi.includes(' at ') ? fi.split(' at ')[0] : fi;
                              var nm = post.author ? (post.author.name || 'Unknown') : 'Unknown';
                              var pu = post.author ? (post.author.linkedinUrl || '') : '';
                              var po = post.linkedinUrl || '';
                              var ct = (post.content || '').substring(0, 2000);
                              var sq = post.searchQuery && post.searchQuery.term ? post.searchQuery.term : '';
                              var vt = vm[sq.toLowerCase()] || 'Broad';
                              var ss = vt + (sq ? ' - ' + sq : '');
                              var cv = { text_mm39wj8z: nm, text_mm39xss9: co, text_mm39q5ez: jt, long_text_mm39azh6: ct, text_mm39nkvy: getContact(post.content || ''), text_mm3fkmwh: ss, date_mm39nc42: { date: new Date().toISOString().split('T')[0] } };
                              if (po) cv.link_mm39r70s = { url: po, text: 'View Post' };
                              if (pu) cv.link_mm394fyb = { url: pu, text: nm };
                              var in_ = nm + (co ? ' - ' + co : '');
                              var mut = 'mutation { create_item(board_id: ' + BOARD_ID + ', item_name: ' + JSON.stringify(in_) + ', column_values: ' + JSON.stringify(JSON.stringify(cv)) + ') { id } }';
                              var mr = await fetch('https://api.monday.com/v2', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + MONDAY_API_KEY, 'API-Version': '2024-01' }, body: JSON.stringify({ query: mut }) });
                              var md = await mr.json();
                              return !md.errors;
                  } catch(e) { return false; }
        }
        var pushed = 0;
        for (var i = 0; i < posts.length; i += 10) {
                  var r = await Promise.all(posts.slice(i, i + 10).map(push));
                  pushed += r.filter(Boolean).length;
        }
        return res.status(200).json({ message: 'Done: ' + pushed + ' of ' + posts.length + ' pushed' });
}
