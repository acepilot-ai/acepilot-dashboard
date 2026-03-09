"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  useStats, useGHL, useWorkspace, useClock, relativeTime,
  type StatsCache, type GHLData, type WorkspaceData, type Todo, type FileEntry, type ActivityItem,
} from "./hooks/useDashboard";
import { usePollingChannel, type ThreadMessage, type AgentId } from "./hooks/usePilotChannel";
import AnalyticsSection from "./components/sections/AnalyticsSection";
import CampaignHealthSection from "./components/sections/CampaignHealthSection";
import MissionSection from "./components/sections/MissionSection";
import PipelineSection from "./components/sections/PipelineSection";
import AgentsSection from "./components/sections/AgentsSection";
import { GOLD, DARK, PANEL, BORDER, TEXT, MUTED, GREEN, RED, BLUE } from "./lib/theme";

type NavItem = "mission" | "pipeline" | "analytics" | "campaigns" | "outreach" | "agents" | "workspace" | "settings";

interface Notification {
  id: string;
  type: "PILOT" | "INTERESTED" | "ERROR";
  msg: string;
  ts: string;
  read: boolean;
  navTarget: NavItem;
}

// Seat → human + agent info. Single source of truth for role-scoped views.
const SEAT_MAP: Record<string, { name: string; senderName: string; ghlId: string; agentHandle: string; agentName: string; territory: string }> = {
  seat_ron: { name: "Ron Parent", senderName: "Ron Parent", ghlId: "", agentHandle: "ace", agentName: "Ace", territory: "Mixed" },
  seat_taylor: { name: "Taylor Posey", senderName: "Taylor Posey", ghlId: "ma3kHGuqV7wPGuzRymB3", agentHandle: "trinity", agentName: "Trinity", territory: "LA" },
  seat_joel: { name: "Joel Davis", senderName: "Joel Davis", ghlId: "ROTliRMFnbHzsAQOluMM", agentHandle: "atlas", agentName: "Atlas", territory: "Coachella Valley (760)" },
  seat_frank: { name: "Frank Leon", senderName: "Frank Leon", ghlId: "Owc8Ufm2W1dkxrwAtTpq", agentHandle: "forge", agentName: "Forge", territory: "LA County" },
  seat_mickey: { name: "Mickey Parson", senderName: "Mickey Parson", ghlId: "neMkuaDwGNWQ0WAIRv9B", agentHandle: "ridge", agentName: "Ridge", territory: "LA / Valley" },
  seat_armen: { name: "Armen Pogosian", senderName: "Armen Pogosian", ghlId: "hLzXkVl8tladQpgHOEwQ", agentHandle: "crest", agentName: "Crest", territory: "SFV / Desert" },
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color, pulse, onClick }: {
  label: string; value: string | number; sub?: string; color?: string; pulse?: boolean; onClick?: () => void;
}) {
  return (
    <div onClick={onClick} style={{
      background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "20px 24px",
      display: "flex", flexDirection: "column", gap: 6, position: "relative", overflow: "hidden",
      cursor: onClick ? "pointer" : "default",
      transition: "border-color 0.25s ease, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease",
    }}
      onMouseEnter={e => { if (onClick) { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = GOLD; el.style.boxShadow = `0 4px 24px rgba(0,0,0,0.3), 0 0 0 1px ${GOLD}20`; } }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = BORDER; el.style.boxShadow = "none"; el.style.transform = "scale(1)"; }}
      onMouseDown={e => { if (onClick) (e.currentTarget as HTMLDivElement).style.transform = "scale(0.97)"; }}
      onMouseUp={e => { if (onClick) (e.currentTarget as HTMLDivElement).style.transform = "scale(1)"; }}
    >
      {pulse && <span style={{ position: "absolute", top: 14, right: 14, width: 8, height: 8, borderRadius: "50%", background: GREEN, boxShadow: `0 0 8px ${GREEN}`, animation: "pulse 2s infinite" }} />}
      {onClick && <span style={{ position: "absolute", bottom: 10, right: 14, fontSize: 9, color: MUTED, fontFamily: "monospace", letterSpacing: 1, transition: "color 0.2s" }}>DRILL DOWN ›</span>}
      <span style={{ fontSize: 11, letterSpacing: 2, color: MUTED, textTransform: "uppercase", fontFamily: "monospace" }}>{label}</span>
      <span style={{ fontSize: 32, fontWeight: 700, color: color || TEXT, fontFamily: "'Courier New', monospace", lineHeight: 1 }}>{value}</span>
      {sub && <span style={{ fontSize: 11, color: MUTED, fontFamily: "monospace" }}>{sub}</span>}
    </div>
  );
}

// ── Modal (1.3 base) ──────────────────────────────────────────────────────────

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    } else {
      setVisible(false);
      const timer = setTimeout(() => setMounted(false), 350);
      return () => clearTimeout(timer);
    }
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [mounted, onClose]);

  if (!mounted) return null;
  return (
    <>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, zIndex: 400,
        background: "rgba(6,6,14,0.85)",
        backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", zIndex: 401,
        width: "min(560px, 95vw)", maxHeight: "80vh",
        background: PANEL, border: `1px solid ${visible ? GOLD + "40" : BORDER}`,
        borderRadius: 16, display: "flex", flexDirection: "column",
        boxShadow: visible ? `0 24px 80px rgba(0,0,0,0.6), 0 0 1px ${GOLD}30` : "none",
        opacity: visible ? 1 : 0,
        transform: visible ? "translate(-50%,-50%) scale(1) translateY(0)" : "translate(-50%,-50%) scale(0.92) translateY(16px)",
        transition: "opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1), transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.35s ease, box-shadow 0.35s ease",
      }}>
        <div style={{ padding: "16px 24px", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <span style={{ fontSize: 11, letterSpacing: 2, color: MUTED, fontFamily: "monospace" }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "4px 12px", color: MUTED, fontSize: 11, cursor: "pointer", fontFamily: "monospace", transition: "color 0.2s, border-color 0.2s" }} onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = TEXT; (e.currentTarget as HTMLButtonElement).style.borderColor = MUTED; }} onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = MUTED; (e.currentTarget as HTMLButtonElement).style.borderColor = BORDER; }}>ESC</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>{children}</div>
      </div>
    </>
  );
}

function AgentRow({ name, status, lastRun, nextRun, todayCount, onClick, compact }: {
  name: string; status: "running" | "idle" | "error"; lastRun: string; nextRun: string; todayCount: number; onClick?: () => void; compact?: boolean;
}) {
  const statusColor = status === "running" ? GREEN : status === "error" ? RED : MUTED;
  const statusGlow = status === "running" ? `0 0 6px ${GREEN}` : status === "error" ? `0 0 6px ${RED}` : "none";
  if (compact) {
    return (
      <div onClick={onClick} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 90px 60px", padding: "12px 20px", borderBottom: `1px solid ${BORDER}`, alignItems: "center", gap: 8, cursor: onClick ? "pointer" : "default", transition: "background 0.15s" }} onMouseEnter={e => { if (onClick) (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.03)"; }} onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}>
        <span style={{ color: TEXT, fontFamily: "monospace", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: statusColor, boxShadow: statusGlow, flexShrink: 0 }} />
          <span style={{ fontSize: 10, color: statusColor, textTransform: "uppercase", letterSpacing: 1, fontFamily: "monospace", fontWeight: 600 }}>{status}</span>
        </span>
        <span style={{ fontSize: 13, color: todayCount > 0 ? GOLD : MUTED, fontFamily: "monospace", textAlign: "right", fontWeight: 700 }}>{todayCount}</span>
      </div>
    );
  }
  return (
    <div onClick={onClick} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) 100px 120px 120px 70px", padding: "14px 20px", borderBottom: `1px solid ${BORDER}`, alignItems: "center", gap: 8, cursor: onClick ? "pointer" : "default", transition: "background 0.15s" }} onMouseEnter={e => { if (onClick) (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.03)"; }} onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}>
      <span style={{ color: TEXT, fontFamily: "monospace", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: statusColor, boxShadow: statusGlow, flexShrink: 0 }} />
        <span style={{ fontSize: 11, color: statusColor, textTransform: "uppercase", letterSpacing: 1, fontFamily: "monospace", fontWeight: 600 }}>{status}</span>
      </span>
      <span style={{ fontSize: 11, color: MUTED, fontFamily: "monospace" }}>{lastRun}</span>
      <span style={{ fontSize: 11, color: MUTED, fontFamily: "monospace" }}>{nextRun}</span>
      <span style={{ fontSize: 13, color: todayCount > 0 ? GOLD : MUTED, fontFamily: "monospace", textAlign: "right", fontWeight: 700 }}>{todayCount}</span>
    </div>
  );
}

