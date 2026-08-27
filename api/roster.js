// Vercel serverless function — returns the DFT creator roster from monday.com.
// Reads the Monday token server-side (MONDAY_API_KEY) so it is never exposed to the browser.
const BOARD = 18417663127;
const GROUPS = ["topics", "group_mm4av3kr", "group_mm4a1fe0", "group_mm4bd5tk"];
const PCOLS = ["numeric_mm49cx8f", "numeric_mm497vsg", "numeric_mm49rr3n", "numeric_mm49bb66", "text_mm4944gw", "text_mm49j2nf", "text_mm49s85f", "text_mm49w81b", "long_text_mm492hxg", "text_mm499xez", "text_mm5nmtz1", "text_mm5n7q86", "text_mm5n8zh3", "long_text_mm5n8f4t", "link_mm5n1zej", "numeric_mm5nn2wj", "long_text_mm5nw1s9", "text_mm5nkdfn", "text_mm5nb2t7", "text_mm5n6m90", "text_mm5n69hv", "text_mm5nbatb", "text_mm5n7syq", "text_mm5n5cc8", "text_mm5nzj3n", "text_mm5nsagz", "text_mm5n7ybc"];
const SCOLS = ["numeric_mm495xbb", "numeric_mm49tej8", "numeric_mm49fe4b", "text_mm49bb5z"];

// State / Region is NOT on the rates board. The rates board's own Location column
// (text_mm49s85f) is country-level — 99 of 132 rows read exactly "United States" —
// so the state cannot be split out of it. The value lives on Global Talent Roster
// (board 6160485039) in column dup__of_email (title "State"; the id is a leftover
// from a duplicated email column). We reach it through the single-valued board
// relation "Creator" that already exists on the rates board, then flatten the
// linked creator's State onto the row as a synthetic column value so the page can
// read it exactly like any other column. Adding CREATOR_STATE_COL to PCOLS would
// NOT work — that column is not on the board being fetched.
const REL_COL = "board_relation_mm49w1a4";   // "Creator" → board 6160485039, allowMultipleItems: false
const CREATOR_STATE_COL = "dup__of_email";   // "State" on 6160485039
const STATE_KEY = "__creator_state";         // synthetic column id emitted on each row

export default async function handler(req, res) {
  try {
    const token = process.env.MONDAY_API_KEY || process.env.MONDAY_API_TOKEN;
    if (!token) return res.status(500).json({ error: "MONDAY_API_KEY env var not set" });
    const p = PCOLS.concat([REL_COL]).map(x => '"' + x + '"').join(",");
    const s = SCOLS.map(x => '"' + x + '"').join(",");
    const g = GROUPS.map(x => '"' + x + '"').join(",");
    const rel = '... on BoardRelationValue{linked_items{id column_values(ids:["' + CREATOR_STATE_COL + '"]){text}}}';
    const query = "query{boards(ids:[" + BOARD + "]){groups(ids:[" + g + "]){id items_page(limit:120){items{id name column_values(ids:[" + p + "]){id text value " + rel + "} subitems{id name column_values(ids:[" + s + "]){id text}}}}}}}";
    const r = await fetch("https://api.monday.com/v2", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: token },
      body: JSON.stringify({ query })
    });
    const body = await r.json();
    if (body.errors) return res.status(502).json({ error: body.errors });

    // Replace the raw relation column with a flat { id: STATE_KEY, text } entry.
    // An unlinked row, or a linked creator with no State recorded, yields "" —
    // the page renders that as an empty cell. Never substitute a placeholder:
    // a blank correctly reads "not recorded", a filler value reads like a claim.
    const groups = (body.data && body.data.boards && body.data.boards[0] && body.data.boards[0].groups) || [];
    groups.forEach(grp => {
      const items = (grp.items_page && grp.items_page.items) || [];
      items.forEach(it => {
        const cvs = it.column_values || [];
        const relIdx = cvs.findIndex(c => c && c.id === REL_COL);
        let state = "";
        if (relIdx >= 0) {
          const linked = (cvs[relIdx].linked_items || [])[0];
          const lcv = linked && (linked.column_values || [])[0];
          state = (lcv && lcv.text) || "";
          cvs.splice(relIdx, 1);
        }
        cvs.push({ id: STATE_KEY, text: state, value: null });
      });
    });

    // The board is rewritten once a day by Shows View Guarantee Sync (08:30 UTC cron,
    // ~16 min run), so the data is static for ~23 hours out of 24. The query itself is
    // slow - 4 groups x 120 items x 27 columns, plus subitems, plus a per-row board
    // relation into the Global Talent Roster for State - and took 60-90s cold, which a
    // brand opening the link had to sit through. A long stale-while-revalidate means a
    // visitor is served instantly from cache and the refresh happens behind them; only
    // a link left untouched for a full day can still go cold.
    res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=86400");
    return res.status(200).json(groups);
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message || e) });
  }
}
