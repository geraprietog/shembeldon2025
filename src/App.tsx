import React, { useEffect, useMemo, useState } from "react";
import seed from "./seed.json";

/** ====== Config ====== */
// Cambia este PIN por el tuyo
const ADMIN_PIN = "1051";
const LS_RESULTS = "shembeldon_v1_results";
const LS_ADMIN = "shemb_admin";
/** ==================== */

type SetScore = { p1: number; p2: number };
type MatchResult = {
  id: string; week: number; p1: string; p2: string;
  sets: SetScore[]; winner?: "p1" | "p2";
};
type Fixture = { id: string; week: number; p1: string; p2: string; date?: string };
type Seed = { players: string[]; fixtures: Fixture[] };

const NEON = {
  cyan: "var(--cyan)",
  pink: "var(--pink)",
  lime: "var(--lime)",
  border: "var(--border)",
};

function loadSaved(): Record<string, MatchResult> {
  try {
    return JSON.parse(localStorage.getItem(LS_RESULTS) || "{}");
  } catch {
    return {};
  }
}
function saveAll(map: Record<string, MatchResult>) {
  localStorage.setItem(LS_RESULTS, JSON.stringify(map));
}

function computeWinner(sets: SetScore[]): "p1" | "p2" | undefined {
  let p1 = 0,
    p2 = 0;
  const played = sets.filter((s) => Number.isFinite(s.p1) && Number.isFinite(s.p2));
  for (const s of played) {
    if (s.p1 > s.p2) p1++;
    else if (s.p2 > s.p1) p2++;
    if (p1 === 2) return "p1";
    if (p2 === 2) return "p2";
  }
  if (played.length === 2 && p1 === 1 && p2 === 1) return undefined;
  if (played.length === 3) return p1 > p2 ? "p1" : "p2";
  return undefined;
}

function Tab({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className={`s-tab ${active ? "is-active" : ""}`}>
      {label}
    </button>
  );
}

type TabKey = "Schedule" | "Submit Result" | "Standings" | "Data";