function CloserRow({ name, territory, leads, sends, cold, onClick }: {
  name: string; territory: string; leads: number; sends: number; cold: number; onClick?: () => void;
}) {
  return (
    <div onClick={onClick} style={{ display: "grid", gridTemplateColumns: "1fr 160px 80px 80px 80px 20px", padding: "14px 20px", borderBottom: `1px solid ${BORDER}`, alignItems: "center", gap: 12, cursor: onClick ? "pointer" : "default", transition: "background 0.15s" }} onMouseEnter={e => { if (onClick) (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.03)"; }} onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}>
      <span style={{ color: TEXT, fontFamily: "monospace", fontSize: 13 }}>{name}</span>
      <span style={{ fontSize: 11, color: MUTED, fontFamily: "monospace" }}>{territory}</span>
      <span style={{ fontSize: 13, color: GREEN, fontFamily: "monospace", textAlign: "center" }}>{leads}</span>
      <span style={{ fontSize: 13, color: BLUE, fontFamily: "monospace", textAlign: "center" }}>{sends}</span>
      <span style={{ fontSize: 13, color: cold > 0 ? RED : MUTED, fontFamily: "monospace", textAlign: "center" }}>{cold}</span>
      {onClick && <span style={{ fontSize: 10, color: MUTED, fontFamily: "monospace" }}>›</span>}
    </div>
  );
}

// ── Pilot Channel ─────────────────────────────────────────────────────────────

function PilotChannel({ role, channel }: { role: string; channel: ReturnType<typeof usePollingChannel> }) {
  const { messages, loading, relay } = channel;
  const from: AgentId = role === "SUPER_ADMIN" ? "ace" : "trinity";
  const to: AgentId = from === "ace" ? "trinity" : "ace";
  const fromLabel = from === "ace" ? "Ace" : "Trinity";
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const send = async () => {
    if (!draft.trim() || sending) return;
    setSending(true);
    const sentBy = role === "SUPER_ADMIN" ? "Ron" : "Taylor";
    await relay(from, to, draft.trim(), sentBy);
    setDraft("");
    setSending(false);
  };

  return (
    <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "14px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: GOLD, boxShadow: `0 0 6px ${GOLD}` }} />
          <span style={{ fontSize: 11, letterSpacing: 2, color: MUTED }}>PILOT CHANNEL — 6 AGENTS</span>
        </div>
        <span style={{ fontSize: 10, color: MUTED, fontFamily: "monospace" }}>{messages.length} messages</span>
      </div>

      {/* Message thread */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", maxHeight: 400, padding: "12px 0", display: "flex", flexDirection: "column", gap: 0 }}>
        {loading && <div style={{ padding: "20px", color: MUTED, fontSize: 11, fontFamily: "monospace", textAlign: "center" }}>Loading channel...</div>}
        {!loading && messages.length === 0 && (
          <div style={{ padding: "24px 20px", color: MUTED, fontSize: 11, fontFamily: "monospace", textAlign: "center" }}>
            No messages yet. Agents will communicate here.<br />
            <span style={{ fontSize: 10, opacity: 0.6 }}>Auto-relay fires when any agent addresses another in chat.</span>
          </div>
        )}
        {messages.map((msg) => {
          const agentColor = msg.from === "ace" ? GOLD : msg.from === "trinity" ? BLUE : GREEN;
          const fromLabel = msg.from.charAt(0).toUpperCase() + msg.from.slice(1);
          const toLabel = msg.to ? msg.to.charAt(0).toUpperCase() + msg.to.slice(1) : "?";
          return (
            <div key={msg.id} style={{ display: "flex", gap: 0, padding: "10px 20px", borderBottom: `1px solid ${BORDER}`, alignItems: "flex-start" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 140, paddingTop: 2 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: agentColor, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: agentColor, fontFamily: "monospace", letterSpacing: 1, fontWeight: 700 }}>
                  {fromLabel.toUpperCase()}
                </span>
                <span style={{ fontSize: 10, color: MUTED, fontFamily: "monospace" }}>→ {toLabel.toUpperCase()}</span>
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 12, color: TEXT, fontFamily: "monospace", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{msg.content}</span>
                <div style={{ fontSize: 9, color: MUTED, marginTop: 4, fontFamily: "monospace" }}>
                  {msg.ts.slice(0, 16).replace("T", " ")} · via {msg.sent_by}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Compose */}
      <div style={{ borderTop: `1px solid ${BORDER}`, padding: "12px 16px", display: "flex", gap: 10, alignItems: "flex-end" }}>
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={`${fromLabel} → ${from === "ace" ? "Trinity" : "Ace"} (direct relay)...`}
          rows={2}
          disabled={sending}
          style={{ flex: 1, background: DARK, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "8px 12px", color: TEXT, fontSize: 12, fontFamily: "monospace", outline: "none", resize: "none", lineHeight: 1.5 }}
        />
        <button onClick={send} disabled={sending || !draft.trim()} style={{
          background: sending || !draft.trim() ? "transparent" : GOLD, border: `1px solid ${sending || !draft.trim() ? BORDER : GOLD}`,
          borderRadius: 6, padding: "8px 16px", color: sending || !draft.trim() ? MUTED : DARK,
          fontSize: 11, fontWeight: 700, cursor: sending || !draft.trim() ? "default" : "pointer",
          fontFamily: "monospace", letterSpacing: 1,
        }}>RELAY</button>
      </div>
    </div>
  );
}

// ── Workspace section ─────────────────────────────────────────────────────────

function WorkspaceSection({ role, seatInfo, chatMessages, channel }: {
  role: string;
  seatInfo: { name: string; senderName: string; ghlId: string; agentHandle: string; agentName: string; territory: string };
  chatMessages: { role: "user" | "assistant"; content: string }[];
  channel: ReturnType<typeof usePollingChannel>;
}) {
  const [tab, setTab] = useState<"todos" | "notes" | "files" | "chat" | "pilot">("todos");
  const { data, loading, error, mutate } = useWorkspace();

  const ws: WorkspaceData = data || { todos: [], notes: "# Workspace Notes\n", files: [] };

  // TODOS
  const [newTodo, setNewTodo] = useState("");
  const addTodo = async () => {
    if (!newTodo.trim()) return;
    const todo: Todo = { id: Date.now().toString(), text: newTodo.trim(), done: false, created_at: new Date().toISOString(), created_by: role === "SUPER_ADMIN" ? "Ron" : role === "ADMIN" ? "Taylor" : seatInfo.name };
    await mutate({ action: "save_todos", todos: [...ws.todos, todo] });
    setNewTodo("");
  };
  const toggleTodo = async (id: string) => {
    const updated = ws.todos.map(t => t.id === id ? { ...t, done: !t.done } : t);
    await mutate({ action: "save_todos", todos: updated });
  };
  const deleteTodo = async (id: string) => {
    const updated = ws.todos.filter(t => t.id !== id);
    await mutate({ action: "save_todos", todos: updated });
  };

  // NOTES
  const [noteEdit, setNoteEdit] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const noteDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { if (!noteEdit) setNoteDraft(ws.notes); }, [ws.notes, noteEdit]);
  const onNoteChange = (v: string) => {
    setNoteDraft(v);
    if (noteDebounce.current) clearTimeout(noteDebounce.current);
    noteDebounce.current = setTimeout(() => mutate({ action: "save_notes", notes: v }), 3000);
  };

  // FILES
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadFile = async (file: File) => {
    if (file.size > 512 * 1024) { alert("File must be ≤512 KB"); return; }
    const reader = new FileReader();
    reader.onload = async (e) => {
      const b64 = (e.target?.result as string).split(",")[1] || "";
      await mutate({ action: "upload_file", name: file.name, size: file.size, uploaded_by: role === "SUPER_ADMIN" ? "Ron" : role === "ADMIN" ? "Taylor" : seatInfo.name, content_b64: b64 });
    };
    reader.readAsDataURL(file);
  };
  const deleteFile = async (entry: FileEntry) => {
    await mutate({ action: "delete_file", gist_file_key: entry.gist_file_key });
  };

  // CHAT EXPORT
  const [exportName, setExportName] = useState("");
  const exportChat = async () => {
    if (!chatMessages.length) { alert("No messages to export"); return; }
    const text = chatMessages.map(m => `[${m.role.toUpperCase()}] ${m.content}`).join("\n\n");
    const blob = new Blob([text], { type: "text/plain" });
    const file = new File([blob], exportName || `chat-export-${Date.now()}.txt`, { type: "text/plain" });
    await uploadFile(file);
    setTab("files");
  };

  const TABS: { id: typeof tab; label: string }[] = [
    { id: "todos", label: "TODOS" }, { id: "notes", label: "NOTES" },
    { id: "files", label: "FILES" }, { id: "chat", label: "CHAT EXPORT" },
    ...(role !== "CLOSER" ? [{ id: "pilot" as typeof tab, label: "PILOT CHANNEL" }] : []),
  ];

  if (loading) return <div style={{ color: MUTED, fontFamily: "monospace", fontSize: 12, padding: 32 }}>Loading workspace...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {error && <div style={{ background: PANEL, border: `1px solid ${RED}`, borderRadius: 8, padding: "10px 16px", color: RED, fontSize: 11, fontFamily: "monospace" }}>Workspace: {error} — gist writes disabled until WORKSPACE_GIST_ID is set</div>}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: "12px 0", background: tab === t.id ? DARK : "none", border: "none",
            borderRight: `1px solid ${BORDER}`, cursor: "pointer", fontSize: 11, letterSpacing: 2,
            color: tab === t.id ? GOLD : MUTED, fontFamily: "monospace",
          }}>{t.label}</button>
        ))}
      </div>

      {/* TODOS */}
      {tab === "todos" && (
        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: 20, borderBottom: `1px solid ${BORDER}`, display: "flex", gap: 10 }}>
            <input value={newTodo} onChange={e => setNewTodo(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addTodo(); }}
              placeholder="New task..."
              style={{ flex: 1, background: DARK, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "8px 12px", color: TEXT, fontSize: 12, fontFamily: "monospace", outline: "none" }} />
            <button onClick={addTodo} style={{ background: GOLD, border: "none", borderRadius: 6, padding: "8px 18px", color: DARK, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "monospace", letterSpacing: 1 }}>ADD</button>
          </div>
          {ws.todos.length === 0 && <div style={{ padding: 24, color: MUTED, fontSize: 12, fontFamily: "monospace", textAlign: "center" }}>No tasks yet.</div>}
          {ws.todos.map(todo => (
            <div key={todo.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderBottom: `1px solid ${BORDER}` }}>
              <input type="checkbox" checked={todo.done} onChange={() => toggleTodo(todo.id)} style={{ cursor: "pointer", accentColor: GOLD }} />
              <span style={{ flex: 1, fontSize: 13, color: todo.done ? MUTED : TEXT, fontFamily: "monospace", textDecoration: todo.done ? "line-through" : "none" }}>{todo.text}</span>
              <span style={{ fontSize: 10, color: BLUE, fontFamily: "monospace", letterSpacing: 1 }}>{todo.created_by}</span>
              <span style={{ fontSize: 10, color: MUTED, fontFamily: "monospace" }}>{todo.created_at.slice(0, 10)}</span>
              <button onClick={() => deleteTodo(todo.id)} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 4, padding: "3px 8px", color: RED, fontSize: 10, cursor: "pointer", fontFamily: "monospace" }}>DEL</button>
            </div>
          ))}
        </div>
      )}

      {/* NOTES */}
      {tab === "notes" && (
        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, letterSpacing: 2, color: MUTED }}>SHARED NOTES</span>
            <button onClick={() => { setNoteEdit(e => !e); if (!noteEdit) setNoteDraft(ws.notes); }} style={{
              background: "none", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "5px 14px",
              color: noteEdit ? GOLD : MUTED, fontSize: 10, cursor: "pointer", fontFamily: "monospace", letterSpacing: 1,
            }}>{noteEdit ? "PREVIEW" : "EDIT"}</button>
          </div>
          {noteEdit ? (
            <textarea value={noteDraft} onChange={e => onNoteChange(e.target.value)}
              style={{ width: "100%", minHeight: 320, background: DARK, border: "none", outline: "none", color: TEXT, fontSize: 12, fontFamily: "monospace", padding: 20, resize: "vertical", lineHeight: 1.7 }} />
          ) : (
            <div style={{ padding: 24, color: TEXT, fontSize: 13, fontFamily: "monospace", whiteSpace: "pre-wrap", lineHeight: 1.8, minHeight: 200 }}>{ws.notes || "No notes yet."}</div>
          )}
        </div>
      )}

      {/* FILES */}
      {tab === "files" && (
        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: 20, borderBottom: `1px solid ${BORDER}`, display: "flex", gap: 10, alignItems: "center" }}>
            <input ref={fileInput} type="file" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ""; }} />
            <button onClick={() => fileInput.current?.click()} style={{ background: GOLD, border: "none", borderRadius: 6, padding: "8px 18px", color: DARK, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "monospace", letterSpacing: 1 }}>UPLOAD FILE</button>
            <span style={{ fontSize: 10, color: MUTED, fontFamily: "monospace" }}>≤ 512 KB</span>
          </div>
          {ws.files.length === 0 && <div style={{ padding: 24, color: MUTED, fontSize: 12, fontFamily: "monospace", textAlign: "center" }}>No files uploaded.</div>}
          {ws.files.map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderBottom: `1px solid ${BORDER}` }}>
              <span style={{ flex: 1, fontSize: 13, color: TEXT, fontFamily: "monospace" }}>{f.name}</span>
              <span style={{ fontSize: 10, color: MUTED, fontFamily: "monospace" }}>{(f.size / 1024).toFixed(1)} KB</span>
              <span style={{ fontSize: 10, color: BLUE, fontFamily: "monospace", letterSpacing: 1 }}>{f.uploaded_by}</span>
              <span style={{ fontSize: 10, color: MUTED, fontFamily: "monospace" }}>{f.uploaded_at.slice(0, 10)}</span>
              <a href={f.download_url} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: GOLD, fontFamily: "monospace", letterSpacing: 1, textDecoration: "none", border: `1px solid ${GOLD}`, borderRadius: 4, padding: "3px 8px" }}>DL</a>
              <button onClick={() => deleteFile(f)} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 4, padding: "3px 8px", color: RED, fontSize: 10, cursor: "pointer", fontFamily: "monospace" }}>DEL</button>
            </div>
          ))}
        </div>
      )}

      {/* CHAT EXPORT */}
      {tab === "chat" && (
        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 28 }}>
          <div style={{ fontSize: 11, letterSpacing: 2, color: MUTED, marginBottom: 20 }}>EXPORT CHAT THREAD TO FILES</div>
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <input value={exportName} onChange={e => setExportName(e.target.value)}
              placeholder="chat-export.txt"
              style={{ flex: 1, background: DARK, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "8px 12px", color: TEXT, fontSize: 12, fontFamily: "monospace", outline: "none" }} />
            <button onClick={exportChat} style={{ background: GOLD, border: "none", borderRadius: 6, padding: "8px 18px", color: DARK, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "monospace", letterSpacing: 1 }}>EXPORT</button>
          </div>
          <div style={{ color: MUTED, fontSize: 11, fontFamily: "monospace", lineHeight: 1.8 }}>
            {chatMessages.length} message{chatMessages.length !== 1 ? "s" : ""} in current session<br />
            Export saves the full thread to the FILES tab as a plain-text file.
          </div>
        </div>
      )}

      {/* PILOT CHANNEL */}
      {tab === "pilot" && <PilotChannel role={role} channel={channel} />}
    </div>
  );
}

