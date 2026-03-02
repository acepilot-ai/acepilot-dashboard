"use client";
import { useState, useEffect, useRef } from "react";

const GOLD = "#C9A84C";
const DARK = "#080810";
const PANEL = "#0D0D1A";
const BORDER = "#1A1A2E";
const TEXT = "#E8E8F0";
const MUTED = "#555570";
const GREEN = "#2ECC71";
const RED = "#E74C3C";
const BLUE = "#3498DB";

type NavItem = "mission" | "pipeline" | "outreach" | "agents" | "settings";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  pulse?: boolean;
}

interface AgentRowProps {
  name: string;
  status: "running" | "idle" | "error";
  lastRun: string;
  nextRun: string;
  todayCount: number;
}

interface CloserRowProps {
  name: string;
  territory: string;
  leads: number;
  sends: number;
  cold: number;
}

interface ActivityItem {
  ts: string;
  type: string;
  msg: string;
}

function StatCard({ label, value, sub, color, pulse }: StatCardProps) {
  return (
    <div style={{
      background: PANEL,
      border: `1px solid ${BORDER}`,
      borderRadius: 12,
      padding: "20px 24px",
      display: "flex",
      flexDirection: "column",
      gap: 6,
      position: "relative",
      overflow: "hidden",
    }}>
      {pulse && (
        <span style={{
          position: "absolute", top: 14, right: 14,
          width: 8, height: 8, borderRadius: "50%",
          background: GREEN,
          boxShadow: `0 0 8px ${GREEN}`,
          animation: "pulse 2s infinite",
        }} />
      )}
      <span style={{ fontSize: 11, letterSpacing: 2, color: MUTED, textTransform: "uppercase", fontFamily: "monospace" }}>{label}</span>
      <span style={{ fontSize: 32, fontWeight: 700, color: color || TEXT, fontFamily: "'Courier New', monospace", lineHeight: 1 }}>{value}</span>
      {sub && <span style={{ fontSize: 11, color: MUTED, fontFamily: "monospace" }}>{sub}</span>}
    </div>
  );
}

function AgentRow({ name, status, lastRun, nextRun, todayCount }: AgentRowProps) {
  const statusColor = status === "running" ? GREEN : status === "error" ? RED : MUTED;
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1fr 100px 140px 140px 80px",
      padding: "14px 20px", borderBottom: `1px solid ${BORDER}`,
      alignItems: "center", gap: 12,
    }}>
      <span style={{ color: TEXT, fontFamily: "monospace", fontSize: 13 }}>{name}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: statusColor, boxShadow: status === "running" ? `0 0 6px ${GREEN}` : "none" }} />
        <span style={{ fontSize: 11, color: statusColor, textTransform: "uppercase", letterSpacing: 1, fontFamily: "monospace" }}>{status}</span>
      </span>
      <span style={{ fontSize: 11, color: MUTED, fontFamily: "monospace" }}>{lastRun}</span>
      <span style={{ fontSize: 11, color: MUTED, fontFamily: "monospace" }}>{nextRun}</span>
      <span style={{ fontSize: 13, color: GOLD, fontFamily: "monospace", textAlign: "right" }}>{todayCount}</span>
    </div>
  );
}

function CloserRow({ name, territory, leads, sends, cold }: CloserRowProps) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1fr 160px 80px 80px 80px",
      padding: "14px 20px", borderBottom: `1px solid ${BORDER}`,
      alignItems: "center", gap: 12,
    }}>
      <span style={{ color: TEXT, fontFamily: "monospace", fontSize: 13 }}>{name}</span>
      <span style={{ fontSize: 11, color: MUTED, fontFamily: "monospace" }}>{territory}</span>
      <span style={{ fontSize: 13, color: GREEN, fontFamily: "monospace", textAlign: "center" }}>{leads}</span>
      <span style={{ fontSize: 13, color: BLUE, fontFamily: "monospace", textAlign: "center" }}>{sends}</span>
      <span style={{ fontSize: 13, color: cold > 0 ? RED : MUTED, fontFamily: "monospace", textAlign: "center" }}>{cold}</span>
    </div>
  );
}

