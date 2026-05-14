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
    function isRelevant(text) {
          if (!text) return false;
          var t = text.toLowerCase();
          var hasCreator = ['creator', 'youtuber', 'influencer', 'youtube channel', 'ugc', 'content creator'].some(function(k) { return t.includes(k); });
          var hasHiring = ['looking for', 'seeking', 'hiring', 'wanted', 'need a', 'searching for', 'opportunity', 'open to', 'accepting applications', 'reach out', 'dm me', 'message me', 'get in touch', 'apply'].some(function(k) { return t.includes(k); });
          return hasCreator && hasHiring;
    }
    function getContact(text) {
          if (!text) return 'DM on LinkedIn';
          var email = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
          if (email) return 'Email: ' + email[0];
          if (/dm me|message me|inbox me/i.test(text)) return 'DM on LinkedIn';
          if (/reach out|get in touch|contact me/i.test(text)) return 'Reach out on LinkedIn';
          if (/apply|submit|form/i.test(text)) return 'Apply via link in post';
          return 'DM on LinkedIn';
    }
    var pushed = 0;
    var skipped = 0;
    for (var i = 0; i < posts.length; i++) {
          var post = posts[i];
          var content = post.content || '';
          if (!isRelevant(content)) { skipped++; continue; }
          try {
                  var fullInfo = post.author ? (post.author.info || '') : '';
                  var company = fullInfo.includes(' at ') ? fullInfo.split(' at ').pop() : '';
                  var jobTitle = fullInfo.includes(' at ') ? fullInfo.split(' at ')[0] : fullInfo;
                  var name = post.author ? (post.author.name || 'Unknown') : 'Unknown';
                  var profileUrl = post.author ? (post.author.linkedinUrl || '') : '';
                  var postUrl = post.linkedinUrl || '';
                  var cv = {
                            text_mm39wj8z: name,
                            text_mm39xss9: company,
                            text_mm39q5ez: jobTitle,
                            long_text_mm39azh6: content.substring(0, 2000),
                            text_mm39nkvy: getContact(content),
                            color_mm39vjy1: { label: 'Not Sent' },
                            date_mm39nc42: { date: new Date().toISOString().split('T')[0] }
                  };
                  if (postUrl) cv.link_mm39r70s = { url: postUrl, text: 'View Post' };
                  if (profileUrl) cv.link_mm394fyb = { url: profileUrl, text: name };
                  var itemName = name + (company ? ' - ' + company : '');
                  var mutation = 'mutation { create_item(board_id: ' + BOARD_ID + ', item_name: ' + JSON.stringify(itemName) + ', column_values: ' + JSON.stringify(JSON.stringify(cv)) + ') { id } }';
                  var mr = await fetch('https://api.monday.com/v2', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + MONDAY_API_KEY, 'API-Version': '2024-01' },
                            body: JSON.stringify({ query: mutation })
                  });
                  var md = await mr.json();
                  if (!md.errors) pushed++;
          } catch(e) {}
    }
    return res.status(200).json({ message: 'Done: ' + pushed + ' pushed, ' + skipped + ' skipped' });
}