// ── Chat Panel ────────────────────────────────────────────────────────────────

function ChatPanel({ role, messages, setMessages, channel }: {
  role: string;
  messages: { role: "user" | "assistant"; content: string }[];
  setMessages: React.Dispatch<React.SetStateAction<{ role: "user" | "assistant"; content: string }[]>>;
  channel: ReturnType<typeof usePollingChannel>;
}) {
  const [seatId, setChatSeatId] = useState("");
  useEffect(() => { setChatSeatId(getCookie("ace_seat") || ""); }, []);
  const seatInfo = SEAT_MAP[seatId] || SEAT_MAP.seat_ron;
  const agent = role === "ADMIN" ? "trinity" : role === "CLOSER" ? seatInfo.agentHandle : "ace";
  const agentLabel = role === "ADMIN" ? "Trinity" : role === "CLOSER" ? seatInfo.agentName : "Ace";
  const sentBy = role === "SUPER_ADMIN" ? "Ron" : role === "ADMIN" ? "Taylor" : seatInfo.name;
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [relaying, setRelaying] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
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
        body: JSON.stringify({ agent, messages: next, sent_by: sentBy }),
      });
      const data = await resp.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.content || data.error || "Error" }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Connection error." }]);
    }
    setLoading(false);
  };

  const relayTarget: AgentId = agent === "ace" ? "trinity" : agent === "trinity" ? "ace" : "trinity";
  const relayMessage = async (idx: number, content: string) => {
    setRelaying(idx);
    await channel.relay(agent as AgentId, relayTarget, content, sentBy);
    setRelaying(null);
  };

  return (
    <div style={{ background: PANEL, borderTop: `1px solid ${open ? GOLD : BORDER}`, height: open ? 340 : 44, overflow: "hidden", display: "flex", flexDirection: "column", transition: "height 0.2s ease, border-color 0.2s ease", flexShrink: 0 }}>
      <div onClick={() => setOpen(o => !o)} style={{ height: 44, flexShrink: 0, display: "flex", alignItems: "center", gap: 10, padding: "0 28px", cursor: "pointer", userSelect: "none", borderBottom: open ? `1px solid ${BORDER}` : "none" }}>
        <img src="/ace-logo.png" alt="" style={{ width: 20, height: 20, opacity: 0.85 }} />
        <span style={{ fontSize: 11, color: GOLD, letterSpacing: 2, fontFamily: "monospace" }}>TALK TO {agentLabel.toUpperCase()}</span>
        {messages.length > 0 && !open && <span style={{ fontSize: 10, color: MUTED, marginLeft: 6, fontFamily: "monospace" }}>({messages.length} msg{messages.length !== 1 ? "s" : ""})</span>}
        <span style={{ marginLeft: "auto", color: MUTED, fontSize: 12, fontFamily: "monospace" }}>{open ? "▼" : "▲"}</span>
      </div>
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "14px 28px", display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.length === 0 && <div style={{ color: MUTED, fontSize: 11, fontFamily: "monospace", textAlign: "center", paddingTop: 16 }}>{agentLabel} is standing by. Ask anything.</div>}
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start", gap: 4 }}>
            <div style={{ maxWidth: "72%", background: m.role === "user" ? "#14142A" : DARK, border: `1px solid ${m.role === "user" ? "#2A2A5E" : BORDER}`, borderRadius: 8, padding: "8px 14px", fontSize: 12, color: m.role === "user" ? GOLD : TEXT, fontFamily: "monospace", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{m.content}</div>
            {m.role === "assistant" && (
              <button onClick={() => relayMessage(i, m.content)} disabled={relaying === i} style={{
                background: "none", border: `1px solid ${BORDER}`, borderRadius: 4, padding: "2px 10px",
                color: relaying === i ? GOLD : MUTED, fontSize: 9, cursor: "pointer",
                fontFamily: "monospace", letterSpacing: 1,
              }}>{relaying === i ? "RELAYING..." : `RELAY → ${relayTarget.toUpperCase()}`}</button>
            )}
          </div>
        ))}
        {loading && <div style={{ display: "flex", justifyContent: "flex-start" }}><div style={{ background: DARK, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 14px", fontSize: 12, color: MUTED, fontFamily: "monospace" }}>{agentLabel} is thinking...</div></div>}
      </div>
      <div style={{ height: 48, flexShrink: 0, borderTop: `1px solid ${BORDER}`, display: "flex", alignItems: "center", padding: "0 16px", gap: 10 }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder={`Message ${agentLabel}...`} disabled={loading} style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: TEXT, fontSize: 12, fontFamily: "monospace" }} />
        <button onClick={send} disabled={loading || !input.trim()} style={{ background: loading || !input.trim() ? "transparent" : GOLD, border: `1px solid ${loading || !input.trim() ? BORDER : GOLD}`, borderRadius: 6, padding: "5px 16px", color: loading || !input.trim() ? MUTED : DARK, fontSize: 11, fontWeight: 700, cursor: loading || !input.trim() ? "default" : "pointer", fontFamily: "monospace", letterSpacing: 1 }}>SEND</button>
      </div>
    </div>
  );
}

function getCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return m ? m[2] : "";
}

// ── Slide Panel (base) ────────────────────────────────────────────────────────

function SlidePanel({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    } else {
      setVisible(false);
      const timer = setTimeout(() => setMounted(false), 350);
      return () => clearTimeout(timer);
    }
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [mounted, onClose]);

  if (!mounted) return null;
  return (
    <>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: "rgba(6,6,14,0.75)",
        backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      }} />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: "min(420px, 90vw)", zIndex: 301,
        background: PANEL, borderLeft: `1px solid ${BORDER}`,
        display: "flex", flexDirection: "column",
        boxShadow: visible ? "0 0 60px rgba(0,0,0,0.5)" : "none",
        transform: visible ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.35s ease",
      }}>
        <div style={{ padding: "18px 24px", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <span style={{ fontSize: 11, letterSpacing: 2, color: MUTED }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "4px 12px", color: MUTED, fontSize: 11, cursor: "pointer", fontFamily: "monospace", transition: "color 0.2s, border-color 0.2s" }} onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = TEXT; (e.currentTarget as HTMLButtonElement).style.borderColor = MUTED; }} onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = MUTED; (e.currentTarget as HTMLButtonElement).style.borderColor = BORDER; }}>ESC</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>{children}</div>
      </div>
    </>
  );
}

// ── Activity Detail (1.1) ─────────────────────────────────────────────────────

const GHL_LOCATION = "yQEQSa2RZOkQaDlCAfit";

