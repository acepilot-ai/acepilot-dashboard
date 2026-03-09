"use client";
import { GOLD, DARK, PANEL, BORDER, TEXT, MUTED, GREEN, RED } from "@/app/lib/theme";

interface AgentsSectionProps {
  role: string;
  seatInfo: { agentName: string; agentHandle: string; territory: string };
  agentRows: any[];
  runningCount: number;
  SCHEDULES: Record<string, any>;
  LOG_PATHS_HAVE: Set<string>;
  setSelectedAgent: (agent: string) => void;
  AgentRow: any;
}

function StatCard({ label, value, sub, color, pulse }: any) {
  return (
    <div style={{
      background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "20px 24px",
      display: "flex", flexDirection: "column", gap: 6, position: "relative", overflow: "hidden",
    }}>
      {pulse && <span style={{ position: "absolute", top: 14, right: 14, width: 8, height: 8, borderRadius: "50%", background: GREEN, boxShadow: `0 0 8px ${GREEN}`, animation: "pulse 2s infinite" }} />}
      <span style={{ fontSize: 11, letterSpacing: 2, color: MUTED, textTransform: "uppercase", fontFamily: "monospace" }}>{label}</span>
      <span style={{ fontSize: 32, fontWeight: 700, color: color || TEXT, fontFamily: "'Courier New', monospace", lineHeight: 1 }}>{value}</span>
      {sub && <span style={{ fontSize: 11, color: MUTED, fontFamily: "monospace" }}>{sub}</span>}
    </div>
  );
}

export default function AgentsSection(props: AgentsSectionProps) {
  const { role, seatInfo, agentRows, runningCount, SCHEDULES, LOG_PATHS_HAVE, setSelectedAgent, AgentRow } = props;

  // CLOSER view
  if (role === "CLOSER") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
            <img src="/ace-logo.png" alt="" style={{ width: 40, height: 40 }} />
            <div>
              <div style={{ fontSize: 18, color: GOLD, fontFamily: "monospace", fontWeight: 700 }}>{seatInfo.agentName.toUpperCase()}</div>
              <div style={{ fontSize: 11, color: MUTED, letterSpacing: 2, marginTop: 4 }}>YOUR AGENT</div>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: GREEN, boxShadow: `0 0 6px ${GREEN}` }} />
              <span style={{ fontSize: 11, color: GREEN }}>ACTIVE</span>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div style={{ background: DARK, borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 10, color: MUTED, letterSpacing: 1, marginBottom: 6 }}>HANDLE</div>
              <div style={{ fontSize: 13, color: TEXT, fontFamily: "monospace" }}>@{seatInfo.agentHandle}</div>
            </div>
            <div style={{ background: DARK, borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 10, color: MUTED, letterSpacing: 1, marginBottom: 6 }}>TERRITORY</div>
              <div style={{ fontSize: 13, color: TEXT, fontFamily: "monospace" }}>{seatInfo.territory}</div>
            </div>
          </div>
          <div style={{ color: MUTED, fontSize: 11, fontFamily: "monospace", lineHeight: 1.8 }}>
            Talk to {seatInfo.agentName} using the chat bar below. Your agent has access to your leads, pipeline data, and outreach stats.
          </div>
        </div>
      </div>
    );
  }

  // OWNER/ADMIN view
  const errorCount = agentRows.filter(a => a.status === "error").length;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="stat-grid-4">
        <StatCard label="Total Agents" value="6" sub="Ace · Trinity · Atlas · Forge · Ridge · Crest" pulse />
        <StatCard label="Cron Scripts" value={Object.keys(SCHEDULES).length} sub="Active scheduled jobs" />
        <StatCard label="Running Now" value={runningCount} sub="Live agents" color={GREEN} />
        <StatCard label="Errors Today" value={errorCount} sub={errorCount === 0 ? "All clear" : "Check logs"} color={errorCount > 0 ? RED : GREEN} />
      </div>
      <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, letterSpacing: 2, color: MUTED }}>ALL AGENTS</span>
          <span style={{ fontSize: 10, color: MUTED }}>6 agents connected via PILOT protocol</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) 100px 120px 120px 70px", padding: "10px 20px", borderBottom: `1px solid ${BORDER}`, gap: 8 }}>
          {["SCRIPT", "STATUS", "LAST RUN", "NEXT RUN", "TODAY"].map((h, i) => (
            <span key={i} style={{ fontSize: 10, color: MUTED, letterSpacing: 1, textAlign: i === 4 ? "right" : "left" }}>{h}</span>
          ))}
        </div>
        {agentRows.map((a, i) => (
          <AgentRow key={i} {...a} onClick={LOG_PATHS_HAVE.has(a.name) ? () => setSelectedAgent(a.name) : undefined} />
        ))}
      </div>
    </div>
  );
}
