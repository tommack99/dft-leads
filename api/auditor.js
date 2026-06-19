export const config = { maxDuration: 60 };

// Inbound Lead Monitoring board
const BOARD = "18412906853";
const QUALITY_COL = "color_mm4523qw";  // Lead Quality (status)
const NOTES_COL = "long_text_mm40h0fj";// Auditor Notes (lead type + one-line reason)
const POST_COL = "long_text_mm39azh6"; // Post Content

const QUALITIES = ["Strong", "Marginal", "Reject: Job ad", "Reject: Wrong side", "Reject: Discussion", "Reject: Unpaid/Gig", "Reject: Vague/Dup"];

const TIME_BUDGET_MS = 45000; // return cleanly under the 60s function limit
const MAX_COLLECT = 150;
const RECENT_DAYS = 14; // audit only leads from the last N days; keeps the cron current and skips the historical pre-auditor backlog
const BATCH = 20;

async function mon(MON, query, variables) {
  const r = await fetch("https://api.monday.com/v2", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": MON },
    body: JSON.stringify({ query, variables: variables || {} })
  });
  return r.json();
}

function buildPrompt(batch) {
  const list = batch.map((it, i) => (i + 1) + ". NAME: " + it.name + "\nPOST: " + (it.text || "").substring(0, 400)).join("\n\n---\n\n");
  return "You are auditing LinkedIn/Reddit posts for Digital Fox Talent (DFT), a YouTube creator talent agency that manages gaming, entertainment and pop-culture creators and books them for PAID brand sponsorships. DFT wants posts from BRANDS or BUYERS looking to hire or book creators, or to engage an agency/talent manager, ideally in the US, UK, Canada, Australia or New Zealand, with a paid budget.\n\nFor each post return one object with:\n- \"i\": the item number\n- \"quality\": EXACTLY one of \"Strong\", \"Marginal\", \"Reject: Job ad\", \"Reject: Wrong side\", \"Reject: Discussion\", \"Reject: Unpaid/Gig\", \"Reject: Vague/Dup\"\n- \"type\": EXACTLY one of \"Buyer intent\", \"Job ad\", \"Competitor / Agency\", \"Self-promo / Freelancer\", \"Unpaid / Gig\", \"Commentary / News\", \"Unclear\"\n- \"reason\": max 10 words\n\nRules:\n- \"Strong\": a brand/buyer with a budget, or explicitly seeking an agency/talent manager to book creators.\n- \"Marginal\": a brand/buyer seeking creators or influencers for paid work, but weaker fit or fewer signals.\n- \"Reject: Job ad\": hiring a permanent or contract employee, or 'apply with your CV/resume'.\n- \"Reject: Wrong side\": recruiting creators INTO their own agency/roster, a UGC/creator-recruitment call, or a creator/freelancer self-promoting.\n- \"Reject: Unpaid/Gig\": unpaid, affiliate-only, commission-only, or no real budget.\n- \"Reject: Discussion\": commentary, opinion, news, event recap or general discussion.\n- \"Reject: Vague/Dup\": too vague to action, or a duplicate.\n- If quality is \"Strong\" or \"Marginal\", then \"type\" MUST be \"Buyer intent\". Otherwise pick the matching reject type.\n\nRespond ONLY with a valid JSON array, no prose and no markdown fences:\n[{\"i\":1,\"quality\":\"...\",\"type\":\"...\",\"reason\":\"...\"}]\n\nPosts:\n" + list;
}

async function classify(ANT, batch) {
  const cr = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANT, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 4000, messages: [{ role: "user", content: buildPrompt(batch) }] })
  });
  const cd = await cr.json();
  const text = (cd && cd.content && cd.content[0] && cd.content[0].text) || "[]";
  const clean = text.replace(/```json|```/g, "").trim();
  try { return JSON.parse(clean); }
  catch (e) {
    const cut = clean.lastIndexOf("}");
    if (cut > 0) { try { return JSON.parse(clean.substring(0, cut + 1) + "]"); } catch (e2) {} }
    return [];
  }
}