function ActivityDetail({ item, onClose }: { item: ActivityItem; onClose: () => void }) {
  const [suppressing, setSuppressing] = useState(false);
  const [suppressed, setSuppressed] = useState(false);

  const domain = item.website
    ? item.website.replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, "").split("?")[0]
    : "";

  const ghlUrl = item.ghl_contact
    ? `https://app.precisiondatastrategies.com/location/${GHL_LOCATION}/contacts/detail/${item.ghl_contact}`
    : null;

  const handleSuppress = async () => {
    if (!domain || suppressing) return;
    setSuppressing(true);
    try {
      await fetch("/api/suppress", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      setSuppressed(true);
    } catch { /* silent */ }
    setSuppressing(false);
  };

  const details = [
    { label: "OUTCOME", value: item.outcome || item.classification || item.type },
    { label: "SENDER", value: item.sender || "—" },
    { label: "TERRITORY", value: item.territory || "—" },
    { label: "TRADE", value: item.trade || "—" },
    { label: "TIME", value: item.ts },
  ];

  // Determine if this item has enriched detail (local mode) or just msg (Gist mode)
  const hasDetail = !!(item.business_name || item.from_email || item.address || item.website);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Business */}
      <div style={{ background: DARK, borderRadius: 10, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 10, fontFamily: "monospace", letterSpacing: 1, color: item.type === "SEND" ? BLUE : item.type === "REPLY" ? GREEN : RED, background: "rgba(255,255,255,0.05)", padding: "2px 8px", borderRadius: 4 }}>{item.type}</span>
        </div>
        <div style={{ fontSize: 15, color: TEXT, fontFamily: "monospace", fontWeight: 700, lineHeight: 1.4 }}>{item.business_name || item.from_email || item.msg}</div>
      </div>
      {!hasDetail && (
        <div style={{ background: DARK, borderRadius: 8, padding: 10, border: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 9, color: MUTED, fontFamily: "monospace", letterSpacing: 1 }}>
            SUMMARY VIEW — detailed contact fields available after next cache refresh
          </div>
        </div>
      )}

      {/* Detail grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {details.map(({ label, value }) => value && value !== "—" ? (
          <div key={label} style={{ background: DARK, borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 9, color: MUTED, letterSpacing: 1, marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 11, color: TEXT, fontFamily: "monospace", wordBreak: "break-word" }}>{value}</div>
          </div>
        ) : null)}
      </div>

      {/* Address */}
      {item.address && (
        <div style={{ background: DARK, borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 9, color: MUTED, letterSpacing: 1, marginBottom: 4 }}>ADDRESS</div>
          <div style={{ fontSize: 11, color: TEXT, fontFamily: "monospace" }}>{item.address}</div>
        </div>
      )}

      {/* Website */}
      {domain && (
        <div style={{ background: DARK, borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 9, color: MUTED, letterSpacing: 1, marginBottom: 4 }}>WEBSITE</div>
          <a href={item.website} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: GOLD, fontFamily: "monospace", wordBreak: "break-all", textDecoration: "none" }}>{domain}</a>
        </div>
      )}

      {/* Reply classification */}
      {item.classification && (
        <div style={{ background: DARK, borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 9, color: MUTED, letterSpacing: 1, marginBottom: 4 }}>CLASSIFICATION</div>
          <div style={{ fontSize: 13, color: item.classification === "INTERESTED" ? GREEN : TEXT, fontFamily: "monospace", letterSpacing: 1 }}>{item.classification}</div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
        {ghlUrl && (
          <a href={ghlUrl} target="_blank" rel="noreferrer" style={{ display: "block", background: GOLD, borderRadius: 8, padding: "11px 0", color: DARK, fontSize: 11, fontWeight: 700, letterSpacing: 2, fontFamily: "monospace", textAlign: "center", textDecoration: "none" }}>
            VIEW IN GHL →
          </a>
        )}
        {domain && (
          <button onClick={handleSuppress} disabled={suppressing || suppressed} style={{ background: "none", border: `1px solid ${suppressed ? GREEN : RED}`, borderRadius: 8, padding: "10px 0", color: suppressed ? GREEN : RED, fontSize: 11, fontWeight: 700, letterSpacing: 2, cursor: suppressed ? "default" : "pointer", fontFamily: "monospace" }}>
            {suppressed ? "✓ DOMAIN SUPPRESSED" : suppressing ? "SUPPRESSING..." : "SUPPRESS DOMAIN"}
          </button>
        )}
        <button onClick={onClose} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 0", color: MUTED, fontSize: 11, letterSpacing: 2, cursor: "default", fontFamily: "monospace" }}>
          RETRY CONTACT — COMING SOON
        </button>
      </div>
    </div>
  );
}

// ── Closer Detail (1.4) ───────────────────────────────────────────────────────

function CloserDetail({ closer, activity }: {
  closer: { name: string; id: string; territory: string; leads: number; sends: number; cold: number };
  activity: ActivityItem[];
}) {
  const recentSends = activity
    .filter(a => a.type === "SEND" && a.sender && closer.name.toLowerCase().includes(a.sender.split(" ")[0].toLowerCase()))
    .slice(0, 10);

  const ghlUrl = closer.id
    ? `https://app.precisiondatastrategies.com/location/${GHL_LOCATION}/contacts/?userId=${closer.id}`
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{ background: DARK, borderRadius: 10, padding: 20 }}>
        <div style={{ fontSize: 18, color: TEXT, fontFamily: "monospace", fontWeight: 700, marginBottom: 6 }}>{closer.name}</div>
        <div style={{ fontSize: 11, color: GOLD, fontFamily: "monospace", letterSpacing: 1 }}>{closer.territory}</div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        {[
          { label: "GHL LEADS", value: closer.leads, color: GREEN },
          { label: "SENDS", value: closer.sends, color: BLUE },
          { label: "COLD DEALS", value: closer.cold, color: closer.cold > 0 ? RED : MUTED },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: DARK, borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 9, color: MUTED, letterSpacing: 1, marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: "monospace" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Recent sends */}
      <div style={{ background: DARK, borderRadius: 10, overflow: "hidden" }}>
        <div style={{ padding: "10px 14px", borderBottom: `1px solid ${BORDER}` }}>
          <span style={{ fontSize: 9, color: MUTED, letterSpacing: 1 }}>RECENT SENDS</span>
        </div>
        {recentSends.length === 0 ? (
          <div style={{ padding: 14, color: MUTED, fontSize: 11, fontFamily: "monospace" }}>No recent send data in current activity window.</div>
        ) : recentSends.map((item, i) => (
          <div key={i} style={{ padding: "8px 14px", borderBottom: `1px solid ${BORDER}`, display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ fontSize: 10, color: MUTED, fontFamily: "monospace", flexShrink: 0 }}>{item.ts}</span>
            <span style={{ fontSize: 11, color: item.outcome?.includes("email_sent") ? GOLD : item.outcome === "submitted" ? GREEN : MUTED, fontFamily: "monospace", flex: 1 }}>
              {item.business_name || item.msg}
            </span>
          </div>
        ))}
      </div>

      {/* Actions */}
      {ghlUrl && (
        <a href={ghlUrl} target="_blank" rel="noreferrer" style={{ display: "block", background: GOLD, borderRadius: 8, padding: "11px 0", color: DARK, fontSize: 11, fontWeight: 700, letterSpacing: 2, fontFamily: "monospace", textAlign: "center", textDecoration: "none" }}>
          VIEW IN GHL →
        </a>
      )}
    </div>
  );
}

// ── Contact Detail (1.5) ──────────────────────────────────────────────────────

interface ContactRecord {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  companyName: string;
  address: string;
  tags: string[];
  dateAdded: string;
  assignedTo: string;
  lastActivity: string;
}

function ContactDetail({ contact }: { contact: ContactRecord }) {
  const ghlUrl = `https://app.precisiondatastrategies.com/location/${GHL_LOCATION}/contacts/detail/${contact.id}`;
  const fields = [
    { label: "PHONE", value: contact.phone },
    { label: "EMAIL", value: contact.email },
    { label: "COMPANY", value: contact.companyName },
    { label: "ADDRESS", value: contact.address },
    { label: "ADDED", value: contact.dateAdded ? new Date(contact.dateAdded).toLocaleDateString() : "" },
    { label: "LAST ACTIVE", value: contact.lastActivity ? new Date(contact.lastActivity).toLocaleDateString() : "" },
  ].filter(f => f.value);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ background: DARK, borderRadius: 10, padding: 18 }}>
        <div style={{ fontSize: 18, color: TEXT, fontFamily: "monospace", fontWeight: 700, marginBottom: 4 }}>{contact.name}</div>
        {contact.companyName && <div style={{ fontSize: 11, color: MUTED, fontFamily: "monospace" }}>{contact.companyName}</div>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {fields.map(({ label, value }) => (
          <div key={label} style={{ background: DARK, borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 9, color: MUTED, letterSpacing: 1, marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 11, color: TEXT, fontFamily: "monospace", wordBreak: "break-all" }}>{value}</div>
          </div>
        ))}
      </div>
      {contact.tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {contact.tags.map((tag, i) => (
            <span key={i} style={{ fontSize: 10, color: GOLD, background: "rgba(201,168,76,0.1)", border: `1px solid rgba(201,168,76,0.3)`, borderRadius: 4, padding: "2px 8px", fontFamily: "monospace" }}>{tag}</span>
          ))}
        </div>
      )}
      <a href={ghlUrl} target="_blank" rel="noreferrer" style={{ display: "block", background: GOLD, borderRadius: 8, padding: "11px 0", color: DARK, fontSize: 11, fontWeight: 700, letterSpacing: 2, fontFamily: "monospace", textAlign: "center", textDecoration: "none" }}>
        VIEW IN GHL →
      </a>
    </div>
  );
}