export default function App() {
  const initial: Seed = (seed as any) ?? { players: [], fixtures: [] };

  const [tab, setTab] = useState<TabKey>("Schedule");
  const [saved, setSaved] = useState<Record<string, MatchResult>>(() => loadSaved());
  const [isAdmin, setIsAdmin] = useState<boolean>(() => localStorage.getItem(LS_ADMIN) === "1");

  useEffect(() => saveAll(saved), [saved]);

  // Atajo: Shift + D -> activar admin (pide PIN si no está activo)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.shiftKey && (e.key === "D" || e.key === "d")) {
        if (isAdmin) {
          localStorage.setItem(LS_ADMIN, "0");
          setIsAdmin(false);
        } else {
          const pin = prompt("Enter admin PIN:");
          if (pin === ADMIN_PIN) {
            localStorage.setItem(LS_ADMIN, "1");
            setIsAdmin(true);
            alert("Admin enabled");
          } else {
            alert("Incorrect PIN");
          }
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isAdmin]);

  const players = useMemo(() => {
    const s = new Set(initial.players || []);
    (initial.fixtures || []).forEach((f) => {
      s.add(f.p1);
      s.add(f.p2);
    });
    return Array.from(s);
  }, [initial]);

  const weeks = useMemo(() => {
    const s = new Set<number>();
    (initial.fixtures || []).forEach((f) => s.add(f.week));
    return Array.from(s).sort((a, b) => a - b);
  }, [initial]);

  const standings = useMemo(() => {
    const map = new Map<
      string,
      { wins: number; losses: number; setsWon: number; setsLost: number }
    >();
    players.forEach((p) => map.set(p, { wins: 0, losses: 0, setsWon: 0, setsLost: 0 }));
    Object.values(saved).forEach((m) => {
      if (!m.winner) return;
      let p1 = 0,
        p2 = 0;
      m.sets.forEach((s) => {
        if (s.p1 > s.p2) p1++;
        else if (s.p2 > s.p1) p2++;
      });
      const r1 = map.get(m.p1)!;
      const r2 = map.get(m.p2)!;
      r1.setsWon += p1;
      r1.setsLost += p2;
      r2.setsWon += p2;
      r2.setsLost += p1;
      if (m.winner === "p1") {
        r1.wins++;
        r2.losses++;
      } else {
        r2.wins++;
        r1.losses++;
      }
    });
    return Array.from(map.entries())
      .map(([name, r]) => ({ name, ...r, diff: r.setsWon - r.setsLost }))
      .sort((a, b) => b.wins - a.wins || b.diff - a.diff || a.name.localeCompare(b.name));
  }, [players, saved]);

  // Submit Result state
  const [weekSel, setWeekSel] = useState<number>(() => weeks[0] ?? 1);
  const matchesThisWeek = (initial.fixtures || []).filter((f) => f.week === weekSel);
  const [matchSel, setMatchSel] = useState<string>(() => matchesThisWeek[0]?.id ?? "");
  useEffect(() => {
    if (!matchesThisWeek.find((m) => m.id === matchSel) && matchesThisWeek[0])
      setMatchSel(matchesThisWeek[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekSel]);
  const active = (initial.fixtures || []).find((x) => x.id === matchSel);
  const currentSaved = active ? saved[active.id] : undefined;
  const [sets, setSets] = useState<SetScore[]>(
    () => currentSaved?.sets ?? [{ p1: 0, p2: 0 }, { p1: 0, p2: 0 }, { p1: 0, p2: 0 }]
  );
  useEffect(() => {
    if (active) {
      setSets(saved[active.id]?.sets ?? [
        { p1: 0, p2: 0 },
        { p1: 0, p2: 0 },
        { p1: 0, p2: 0 },
      ]);
    }
  }, [matchSel]); // eslint-disable-line

  function submit() {
    if (!active) return;
    const winner = computeWinner(sets);
    if (!winner) {
      alert("Best-of-3: two straight sets OR a 3rd set if it's 1–1.");
      return;
    }
    setSaved((prev) => ({
      ...prev,
      [active.id]: { id: active.id, week: active.week, p1: active.p1, p2: active.p2, sets, winner },
    }));
    alert(`Saved! Winner: ${winner === "p1" ? active.p1 : active.p2}`);
  }

  /* ---------- Subviews ---------- */
  function ScheduleTab() {
    if (!initial.fixtures?.length)
      return <div className="s-card">No fixtures yet. Load them in the Data tab.</div>;
    return (
      <div style={{ display: "grid", gap: 12 }}>
        {weeks.map((w) => (
          <div key={w} className="s-card">
            <div
              style={{
                fontWeight: 800,
                marginBottom: 8,
                color: NEON.cyan,
                textShadow: `0 0 10px ${NEON.cyan}66`,
              }}
            >
              Week {w}
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {initial.fixtures
                .filter((f) => f.week === w)
                .map((f) => {
                  const res = saved[f.id];
                  const label = res ? ` — Winner: ${res.winner === "p1" ? f.p1 : f.p2}` : "";
                  return (
                    <div
                      key={f.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        border: `1px solid ${NEON.border}`,
                        borderRadius: 10,
                        padding: "10px 12px",
                      }}
                    >
                      <div>
                        <b>{f.p1}</b> vs <b>{f.p2}</b>{" "}
                        {f.date ? <span style={{ color: "var(--sub)" }}> — {f.date}</span> : null}
                        <span style={{ color: "var(--lime)" }}>{label}</span>
                      </div>
                      <div style={{ color: "var(--sub)", fontSize: 12 }}>ID: {f.id}</div>
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  function SubmitTab() {
    if (!active) return <div className="s-card">No matches in week {weekSel}.</div>;
    return (
      <div className="s-card" style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8, alignItems: "center" }}>
          <div style={{ color: "var(--sub)" }}>Week</div>
          <select value={weekSel} onChange={(e) => setWeekSel(Number(e.target.value))} className="s-select">
            {weeks.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
          <div style={{ color: "var(--sub)" }}>Match</div>
          <select value={matchSel} onChange={(e) => setMatchSel(e.target.value)} className="s-select">
            {matchesThisWeek.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id}
              </option>
            ))}
          </select>
        </div>

        {[0, 1, 2].map((i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 70px 70px", gap: 8, alignItems: "center" }}>
            <div>Set {i + 1}</div>
            <input
              type="number"
              min={0}
              value={sets[i]?.p1 ?? 0}
              onChange={(e) => {
                const v = Number(e.target.value);
                const s = [...sets];
                s[i] = { ...s[i], p1: v };
                setSets(s);
              }}
              className="s-num"
            />
            <input
              type="number"
              min={0}
              value={sets[i]?.p2 ?? 0}
              onChange={(e) => {
                const v = Number(e.target.value);
                const s = [...sets];
                s[i] = { ...s[i], p2: v };
                setSets(s);
              }}
              className="s-num"
            />
          </div>
        ))}

        <div style={{ color: "var(--sub)" }}>
          Current winner:{" "}
          <b style={{ color: "var(--lime)" }}>
            {computeWinner(sets) === "p1"
              ? active.p1
              : computeWinner(sets) === "p2"
              ? active.p2
              : "—"}
          </b>
        </div>

        <button onClick={submit} className="s-btn-pink">
          Save Result
        </button>
        {currentSaved && (
          <div style={{ color: "var(--sub)" }}>
            Last saved: <b>{currentSaved.winner === "p1" ? active.p1 : active.p2}</b> •{" "}
            {currentSaved.sets.map((s) => `${s.p1}-${s.p2}`).join(", ")}
          </div>
        )}
      </div>
    );
  }

  function StandingsTab() {
    if (!players.length) return <div className="s-card">No players yet.</div>;
    return (
      <div className="s-card">
        <table className="table" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["#", "Player", "W", "L", "Sets +", "Sets −", "Diff"].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
        <tbody>
            {standings.map((r, i) => (
              <tr key={r.name}>
                <td>{i + 1}</td>
                <td style={{ fontWeight: 700 }}>{r.name}</td>
                <td>{r.wins}</td>
                <td>{r.losses}</td>
                <td>{r.setsWon}</td>
                <td>{r.setsLost}</td>
                <td>{r.diff}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 8, color: "var(--sub)", fontSize: 12 }}>
          Tiebreak: Wins → Set Differential → Name (A–Z)
        </div>
      </div>
    );
  }

  function DataTab() {
    return (
      <div className="s-card" style={{ display: "grid", gap: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>Loaded players</div>
        <div style={{ color: "var(--sub)" }}>
          {players.length ? players.join(", ") : "—"}
        </div>
        <div>
          <button
            onClick={() => {
              if (confirm("Clear ALL saved results?")) setSaved({});
            }}
            className="s-btn-pink"
          >
            Clear Results (localStorage)
          </button>
        </div>
        <div style={{ color: "var(--sub)" }}>
          Edit <code>src/seed.json</code> to change players/fixtures.
        </div>
      </div>
    );
  }

  /* ---------- Layout ---------- */
  return (
    <div className="s-wrap">
      {/* Fondo difuminado + silueta */}
      <div className="hero-bg" aria-hidden="true" />
      <div className="silhouette" />
      {/* <div className="silhouette silhouette--left" /> */}

      {/* HERO */}
<div className="hero">
  <div>
    <h1 className="hero-title">
      <span style={{ color: "var(--pink)" }}>Shembeldon</span>{" "}
      <span style={{ color: "var(--cyan)" }}>Singles</span>{" "}
      <span style={{ color: "var(--lime)" }}>Championship</span>
    </h1>

    <div className="hero-sub">
      Best-of-3: two straight sets wins; if it’s 1–1 after two, play a 3rd set to decide.
    </div>

    {/* Línea en neón */}
    <div className="hero-subline">TENNIS • SCHEDULE</div>
  </div>

  <div className="hero-actions">
    <button
      className="lock-btn"
      onClick={() => {
        if (isAdmin) {
          if (confirm("Disable admin mode?")) {
            localStorage.setItem(LS_ADMIN, "0");
            setIsAdmin(false);
          }
          return;
        }
        const pin = prompt("Enter admin PIN:");
        if (pin === ADMIN_PIN) {
          localStorage.setItem(LS_ADMIN, "1");
          setIsAdmin(true);
          alert("Admin enabled");
        } else {
          alert("Incorrect PIN");
        }
      }}
      title={isAdmin ? "Disable admin" : "Enable admin"}
    >
      {isAdmin ? "🔓 Admin" : "🔒 Admin"}
    </button>
    <span className="lock-ind">(Press Shift+D)</span>
  </div>
</div>

      {/* TABS */}
      <div style={{ display: "flex", gap: 8, margin: "18px 0 16px" }}>
        <Tab label="Schedule" active={tab === "Schedule"} onClick={() => setTab("Schedule")} />
        <Tab
          label="Submit Result"
          active={tab === "Submit Result"}
          onClick={() => setTab("Submit Result")}
        />
        <Tab
          label="Standings"
          active={tab === "Standings"}
          onClick={() => setTab("Standings")}
        />
        {isAdmin && <Tab label="Data" active={tab === "Data"} onClick={() => setTab("Data")} />}
      </div>

      {/* CONTENIDO */}
      <div style={{ maxWidth: 860, display: "grid", gap: 14 }}>
        {tab === "Schedule" && <ScheduleTab />}
        {tab === "Submit Result" && <SubmitTab />}
        {tab === "Standings" && <StandingsTab />}
        {isAdmin && tab === "Data" && <DataTab />}
      </div>
    </div>
  );
}