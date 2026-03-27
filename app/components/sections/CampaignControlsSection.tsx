"use client";
import { useState, useEffect } from "react";
import { GOLD, DARK, PANEL, BORDER, TEXT, MUTED, GREEN, RED, BLUE } from "@/app/lib/theme";
import type { CampaignHealth } from "@/app/hooks/useDashboard";
import type { Territory, CampaignTemplate, CampaignControls } from "@/app/api/campaigns/route";

const DEMO_CONTROLS: CampaignControls = {
  paused: { "BreezePro Outreach": false, "Commercial Pipeline": false },
  territories: [
    { id: "1", name: "Phoenix Metro",          campaign: "BreezePro Outreach",   active: true, added_at: "2026-02-15T08:00:00Z" },
    { id: "2", name: "East Valley / Scottsdale", campaign: "BreezePro Outreach", active: true, added_at: "2026-02-15T08:00:00Z" },
    { id: "3", name: "Tucson Metro",            campaign: "BreezePro Outreach",   active: true, added_at: "2026-02-20T08:00:00Z" },
    { id: "4", name: "Phoenix West",            campaign: "BreezePro Outreach",   active: false, added_at: "2026-02-22T08:00:00Z" },
    { id: "5", name: "Commercial Accounts",     campaign: "Commercial Pipeline",  active: true, added_at: "2026-02-15T08:00:00Z" },
  ],
  templates: [
    { id: "t1", name: "HVAC Residential Form",     type: "form",  campaign: "BreezePro Outreach",  last_used: "2026-03-27", preview: "Hi, I help HVAC companies in Phoenix get more residential installs through..." },
    { id: "t2", name: "AC Repair Email Outreach",  type: "email", campaign: "BreezePro Outreach",  last_used: "2026-03-27", preview: "Subject: Quick question about your AC repair volume..." },
    { id: "t3", name: "Seasonal Tune-Up Form",     type: "form",  campaign: "BreezePro Outreach",  last_used: "2026-03-24", preview: "With summer coming, homeowners are booking tune-ups early. We help HVAC teams..." },
    { id: "t4", name: "Commercial HVAC Form",      type: "form",  campaign: "Commercial Pipeline",  last_used: "2026-03-26", preview: "We work with commercial property managers across Phoenix to optimize..." },
    { id: "t5", name: "Maintenance Contract Email",type: "email", campaign: "Commercial Pipeline",  last_used: "2026-03-25", preview: "Subject: Recurring maintenance contracts — worth a 15 min call?" },
  ],
};

interface Props {
  campaigns: CampaignHealth[];
  isDemo?: boolean;
}