function ContactsPanel({ pipelineTab }: { pipelineTab: string }) {
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedContact, setSelectedContact] = useState<ContactRecord | null>(null);
  const [closerFilter, setCloserFilter] = useState("");

  const CLOSER_OPTIONS = [
    { name: "All Closers", id: "" },
    { name: "Joel Davis", id: "ROTliRMFnbHzsAQOluMM" },
    { name: "Frank Leon", id: "Owc8Ufm2W1dkxrwAtTpq" },
    { name: "Mickey Parson", id: "neMkuaDwGNWQ0WAIRv9B" },
    { name: "Armen Pogosian", id: "hLzXkVl8tladQpgHOEwQ" },
    { name: "Taylor Posey", id: "ma3kHGuqV7wPGuzRymB3" },
  ];

  const load = useCallback(async (p: number, cid: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (cid) params.set("closerId", cid);
      const resp = await fetch(`/api/contacts?${params}`);
      if (resp.ok) {
        const data = await resp.json();
        setContacts(data.contacts || []);
        setTotal(data.total || 0);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (pipelineTab === "contacts") load(page, closerFilter);
  }, [pipelineTab, page, closerFilter, load]);

  const totalPages = Math.ceil(total / 20);

  return (
    <>
      <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
        {/* Header + filter */}
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, letterSpacing: 2, color: MUTED }}>GHL CONTACTS</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select value={closerFilter} onChange={e => { setCloserFilter(e.target.value); setPage(1); }} style={{ background: DARK, border: `1px solid ${BORDER}`, borderRadius: 4, padding: "4px 8px", color: MUTED, fontSize: 10, fontFamily: "monospace" }}>
              {CLOSER_OPTIONS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <span style={{ fontSize: 10, color: MUTED, fontFamily: "monospace" }}>{total} contacts</span>
          </div>
        </div>
        {/* Column headers */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 140px 160px 100px 20px", padding: "8px 20px", borderBottom: `1px solid ${BORDER}` }}>
          {["NAME", "PHONE", "EMAIL", "ADDED", ""].map((h, i) => (
            <span key={i} style={{ fontSize: 10, color: MUTED, letterSpacing: 1 }}>{h}</span>
          ))}
        </div>
        {/* Rows */}
        {loading ? (
          <div style={{ padding: 20, color: MUTED, fontSize: 11, fontFamily: "monospace" }}>Loading contacts...</div>
        ) : contacts.length === 0 ? (
          <div style={{ padding: 20, color: MUTED, fontSize: 11, fontFamily: "monospace" }}>No contacts found.</div>
        ) : contacts.map((c, i) => (
          <div key={i} onClick={() => setSelectedContact(c)} style={{ display: "grid", gridTemplateColumns: "1fr 140px 160px 100px 20px", padding: "12px 20px", borderBottom: `1px solid ${BORDER}`, alignItems: "center", cursor: "pointer", transition: "background 0.15s" }} onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.03)"} onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = "transparent"}>
            <div>
              <div style={{ fontSize: 12, color: TEXT, fontFamily: "monospace" }}>{c.name}</div>
              {c.companyName && <div style={{ fontSize: 10, color: MUTED, fontFamily: "monospace" }}>{c.companyName}</div>}
            </div>
            <span style={{ fontSize: 11, color: MUTED, fontFamily: "monospace" }}>{c.phone || "—"}</span>
            <span style={{ fontSize: 10, color: MUTED, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.email || "—"}</span>
            <span style={{ fontSize: 10, color: MUTED, fontFamily: "monospace" }}>{c.dateAdded ? new Date(c.dateAdded).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}</span>
            <span style={{ fontSize: 10, color: MUTED, fontFamily: "monospace" }}>›</span>
          </div>
        ))}
        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ padding: "12px 20px", display: "flex", gap: 8, alignItems: "center", borderTop: `1px solid ${BORDER}` }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 4, padding: "4px 10px", color: MUTED, fontSize: 10, cursor: page === 1 ? "default" : "pointer", fontFamily: "monospace" }}>← PREV</button>
            <span style={{ fontSize: 10, color: MUTED, fontFamily: "monospace" }}>Page {page} of {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 4, padding: "4px 10px", color: MUTED, fontSize: 10, cursor: page === totalPages ? "default" : "pointer", fontFamily: "monospace" }}>NEXT →</button>
          </div>
        )}
      </div>
      <Modal open={!!selectedContact} onClose={() => setSelectedContact(null)} title="CONTACT DETAIL">
        {selectedContact && <ContactDetail contact={selectedContact} />}
      </Modal>
    </>
  );
}

// ── Opportunity Management (1.6) ──────────────────────────────────────────────

interface OpportunityRecord {
  id: string;
  name: string;
  status: string;
  monetaryValue: number;
  currency: string;
  stageName: string;
  assignedTo: string;
  assignedName: string;
  contactId: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  createdAt: string;
  updatedAt: string;
  lastActivityType: string;
}

function OpportunityDetail({ opp }: { opp: OpportunityRecord }) {
  const ghlUrl = opp.contactId
    ? `https://app.precisiondatastrategies.com/location/${GHL_LOCATION}/contacts/detail/${opp.contactId}`
    : `https://app.precisiondatastrategies.com/location/${GHL_LOCATION}/opportunities/list`;

  const stageColor = opp.status === "won" ? GREEN : opp.status === "lost" ? RED : GOLD;
  const fields = [
    { label: "STAGE", value: opp.stageName },
    { label: "STATUS", value: opp.status.toUpperCase() },
    { label: "VALUE", value: opp.monetaryValue > 0 ? `$${opp.monetaryValue.toLocaleString()}` : "—" },
    { label: "ASSIGNED TO", value: opp.assignedName },
    { label: "CONTACT", value: opp.contactName },
    { label: "EMAIL", value: opp.contactEmail },
    { label: "PHONE", value: opp.contactPhone },
    { label: "CREATED", value: opp.createdAt ? new Date(opp.createdAt).toLocaleDateString() : "—" },
    { label: "LAST UPDATED", value: opp.updatedAt ? new Date(opp.updatedAt).toLocaleDateString() : "—" },
    { label: "LAST ACTIVITY", value: opp.lastActivityType || "—" },
  ].filter(f => f.value && f.value !== "—");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ background: DARK, borderRadius: 10, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 10, color: stageColor, background: "rgba(255,255,255,0.05)", padding: "2px 8px", borderRadius: 4, fontFamily: "monospace", letterSpacing: 1 }}>{opp.stageName}</span>
        </div>
        <div style={{ fontSize: 17, color: TEXT, fontFamily: "monospace", fontWeight: 700, lineHeight: 1.3 }}>{opp.name}</div>
        {opp.monetaryValue > 0 && <div style={{ fontSize: 22, color: GREEN, fontFamily: "monospace", fontWeight: 700, marginTop: 8 }}>${opp.monetaryValue.toLocaleString()}</div>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {fields.map(({ label, value }) => (
          <div key={label} style={{ background: DARK, borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 9, color: MUTED, letterSpacing: 1, marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 11, color: TEXT, fontFamily: "monospace", wordBreak: "break-all" }}>{value}</div>
          </div>
        ))}
      </div>
      <a href={ghlUrl} target="_blank" rel="noreferrer" style={{ display: "block", background: GOLD, borderRadius: 8, padding: "11px 0", color: DARK, fontSize: 11, fontWeight: 700, letterSpacing: 2, fontFamily: "monospace", textAlign: "center", textDecoration: "none" }}>
        VIEW IN GHL →
      </a>
    </div>
  );
}

function OpportunitiesPanel({ pipelineTab }: { pipelineTab: string }) {
  const [opps, setOpps] = useState<OpportunityRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("open");
  const [selectedOpp, setSelectedOpp] = useState<OpportunityRecord | null>(null);

  const load = useCallback(async (p: number, status: string) => {
    setLoading(true);
    try {
      const resp = await fetch(`/api/opportunities?status=${status}&page=${p}`);
      if (resp.ok) {
        const data = await resp.json();
        setOpps(data.opportunities || []);
        setTotal(data.total || 0);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (pipelineTab === "opportunities") load(page, statusFilter);
  }, [pipelineTab, page, statusFilter, load]);

  const totalPages = Math.ceil(total / 20);

  return (
    <>
      <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, letterSpacing: 2, color: MUTED }}>OPPORTUNITIES</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} style={{ background: DARK, border: `1px solid ${BORDER}`, borderRadius: 4, padding: "4px 8px", color: MUTED, fontSize: 10, fontFamily: "monospace" }}>
              <option value="open">Open</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
              <option value="abandoned">Abandoned</option>
            </select>
            <span style={{ fontSize: 10, color: MUTED, fontFamily: "monospace" }}>{total} total</span>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 160px 120px 120px 100px 20px", padding: "8px 20px", borderBottom: `1px solid ${BORDER}` }}>
          {["OPPORTUNITY", "CONTACT", "STAGE", "ASSIGNED", "VALUE", ""].map((h, i) => (
            <span key={i} style={{ fontSize: 10, color: MUTED, letterSpacing: 1 }}>{h}</span>
          ))}
        </div>
        {loading ? (
          <div style={{ padding: 20, color: MUTED, fontSize: 11, fontFamily: "monospace" }}>Loading opportunities...</div>
        ) : opps.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: MUTED, fontFamily: "monospace" }}>No {statusFilter} opportunities found.</div>
            <div style={{ fontSize: 10, color: MUTED, fontFamily: "monospace", marginTop: 6 }}>Pipeline is building — this will populate as leads progress.</div>
          </div>
        ) : opps.map((o, i) => (
          <div key={i} onClick={() => setSelectedOpp(o)} style={{ display: "grid", gridTemplateColumns: "1fr 160px 120px 120px 100px 20px", padding: "12px 20px", borderBottom: `1px solid ${BORDER}`, alignItems: "center", cursor: "pointer", transition: "background 0.15s" }} onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.03)"} onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = "transparent"}>
            <span style={{ fontSize: 12, color: TEXT, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.name}</span>
            <span style={{ fontSize: 11, color: MUTED, fontFamily: "monospace" }}>{o.contactName}</span>
            <span style={{ fontSize: 10, color: GOLD, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.stageName}</span>
            <span style={{ fontSize: 11, color: MUTED, fontFamily: "monospace" }}>{o.assignedName}</span>
            <span style={{ fontSize: 11, color: o.monetaryValue > 0 ? GREEN : MUTED, fontFamily: "monospace" }}>{o.monetaryValue > 0 ? `$${o.monetaryValue.toLocaleString()}` : "—"}</span>
            <span style={{ fontSize: 10, color: MUTED, fontFamily: "monospace" }}>›</span>
          </div>
        ))}
        {totalPages > 1 && (
          <div style={{ padding: "12px 20px", display: "flex", gap: 8, alignItems: "center", borderTop: `1px solid ${BORDER}` }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 4, padding: "4px 10px", color: MUTED, fontSize: 10, cursor: page === 1 ? "default" : "pointer", fontFamily: "monospace" }}>← PREV</button>
            <span style={{ fontSize: 10, color: MUTED, fontFamily: "monospace" }}>Page {page} of {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 4, padding: "4px 10px", color: MUTED, fontSize: 10, cursor: page === totalPages ? "default" : "pointer", fontFamily: "monospace" }}>NEXT →</button>
          </div>
        )}
      </div>
      <Modal open={!!selectedOpp} onClose={() => setSelectedOpp(null)} title="OPPORTUNITY DETAIL">
        {selectedOpp && <OpportunityDetail opp={selectedOpp} />}
      </Modal>
    </>
  );
}

// ── Agent Log Panel (1.2) ─────────────────────────────────────────────────────

interface AgentLogData {
  script: string;
  log_path: string | null;
  last_modified: string;
  file_size: number;
  status: "running" | "idle" | "error";
  lines: string[];
}

