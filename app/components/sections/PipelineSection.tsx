"use client";
import { GOLD, DARK, PANEL, BORDER, TEXT, MUTED, GREEN, BLUE } from "@/app/lib/theme";
import LeadScorePanel from "@/app/components/sections/LeadScorePanel";

type PipelineTab = "closers" | "contacts" | "opportunities" | "leads";

interface PipelineSectionProps {
  role: string;
  seatInfo: { ghlId: string };
  closers: any[];
  ghlData?: { total_contacts?: number; open_opportunities?: number } | null;
  pipelineTab: PipelineTab;
  setPipelineTab: (tab: PipelineTab) => void;
  setSelectedCloser: (closer: any) => void;
  CloserRow: any;
  ContactsPanel: any;
  OpportunitiesPanel: any;
}

const tabBtn = (current: PipelineTab, id: PipelineTab, label: string, set: (t: PipelineTab) => void) => (
  <button key={id} onClick={() => set(id)} style={{ background: current === id ? GOLD : "none", border: "none", borderRadius: 7, padding: "7px 18px", color: current === id ? DARK : MUTED, fontSize: 10, fontWeight: 700, letterSpacing: 1, cursor: "pointer", fontFamily: "monospace", transition: "all 0.15s" }}>
    {label}
  </button>
);

export default function PipelineSection(props: PipelineSectionProps) {
  const { role, seatInfo, closers, ghlData, pipelineTab, setPipelineTab, setSelectedCloser, CloserRow, ContactsPanel, OpportunitiesPanel } = props;

  // ── CLOSER view ─────────────────────────────────────────────────────────────
  if (role === "CLOSER") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div className="stat-grid-3">
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "20px 24px", display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 11, letterSpacing: 2, color: MUTED, textTransform: "uppercase", fontFamily: "monospace" }}>My GHL Leads</span>
            <span style={{ fontSize: 32, fontWeight: 700, color: GREEN, fontFamily: "'Courier New', monospace", lineHeight: 1 }}>{closers.find(c => c.id === seatInfo.ghlId)?.leads ?? 0}</span>
            <span style={{ fontSize: 11, color: MUTED, fontFamily: "monospace" }}>Contacts assigned to me</span>
          </div>
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "20px 24px", display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 11, letterSpacing: 2, color: MUTED, textTransform: "uppercase", fontFamily: "monospace" }}>My Sends</span>
            <span style={{ fontSize: 32, fontWeight: 700, color: BLUE, fontFamily: "'Courier New', monospace", lineHeight: 1 }}>{closers.find(c => c.id === seatInfo.ghlId)?.sends ?? 0}</span>
            <span style={{ fontSize: 11, color: MUTED, fontFamily: "monospace" }}>Outreach attributed</span>
          </div>
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "20px 24px", display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 11, letterSpacing: 2, color: MUTED, textTransform: "uppercase", fontFamily: "monospace" }}>Cold Deals</span>
            <span style={{ fontSize: 32, fontWeight: 700, color: GREEN, fontFamily: "'Courier New', monospace", lineHeight: 1 }}>{closers.find(c => c.id === seatInfo.ghlId)?.cold ?? 0}</span>
            <span style={{ fontSize: 11, color: MUTED, fontFamily: "monospace" }}>No stale deals</span>
          </div>
        </div>

        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}` }}>
            <span style={{ fontSize: 11, letterSpacing: 2, color: MUTED }}>MY PIPELINE</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 160px 80px 80px 80px", padding: "10px 20px", borderBottom: `1px solid ${BORDER}` }}>
            {["CLOSER", "TERRITORY", "LEADS", "SENDS", "COLD"].map((h, i) => (
              <span key={i} style={{ fontSize: 10, color: MUTED, letterSpacing: 1, textAlign: i > 1 ? "center" : "left" }}>{h}</span>
            ))}
          </div>
          {closers.filter(c => c.id === seatInfo.ghlId).map((c, i) => <CloserRow key={i} {...c} />)}
        </div>

        {/* Lead scores tab for closer */}
        <div style={{ display: "flex", gap: 0, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 4, width: "fit-content" }}>
          {tabBtn(pipelineTab, "leads", "LEAD SCORES", setPipelineTab)}
        </div>
        {pipelineTab === "leads" && <LeadScorePanel role={role} closerId={seatInfo.ghlId} />}
      </div>
    );
  }

  // ── OWNER / ADMIN view ───────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="stat-grid-3">
        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "20px 24px", display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 11, letterSpacing: 2, color: MUTED, textTransform: "uppercase", fontFamily: "monospace" }}>Total GHL Contacts</span>
          <span style={{ fontSize: 32, fontWeight: 700, color: TEXT, fontFamily: "'Courier New', monospace", lineHeight: 1 }}>{ghlData?.total_contacts ?? "—"}</span>
          <span style={{ fontSize: 11, color: MUTED, fontFamily: "monospace" }}>Across all closers</span>
        </div>
        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "20px 24px", display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 11, letterSpacing: 2, color: MUTED, textTransform: "uppercase", fontFamily: "monospace" }}>Open Opportunities</span>
          <span style={{ fontSize: 32, fontWeight: 700, color: TEXT, fontFamily: "'Courier New', monospace", lineHeight: 1 }}>{ghlData?.open_opportunities ?? "—"}</span>
          <span style={{ fontSize: 11, color: MUTED, fontFamily: "monospace" }}>Pipeline building</span>
        </div>
        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "20px 24px", display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 11, letterSpacing: 2, color: MUTED, textTransform: "uppercase", fontFamily: "monospace" }}>Cold Deals</span>
          <span style={{ fontSize: 32, fontWeight: 700, color: GREEN, fontFamily: "'Courier New', monospace", lineHeight: 1 }}>0</span>
          <span style={{ fontSize: 11, color: MUTED, fontFamily: "monospace" }}>No stale deals</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 0, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 4, width: "fit-content" }}>
        {(["closers", "contacts", "opportunities", "leads"] as const).map(tab =>
          tabBtn(pipelineTab, tab, tab === "leads" ? "LEAD SCORES" : tab.toUpperCase(), setPipelineTab)
        )}
      </div>

      {pipelineTab === "leads" && <LeadScorePanel role={role} closerId="" />}

      {pipelineTab === "closers" && (
        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}` }}>
            <span style={{ fontSize: 11, letterSpacing: 2, color: MUTED }}>CLOSER PERFORMANCE</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 160px 80px 80px 80px 20px", padding: "10px 20px", borderBottom: `1px solid ${BORDER}` }}>
            {["CLOSER", "TERRITORY", "LEADS", "SENDS", "COLD", ""].map((h, i) => (
              <span key={i} style={{ fontSize: 10, color: MUTED, letterSpacing: 1, textAlign: i > 1 ? "center" : "left" }}>{h}</span>
            ))}
          </div>
          {closers.map((c, i) => <CloserRow key={i} {...c} onClick={() => setSelectedCloser(c)} />)}
        </div>
      )}

      {pipelineTab === "contacts"      && <ContactsPanel pipelineTab={pipelineTab} />}
      {pipelineTab === "opportunities" && <OpportunitiesPanel pipelineTab={pipelineTab} />}
    </div>
  );
}
