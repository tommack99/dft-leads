// Second home for the revenue statements.
//
// monday is where finance WORKS the numbers; this is an independent, append-only archive of
// what Google actually said, so a statement can be reconstructed even if a board row is edited,
// moved or deleted. It lives in its own PRIVATE Apify key-value store - deliberately not the
// article store, which is public-read and shared with the MSN pipeline.
//
// Records are write-once. A month that already exists is never overwritten.

const API = "https://api.apify.com/v2/key-value-stores";
const STORE_NAME = "subplot-revenue";
const tok = () => process.env.APIFY_TOKEN || "";

let storeId = null;

// Apify returns the existing store when the name matches, so this is get-or-create.
async function store() {
  if (storeId) return storeId;
  if (!tok()) throw new Error("APIFY_TOKEN missing - cannot archive revenue");
  const r = await fetch(`${API}?name=${STORE_NAME}&token=${tok()}`, { method: "POST" });
  const j = await r.json();
  if (!r.ok || !j.data?.id) throw new Error("archive store: " + (j.error?.message || r.status));
  storeId = j.data.id;
  return storeId;
}

export const monthKey = label => `revenue-${label}`;          // revenue-2026-08

export async function readMonth(label) {
  const id = await store();
  const r = await fetch(`${API}/${id}/records/${monthKey(label)}?token=${tok()}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error("archive read: " + r.status);
  return r.json();
}

export async function listMonths() {
  const id = await store();
  const r = await fetch(`${API}/${id}/keys?limit=1000&token=${tok()}`);
  if (!r.ok) throw new Error("archive keys: " + r.status);
  const j = await r.json();
  return (j.data?.items || []).map(i => i.key).filter(k => k.startsWith("revenue-"))
    .map(k => k.slice(8)).sort().reverse();
}

// Write-once. Returns "archived" or "already-archived"; never silently replaces a record.
export async function archiveMonth(label, payload) {
  if (await readMonth(label)) return "already-archived";
  const id = await store();
  const r = await fetch(`${API}/${id}/records/${monthKey(label)}?token=${tok()}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, archivedAt: new Date().toISOString() }),
  });
  if (!r.ok) throw new Error("archive write: " + r.status);
  return "archived";
}
