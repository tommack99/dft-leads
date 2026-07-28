// Vercel serverless function — returns the DFT creator roster from monday.com.
// Reads the Monday token server-side (MONDAY_API_KEY) so it is never exposed to the browser.
const BOARD = 18417663127;
const GROUPS = ["topics", "group_mm4av3kr", "group_mm4a1fe0", "group_mm4bd5tk"];
const PCOLS = ["numeric_mm49cx8f", "numeric_mm497vsg", "numeric_mm49rr3n", "numeric_mm49bb66", "text_mm4944gw", "text_mm49j2nf", "text_mm49s85f", "text_mm49w81b", "long_text_mm492hxg", "text_mm499xez", "text_mm5nmtz1", "text_mm5n7q86", "text_mm5n8zh3", "long_text_mm5n8f4t", "link_mm5n1zej", "numeric_mm5nn2wj", "long_text_mm5nw1s9", "text_mm5nkdfn", "text_mm5nb2t7", "text_mm5n6m90", "text_mm5n69hv", "text_mm5nbatb", "text_mm5n7syq", "text_mm5n5cc8", "text_mm5nzj3n", "text_mm5nsagz", "text_mm5n7ybc"];
const SCOLS = ["numeric_mm495xbb", "numeric_mm49tej8", "numeric_mm49fe4b", "text_mm49bb5z"];

export default async function handler(req, res) {
  try {
    const token = process.env.MONDAY_API_KEY || process.env.MONDAY_API_TOKEN;
    if (!token) return res.status(500).json({ error: "MONDAY_API_KEY env var not set" });
    const p = PCOLS.map(x => '"' + x + '"').join(",");
    const s = SCOLS.map(x => '"' + x + '"').join(",");
    const g = GROUPS.map(x => '"' + x + '"').join(",");
    const query = "query{boards(ids:[" + BOARD + "]){groups(ids:[" + g + "]){id items_page(limit:120){items{id name column_values(ids:[" + p + "]){id text value} subitems{id name column_values(ids:[" + s + "]){id text}}}}}}}";
    const r = await fetch("https://api.monday.com/v2", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: token },
      body: JSON.stringify({ query })
    });
    const body = await r.json();
    if (body.errors) return res.status(502).json({ error: body.errors });
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json(body.data.boards[0].groups);
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message || e) });
  }
}