function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {items.map((item, i) => (
        <div key={i} style={{
          display: "flex", gap: 16, padding: "10px 20px",
          borderBottom: `1px solid ${BORDER}`,
          alignItems: "flex-start",
        }}>
          <span style={{ fontSize: 10, color: MUTED, fontFamily: "monospace", whiteSpace: "nowrap", paddingTop: 2, minWidth: 80 }}>{item.ts}</span>
          <span style={{
            fontSize: 10, fontFamily: "monospace", letterSpacing: 1,
            color: item.type === "SEND" ? BLUE : item.type === "REPLY" ? GREEN : item.type === "ERROR" ? RED : GOLD,
            minWidth: 60, paddingTop: 2,
          }}>{item.type}</span>
          <span style={{ fontSize: 12, color: TEXT, fontFamily: "monospace" }}>{item.msg}</span>
        </div>
      ))}
    </div>
  );
}

function ChatPanel({ role }: { role: string }) {
  const agent = role === "ADMIN" ? "trinity" : "ace";
  const agentLabel = role === "ADMIN" ? "Trinity" : "Ace";
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: "user" as const, content: input.trim() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agent, messages: next }),
      });
      const data = await resp.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.content || data.error || "Error" }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Connection error." }]);
    }
    setLoading(false);
  };

  return (
    <div style={{
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 200,
      background: PANEL,
      borderTop: `1px solid ${open ? GOLD : BORDER}`,
      height: open ? 340 : 44,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      transition: "height 0.2s ease, border-color 0.2s ease",
    }}>
      {/* Collapsed bar / header */}
      <div onClick={() => setOpen(o => !o)} style={{
        height: 44,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "0 28px",
        cursor: "pointer",
        userSelect: "none",
        borderBottom: open ? `1px solid ${BORDER}` : "none",
      }}>
        <img src="/ace-logo.png" alt="" style={{ width: 20, height: 20, opacity: 0.85 }} />
        <span style={{ fontSize: 11, color: GOLD, letterSpacing: 2, fontFamily: "monospace" }}>
          TALK TO {agentLabel.toUpperCase()}
        </span>
        {messages.length > 0 && !open && (
          <span style={{ fontSize: 10, color: MUTED, marginLeft: 6, fontFamily: "monospace" }}>
            ({messages.length} msg{messages.length !== 1 ? "s" : ""})
          </span>
        )}
        <span style={{ marginLeft: "auto", color: MUTED, fontSize: 12, fontFamily: "monospace" }}>
          {open ? "▼" : "▲"}
        </span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{
        flex: 1,
        overflowY: "auto",
        padding: "14px 28px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}>
        {messages.length === 0 && (
          <div style={{ color: MUTED, fontSize: 11, fontFamily: "monospace", textAlign: "center", paddingTop: 16 }}>
            {agentLabel} is standing by. Ask anything.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "72%",
              background: m.role === "user" ? "#14142A" : DARK,
              border: `1px solid ${m.role === "user" ? "#2A2A5E" : BORDER}`,
              borderRadius: 8,
              padding: "8px 14px",
              fontSize: 12,
              color: m.role === "user" ? GOLD : TEXT,
              fontFamily: "monospace",
              lineHeight: 1.55,
              whiteSpace: "pre-wrap",
            }}>{m.content}</div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{
              background: DARK, border: `1px solid ${BORDER}`,
              borderRadius: 8, padding: "8px 14px",
              fontSize: 12, color: MUTED, fontFamily: "monospace",
            }}>{agentLabel} is thinking...</div>
          </div>
        )}
      </div>

      {/* Input row */}
      <div style={{
        height: 48,
        flexShrink: 0,
        borderTop: `1px solid ${BORDER}`,
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        gap: 10,
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={`Message ${agentLabel}...`}
          disabled={loading}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: TEXT,
            fontSize: 12,
            fontFamily: "monospace",
          }}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          style={{
            background: loading || !input.trim() ? "transparent" : GOLD,
            border: `1px solid ${loading || !input.trim() ? BORDER : GOLD}`,
            borderRadius: 6,
            padding: "5px 16px",
            color: loading || !input.trim() ? MUTED : DARK,
            fontSize: 11,
            fontWeight: 700,
            cursor: loading || !input.trim() ? "default" : "pointer",
            fontFamily: "monospace",
            letterSpacing: 1,
          }}
        >SEND</button>
      </div>
    </div>
  );
}

function getCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return m ? m[2] : "";
}

export default function Dashboard() {
  const [nav, setNav] = useState<NavItem>("mission");
  const [time, setTime] = useState(new Date());
  const [role, setRole] = useState<string>("SUPER_ADMIN");

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    setRole(getCookie("ace_role") || "SUPER_ADMIN");
    return () => clearInterval(t);
  }, []);

  const agents: AgentRowProps[] = [
    { name: "ace",                    status: "running", lastRun: "always on",   nextRun: "continuous",       todayCount: 0 },
    { name: "trinity",                    status: "idle",    lastRun: "on handoff",  nextRun: "on handoff",       todayCount: 0 },
    { name: "outreach.py",            status: "idle",    lastRun: "Today 08:05", nextRun: "Tomorrow 08:05",   todayCount: 138 },
    { name: "reply-monitor.py",       status: "running", lastRun: "5 min ago",   nextRun: "25 min",           todayCount: 0 },
    { name: "stephie-outreach.py",    status: "idle",    lastRun: "Today 18:00", nextRun: "Tomorrow 18:00",   todayCount: 50 },
    { name: "morning-report.py",      status: "idle",    lastRun: "Today 07:55", nextRun: "Tomorrow 07:55",   todayCount: 1 },
    { name: "pipeline-monitor.py",    status: "idle",    lastRun: "Today 09:00", nextRun: "Tomorrow 09:00",   todayCount: 1 },
    { name: "tripwire-monitor.py",    status: "running", lastRun: "1 min ago",   nextRun: "14 min",           todayCount: 0 },
    { name: "taylor-email-cleanup.py",status: "idle",    lastRun: "Today 18:00", nextRun: "Tomorrow 06:00",   todayCount: 2 },
    { name: "nightly-review.py",      status: "idle",    lastRun: "Today 02:00", nextRun: "Tomorrow 02:00",   todayCount: 1 },
  ];

  const closers: CloserRowProps[] = [
    { name: "Joel Davis", territory: "Coachella Valley (760)", leads: 0, sends: 89, cold: 0 },
    { name: "Frank Leon", territory: "LA County (661)", leads: 0, sends: 78, cold: 0 },
    { name: "Mickey Parson", territory: "LA / Valley", leads: 0, sends: 37, cold: 0 },
    { name: "Armen Pogosian", territory: "SFV / Desert", leads: 0, sends: 33, cold: 0 },
    { name: "Taylor Posey", territory: "Seattle / LA", leads: 0, sends: 39, cold: 0 },
    { name: "Ron Parent", territory: "Mixed", leads: 0, sends: 38, cold: 0 },
  ];

  const activity: ActivityItem[] = [
    { ts: "18:32", type: "SEND", msg: "Stephie → Ringston Chiropractic (Charlotte NC) — form submitted" },
    { ts: "18:27", type: "SEND", msg: "Stephie → Gold Hill Chiropractic — email sent" },
    { ts: "18:22", type: "SCAN", msg: "reply-monitor — 6 inboxes scanned, 0 new replies" },
    { ts: "09:00", type: "SCAN", msg: "pipeline-monitor — 0 cold deals detected" },
    { ts: "08:32", type: "SEND", msg: "PDS outreach complete — 138/300 processed (78 form, 60 email)" },
    { ts: "08:30", type: "ALERT", msg: "TRIPWIRE — hourly rate exceeded: 124 messages in 1hr" },
    { ts: "07:55", type: "REPORT", msg: "Morning report sent → Ron + Taylor" },
    { ts: "02:00", type: "SCAN", msg: "Nightly review complete — memory consolidated" },
  ];

  const allNavItems: { id: NavItem; label: string; roles: string[] }[] = [
    { id: "mission",  label: "Mission Control", roles: ["SUPER_ADMIN", "ADMIN"] },
    { id: "pipeline", label: "Pipeline",        roles: ["SUPER_ADMIN", "ADMIN"] },
    { id: "outreach", label: "Outreach",        roles: ["SUPER_ADMIN"] },
    { id: "agents",   label: "Agents",          roles: ["SUPER_ADMIN", "ADMIN"] },
    { id: "settings", label: "Settings",        roles: ["SUPER_ADMIN"] },
  ];
  const navItems = allNavItems.filter(n => n.roles.includes(role));

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: DARK, color: TEXT, fontFamily: "monospace" }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        ::-webkit-scrollbar { width: 4px; } 
        ::-webkit-scrollbar-track { background: ${DARK}; }
        ::-webkit-scrollbar-thumb { background: ${BORDER}; border-radius: 2px; }
        body { background: ${DARK}; }
      `}</style>

      {/* Sidebar */}
      <div style={{
        width: 220, background: PANEL, borderRight: `1px solid ${BORDER}`,
        display: "flex", flexDirection: "column", padding: "24px 0",
        position: "fixed", top: 0, left: 0, height: "100vh",
      }}>
        {/* Logo */}
        <div style={{ padding: "0 24px 28px", borderBottom: `1px solid ${BORDER}` }}>
          <img src="/ace-logo.png" alt="AcePilot"
            style={{ width: 48, height: 48 }} />
          <div style={{ fontSize: 10, color: MUTED, letterSpacing: 3, marginTop: 6 }}>ACEPILOT.AI</div>
        </div>

        {/* Nav */}
        <nav style={{ padding: "20px 0", flex: 1 }}>
          {navItems.map(item => (
            <button key={item.id} onClick={() => setNav(item.id)} style={{
              display: "block", width: "100%", textAlign: "left",
              padding: "11px 24px", background: "none", border: "none",
              cursor: "pointer", fontSize: 12, letterSpacing: 1,
              color: nav === item.id ? GOLD : MUTED,
              borderLeft: nav === item.id ? `2px solid ${GOLD}` : "2px solid transparent",
              transition: "all 0.15s",
            }}>{item.label.toUpperCase()}</button>
          ))}
        </nav>

        {/* Status */}
        <div style={{ padding: "16px 24px", borderTop: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 10, color: MUTED, letterSpacing: 1, marginBottom: 8 }}>SYSTEM</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: GREEN, boxShadow: `0 0 6px ${GREEN}` }} />
            <span style={{ fontSize: 11, color: GREEN }}>ALL SYSTEMS GO</span>
          </div>
          <div style={{ fontSize: 10, color: MUTED, marginTop: 8, fontFamily: "monospace" }}>
            {time.toLocaleTimeString("en-US", { hour12: false, timeZone: "America/Los_Angeles" })} PST
          </div>
          <div style={{ fontSize: 9, color: role === "SUPER_ADMIN" ? GOLD : BLUE, letterSpacing: 1, marginTop: 6 }}>
            {role === "SUPER_ADMIN" ? "SUPER ADMIN" : "ADMIN"}
          </div>
          <a href="/account" style={{
            marginTop: 10, display: "block", background: "none", border: `1px solid ${BORDER}`,
            borderRadius: 6, padding: "6px 10px", color: MUTED, fontSize: 10,
            cursor: "pointer", letterSpacing: 1, width: "100%", textAlign: "center",
            textDecoration: "none",
          }}>ACCOUNT</a>
          <button onClick={() => {
            document.cookie = "auth=; max-age=0; path=/";
            document.cookie = "ace_user=; max-age=0; path=/";
            document.cookie = "ace_role=; max-age=0; path=/";
            window.location.href = "/login";
          }} style={{
            marginTop: 6, background: "none", border: `1px solid ${BORDER}`,
            borderRadius: 6, padding: "6px 10px", color: MUTED, fontSize: 10,
            cursor: "pointer", letterSpacing: 1, width: "100%",
          }}>SIGN OUT</button>
        </div>
      </div>

      {/* Main */}
      <div style={{ marginLeft: 220, flex: 1, display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        {/* Top bar */}
        <div style={{
          padding: "16px 32px", borderBottom: `1px solid ${BORDER}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: PANEL, position: "sticky", top: 0, zIndex: 10,
        }}>
          <div>
            <div style={{ fontSize: 14, color: TEXT, letterSpacing: 2 }}>
              {navItems.find(n => n.id === nav)?.label.toUpperCase()}
            </div>
            <div style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>
              {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: GREEN, boxShadow: `0 0 6px ${GREEN}` }} />
            <span style={{ fontSize: 11, color: MUTED, letterSpacing: 1 }}>LIVE</span>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: 32, flex: 1 }}>

          {/* MISSION CONTROL */}
          {nav === "mission" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
              {/* Stats row */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
                <StatCard label="Total Contacted" value="1,085" sub="All time, all campaigns" pulse />
                <StatCard label="Today's Sends" value="188" sub="PDS: 138 · Stephie: 50" color={GOLD} />
                <StatCard label="Reply Rate" value="3.9%" sub="17 replies / 441 sends" />
                <StatCard label="Pending Approvals" value="0" sub="Approval queue clear" color={GREEN} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                {/* Agents status */}
                <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11, letterSpacing: 2, color: MUTED }}>ACTIVE AGENTS</span>
                    <span style={{ fontSize: 11, color: GREEN, fontFamily: "monospace" }}>2 RUNNING</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "100px 80px 80px", padding: "10px 20px", borderBottom: `1px solid ${BORDER}` }}>
                    <span style={{ fontSize: 10, color: MUTED, letterSpacing: 1 }}>SCRIPT</span>
                    <span style={{ fontSize: 10, color: MUTED, letterSpacing: 1 }}>STATUS</span>
                    <span style={{ fontSize: 10, color: MUTED, letterSpacing: 1, textAlign: "right" }}>TODAY</span>
                  </div>
                  {agents.slice(0, 5).map((a, i) => (
                    <AgentRow key={i} {...a} />
                  ))}
                </div>

                {/* Activity feed */}
                <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}` }}>
                    <span style={{ fontSize: 11, letterSpacing: 2, color: MUTED }}>ACTIVITY FEED</span>
                  </div>
                  <ActivityFeed items={activity} />
                </div>
              </div>

              {/* Campaign summary */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24 }}>
                  <div style={{ fontSize: 11, letterSpacing: 2, color: MUTED, marginBottom: 16 }}>PDS OUTREACH</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div><div style={{ fontSize: 10, color: MUTED }}>TOTAL SENT</div><div style={{ fontSize: 24, color: TEXT, fontFamily: "monospace", marginTop: 4 }}>579</div></div>
                    <div><div style={{ fontSize: 10, color: MUTED }}>FORMS</div><div style={{ fontSize: 24, color: BLUE, fontFamily: "monospace", marginTop: 4 }}>259</div></div>
                    <div><div style={{ fontSize: 10, color: MUTED }}>EMAILS</div><div style={{ fontSize: 24, color: GOLD, fontFamily: "monospace", marginTop: 4 }}>182</div></div>
                    <div><div style={{ fontSize: 10, color: MUTED }}>TERRITORY</div><div style={{ fontSize: 13, color: TEXT, fontFamily: "monospace", marginTop: 4 }}>LA 80% · Desert 20%</div></div>
                  </div>
                </div>
                <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24 }}>
                  <div style={{ fontSize: 11, letterSpacing: 2, color: MUTED, marginBottom: 16 }}>STEPHIE / ITS LANDSCAPE</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div><div style={{ fontSize: 10, color: MUTED }}>TOTAL SENT</div><div style={{ fontSize: 24, color: TEXT, fontFamily: "monospace", marginTop: 4 }}>101</div></div>
                    <div><div style={{ fontSize: 10, color: MUTED }}>FORMS</div><div style={{ fontSize: 24, color: BLUE, fontFamily: "monospace", marginTop: 4 }}>86</div></div>
                    <div><div style={{ fontSize: 10, color: MUTED }}>EMAILS</div><div style={{ fontSize: 24, color: GOLD, fontFamily: "monospace", marginTop: 4 }}>15</div></div>
                    <div><div style={{ fontSize: 10, color: MUTED }}>TERRITORY</div><div style={{ fontSize: 13, color: TEXT, fontFamily: "monospace", marginTop: 4 }}>Charlotte NC area</div></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PIPELINE */}
          {nav === "pipeline" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                <StatCard label="Total GHL Contacts" value="335" sub="Across all closers" />
                <StatCard label="Open Opportunities" value="0" sub="Pipeline building" />
                <StatCard label="Cold Deals" value="0" sub="No stale deals" color={GREEN} />
              </div>
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
                <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}` }}>
                  <span style={{ fontSize: 11, letterSpacing: 2, color: MUTED }}>CLOSER PERFORMANCE</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 160px 80px 80px 80px", padding: "10px 20px", borderBottom: `1px solid ${BORDER}` }}>
                  <span style={{ fontSize: 10, color: MUTED, letterSpacing: 1 }}>CLOSER</span>
                  <span style={{ fontSize: 10, color: MUTED, letterSpacing: 1 }}>TERRITORY</span>
                  <span style={{ fontSize: 10, color: MUTED, letterSpacing: 1, textAlign: "center" }}>LEADS</span>
                  <span style={{ fontSize: 10, color: MUTED, letterSpacing: 1, textAlign: "center" }}>SENDS</span>
                  <span style={{ fontSize: 10, color: MUTED, letterSpacing: 1, textAlign: "center" }}>COLD</span>
                </div>
                {closers.map((c, i) => <CloserRow key={i} {...c} />)}
              </div>
            </div>
          )}

          {/* OUTREACH */}
          {nav === "outreach" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
                <StatCard label="All Time Sends" value="680" sub="PDS + Stephie combined" />
                <StatCard label="Forms Submitted" value="345" sub="50.7% of sends" color={BLUE} />
                <StatCard label="Emails Sent" value="197" sub="28.9% of sends" color={GOLD} />
                <StatCard label="Reply Rate" value="3.9%" sub="17 total replies" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}` }}>
                    <span style={{ fontSize: 11, letterSpacing: 2, color: MUTED }}>PDS — SENDER BREAKDOWN</span>
                  </div>
                  {[
                    { name: "Joel Davis", sends: 89, territory: "Coachella (760)" },
                    { name: "Frank Leon", sends: 78, territory: "LA County" },
                    { name: "Taylor Posey", sends: 39, territory: "Seattle / LA" },
                    { name: "Mickey Parson", sends: 37, territory: "LA / Valley" },
                    { name: "Ron Parent", sends: 38, territory: "Mixed" },
                    { name: "Armen Pogosian", sends: 33, territory: "SFV / Desert" },
                  ].map((r, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", borderBottom: `1px solid ${BORDER}` }}>
                      <div>
                        <div style={{ fontSize: 12, color: TEXT, fontFamily: "monospace" }}>{r.name}</div>
                        <div style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>{r.territory}</div>
                      </div>
                      <span style={{ fontSize: 18, color: GOLD, fontFamily: "monospace" }}>{r.sends}</span>
                    </div>
                  ))}
                </div>
                <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}` }}>
                    <span style={{ fontSize: 11, letterSpacing: 2, color: MUTED }}>REPLY CLASSIFICATION</span>
                  </div>
                  {[
                    { type: "INTERNAL", count: 8, color: MUTED },
                    { type: "AUTO_REPLY", count: 4, color: MUTED },
                    { type: "VERIFICATION", count: 3, color: MUTED },
                    { type: "NOT_INTERESTED", count: 0, color: MUTED },
                    { type: "INTERESTED", count: 0, color: GREEN },
                  ].map((r, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", borderBottom: `1px solid ${BORDER}` }}>
                      <span style={{ fontSize: 11, color: r.color, fontFamily: "monospace", letterSpacing: 1 }}>{r.type}</span>
                      <span style={{ fontSize: 18, color: r.color, fontFamily: "monospace" }}>{r.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* AGENTS */}
          {nav === "agents" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
                <StatCard label="Total Agents" value="2" sub="Ace · Trinity" pulse />
                <StatCard label="Cron Scripts" value="8" sub="Active scheduled jobs" />
                <StatCard label="Running Now" value="3" sub="reply-monitor + tripwire + ace" color={GREEN} />
                <StatCard label="Errors Today" value="0" sub="All clear" color={GREEN} />
              </div>
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
                <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, letterSpacing: 2, color: MUTED }}>ALL AGENTS</span>
                  <span style={{ fontSize: 10, color: MUTED }}>ACE ↔ TRINITY via PILOT protocol</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 140px 140px 80px", padding: "10px 20px", borderBottom: `1px solid ${BORDER}` }}>
                  {["SCRIPT", "STATUS", "LAST RUN", "NEXT RUN", "TODAY"].map((h, i) => (
                    <span key={i} style={{ fontSize: 10, color: MUTED, letterSpacing: 1, textAlign: i === 4 ? "right" : "left" }}>{h}</span>
                  ))}
                </div>
                {agents.map((a, i) => <AgentRow key={i} {...a} />)}
              </div>
            </div>
          )}

          {/* SETTINGS */}
          {nav === "settings" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 32 }}>
                <div style={{ fontSize: 11, letterSpacing: 2, color: MUTED, marginBottom: 24 }}>SYSTEM CONFIGURATION</div>
                <div style={{ color: GOLD, fontSize: 13, fontFamily: "monospace", marginBottom: 16 }}>⚠ Full settings panel coming in Phase 2</div>
                <div style={{ color: MUTED, fontSize: 12, fontFamily: "monospace", lineHeight: 2 }}>
                  Planned controls:<br />
                  — Add / remove closers<br />
                  — Add / remove sender email addresses<br />
                  — Configure daily limits per sender<br />
                  — Set target regions and industries<br />
                  — Manage suppression list<br />
                  — Configure GHL integration<br />
                  — Telegram notification settings<br />
                  — Role-based user management<br />
                  — Agent start / stop controls
                </div>
              </div>
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 32 }}>
                <div style={{ fontSize: 11, letterSpacing: 2, color: MUTED, marginBottom: 16 }}>ACCESS</div>
                {[
                  { role: "SUPER_ADMIN", user: "Ron Parent", access: "Full system access" },
                  { role: "ADMIN", user: "Taylor Posey", access: "Pipeline + team management" },
                  { role: "CLOSER", user: "Joel Davis", access: "Own leads only" },
                  { role: "CLOSER", user: "Frank Leon", access: "Own leads only" },
                  { role: "CLOSER", user: "Mickey Parson", access: "Own leads only" },
                  { role: "CLOSER", user: "Armen Pogosian", access: "Own leads only" },
                ].map((u, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: `1px solid ${BORDER}` }}>
                    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                      <span style={{ fontSize: 10, color: u.role === "SUPER_ADMIN" ? GOLD : u.role === "ADMIN" ? BLUE : MUTED, letterSpacing: 1, minWidth: 100 }}>{u.role}</span>
                      <span style={{ fontSize: 12, color: TEXT, fontFamily: "monospace" }}>{u.user}</span>
                    </div>
                    <span style={{ fontSize: 11, color: MUTED, fontFamily: "monospace" }}>{u.access}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 32px", borderTop: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 44 }}>
          <span style={{ fontSize: 10, color: MUTED, letterSpacing: 1 }}>ACEPILOT.AI — MISSION CONTROL v0.1</span>
          <span style={{ fontSize: 10, color: MUTED, fontFamily: "monospace" }}>
            {time.toLocaleString("en-US", { timeZone: "America/Los_Angeles", hour12: false })} PST
          </span>
        </div>
      </div>

      <ChatPanel role={role} />
    </div>
  );
}
