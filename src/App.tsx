import React, { useEffect, useMemo, useState } from "react";
import seed from "./seed.json";
import { upsertResult, wipeAllResults } from "./services/resultsStore";
import "./theme.css";

/** ====== Config ====== */
const ADMIN_PIN = "1051";
const LS_ADMIN = "shemb_admin";
const POLL_MS = 5000; // refresco automático cada 5s
/** ==================== */

type SetScore = RSetScore;
type MatchResult = {
  id: string;
  week: number;
  p1: string;
  p2: string;
  sets: SetScore[];
  winner?: "p1" | "p2";
};
type Fixture = {
  id: string;
  week: number;
  p1: string;
  p2: string;
  date?: string;
};
type Seed = { players: string[]; fixtures: Fixture[] };

const NEON = {
  cyan: "var(--cyan)",
  pink: "var(--pink)",
  lime: "var(--lime)",
  border: "var(--border)",
};

function computeWinner(sets: SetScore[]): "p1" | "p2" | undefined {
  let p1 = 0,
    p2 = 0;
  const played = sets.filter(
    (s) => Number.isFinite(s.p1) && Number.isFinite(s.p2)
  );
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
  const [saved, setSaved] = useState<Record<string, MatchResult>>({});
  const [isAdmin, setIsAdmin] = useState<boolean>(
    () => localStorage.getItem(LS_ADMIN) === "1"
  );

  // Cargar y refrescar datos del servidor con polling
  useEffect(() => {
    let mounted = true;
    let timer: number | undefined;

    async function loadData() {
      const remote = await fetchAllResults();
      if (!mounted) return;
      setSaved(
        Object.fromEntries(
          Object.entries(remote).map(([k, r]) => [
            k,
            {
              id: r.match_id,
              week: r.week,
              p1: r.p1,
              p2: r.p2,
              sets: r.sets,
              winner: (r.winner ?? undefined) as "p1" | "p2" | undefined,
            },
          ])
        )
      );
    }

    loadData(); // carga inicial
    timer = window.setInterval(loadData, POLL_MS);
    return () => {
      mounted = false;
      if (timer) window.clearInterval(timer);
    };
  }, []);

  // Atajo: Shift + D -> activar/desactivar admin
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
    players.forEach((p) =>
      map.set(p, { wins: 0, losses: 0, setsWon: 0, setsLost: 0 })
    );
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
      .sort(
        (a, b) =>
          b.wins - a.wins || b.diff - a.diff || a.name.localeCompare(b.name)
      );
  }, [players, saved]);

  // Submit Result state
  const [weekSel, setWeekSel] = useState<number>(() => weeks[0] ?? 1);
  const matchesThisWeek = (initial.fixtures || []).filter(
    (f) => f.week === weekSel
  );
  const [matchSel, setMatchSel] = useState<string>(
    () => matchesThisWeek[0]?.id ?? ""
  );
  useEffect(() => {
    if (!matchesThisWeek.find((m) => m.id === matchSel) && matchesThisWeek[0]) {
      setMatchSel(matchesThisWeek[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekSel, weeks.length, initial.fixtures?.length]);

  const active = (initial.fixtures || []).find((x) => x.id === matchSel);
  const currentSaved = active ? saved[active.id] : undefined;

  const [sets, setSets] = useState<SetScore[]>(
    () =>
      currentSaved?.sets ?? [
        { p1: 0, p2: 0 },
        { p1: 0, p2: 0 },
        { p1: 0, p2: 0 },
      ]
  );
  // ⚠️ Importante: NO depender de `saved` para no pisar lo que escribe el usuario
  useEffect(() => {
    if (!active) return;
    setSets(
      saved[active.id]?.sets ?? [
        { p1: 0, p2: 0 },
        { p1: 0, p2: 0 },
        { p1: 0, p2: 0 },
      ]
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchSel]);

  async function submit() {
    if (!active) return;
    const winner = computeWinner(sets);
    if (!winner) {
      alert("Best-of-3: two straight sets OR a 3rd set if it's 1–1.");
      return;
    }
    await upsertResult({
      match_id: active.id,
      week: active.week,
      p1: active.p1,
      p2: active.p2,
      sets,
      winner,
    });
  }

  /* ---------- Subviews ---------- */
  function ScheduleTab() {
    if (!initial.fixtures?.length)
      return (
        <div className="s-card">
          No fixtures yet. Load them in the Data tab.
        </div>
      );

    return (
      <div style={{ display: "grid", gap: 12 }}>
        {weeks.map((w) => (
          <div key={w} className="s-card">
            <div className="week-title">Week {w}</div>

            <div style={{ display: "grid", gap: 10 }}>
              {initial.fixtures
                .filter((f) => f.week === w)
                .map((f) => {
                  const res = saved[f.id];
                  const scoreLine =
                    res && res.sets.length > 0
                      ? res.sets
                          .map((s) => `${s?.p1 ?? "—"}-${s?.p2 ?? "—"}`)
                          .join(", ")
                      : "—, —, —";
                  const winnerLabel = res?.winner
                    ? `Winner: ${res.winner === "p1" ? f.p1 : f.p2}`
                    : "";

                  const isComplete = Boolean(res?.winner);

                  return (
                    <div
                      key={f.id}
                      className={`match-card ${
                        isComplete ? "is-complete" : "is-pending"
                      }`}
                    >
                      {/* Izquierda: jugadores + fecha */}
                      <div className="match-left">
                        <div className="players">
                          <b>{f.p1}</b> <span className="vs">vs</span>{" "}
                          <b>{f.p2}</b>
                        </div>
                        {f.date ? <div className="date">{f.date}</div> : null}
                        {winnerLabel && (
                          <div className="badge winner-badge">
                            {winnerLabel}
                          </div>
                        )}
                      </div>

                      {/* Derecha: marcador */}
                      <div className="match-right">
                        <span className="badge score-badge">{scoreLine}</span>
                      </div>
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
    if (!active)
      return <div className="s-card">No matches in week {weekSel}.</div>;
    return (
      <div className="s-card" style={{ display: "grid", gap: 14 }}>
        <div className="grid-2">
          <label className="label">Week</label>
          <select
            value={weekSel}
            onChange={(e) => setWeekSel(Number(e.target.value))}
            className="s-select"
          >
            {weeks.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>

          <label className="label">Match</label>
          <select
            value={matchSel}
            onChange={(e) => setMatchSel(e.target.value)}
            className="s-select"
          >
            {matchesThisWeek.map((m) => (
              <option key={m.id} value={m.id}>
                {m.p1} vs {m.p2}
              </option>
            ))}
          </select>
        </div>

        {[0, 1, 2].map((i) => (
          <div key={i} className="set-row">
            <div className="set-label">Set {i + 1}</div>
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
              inputMode="numeric"
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
              inputMode="numeric"
            />
          </div>
        ))}

        <div className="current-winner">
          Current winner:{" "}
          <b className="winner-name">
            {computeWinner(sets) === "p1"
              ? active.p1
              : computeWinner(sets) === "p2"
              ? active.p2
              : "—"}
          </b>
        </div>

        <button onClick={submit} className="btn btn-primary">
          Save Result
        </button>
        {currentSaved && (
          <div className="last-saved">
            Last saved:{" "}
            <b>{currentSaved.winner === "p1" ? active.p1 : active.p2}</b> •{" "}
            {currentSaved.sets.map((s) => `${s.p1}-${s.p2}`).join(", ")}
          </div>
        )}
      </div>
    );
  }

  function StandingsTable() {
    return (
      <table className="table standings-table">
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
              <td>
                {i + 1} {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : ""}
              </td>
              <td className="player-name-cell">{r.name}</td>
              <td>{r.wins}</td>
              <td>{r.losses}</td>
              <td>{r.setsWon}</td>
              <td>{r.setsLost}</td>
              <td className={r.diff > 0 ? "pos" : r.diff < 0 ? "neg" : ""}>
                {r.diff}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  function StandingsCards() {
    return (
      <div className="standings-cards">
        {standings.map((r, i) => (
          <div className="standings-card" key={r.name}>
            <div className="rank">
              #{i + 1} {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : ""}
            </div>
            <div className="name">{r.name}</div>
            <div className="row">
              <span>W</span>
              <b>{r.wins}</b>
              <span>L</span>
              <b>{r.losses}</b>
              <span>Diff</span>
              <b className={r.diff > 0 ? "pos" : r.diff < 0 ? "neg" : ""}>
                {r.diff}
              </b>
            </div>
            <div className="row small">
              <span>Sets +</span>
              <b>{r.setsWon}</b>
              <span>Sets −</span>
              <b>{r.setsLost}</b>
            </div>
          </div>
        ))}
      </div>
    );
  }

  function StandingsTab() {
    if (!players.length) return <div className="s-card">No players yet.</div>;
    return (
      <div className="s-card">
        {/* Desktop table */}
        <div className="desktop-only">
          <StandingsTable />
        </div>
        {/* Mobile cards */}
        <div className="mobile-only">
          <StandingsCards />
        </div>
        <div className="tiebreak-note">
          Tiebreak: Wins → Set Differential → Name (A–Z)
        </div>
      </div>
    );
  }

  function DataTab() {
    return (
      <div className="s-card" style={{ display: "grid", gap: 12 }}>
        <div className="section-title">Loaded players</div>
        <div className="muted">{players.length ? players.join(", ") : "—"}</div>
        <div>
          <button
            onClick={async () => {
              if (!confirm("Clear ALL saved results?")) return;
              const ok = await wipeAllResults();
              if (ok !== false) {
                setSaved({});
                alert("All results cleared.");
              } else {
                alert("Could not clear results. Check console/policies.");
              }
            }}
            className="btn btn-danger"
          >
            Clear Results (server)
          </button>
        </div>
        <div className="muted">
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

      {/* HERO */}
      <div className="hero">
        <div>
          <h1 className="hero-title">
            <span className="title-pink">Shembeldon</span>{" "}
            <span className="title-cyan">Singles</span>{" "}
            <span className="title-lime">Championship</span>
          </h1>

          <div className="hero-sub">
            Best-of-3: two straight sets wins; if it’s 1–1 after two, play a 3rd
            set to decide.
          </div>

          <div className="hero-subline">TENNIS • SCHEDULE</div>
        </div>

        <div className="hero-actions">
          <button
            className={`lock-btn ${isAdmin ? "on" : ""}`}
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
      <div className="tabs">
        <Tab
          label="Schedule"
          active={tab === "Schedule"}
          onClick={() => setTab("Schedule")}
        />
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
        {isAdmin && (
          <Tab
            label="Data"
            active={tab === "Data"}
            onClick={() => setTab("Data")}
          />
        )}
      </div>

      {/* CONTENIDO */}
      <div className="content">
        {tab === "Schedule" && <ScheduleTab />}
        {tab === "Submit Result" && <SubmitTab />}
        {tab === "Standings" && <StandingsTab />}
        {isAdmin && tab === "Data" && <DataTab />}
      </div>
    </div>
  );
}
