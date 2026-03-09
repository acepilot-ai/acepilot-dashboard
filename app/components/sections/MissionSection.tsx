"use client";
import { GOLD, DARK, PANEL, BORDER, TEXT, MUTED, GREEN, BLUE, RED } from "@/app/lib/theme";
import type { ActivityItem } from "@/app/hooks/useDashboard";

interface MissionSectionProps {
  role: string;
  seatInfo: { name: string; senderName: string; territory: string; agentName: string };
  totalContacted: number;
  todaySends: number;
  replyRate: string;
  replies?: { total: number };
  pds?: { today: number; total: number; by_sender: Record<string, { today: number; total: number }>; by_outcome: Record<string, number> };
  stephie?: { today: number; total: number; by_outcome: Record<string, number> };
  agentRows: any[];
  runningCount: number;
  activity: ActivityItem[];
  filteredActivity: ActivityItem[];
  activityFilter: { sender: string; trade: string; eventType: string };
  activitySenders: string[];
  activityTrades: string[];
  setDrillDown: (val: string | null) => void;
  setActivityFilter: (fn: (f: any) => any) => void;
  setSelectedActivity: (item: ActivityItem | null) => void;
  StatCard: any;
  AgentRow: any;
}

function StatCard({ label, value, sub, color, pulse, onClick }: any) {
  return (
    <div onClick={onClick} style={{
      background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "20px 24px",
      display: "flex", flexDirection: "column", gap: 6, cursor: onClick ? "pointer" : "default",
      transition: "border-color 0.25s ease, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease",
    }}>
      {pulse && <span style={{ position: "absolute", top: 14, right: 14, width: 8, height: 8, borderRadius: "50%", background: GREEN, boxShadow: `0 0 8px ${GREEN}`, animation: "pulse 2s infinite" }} />}
      {onClick && <span style={{ position: "absolute", bottom: 10, right: 14, fontSize: 9, color: MUTED, fontFamily: "monospace", letterSpacing: 1 }}>DRILL DOWN ›</span>}
      <span style={{ fontSize: 11, letterSpacing: 2, color: MUTED, textTransform: "uppercase", fontFamily: "monospace" }}>{label}</span>
      <span style={{ fontSize: 32, fontWeight: 700, color: color || TEXT, fontFamily: "'Courier New', monospace", lineHeight: 1 }}>{value}</span>
      {sub && <span style={{ fontSize: 11, color: MUTED, fontFamily: "monospace" }}>{sub}</span>}
    </div>
  );
}