export default function CampaignControlsSection({ campaigns, isDemo }: Props) {
  const [controls, setControls]       = useState<CampaignControls>({ paused: {}, territories: [], templates: [] });
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState<string | null>(null);
  const [ctrlTab, setCtrlTab]         = useState<"pause" | "territories" | "templates">("pause");
  const [addTerr, setAddTerr]         = useState(false);
  const [newTerrName, setNewTerrName] = useState("");
  const [newTerrCamp, setNewTerrCamp] = useState(campaigns[0]?.name ?? "");
  const [editId, setEditId]           = useState<string | null>(null);
  const [editName, setEditName]       = useState("");
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);

  useEffect(() => {
    if (isDemo) { setControls(DEMO_CONTROLS); setLoading(false); return; }
    fetch("/api/campaigns").then(r => r.json()).then(d => { setControls(d); setLoading(false); }).catch(() => setLoading(false));
  }, [isDemo]);

  async function togglePause(name: string) {
    if (isDemo) { setControls(c => ({ ...c, paused: { ...c.paused, [name]: !c.paused[name] } })); return; }
    setSaving(name);
    const res = await fetch("/api/campaigns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "toggle_pause", campaign: name }) });
    const data = await res.json();
    if (data.controls) setControls(data.controls);
    setSaving(null);
  }

  async function addTerritory() {
    if (!newTerrName.trim()) return;
    const campName = newTerrCamp || campaigns[0]?.name || "Unassigned";
    if (isDemo) {
      setControls(c => ({ ...c, territories: [...c.territories, { id: Date.now().toString(), name: newTerrName.trim(), campaign: campName, active: true, added_at: new Date().toISOString() }] }));
    } else {
      const res = await fetch("/api/campaigns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "add_territory", name: newTerrName.trim(), campaign: campName }) });
      const data = await res.json();
      if (data.controls) setControls(data.controls);
    }
    setNewTerrName(""); setAddTerr(false);
  }

  async function removeTerritory(id: string) {
    if (isDemo) { setControls(c => ({ ...c, territories: c.territories.filter(t => t.id !== id) })); return; }
    const res = await fetch("/api/campaigns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "remove_territory", id }) });
    const data = await res.json();
    if (data.controls) setControls(data.controls);
  }

  async function saveEditTerritory(id: string) {
    if (!editName.trim()) return;
    if (isDemo) {
      setControls(c => ({ ...c, territories: c.territories.map(t => t.id === id ? { ...t, name: editName.trim() } : t) }));
    } else {
      const res = await fetch("/api/campaigns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update_territory", id, updates: { name: editName.trim() } }) });
      const data = await res.json();
      if (data.controls) setControls(data.controls);
    }
    setEditId(null); setEditName("");
  }

  async function toggleTerritoryActive(t: Territory) {
    const updates = { active: !t.active };
    if (isDemo) {
      setControls(c => ({ ...c, territories: c.territories.map(x => x.id === t.id ? { ...x, ...updates } : x) }));
    } else {
      const res = await fetch("/api/campaigns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update_territory", id: t.id, updates }) });
      const data = await res.json();
      if (data.controls) setControls(data.controls);
    }
  }

  const subTabs = [
    { id: "pause" as const,       label: "PAUSE / RESUME" },
    { id: "territories" as const, label: "TERRITORIES" },
    { id: "templates" as const,   label: "TEMPLATES" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ fontSize: 11, letterSpacing: 2, color: MUTED, fontFamily: "monospace" }}>
        CAMPAIGN CONTROLS — {campaigns.length} CAMPAIGN{campaigns.length !== 1 ? "S" : ""}
      </div>

      {/* Sub-tab bar */}
      <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${BORDER}`, paddingBottom: 12 }}>
        {subTabs.map(t => (
          <button key={t.id} onClick={() => setCtrlTab(t.id)} style={{ background: ctrlTab === t.id ? GOLD + "22" : "transparent", border: `1px solid ${ctrlTab === t.id ? GOLD : BORDER}`, borderRadius: 6, padding: "6px 14px", fontSize: 10, color: ctrlTab === t.id ? GOLD : MUTED, fontFamily: "monospace", letterSpacing: 1, cursor: "pointer" }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading && <div style={{ color: MUTED, fontFamily: "monospace", fontSize: 12 }}>Loading controls...</div>}

      {/* ── PAUSE / RESUME ─────────────────────────────────────────────────── */}
      {!loading && ctrlTab === "pause" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {campaigns.length === 0 && (
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 40, textAlign: "center", color: MUTED, fontFamily: "monospace", fontSize: 12 }}>
              No campaigns found.
            </div>
          )}
          {campaigns.map(c => {
            const isPaused = !!controls.paused[c.name];
            const isSaving = saving === c.name;
            return (
              <div key={c.name} style={{ background: PANEL, border: `1px solid ${isPaused ? MUTED : BORDER}`, borderRadius: 12, padding: 24, display: "flex", alignItems: "center", gap: 20, opacity: isPaused ? 0.7 : 1 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: isPaused ? MUTED : GOLD, fontFamily: "monospace", fontWeight: 700, letterSpacing: 1 }}>{c.name.toUpperCase()}</div>
                  <div style={{ fontSize: 10, color: MUTED, marginTop: 4 }}>{c.total.toLocaleString()} total · {c.today.toLocaleString()} today</div>
                  <div style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>
                    Reach {(c.reach_rate * 100).toFixed(1)}% · Skip {(c.skip_rate * 100).toFixed(1)}% · Error {(c.error_rate * 100).toFixed(1)}%
                  </div>
                </div>

                {/* Status badge */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <div style={{ fontSize: 10, color: isPaused ? RED : GREEN, fontFamily: "monospace", letterSpacing: 1 }}>
                    {isPaused ? "PAUSED" : "ACTIVE"}
                  </div>
                  {/* Toggle */}
                  <div onClick={() => !isSaving && togglePause(c.name)} style={{ width: 48, height: 26, borderRadius: 13, background: isPaused ? DARK : GREEN + "44", border: `1px solid ${isPaused ? MUTED : GREEN}`, cursor: isSaving ? "wait" : "pointer", position: "relative", transition: "all 0.2s" }}>
                    <div style={{ position: "absolute", top: 3, left: isPaused ? 4 : 22, width: 18, height: 18, borderRadius: "50%", background: isPaused ? MUTED : GREEN, transition: "all 0.2s" }} />
                  </div>
                  {isSaving && <div style={{ fontSize: 9, color: MUTED, fontFamily: "monospace" }}>saving...</div>}
                </div>
              </div>
            );
          })}
          <div style={{ fontSize: 10, color: MUTED, fontFamily: "monospace", padding: "4px 0" }}>
            Pause flag is saved to Gist — VPS cron checks this before each run.
          </div>
        </div>
      )}

      {/* ── TERRITORY MANAGER ──────────────────────────────────────────────── */}
      {!loading && ctrlTab === "territories" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Add territory */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            {!addTerr ? (
              <button onClick={() => setAddTerr(true)} style={{ background: GOLD + "22", border: `1px solid ${GOLD}`, borderRadius: 6, padding: "7px 16px", fontSize: 10, color: GOLD, fontFamily: "monospace", letterSpacing: 1, cursor: "pointer" }}>
                + ADD TERRITORY
              </button>
            ) : (
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input value={newTerrName} onChange={e => setNewTerrName(e.target.value)} onKeyDown={e => e.key === "Enter" && addTerritory()} placeholder="Territory name" style={{ background: DARK, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "7px 12px", fontSize: 11, color: TEXT, fontFamily: "monospace", outline: "none", width: 180 }} />
                <select value={newTerrCamp} onChange={e => setNewTerrCamp(e.target.value)} style={{ background: DARK, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "7px 12px", fontSize: 11, color: TEXT, fontFamily: "monospace", outline: "none" }}>
                  {campaigns.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
                <button onClick={addTerritory} style={{ background: GOLD + "22", border: `1px solid ${GOLD}`, borderRadius: 6, padding: "7px 14px", fontSize: 10, color: GOLD, fontFamily: "monospace", cursor: "pointer" }}>SAVE</button>
                <button onClick={() => { setAddTerr(false); setNewTerrName(""); }} style={{ background: "transparent", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "7px 14px", fontSize: 10, color: MUTED, fontFamily: "monospace", cursor: "pointer" }}>CANCEL</button>
              </div>
            )}
          </div>

          {/* Territory table */}
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
            {/* Header */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 80px 100px", gap: 12, padding: "10px 20px", borderBottom: `1px solid ${BORDER}`, fontSize: 9, color: MUTED, fontFamily: "monospace", letterSpacing: 1 }}>
              <span>TERRITORY</span><span>CAMPAIGN</span><span>STATUS</span><span style={{ textAlign: "right" }}>ACTIONS</span>
            </div>
            {controls.territories.length === 0 && (
              <div style={{ padding: 32, textAlign: "center", color: MUTED, fontFamily: "monospace", fontSize: 11 }}>
                No territories configured. Add one above.
              </div>
            )}
            {controls.territories.map(t => (
              <div key={t.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 80px 100px", gap: 12, padding: "12px 20px", borderBottom: `1px solid ${BORDER}`, alignItems: "center" }}>
                {editId === t.id ? (
                  <input value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => e.key === "Enter" && saveEditTerritory(t.id)} autoFocus style={{ background: DARK, border: `1px solid ${GOLD}`, borderRadius: 4, padding: "4px 8px", fontSize: 11, color: TEXT, fontFamily: "monospace", outline: "none" }} />
                ) : (
                  <span style={{ fontSize: 12, color: t.active ? TEXT : MUTED, fontFamily: "monospace" }}>{t.name}</span>
                )}
                <span style={{ fontSize: 11, color: MUTED, fontFamily: "monospace" }}>{t.campaign}</span>
                <span>
                  <span onClick={() => toggleTerritoryActive(t)} style={{ cursor: "pointer", fontSize: 10, color: t.active ? GREEN : MUTED, fontFamily: "monospace", letterSpacing: 1 }}>
                    {t.active ? "ACTIVE" : "OFF"}
                  </span>
                </span>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  {editId === t.id ? (
                    <>
                      <button onClick={() => saveEditTerritory(t.id)} style={{ background: "transparent", border: `1px solid ${GOLD}`, borderRadius: 4, padding: "3px 8px", fontSize: 9, color: GOLD, fontFamily: "monospace", cursor: "pointer" }}>SAVE</button>
                      <button onClick={() => setEditId(null)} style={{ background: "transparent", border: `1px solid ${BORDER}`, borderRadius: 4, padding: "3px 8px", fontSize: 9, color: MUTED, fontFamily: "monospace", cursor: "pointer" }}>✕</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => { setEditId(t.id); setEditName(t.name); }} style={{ background: "transparent", border: `1px solid ${BORDER}`, borderRadius: 4, padding: "3px 8px", fontSize: 9, color: MUTED, fontFamily: "monospace", cursor: "pointer" }}>EDIT</button>
                      <button onClick={() => removeTerritory(t.id)} style={{ background: "transparent", border: `1px solid ${RED}22`, borderRadius: 4, padding: "3px 8px", fontSize: 9, color: RED, fontFamily: "monospace", cursor: "pointer" }}>DEL</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TEMPLATE VIEWER ────────────────────────────────────────────────── */}
      {!loading && ctrlTab === "templates" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 10, color: MUTED, fontFamily: "monospace" }}>
            Read-only. Templates are managed on VPS — metadata pushed to Gist via cron.
          </div>
          {controls.templates.length === 0 && (
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 40, textAlign: "center", color: MUTED, fontFamily: "monospace", fontSize: 11 }}>
              No templates in Gist yet. VPS push-stats-cache.py will populate this once template metadata is added.
            </div>
          )}
          {controls.templates.map(t => (
            <div key={t.id} style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: expandedTemplate === t.id ? 12 : 0 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: GOLD, fontFamily: "monospace", fontWeight: 700 }}>{t.name}</div>
                  <div style={{ fontSize: 10, color: MUTED, marginTop: 3 }}>{t.campaign} · Last used {t.last_used}</div>
                </div>
                <div style={{ background: t.type === "form" ? GREEN + "22" : BLUE + "22", border: `1px solid ${t.type === "form" ? GREEN : BLUE}`, borderRadius: 6, padding: "4px 10px", fontSize: 9, color: t.type === "form" ? GREEN : BLUE, fontFamily: "monospace", letterSpacing: 1 }}>
                  {t.type.toUpperCase()}
                </div>
                <button onClick={() => setExpandedTemplate(expandedTemplate === t.id ? null : t.id)} style={{ background: "transparent", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "5px 12px", fontSize: 10, color: MUTED, fontFamily: "monospace", cursor: "pointer" }}>
                  {expandedTemplate === t.id ? "HIDE" : "PREVIEW"}
                </button>
              </div>
              {expandedTemplate === t.id && (
                <div style={{ background: DARK, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 14, fontSize: 11, color: TEXT, fontFamily: "monospace", lineHeight: 1.6 }}>
                  {t.preview}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
