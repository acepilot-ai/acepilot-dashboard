"use client";
import { useState, useEffect } from "react";
import { GOLD, DARK, PANEL, BORDER, TEXT, MUTED, GREEN, RED, BLUE } from "@/app/lib/theme";

interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  companyName: string;
  tags: string[];
  dateAdded: string;
  lastActivity: string;
  assignedTo: string;
}

interface ScoredContact extends Contact {
  score: number;
  grade: "A" | "B" | "C" | "D";
  signals: string[];
  stale: boolean; // interested + no activity 48h+
}

// ── Scoring algorithm ─────────────────────────────────────────────────────────
// All factors generic — works for any business/territory structure
function scoreContact(c: Contact): ScoredContact {
  let score = 0;
  const signals: string[] = [];
  const tags = c.tags.map(t => t.toLowerCase());

  // Reply classification (highest weight)
  if (tags.includes("interested")) {
    score += 40; signals.push("INTERESTED");
  } else if (tags.some(t => t.includes("callback"))) {
    score += 20; signals.push("CALLBACK");
  }

  // Auto-created by webhook = verified reply lead
  if (tags.includes("auto-created")) {
    score += 10; signals.push("Verified reply");
  }

  // Contact completeness
  if (c.email)       { score += 10; signals.push("Email"); }
  if (c.phone)       { score += 10; signals.push("Phone"); }
  if (c.companyName) { score += 5; }

  // Trade value — pulled from tags set by webhook
  const highValueKeywords = ["hvac", "plumbing", "electrical", "roofing", "solar", "pest"];
  const medValueKeywords  = ["landscaping", "painting", "cleaning", "flooring", "fencing"];
  if (highValueKeywords.some(k => tags.some(t => t.includes(k)))) {
    score += 15; signals.push("High-value trade");
  } else if (medValueKeywords.some(k => tags.some(t => t.includes(k)))) {
    score += 8;  signals.push("Med-value trade");
  }

  // Recency
  const ageH = (Date.now() - new Date(c.dateAdded).getTime()) / 3_600_000;
  if      (ageH < 24)  { score += 15; signals.push("< 24h"); }
  else if (ageH < 168) { score += 10; signals.push("< 7 days"); }
  else if (ageH < 720) { score += 5; }

  const grade: ScoredContact["grade"] =
    score >= 70 ? "A" : score >= 50 ? "B" : score >= 30 ? "C" : "D";

  // Follow-up staleness: INTERESTED but no activity in 48h
  const lastActH = (Date.now() - new Date(c.lastActivity || c.dateAdded).getTime()) / 3_600_000;
  const stale = tags.includes("interested") && lastActH > 48;

  return { ...c, score: Math.min(score, 100), grade, signals, stale };
}

const GRADE_COLOR: Record<string, string> = { A: GREEN, B: GOLD, C: BLUE, D: MUTED };