export default async function handler(req, res) {
  const MON = process.env.MONDAY_API_KEY;
  const ANT = process.env.ANTHROPIC_API_KEY;
  if (!MON || !ANT) return res.status(500).json({ error: "Missing env vars" });
  const t0 = Date.now();

  // PHASE 1 - collect newest unclassified leads (Auditor Notes empty), newest first
  const cutoff = new Date(Date.now() - RECENT_DAYS * 86400000).toISOString().slice(0, 10);
  const rules = '{rules:[{column_id:"' + NOTES_COL + '", compare_value:[""], operator:is_empty},{column_id:"date_mm39nc42", compare_value:["EXACT","' + cutoff + '"], operator:greater_than}], order_by:[{column_id:"date_mm39nc42", direction:desc}]}';
  let todo = [], cursor = null;
  while (todo.length < MAX_COLLECT) {
    let page;
    if (!cursor) {
      const q = "{boards(ids:[" + BOARD + "]){items_page(limit:100, query_params:" + rules + "){cursor items{id name}}}}";
      const d = await mon(MON, q);
      page = d && d.data && d.data.boards && d.data.boards[0] && d.data.boards[0].items_page;
    } else {
      const q = "query($c:String!){next_items_page(limit:100,cursor:$c){cursor items{id name}}}";
      const d = await mon(MON, q, { c: cursor });
      page = d && d.data && d.data.next_items_page;
    }
    if (!page) break;
    for (const it of (page.items || [])) { todo.push({ id: it.id, name: it.name }); if (todo.length >= MAX_COLLECT) break; }
    cursor = page.cursor;
    if (!cursor) break;
  }

  todo.sort((a, b) => Number(b.id) - Number(a.id)); // newest-first by id (monday ignores order_by here)
  if (!todo.length) return res.json({ message: "Auditor complete - nothing to classify", scored: 0 });

  // PHASE 2 - classify + write Lead Quality + Auditor Notes, time-bounded (checked between AND within batches)
  let scored = 0, failed = 0, processed = 0;
  outer:
  for (let start = 0; start < todo.length; start += BATCH) {
    if (Date.now() - t0 > TIME_BUDGET_MS) break;
    const chunk = todo.slice(start, start + BATCH);
    const ids = chunk.map(c => c.id).join(",");
    const td = await mon(MON, "{items(ids:[" + ids + "]){id name column_values(ids:[\"" + POST_COL + "\"]){id text}}}");
    const fetched = (td && td.data && td.data.items) || [];
    const batch = chunk.map(c => {
      const f = fetched.find(x => x.id === c.id);
      const p = f && f.column_values.find(cv => cv.id === POST_COL);
      return { id: c.id, name: c.name, text: p ? p.text : "" };
    });
    let results;
    try { results = await classify(ANT, batch); } catch (e) { failed++; continue; }
    for (let i = 0; i < batch.length; i++) {
      if (Date.now() - t0 > TIME_BUDGET_MS) break outer;
      processed++;
      const r = results.find(x => x && x.i === i + 1) || results[i];
      if (!r) continue;
      let quality = QUALITIES.indexOf(r.quality) >= 0 ? r.quality : "Reject: Vague/Dup";
      const isReject = quality.indexOf("Reject") === 0;
      let type = (typeof r.type === "string" && r.type) ? r.type : "Unclear";
      if (!isReject) type = "Buyer intent";
      else if (type === "Buyer intent") type = "Unclear";
      let reason = (typeof r.reason === "string" ? r.reason : "").replace(/[\r\n"\\]/g, " ").trim().substring(0, 120);
      const note = reason ? (type + " - " + reason) : type;
      const cv = { [QUALITY_COL]: { label: quality }, [NOTES_COL]: { text: note } };
      try {
        await mon(MON, "mutation($cv:JSON!){change_multiple_column_values(board_id:" + BOARD + ",item_id:" + batch[i].id + ",column_values:$cv){id}}", { cv: JSON.stringify(cv) });
        scored++;
      } catch (e) {}
    }
  }
  return res.json({ message: "Auditor complete", collected: todo.length, processed, scored, failed, ms: Date.now() - t0 });
}