function AgentLogPanel({ script }: { script: string }) {
  const [data, setData] = useState<AgentLogData | null>(null);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch(`/api/agent-log?script=${encodeURIComponent(script)}&n=80`);
      if (resp.ok) setData(await resp.json());
    } catch { /* silent */ }
    setLoading(false);
  }, [script]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [data]);

  const statusColor = data?.status === "running" ? GREEN : data?.status === "error" ? RED : MUTED;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%" }}>
      {/* Header meta */}
      <div style={{ background: DARK, borderRadius: 10, padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontSize: 13, color: TEXT, fontFamily: "monospace", fontWeight: 700 }}>{script}</div>
          {data && (
            <span style={{ fontSize: 10, color: statusColor, background: "rgba(255,255,255,0.05)", padding: "2px 8px", borderRadius: 4, letterSpacing: 1, fontFamily: "monospace", textTransform: "uppercase" }}>{data.status}</span>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            { label: "LAST RUN", value: data?.last_modified ? relativeTime(new Date(data.last_modified)) : "—" },
            { label: "LOG SIZE", value: data?.file_size ? `${(data.file_size / 1024).toFixed(1)} KB` : "—" },
            { label: "LOG FILE", value: data?.log_path || "none" },
          ].map(({ label, value }) => (
            <div key={label} style={{ padding: "8px 10px", background: PANEL, borderRadius: 6 }}>
              <div style={{ fontSize: 9, color: MUTED, letterSpacing: 1, marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 10, color: MUTED, fontFamily: "monospace", wordBreak: "break-all" }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Log lines */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 9, color: MUTED, letterSpacing: 1 }}>LAST {data?.lines.length || 0} LINES</span>
          <button onClick={load} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 4, padding: "3px 10px", color: MUTED, fontSize: 10, cursor: "pointer", fontFamily: "monospace", letterSpacing: 1 }}>REFRESH</button>
        </div>
        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", background: "#050508", borderRadius: 8, padding: 14, border: `1px solid ${BORDER}` }}>
          {loading ? (
            <div style={{ color: MUTED, fontSize: 11, fontFamily: "monospace" }}>Loading...</div>
          ) : data?.lines.length ? (
            data.lines.map((line, i) => {
              const isError = /error|exception|traceback|critical/i.test(line);
              const isWarn = /warn|warning/i.test(line);
              const isOk = /success|done|submitted|email_sent|ok\b/i.test(line);
              const color = isError ? RED : isWarn ? GOLD : isOk ? GREEN : "#8888aa";
              return (
                <div key={i} style={{ fontFamily: "monospace", fontSize: 10, color, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                  {line || " "}
                </div>
              );
            })
          ) : (
            <div style={{ color: MUTED, fontSize: 11, fontFamily: "monospace" }}>No log lines found.</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Notification Bell ─────────────────────────────────────────────────────────

function NotificationBell({ notifications, unread, onMarkAllRead, onClear, onMarkRead, onNavigate }: {
  notifications: Notification[];
  unread: number;
  onMarkAllRead: () => void;
  onClear: () => void;
  onMarkRead: (id: string) => void;
  onNavigate: (target: NavItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const TYPE_ICON: Record<string, string> = { PILOT: "🔔", INTERESTED: "📨", ERROR: "🚨" };
  const TYPE_COLOR: Record<string, string> = { PILOT: GOLD, INTERESTED: GREEN, ERROR: RED };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: "relative", background: open ? "rgba(201,168,76,0.08)" : "none",
          border: `1px solid ${open ? GOLD : BORDER}`, borderRadius: 8,
          padding: "5px 10px", cursor: "pointer", display: "flex", alignItems: "center",
        }}
      >
        <span style={{ fontSize: 14 }}>🔔</span>
        {unread > 0 && (
          <span style={{
            position: "absolute", top: -5, right: -5,
            background: RED, color: "#fff", fontSize: 9, fontWeight: 700,
            borderRadius: "50%", minWidth: 16, height: 16,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "monospace", padding: "0 2px",
          }}>{unread > 9 ? "9+" : unread}</span>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0, width: 360,
          background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 10,
          zIndex: 200, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        }}>
          <div style={{ padding: "12px 16px", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, letterSpacing: 2, color: MUTED }}>NOTIFICATIONS</span>
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={onMarkAllRead} style={{ background: "none", border: "none", color: MUTED, fontSize: 9, cursor: "pointer", letterSpacing: 1, fontFamily: "monospace" }}>MARK READ</button>
              <button onClick={onClear} style={{ background: "none", border: "none", color: MUTED, fontSize: 9, cursor: "pointer", letterSpacing: 1, fontFamily: "monospace" }}>CLEAR ALL</button>
            </div>
          </div>
          <div style={{ maxHeight: 340, overflowY: "auto" }}>
            {notifications.length === 0 && (
              <div style={{ padding: 28, color: MUTED, fontSize: 11, fontFamily: "monospace", textAlign: "center" }}>No notifications.</div>
            )}
            {notifications.map(n => (
              <div
                key={n.id}
                onClick={() => { onMarkRead(n.id); onNavigate(n.navTarget); setOpen(false); }}
                style={{
                  display: "flex", gap: 12, padding: "12px 16px", borderBottom: `1px solid ${BORDER}`,
                  cursor: "pointer", background: n.read ? "transparent" : "rgba(201,168,76,0.04)",
                  alignItems: "flex-start",
                }}
              >
                <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>{TYPE_ICON[n.type] || "🔔"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: n.read ? MUTED : TEXT, fontFamily: "monospace", lineHeight: 1.5, wordBreak: "break-word" }}>{n.msg}</div>
                  <div style={{ fontSize: 9, color: MUTED, marginTop: 3, fontFamily: "monospace" }}>{n.ts}</div>
                </div>
                {!n.read && <span style={{ width: 6, height: 6, borderRadius: "50%", background: TYPE_COLOR[n.type] || GOLD, flexShrink: 0, marginTop: 5 }} />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Agent status builder ──────────────────────────────────────────────────────
const SCHEDULES: Record<string, number> = {
  "reply-monitor.py": 30, "outreach.py": 1440, "stephie-outreach.py": 1440,
  "morning-report.py": 1440, "pipeline-monitor.py": 1440, "nightly-review.py": 1440,
  "taylor-email-cleanup.py": 720,
};

// Scripts that have a known log file (clickable in agents section)
const LOG_PATHS_HAVE = new Set([
  "reply-monitor.py", "outreach.py", "stephie-outreach.py",
  "morning-report.py", "pipeline-monitor.py", "taylor-email-cleanup.py", "nightly-review.py",
]);

function buildAgentRows(agentsData: StatsCache["agents"] | undefined) {
  const base = [
    { name: "ace", nextRun: "continuous" },
    { name: "trinity", nextRun: "on handoff" },
    { name: "outreach.py", nextRun: "Tomorrow 08:05" },
    { name: "reply-monitor.py", nextRun: "next 30min" },
    { name: "stephie-outreach.py", nextRun: "Tomorrow 18:00" },
    { name: "morning-report.py", nextRun: "Tomorrow 07:55" },
    { name: "pipeline-monitor.py", nextRun: "Tomorrow 09:00" },
    { name: "tripwire-monitor.py", nextRun: "next 15min" },
    { name: "taylor-email-cleanup.py", nextRun: "Tomorrow 06:00" },
    { name: "nightly-review.py", nextRun: "Tomorrow 02:00" },
  ];

  return base.map(b => {
    const live = agentsData?.[b.name];
    if (!live) {
      return { name: b.name, status: "idle" as const, lastRun: "—", nextRun: b.nextRun, todayCount: 0 };
    }
    const interval = SCHEDULES[b.name] ?? 0;
    let status: "running" | "idle" | "error" = "idle";
    if (interval && live.last_modified) {
      const ageMins = (Date.now() - new Date(live.last_modified).getTime()) / 60000;
      if (ageMins < interval * 1.5) status = "running";
      else if (ageMins > interval * 3) status = "error";
    }
    const lastRun = live.last_modified ? relativeTime(new Date(live.last_modified)) : "—";
    return { name: b.name, status, lastRun, nextRun: b.nextRun, todayCount: live.today_count };
  });
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [nav, setNav] = useState<NavItem>("mission");
  const [role, setRole] = useState<string>("SUPER_ADMIN");
  const [seatId, setSeatId] = useState<string>("");
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<ActivityItem | null>(null);
  const [activityFilter, setActivityFilter] = useState({ sender: "", trade: "", eventType: "" });
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [drillDown, setDrillDown] = useState<string | null>(null);
  const [pipelineTab, setPipelineTab] = useState<"closers" | "contacts" | "opportunities">("closers");
  const [analyticsTab, setAnalyticsTab] = useState<"volume" | "trades" | "senders" | "territory">("volume");
  const [selectedCloser, setSelectedCloser] = useState<{ name: string; id: string; territory: string; leads: number; sends: number; cold: number } | null>(null);
  const [dateStr, setDateStr] = useState<string>("");
  const addNotification = useCallback((n: Omit<Notification, "id" | "ts" | "read">) => {
    setNotifications(prev => [{
      ...n,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      ts: new Date().toLocaleTimeString("en-US", { hour12: false, timeZone: "America/Los_Angeles" }) + " PST",
      read: false,
    }, ...prev].slice(0, 50));
  }, []);

  const time = useClock();
  const { data: stats, loading: statsLoading, lastUpdated } = useStats();
  const { data: ghl } = useGHL();
  const channel = usePollingChannel(15_000);

  useEffect(() => {
    setRole(getCookie("ace_role") || "SUPER_ADMIN");
    setSeatId(getCookie("ace_seat") || "");
    setDateStr(new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }));
  }, []);

  // Resolve seat info for scoped views
  const seatInfo = SEAT_MAP[seatId] || SEAT_MAP.seat_ron;

  const allNavItems: { id: NavItem; label: string; roles: string[] }[] = [
    { id: "mission", label: "Mission Control", roles: ["SUPER_ADMIN", "ADMIN", "CLOSER", "OWNER"] },
    { id: "pipeline", label: "Pipeline", roles: ["SUPER_ADMIN", "ADMIN", "CLOSER", "OWNER"] },
    { id: "analytics", label: "Analytics", roles: ["SUPER_ADMIN", "ADMIN", "OWNER"] },
    { id: "campaigns", label: "Campaign Health", roles: ["SUPER_ADMIN", "ADMIN", "OWNER"] },
    { id: "outreach", label: "Outreach", roles: ["SUPER_ADMIN", "OWNER"] },
    { id: "agents", label: "Agents", roles: ["SUPER_ADMIN", "ADMIN", "CLOSER", "OWNER"] },
    { id: "workspace", label: "Workspace", roles: ["SUPER_ADMIN", "ADMIN", "CLOSER", "OWNER"] },
    { id: "settings", label: "Settings", roles: ["SUPER_ADMIN", "OWNER"] },
  ];
  const navItems = allNavItems.filter(n => n.roles.includes(role));

  // Derived live values
  const pds = stats?.pds;
  const stephie = stats?.stephie;
  const replies = stats?.replies;
  const totalContacted = (pds?.total ?? 0) + (stephie?.total ?? 0);
  const todaySends = (pds?.today ?? 0) + (stephie?.today ?? 0);
  const replyRate = totalContacted > 0 ? ((replies?.total ?? 0) / totalContacted * 100).toFixed(1) + "%" : "—";
  const activity = stats?.activity ?? [];
  const agentRows = buildAgentRows(stats?.agents);
  const runningCount = agentRows.filter(a => a.status === "running").length;

  // Activity filter derivations
  const filteredActivity = activity.filter(a =>
    (!activityFilter.sender || a.sender === activityFilter.sender) &&
    (!activityFilter.trade || a.trade === activityFilter.trade) &&
    (!activityFilter.eventType || a.type === activityFilter.eventType)
  );
  const activitySenders = [...new Set(activity.map(a => a.sender).filter(Boolean))] as string[];
  const activityTrades = [...new Set(activity.map(a => a.trade).filter(Boolean))] as string[];

  // ── Notification watchers ─────────────────────────────────────────────────────
  const interestedCount = replies?.by_classification?.["INTERESTED"] ?? 0;
  const lastInterested = useRef<number>(-1);
  useEffect(() => {
    if (lastInterested.current === -1) { lastInterested.current = interestedCount; return; }
    if (interestedCount > lastInterested.current) {
      const delta = interestedCount - lastInterested.current;
      addNotification({ type: "INTERESTED", msg: `${delta} new INTERESTED repl${delta === 1 ? "y" : "ies"} detected`, navTarget: "mission" });
    }
    lastInterested.current = interestedCount;
  }, [interestedCount, addNotification]);

  const seenPilotIds = useRef<Set<string>>(new Set());
  const pilotReady = useRef(false);
  useEffect(() => {
    if (!channel.messages.length) return;
    if (!pilotReady.current) {
      channel.messages.forEach(m => seenPilotIds.current.add(m.id));
      pilotReady.current = true;
      return;
    }
    channel.messages.forEach(m => {
      if (!seenPilotIds.current.has(m.id)) {
        seenPilotIds.current.add(m.id);
        const fromLabel = m.from.charAt(0).toUpperCase() + m.from.slice(1);
        const toLabel = m.to ? m.to.charAt(0).toUpperCase() + m.to.slice(1) : "?";
        const preview = m.content.length > 80 ? m.content.slice(0, 80) + "..." : m.content;
        addNotification({ type: "PILOT", msg: `${fromLabel} → ${toLabel}: "${preview}"`, navTarget: "workspace" });
      }
    });
  }, [channel.messages, addNotification]);

  const seenErrors = useRef<Set<string>>(new Set());
  const errorsReady = useRef(false);
  useEffect(() => {
    if (!agentRows.length) return;
    const currentErrors = new Set(agentRows.filter(a => a.status === "error").map(a => a.name));
    if (!errorsReady.current) {
      currentErrors.forEach(n => seenErrors.current.add(n));
      errorsReady.current = true;
      return;
    }
    currentErrors.forEach(name => {
      if (!seenErrors.current.has(name)) {
        seenErrors.current.add(name);
        addNotification({ type: "ERROR", msg: `Script error detected: ${name}`, navTarget: "agents" });
      }
    });
    seenErrors.current.forEach(name => { if (!currentErrors.has(name)) seenErrors.current.delete(name); });
  }, [agentRows, addNotification]);

  // GHL derived
  const ghlData: GHLData | null = ghl;
  const closers = ghlData?.closers ?? [
    { name: "Joel Davis", id: "", territory: "Coachella Valley (760)", leads: 0, sends: 0, cold: 0 },
    { name: "Frank Leon", id: "", territory: "LA County", leads: 0, sends: 0, cold: 0 },
    { name: "Mickey Parson", id: "", territory: "LA / Valley", leads: 0, sends: 0, cold: 0 },
    { name: "Armen Pogosian", id: "", territory: "SFV / Desert", leads: 0, sends: 0, cold: 0 },
    { name: "Taylor Posey", id: "", territory: "LA / Seattle", leads: 0, sends: 0, cold: 0 },
  ];

  return (
    <div className="root-layout" style={{ background: DARK, color: TEXT, fontFamily: "monospace" }}>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
        body { background: ${DARK}; }
        textarea { box-sizing: border-box; }
        select { outline: none; }
      `}</style>

      {/* Sidebar */}
      <div className="sidebar" style={{ background: PANEL, borderRight: `1px solid ${BORDER}`, padding: "24px 0" }}>
        <div style={{ padding: "0 24px 28px", borderBottom: `1px solid ${BORDER}` }}>
          <img src="/ace-logo.png" alt="AcePilot" style={{ width: 48, height: 48 }} />
          <div style={{ fontSize: 10, color: MUTED, letterSpacing: 3, marginTop: 6 }}>ACEPILOT.AI</div>
        </div>
        <nav style={{ padding: "20px 0", flex: 1 }}>
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setNav(item.id)}
              onMouseEnter={e => { if (nav !== item.id) { (e.currentTarget as HTMLButtonElement).style.background = `rgba(201, 168, 76, 0.1)`; (e.currentTarget as HTMLButtonElement).style.color = TEXT; } }}
              onMouseLeave={e => { if (nav !== item.id) { (e.currentTarget as HTMLButtonElement).style.background = "none"; (e.currentTarget as HTMLButtonElement).style.color = "#9999B0"; } }}
              style={{
                display: "block", width: "100%", textAlign: "left", padding: "12px 24px",
                background: "none", border: "none", cursor: "pointer",
                fontSize: 12, letterSpacing: 1, fontWeight: nav === item.id ? 600 : 500,
                color: nav === item.id ? GOLD : "#9999B0",
                borderLeft: nav === item.id ? `3px solid ${GOLD}` : "3px solid transparent",
                transition: "all 0.15s", lineHeight: 1.4
              }}
            >
              {item.label.toUpperCase()}
            </button>
          ))}
        </nav>
        <div style={{ padding: "16px 24px", borderTop: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 10, color: MUTED, letterSpacing: 1, marginBottom: 8 }}>SYSTEM</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: GREEN, boxShadow: `0 0 6px ${GREEN}` }} />
            <span style={{ fontSize: 11, color: GREEN }}>ALL SYSTEMS GO</span>
          </div>
          <div style={{ fontSize: 10, color: MUTED, marginTop: 8, fontFamily: "monospace" }}>
            {time?.toLocaleTimeString("en-US", { hour12: false, timeZone: "America/Los_Angeles" }) ?? "--:--:--"} PST
          </div>
          <div style={{ fontSize: 9, color: role === "SUPER_ADMIN" ? GOLD : role === "ADMIN" ? BLUE : MUTED, letterSpacing: 1, marginTop: 6 }}>
            {role === "SUPER_ADMIN" ? "OWNER" : role === "ADMIN" ? "ADMIN" : seatInfo.agentName.toUpperCase()}
          </div>
          <a href="/account" style={{ marginTop: 10, display: "block", background: "none", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "6px 10px", color: MUTED, fontSize: 10, cursor: "pointer", letterSpacing: 1, width: "100%", textAlign: "center", textDecoration: "none" }}>ACCOUNT</a>
          <button onClick={() => { document.cookie = "auth=; max-age=0; path=/"; document.cookie = "ace_user=; max-age=0; path=/"; document.cookie = "ace_role=; max-age=0; path=/"; window.location.href = "/login"; }} style={{ marginTop: 6, background: "none", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "6px 10px", color: MUTED, fontSize: 10, cursor: "pointer", letterSpacing: 1, width: "100%" }}>SIGN OUT</button>
        </div>
      </div>

      {/* Main */}
      <div className="main-col">
        {/* Top bar */}
        <div style={{ padding: "16px 24px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: PANEL, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div>
              <div style={{ fontSize: 14, color: TEXT, letterSpacing: 2 }}>{navItems.find(n => n.id === nav)?.label.toUpperCase()}</div>
              <div style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>{dateStr}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: statsLoading ? GOLD : GREEN, boxShadow: `0 0 6px ${statsLoading ? GOLD : GREEN}` }} />
              <span style={{ fontSize: 11, color: MUTED, letterSpacing: 1 }}>{lastUpdated ? relativeTime(lastUpdated) : "syncing..."}</span>
            </div>
            <NotificationBell
              notifications={notifications}
              unread={notifications.filter(n => !n.read).length}
              onMarkAllRead={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))}
              onClear={() => setNotifications([])}
              onMarkRead={(id) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))}
              onNavigate={(target) => setNav(target)}
            />
          </div>
        </div>

        {/* Content */}
        <div className="content-area">

          {/* MISSION CONTROL — CLOSER */}
          {nav === "mission" && (
            <MissionSection
              role={role}
              seatInfo={seatInfo}
              totalContacted={totalContacted}
              todaySends={todaySends}
              replyRate={replyRate}
              replies={replies}
              pds={pds}
              stephie={stephie}
              agentRows={agentRows}
              runningCount={runningCount}
              activity={activity}
              filteredActivity={filteredActivity}
              activityFilter={activityFilter}
              activitySenders={activitySenders}
              activityTrades={activityTrades}
              setDrillDown={setDrillDown}
              setActivityFilter={setActivityFilter}
              setSelectedActivity={setSelectedActivity}
              StatCard={StatCard}
              AgentRow={AgentRow}
            />
          )}

          {nav === "pipeline" && (
            <PipelineSection
              role={role}
              seatInfo={seatInfo}
              closers={closers}
              ghlData={ghlData}
              pipelineTab={pipelineTab}
              setPipelineTab={setPipelineTab}
              setSelectedCloser={setSelectedCloser}
              CloserRow={CloserRow}
              ContactsPanel={ContactsPanel}
              OpportunitiesPanel={OpportunitiesPanel}
            />
          )}

          {/* OUTREACH */}
          {nav === "outreach" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div className="stat-grid-4">
                <StatCard label="All Time Sends" value={totalContacted} sub="PDS + Stephie combined" />
                <StatCard label="Forms Submitted" value={(pds?.by_outcome.form ?? 0) + (stephie?.by_outcome.form ?? 0)} sub={totalContacted > 0 ? `${(((pds?.by_outcome.form ?? 0) + (stephie?.by_outcome.form ?? 0)) / totalContacted * 100).toFixed(1)}% of sends` : "—"} color={BLUE} />
                <StatCard label="Emails Sent" value={(pds?.by_outcome.email ?? 0) + (stephie?.by_outcome.email ?? 0)} sub={totalContacted > 0 ? `${(((pds?.by_outcome.email ?? 0) + (stephie?.by_outcome.email ?? 0)) / totalContacted * 100).toFixed(1)}% of sends` : "—"} color={GOLD} />
                <StatCard label="Reply Rate" value={replyRate} sub={`${replies?.total ?? 0} total replies`} />
              </div>
              <div className="two-col-grid">
                <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}` }}>
                    <span style={{ fontSize: 11, letterSpacing: 2, color: MUTED }}>PDS — SENDER BREAKDOWN</span>
                  </div>
                  {pds && Object.entries(pds.by_sender).length > 0
                    ? Object.entries(pds.by_sender).sort((a, b) => b[1].total - a[1].total).map(([name, s], i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", borderBottom: `1px solid ${BORDER}` }}>
                        <div><div style={{ fontSize: 12, color: TEXT, fontFamily: "monospace" }}>{name}</div><div style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>{s.today} today</div></div>
                        <span style={{ fontSize: 18, color: GOLD, fontFamily: "monospace" }}>{s.total}</span>
                      </div>
                    ))
                    : <div style={{ padding: 20, color: MUTED, fontSize: 11, fontFamily: "monospace" }}>No sender data yet.</div>
                  }
                </div>
                <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}` }}>
                    <span style={{ fontSize: 11, letterSpacing: 2, color: MUTED }}>REPLY CLASSIFICATION</span>
                  </div>
                  {replies && Object.entries(replies.by_classification).length > 0
                    ? Object.entries(replies.by_classification).sort((a, b) => b[1] - a[1]).map(([type, count], i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", borderBottom: `1px solid ${BORDER}` }}>
                        <span style={{ fontSize: 11, color: type === "INTERESTED" ? GREEN : MUTED, fontFamily: "monospace", letterSpacing: 1 }}>{type}</span>
                        <span style={{ fontSize: 18, color: type === "INTERESTED" ? GREEN : MUTED, fontFamily: "monospace" }}>{count}</span>
                      </div>
                    ))
                    : <div style={{ padding: 20, color: MUTED, fontSize: 11, fontFamily: "monospace" }}>No replies classified yet.</div>
                  }
                </div>
              </div>
            </div>
          )}

          {/* ANALYTICS (2.1 / 2.2 / 2.3) */}
          {nav === "analytics" && (
            <AnalyticsSection
              stats={stats}
              ghlData={ghlData}
              analyticsTab={analyticsTab}
              setAnalyticsTab={setAnalyticsTab}
            />
          )}

          {/* CAMPAIGN HEALTH */}
          {nav === "campaigns" && (
            <CampaignHealthSection campaigns={stats?.campaigns ?? []} />
          )}

          {nav === "agents" && (
            <AgentsSection
              role={role}
              seatInfo={seatInfo}
              agentRows={agentRows}
              runningCount={runningCount}
              SCHEDULES={SCHEDULES}
              LOG_PATHS_HAVE={LOG_PATHS_HAVE}
              setSelectedAgent={setSelectedAgent}
              AgentRow={AgentRow}
            />
          )}

          {/* WORKSPACE */}
          {nav === "workspace" && <WorkspaceSection role={role} seatInfo={seatInfo} chatMessages={chatMessages} channel={channel} />}

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

        <div className="footer-bar" style={{ padding: "12px 32px", borderTop: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 10, color: MUTED, letterSpacing: 1 }}>ACEPILOT.AI — MISSION CONTROL v0.2</span>
          <span style={{ fontSize: 10, color: MUTED, fontFamily: "monospace" }}>{time?.toLocaleString("en-US", { timeZone: "America/Los_Angeles", hour12: false }) ?? "--"} PST</span>
        </div>
        <ChatPanel role={role} messages={chatMessages} setMessages={setChatMessages} channel={channel} />
        <nav className="bottom-nav" style={{ background: PANEL, borderTop: `1px solid ${BORDER}` }}>
          {navItems.filter(n => ["mission", "pipeline", "analytics", "workspace"].includes(n.id)).map(item => {
            const ICONS: Record<string, string> = { mission: "🎯", pipeline: "📋", analytics: "📊", workspace: "📁" };
            return (
              <button key={item.id} onClick={() => setNav(item.id)} style={{
                flex: 1, height: "100%", background: "none", border: "none", cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 3, color: nav === item.id ? GOLD : MUTED,
                borderTop: nav === item.id ? `2px solid ${GOLD}` : "2px solid transparent",
                minHeight: 44,
              }}>
                <span style={{ fontSize: 18 }}>{ICONS[item.id] || "●"}</span>
                <span style={{ fontSize: 9, letterSpacing: 1, fontFamily: "monospace" }}>{item.label.split(" ")[0].toUpperCase()}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* 1.4 — Closer detail modal */}
      <Modal open={!!selectedCloser} onClose={() => setSelectedCloser(null)} title="CLOSER DETAIL">
        {selectedCloser && <CloserDetail closer={selectedCloser} activity={activity} />}
      </Modal>

      {/* 1.1 — Activity detail slide panel */}
      <SlidePanel open={!!selectedActivity} onClose={() => setSelectedActivity(null)} title="ACTIVITY DETAIL">
        {selectedActivity && <ActivityDetail item={selectedActivity} onClose={() => setSelectedActivity(null)} />}
      </SlidePanel>

      {/* 1.2 — Agent log slide panel */}
      <SlidePanel open={!!selectedAgent} onClose={() => setSelectedAgent(null)} title="AGENT LOG">
        {selectedAgent && <AgentLogPanel script={selectedAgent} />}
      </SlidePanel>

      {/* 1.3 — Stat card drill-down modals */}
      <Modal open={drillDown === "total"} onClose={() => setDrillDown(null)} title="TOTAL CONTACTED — BREAKDOWN">
        {drillDown === "total" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { label: "PDS Total", value: pds?.total ?? 0, color: TEXT },
                { label: "Stephie Total", value: stephie?.total ?? 0, color: TEXT },
                { label: "Forms", value: (pds?.by_outcome.form ?? 0) + (stephie?.by_outcome.form ?? 0), color: BLUE },
                { label: "Emails", value: (pds?.by_outcome.email ?? 0) + (stephie?.by_outcome.email ?? 0), color: GOLD },
                { label: "Skipped", value: (pds?.by_outcome.skip ?? 0) + (stephie?.by_outcome.skip ?? 0), color: MUTED },
                { label: "Errors", value: (pds?.by_outcome.error ?? 0) + (stephie?.by_outcome.error ?? 0), color: RED },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: DARK, borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 9, color: MUTED, letterSpacing: 1, marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: "monospace" }}>{value.toLocaleString()}</div>
                </div>
              ))}
            </div>
            <div style={{ background: DARK, borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 9, color: MUTED, letterSpacing: 1, marginBottom: 10 }}>BY SENDER (PDS)</div>
              {pds?.by_sender && Object.entries(pds.by_sender).sort((a, b) => b[1].total - a[1].total).map(([name, counts]) => (
                <div key={name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${BORDER}` }}>
                  <span style={{ fontSize: 11, color: TEXT, fontFamily: "monospace" }}>{name}</span>
                  <span style={{ fontSize: 11, color: GOLD, fontFamily: "monospace" }}>{counts.total.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      <Modal open={drillDown === "today"} onClose={() => setDrillDown(null)} title="TODAY'S SENDS — BREAKDOWN">
        {drillDown === "today" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { label: "PDS Today", value: pds?.today ?? 0, color: TEXT },
                { label: "Stephie Today", value: stephie?.today ?? 0, color: TEXT },
                { label: "Forms", value: (pds?.today_by_outcome.form ?? 0) + (stephie?.today_by_outcome.form ?? 0), color: BLUE },
                { label: "Emails", value: (pds?.today_by_outcome.email ?? 0) + (stephie?.today_by_outcome.email ?? 0), color: GOLD },
                { label: "Skipped", value: (pds?.today_by_outcome.skip ?? 0) + (stephie?.today_by_outcome.skip ?? 0), color: MUTED },
                { label: "Errors", value: (pds?.today_by_outcome.error ?? 0) + (stephie?.today_by_outcome.error ?? 0), color: RED },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: DARK, borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 9, color: MUTED, letterSpacing: 1, marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: "monospace" }}>{value.toLocaleString()}</div>
                </div>
              ))}
            </div>
            <div style={{ background: DARK, borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 9, color: MUTED, letterSpacing: 1, marginBottom: 10 }}>BY SENDER TODAY (PDS)</div>
              {pds?.by_sender && Object.entries(pds.by_sender).filter(([, c]) => c.today > 0).sort((a, b) => b[1].today - a[1].today).map(([name, counts]) => (
                <div key={name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${BORDER}` }}>
                  <span style={{ fontSize: 11, color: TEXT, fontFamily: "monospace" }}>{name}</span>
                  <span style={{ fontSize: 11, color: GOLD, fontFamily: "monospace" }}>{counts.today}</span>
                </div>
              ))}
              {pds?.by_sender && Object.values(pds.by_sender).every(c => c.today === 0) && (
                <div style={{ fontSize: 11, color: MUTED, fontFamily: "monospace" }}>No sends logged today yet.</div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal open={drillDown === "replies"} onClose={() => setDrillDown(null)} title="REPLIES — BREAKDOWN">
        {drillDown === "replies" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: DARK, borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 9, color: MUTED, letterSpacing: 1, marginBottom: 4 }}>TOTAL REPLIES</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: GREEN, fontFamily: "monospace" }}>{replies?.total ?? 0}</div>
            </div>
            <div style={{ background: DARK, borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 9, color: MUTED, letterSpacing: 1, marginBottom: 10 }}>BY CLASSIFICATION</div>
              {replies?.by_classification && Object.entries(replies.by_classification).sort((a, b) => b[1] - a[1]).map(([cls, count]) => {
                const c = cls === "INTERESTED" ? GREEN : cls === "NOT_INTERESTED" ? RED : cls === "OOO" ? GOLD : MUTED;
                return (
                  <div key={cls} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${BORDER}` }}>
                    <span style={{ fontSize: 11, color: c, fontFamily: "monospace", letterSpacing: 1 }}>{cls}</span>
                    <span style={{ fontSize: 13, color: c, fontFamily: "monospace", fontWeight: 700 }}>{count}</span>
                  </div>
                );
              })}
              {(!replies?.by_classification || Object.keys(replies.by_classification).length === 0) && (
                <div style={{ fontSize: 11, color: MUTED, fontFamily: "monospace" }}>No replies classified yet.</div>
              )}
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}
