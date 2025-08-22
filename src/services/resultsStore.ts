// src/services/resultsStore.ts
import { createClient } from "@supabase/supabase-js";

export type SetScore = { p1: number; p2: number };

export type RemoteResult = {
  match_id: string; // p.ej. "W1-Reid-Gerardo" (PRIMARY KEY)
  week: number;
  p1: string;
  p2: string;
  sets: SetScore[];
  winner: "p1" | "p2" | null;
  updated_at?: string;
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnon) {
  throw new Error(
    "[resultsStore] Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY"
  );
}

const supabase = createClient(supabaseUrl, supabaseAnon);

/**
 * Trae todos los resultados como un mapa { match_id: RemoteResult }
 */
export async function fetchAllResults(): Promise<Record<string, RemoteResult>> {
  const { data, error } = await supabase
    .from("results")
    .select("match_id, week, p1, p2, sets, winner, updated_at")
    .order("updated_at", { ascending: true });

  if (error) {
    console.error("[resultsStore] fetchAllResults error:", error);
    return {};
  }

  const map: Record<string, RemoteResult> = {};
  for (const r of data ?? []) map[r.match_id] = r as RemoteResult;
  return map;
}

/**
 * Inserta/actualiza un resultado.
 */
export async function upsertResult(r: RemoteResult): Promise<void> {
  const { error } = await supabase.from("results").upsert({
    match_id: r.match_id,
    week: r.week,
    p1: r.p1,
    p2: r.p2,
    sets: r.sets,
    winner: r.winner,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error("[resultsStore] upsertResult error:", error);
    throw error;
  }
}

/**
 * Borra TODOS los resultados (cuidado).
 */
export async function wipeAllResults(): Promise<void> {
  const { error } = await supabase.from("results").delete().neq("match_id", "");
  if (error) {
    console.error("[resultsStore] wipeAllResults error:", error);
    throw error;
  }
}