function ScoreBadge({ contact }: { contact: ScoredContact }) {
  const color = GRADE_COLOR[contact.grade];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: color + "22", border: `1px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "monospace", fontWeight: 700, fontSize: 13, color }}>
        {contact.grade}
      </div>
      <div style={{ fontSize: 11, fontFamily: "monospace", color: MUTED }}>{contact.score}</div>
    </div>
  );
}

function ContactRow({ c, rank }: { c: ScoredContact; rank?: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: `1px solid ${BORDER}` }}>
      <div onClick={() => setOpen(o => !o)} style={{ display: "grid", gridTemplateColumns: "28px 36px 1fr 1fr 120px 80px", gap: 12, padding: "12px 20px", cursor: "pointer", background: open ? DARK + "80" : "transparent", alignItems: "center" }}>
        {rank !== undefined
          ? <span style={{ fontSize: 9, color: MUTED, fontFamily: "monospace", textAlign: "center" }}>#{rank}</span>
          : <span style={{ fontSize: 14 }}>⏰</span>
        }
        <ScoreBadge contact={c} />
        <div>
          <div style={{ fontSize: 12, color: TEXT, fontFamily: "monospace" }}>{c.name || c.companyName || "Unknown"}</div>
          <div style={{ fontSize: 10, color: MUTED, fontFamily: "monospace" }}>{c.companyName || c.email || "—"}</div>
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {c.signals.map(s => (
            <span key={s} style={{ fontSize: 8, background: DARK, border: `1px solid ${BORDER}`, borderRadius: 4, padding: "2px 6px", color: MUTED, fontFamily: "monospace", letterSpacing: 1 }}>{s}</span>
          ))}
        </div>
        <div style={{ fontSize: 10, color: MUTED, fontFamily: "monospace" }}>
          {c.tags.find(t => t !== "interested" && t !== "auto-created" && !["email","phone","high-value trade","callback"].includes(t.toLowerCase())) || "—"}
        </div>
        <div style={{ fontSize: 10, color: c.stale ? RED : MUTED, fontFamily: "monospace", textAlign: "right" }}>
          {c.stale ? "FOLLOW UP" : c.lastActivity ? new Date(c.lastActivity).toLocaleDateString() : "—"}
        </div>
      </div>
      {open && (
        <div style={{ padding: "12px 20px 16px", background: DARK + "60", display: "flex", gap: 24, flexWrap: "wrap" }}>
          {[
            { l: "Email",      v: c.email       || "—" },
            { l: "Phone",      v: c.phone       || "—" },
            { l: "Company",    v: c.companyName || "—" },
            { l: "Added",      v: c.dateAdded ? new Date(c.dateAdded).toLocaleDateString() : "—" },
            { l: "Last Activity", v: c.lastActivity ? new Date(c.lastActivity).toLocaleDateString() : "—" },
            { l: "Tags",       v: c.tags.join(", ") || "none" },
          ].map(({ l, v }) => (
            <div key={l} style={{ minWidth: 140 }}>
              <div style={{ fontSize: 8, color: MUTED, fontFamily: "monospace", letterSpacing: 1, marginBottom: 2 }}>{l.toUpperCase()}</div>
              <div style={{ fontSize: 11, color: TEXT, fontFamily: "monospace", wordBreak: "break-all" }}>{v}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface Props {
  role: string;
  closerId: string; // GHL ID for this closer (empty for ADMIN/OWNER = fetch all)
}

export default function LeadScorePanel({ role, closerId }: Props) {
  const [scored,   setScored]   = useState<ScoredContact[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [view,     setView]     = useState<"ranked" | "followup">("ranked");
  const [gradeFilter, setGradeFilter] = useState<string>("");

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: "1" });
    if (role === "CLOSER" && closerId) params.set("closerId", closerId);

    fetch(`/api/contacts?${params}`)
      .then(r => r.json())
      .then(data => {
        const contacts: Contact[] = data.contacts ?? [];
        const s = contacts
          .map(scoreContact)
          .sort((a, b) => b.score - a.score);
        setScored(s);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [role, closerId]);

  const followUp = scored.filter(c => c.stale);
  const ranked   = gradeFilter ? scored.filter(c => c.grade === gradeFilter) : scored;

  const gradeCount = (g: string) => scored.filter(c => c.grade === g).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {(["A", "B", "C", "D"] as const).map(g => (
          <div key={g} onClick={() => setGradeFilter(gradeFilter === g ? "" : g)} style={{ background: gradeFilter === g ? GRADE_COLOR[g] + "22" : PANEL, border: `1px solid ${gradeFilter === g ? GRADE_COLOR[g] : BORDER}`, borderRadius: 10, padding: "14px 20px", cursor: "pointer" }}>
            <div style={{ fontSize: 9, color: MUTED, fontFamily: "monospace", letterSpacing: 1, marginBottom: 6 }}>
              {g === "A" ? "HOT (70+)" : g === "B" ? "WARM (50-69)" : g === "C" ? "COOL (30-49)" : "COLD (<30)"}
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: GRADE_COLOR[g], fontFamily: "monospace" }}>{gradeCount(g)}</div>
          </div>
        ))}
      </div>

      {/* Follow-up alert */}
      {followUp.length > 0 && (
        <div onClick={() => setView("followup")} style={{ background: RED + "11", border: `1px solid ${RED}44`, borderRadius: 10, padding: "12px 20px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
          <span style={{ fontSize: 18 }}>⏰</span>
          <div>
            <div style={{ fontSize: 12, color: RED, fontFamily: "monospace", fontWeight: 700 }}>{followUp.length} FOLLOW-UP{followUp.length > 1 ? "S" : ""} OVERDUE</div>
            <div style={{ fontSize: 10, color: MUTED, fontFamily: "monospace" }}>Interested leads with no activity in 48h+ — click to view</div>
          </div>
        </div>
      )}

      {/* View toggle */}
      <div style={{ display: "flex", gap: 4 }}>
        {([["ranked", "RANKED LEADS"], ["followup", "FOLLOW-UP QUEUE"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setView(id)} style={{ background: view === id ? GOLD + "22" : "transparent", border: `1px solid ${view === id ? GOLD : BORDER}`, borderRadius: 6, padding: "6px 16px", fontSize: 10, color: view === id ? GOLD : MUTED, fontFamily: "monospace", letterSpacing: 1, cursor: "pointer" }}>
            {label} {id === "followup" && followUp.length > 0 ? `(${followUp.length})` : ""}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: "28px 36px 1fr 1fr 120px 80px", gap: 12, padding: "10px 20px", borderBottom: `1px solid ${BORDER}` }}>
          {["#", "SCORE", "CONTACT", "SIGNALS", "TERRITORY/TAG", view === "ranked" ? "ADDED" : "LAST ACTIVITY"].map(h => (
            <span key={h} style={{ fontSize: 9, color: MUTED, fontFamily: "monospace", letterSpacing: 1 }}>{h}</span>
          ))}
        </div>

        {loading && (
          <div style={{ padding: 40, textAlign: "center", color: MUTED, fontFamily: "monospace", fontSize: 11 }}>Loading leads...</div>
        )}

        {!loading && view === "ranked" && ranked.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: MUTED, fontFamily: "monospace", fontSize: 11 }}>
            No {gradeFilter ? `grade ${gradeFilter}` : ""} leads yet. Contacts from GHL will appear here once loaded.
          </div>
        )}

        {!loading && view === "followup" && followUp.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: MUTED, fontFamily: "monospace", fontSize: 11 }}>
            No overdue follow-ups. All interested leads have recent activity.
          </div>
        )}

        {!loading && view === "ranked" && ranked.slice(0, 50).map((c, i) => (
          <ContactRow key={c.id} c={c} rank={i + 1} />
        ))}

        {!loading && view === "followup" && followUp.map(c => (
          <ContactRow key={c.id} c={c} />
        ))}
      </div>

      <div style={{ fontSize: 9, color: MUTED, fontFamily: "monospace" }}>
        Scoring: INTERESTED tag +40 · Verified reply +10 · Email +10 · Phone +10 · High-value trade +15 · Added &lt;24h +15 · &lt;7d +10 · &lt;30d +5. Max 100.
        Follow-up queue = INTERESTED contacts with no activity in 48h+.
      </div>
    </div>
  );
}
