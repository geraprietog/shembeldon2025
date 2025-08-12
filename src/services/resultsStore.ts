// src/services/resultsStore.ts
const API_URL = import.meta.env.VITE_API_URL || "";

export async function upsertResult(
  week: number,
  matchId: string,
  scores: number[][]
) {
  const res = await fetch(`${API_URL}/results`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ week, matchId, scores }),
  });
  if (!res.ok) {
    throw new Error(`Error saving result: ${res.statusText}`);
  }
  return res.json();
}

export async function wipeAllResults() {
  const res = await fetch(`${API_URL}/results`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(`Error deleting results: ${res.statusText}`);
  }
  return res.json();
}
