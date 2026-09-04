// SUBPLOT daily health check.
//
// The site already removes articles whose source video has gone, but silently - and a silent
// fix hides the upstream bug. This runs once a day, notices anything NEW that has gone missing
// since the last run, and raises a single row on the task queue so a pattern gets seen rather
// than quietly absorbed. Nothing is raised on a clean day.
//
// Manual run: /api/subplot?path=__health&dry=1
//
// Lives here rather than as its own /api file: the Vercel Hobby plan caps a deployment at 12
// serverless functions and the project is at the cap, so a thirteenth fails the whole build.

import { getData } from "./data.js";
import { readRecord, putRecord } from "./archive.js";

const KEY = "health-missing-videos";
const BOARD = 6932885261;                       // Business Development Tasks - the single queue

const monday = async (query, variables) => {
  const r = await fetch("https://api.monday.com/v2", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: process.env.MONDAY_API_KEY || "", "API-Version": "2024-10" },
    body: JSON.stringify({ query, variables }),
  });
  const j = await r.json();
  if (j.errors) throw new Error("monday: " + JSON.stringify(j.errors));
  return j.data;
};

export async function runHealth(req, res) {
  const dry = req.query.dry === "1";

  try {
    const data = await getData();                       // getData prunes; `removed` is what it dropped
    const removed = data.removed || [];
    const seen = (await readRecord(KEY))?.ids || [];
    const fresh = removed.filter(r => !seen.includes(r.id));

    const summary = {
      checked: data.arts.length + removed.length,
      missingNow: removed.length,
      newSinceLastRun: fresh.length,
      newlyMissing: fresh,
      allMissing: removed,
    };
    if (dry) return res.status(200).json({ dry: true, ...summary });

    if (fresh.length) {
      const when = new Date().toISOString().slice(0, 10);
      const lines = fresh.map(r => `- ${r.creator} - ${r.headline} (video ${r.id})`).join("\n");
      const d = await monday(
        `mutation($b:ID!,$n:String!){create_item(board_id:$b,item_name:$n){id}}`,
        { b: String(BOARD), n: `SUBPLOT: ${fresh.length} article${fresh.length === 1 ? "" : "s"} pulled - source video gone (${when})` });
      const itemId = d?.create_item?.id;
      if (itemId) {
        await monday(`mutation($i:ID!,$b:String!){create_update(item_id:$i,body:$b){id}}`, {
          i: String(itemId),
          b: `These articles were removed from subplot.tv because their YouTube video is no longer public (deleted, made private, or pulled):\n\n${lines}\n\nThe site handles this on its own - nothing is broken on subplot.tv. Raising it so the pattern is visible: if these are creators deleting their own videos that is routine, but if the pipeline is generating from videos that were already private, that is a source-side bug and there will be more.`,
        });
      }
      await putRecord(KEY, { ids: [...new Set([...seen, ...removed.map(r => r.id)])], lastRaised: when });
    } else if (removed.length !== seen.length) {
      await putRecord(KEY, { ids: removed.map(r => r.id) });
    }

    return res.status(200).json({ ...summary, raised: fresh.length > 0 });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