export default function MissionSection(props: MissionSectionProps) {
  const { role, seatInfo, totalContacted, todaySends, replyRate, replies, pds, stephie, agentRows, runningCount, activity, filteredActivity, activityFilter, activitySenders, activityTrades, setDrillDown, setActivityFilter, setSelectedActivity } = props;

  if (role === "CLOSER") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <div className="stat-grid-4">
          <StatCard label="My Sends Today" value={pds?.by_sender[seatInfo.senderName]?.today ?? 0} sub={seatInfo.territory} color={GOLD} pulse />
          <StatCard label="My Sends All Time" value={pds?.by_sender[seatInfo.senderName]?.total ?? 0} sub="All time outreach" />
          <StatCard label="Territory" value="ACTIVE" sub={seatInfo.territory} color={GREEN} />
          <StatCard label="Reply Rate" value={replyRate} sub={`${replies?.total ?? 0} total replies`} />
        </div>
        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}` }}>
            <span style={{ fontSize: 11, letterSpacing: 2, color: MUTED }}>RECENT ACTIVITY</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {activity.length === 0 && <div style={{ padding: 20, color: MUTED, fontSize: 11, fontFamily: "monospace" }}>No activity yet.</div>}
            {activity.slice(0, 10).map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 16, padding: "10px 20px", borderBottom: `1px solid ${BORDER}`, alignItems: "flex-start" }}>
                <span style={{ fontSize: 10, color: MUTED, fontFamily: "monospace", whiteSpace: "nowrap", paddingTop: 2, minWidth: 80 }}>{item.ts}</span>
                <span style={{ fontSize: 10, fontFamily: "monospace", letterSpacing: 1, color: item.type === "SEND" ? BLUE : item.type === "REPLY" ? GREEN : item.type === "ERROR" ? RED : GOLD, minWidth: 60, paddingTop: 2 }}>{item.type}</span>
                <span style={{ fontSize: 12, color: TEXT, fontFamily: "monospace" }}>{item.msg}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <div className="stat-grid-4">
        <StatCard label="Total Contacted" value={totalContacted.toLocaleString()} sub="All time, all campaigns" pulse onClick={() => setDrillDown("total")} />
        <StatCard label="Today's Sends" value={todaySends} sub={`PDS: ${pds?.today ?? 0} · Stephie: ${stephie?.today ?? 0}`} color={GOLD} onClick={() => setDrillDown("today")} />
        <StatCard label="Reply Rate" value={replyRate} sub={`${replies?.total ?? 0} replies / ${totalContacted} sends`} onClick={() => setDrillDown("replies")} />
        <StatCard label="Pending Approvals" value="0" sub="Approval queue clear" color={GREEN} />
      </div>

      <div className="two-col-grid">
        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, letterSpacing: 2, color: MUTED }}>ACTIVE AGENTS</span>
            <span style={{ fontSize: 11, color: GREEN, fontFamily: "monospace", fontWeight: 600 }}>{runningCount} RUNNING</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 90px 60px", padding: "10px 20px", borderBottom: `1px solid ${BORDER}` }}>
            <span style={{ fontSize: 10, color: MUTED, letterSpacing: 1 }}>SCRIPT</span>
            <span style={{ fontSize: 10, color: MUTED, letterSpacing: 1, textAlign: "center" }}>STATUS</span>
            <span style={{ fontSize: 10, color: MUTED, letterSpacing: 1, textAlign: "right" }}>TODAY</span>
          </div>
          {agentRows.slice(0, 5).map((a, i) => <props.AgentRow key={i} {...a} compact />)}
        </div>

        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, letterSpacing: 2, color: MUTED }}>ACTIVITY FEED</span>
            <span style={{ fontSize: 10, color: MUTED, fontFamily: "monospace" }}>{filteredActivity.length} events</span>
          </div>
          <div style={{ padding: "8px 14px", borderBottom: `1px solid ${BORDER}`, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {([
              { key: "sender", label: "SENDER", opts: activitySenders },
              { key: "trade", label: "TRADE", opts: activityTrades },
              { key: "eventType", label: "TYPE", opts: ["SEND", "REPLY", "ERROR"] },
            ]).map(({ key, label, opts }) => (
              <select key={key} value={activityFilter[key as keyof typeof activityFilter]} onChange={e => setActivityFilter(f => ({ ...f, [key]: e.target.value }))}
                style={{ background: DARK, border: `1px solid ${activityFilter[key as keyof typeof activityFilter] ? GOLD : BORDER}`, borderRadius: 4, padding: "4px 6px", color: activityFilter[key as keyof typeof activityFilter] ? TEXT : MUTED, fontSize: 9, fontFamily: "monospace", letterSpacing: 1, cursor: "pointer" }}>
                <option value="">ALL {label}S</option>
                {opts.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ))}
            {(activityFilter.sender || activityFilter.trade || activityFilter.eventType) && (
              <button onClick={() => setActivityFilter(f => ({ sender: "", trade: "", eventType: "" }))}
                style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 4, padding: "4px 8px", color: MUTED, fontSize: 9, fontFamily: "monospace", cursor: "pointer", letterSpacing: 1 }}>CLEAR</button>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {filteredActivity.length === 0 && <div style={{ padding: 20, color: MUTED, fontSize: 11, fontFamily: "monospace" }}>No activity matching filters.</div>}
            {filteredActivity.slice(0, 15).map((item, i) => (
              <div key={i} onClick={() => setSelectedActivity(item)}
                style={{ display: "flex", gap: 16, padding: "10px 20px", borderBottom: `1px solid ${BORDER}`, alignItems: "flex-start", cursor: "pointer" }}>
                <span style={{ fontSize: 10, color: MUTED, fontFamily: "monospace", whiteSpace: "nowrap", paddingTop: 2, minWidth: 80 }}>{item.ts}</span>
                <span style={{ fontSize: 10, fontFamily: "monospace", letterSpacing: 1, color: item.type === "SEND" ? BLUE : item.type === "REPLY" ? GREEN : item.type === "ERROR" ? RED : GOLD, minWidth: 60, paddingTop: 2 }}>{item.type}</span>
                <span style={{ fontSize: 12, color: TEXT, fontFamily: "monospace", flex: 1 }}>{item.msg}</span>
                <span style={{ fontSize: 10, color: MUTED, fontFamily: "monospace", flexShrink: 0 }}>›</span>
              </div>
            ))}
            {filteredActivity.length > 15 && (
              <div style={{ padding: "10px 20px", color: MUTED, fontSize: 10, fontFamily: "monospace" }}>+{filteredActivity.length - 15} more — use filters to narrow</div>
            )}
          </div>
        </div>
      </div>

      <div className="two-col-grid">
        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24 }}>
          <div style={{ fontSize: 11, letterSpacing: 2, color: MUTED, marginBottom: 16 }}>PDS OUTREACH</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><div style={{ fontSize: 10, color: MUTED }}>TOTAL SENT</div><div style={{ fontSize: 24, color: TEXT, fontFamily: "monospace", marginTop: 4 }}>{pds?.total ?? 0}</div></div>
            <div><div style={{ fontSize: 10, color: MUTED }}>FORMS</div><div style={{ fontSize: 24, color: BLUE, fontFamily: "monospace", marginTop: 4 }}>{pds?.by_outcome.form ?? 0}</div></div>
            <div><div style={{ fontSize: 10, color: MUTED }}>EMAILS</div><div style={{ fontSize: 24, color: GOLD, fontFamily: "monospace", marginTop: 4 }}>{pds?.by_outcome.email ?? 0}</div></div>
            <div><div style={{ fontSize: 10, color: MUTED }}>TERRITORY</div><div style={{ fontSize: 13, color: TEXT, fontFamily: "monospace", marginTop: 4 }}>LA 80% · Desert 20%</div></div>
          </div>
        </div>
        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24 }}>
          <div style={{ fontSize: 11, letterSpacing: 2, color: MUTED, marginBottom: 16 }}>STEPHIE / ITS LANDSCAPE</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><div style={{ fontSize: 10, color: MUTED }}>TOTAL SENT</div><div style={{ fontSize: 24, color: TEXT, fontFamily: "monospace", marginTop: 4 }}>{stephie?.total ?? 0}</div></div>
            <div><div style={{ fontSize: 10, color: MUTED }}>FORMS</div><div style={{ fontSize: 24, color: BLUE, fontFamily: "monospace", marginTop: 4 }}>{stephie?.by_outcome.form ?? 0}</div></div>
            <div><div style={{ fontSize: 10, color: MUTED }}>EMAILS</div><div style={{ fontSize: 24, color: GOLD, fontFamily: "monospace", marginTop: 4 }}>{stephie?.by_outcome.email ?? 0}</div></div>
            <div><div style={{ fontSize: 10, color: MUTED }}>TERRITORY</div><div style={{ fontSize: 13, color: TEXT, fontFamily: "monospace", marginTop: 4 }}>Charlotte NC area</div></div>
          </div>
        </div>
      </div>
    </div>
  );
}
