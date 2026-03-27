"use client";
import { useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import dynamic from "next/dynamic";
import { GOLD, DARK, PANEL, BORDER, TEXT, MUTED, GREEN, RED, BLUE, CHART_TOOLTIP, CHART_TICK, CHART_LEGEND, PALETTE_COLORS } from "@/app/lib/theme";
import type { StatsCache, GHLData } from "@/app/hooks/useDashboard";

const TerritoryMap = dynamic(() => import("@/app/components/TerritoryMap"), { ssr: false });

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "20px 20px 12px" }}>
      <div style={{ fontSize: 10, color: MUTED, fontFamily: "monospace", letterSpacing: 2, marginBottom: 16 }}>{title}</div>
      {children}
    </div>
  );
}

function SenderTable({ byS }: { byS: Record<string, { total: number; today: number; form: number; email: number; replies: number; interested: number }> }) {
  const rows = Object.entries(byS)
    .filter(([s]) => s && s !== "unknown")
    .map(([sender, v]) => ({
      sender,
      total:        v.total,
      today:        v.today,
      reach:        v.total > 0 ? +((v.form + v.email) / v.total * 100).toFixed(1) : 0,
      replyRate:    v.total > 0 ? +(v.replies  / v.total * 100).toFixed(1) : 0,
      intRate:      v.total > 0 ? +(v.interested / v.total * 100).toFixed(1) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  if (rows.length === 0) return (
    <div style={{ padding: 32, textAlign: "center", color: MUTED, fontSize: 11, fontFamily: "monospace" }}>
      No sender data yet.
    </div>
  );

  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          {["SENDER", "SENDS", "TODAY", "REACH %", "REPLY %", "INT %"].map(h => (
            <th key={h} style={{ padding: "8px 16px", fontSize: 9, color: MUTED, fontFamily: "monospace", letterSpacing: 1, textAlign: h === "SENDER" ? "left" : "right", borderBottom: `1px solid ${BORDER}`, fontWeight: 400 }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.sender} style={{ background: i % 2 === 0 ? "transparent" : DARK + "40" }}>
            <td style={{ padding: "10px 16px", fontSize: 11, color: TEXT, fontFamily: "monospace" }}>{r.sender}</td>
            <td style={{ padding: "10px 16px", fontSize: 11, color: TEXT, fontFamily: "monospace", textAlign: "right" }}>{r.total.toLocaleString()}</td>
            <td style={{ padding: "10px 16px", fontSize: 11, color: r.today > 0 ? GOLD : MUTED, fontFamily: "monospace", textAlign: "right" }}>{r.today}</td>
            <td style={{ padding: "10px 16px", fontSize: 11, color: BLUE, fontFamily: "monospace", textAlign: "right" }}>{r.reach}%</td>
            <td style={{ padding: "10px 16px", fontSize: 11, color: r.replyRate > 0 ? GREEN : MUTED, fontFamily: "monospace", textAlign: "right" }}>{r.replyRate}%</td>
            <td style={{ padding: "10px 16px", fontSize: 11, color: r.intRate > 0 ? GOLD : MUTED, fontFamily: "monospace", textAlign: "right" }}>{r.intRate}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

type AnalyticsTab = "volume" | "trades" | "senders" | "territory";

interface Props {
  stats:        StatsCache | null;
  ghlData:      GHLData    | null;
  analyticsTab: AnalyticsTab;
  setAnalyticsTab: (t: AnalyticsTab) => void;
}

export default function AnalyticsSection({ stats, ghlData, analyticsTab, setAnalyticsTab }: Props) {
  const [mapTerrFilter, setMapTerrFilter] = useState("");
  const pdsD  = stats?.pds;
  const stphD = stats?.stephie;
  const repD  = stats?.replies;

  // Reply rate per territory — derived from activity feed (approximate, last ~50 events)
  const terrReplyRate: Record<string, { replies: number; sends: number }> = {};
  for (const item of stats?.activity ?? []) {
    if (!item.territory) continue;
    if (!terrReplyRate[item.territory]) terrReplyRate[item.territory] = { replies: 0, sends: 0 };
    if (item.type === "REPLY") terrReplyRate[item.territory].replies++;
    if (item.type === "SEND")  terrReplyRate[item.territory].sends++;
  }

  // 30-day combined volume
  const vol30 = (pdsD?.rolling_30d ?? []).map((d, i) => ({
    date:    d.date.slice(5),
    pds:     d.total,
    stephie: stphD?.rolling_30d?.[i]?.total ?? 0,
  }));

  // 7-day reply rate trend
  const replyTrend = (pdsD?.rolling_7d ?? []).map(d => ({
    date:    d.date.slice(5),
    sends:   d.total,
    replies: d.replies ?? 0,
    rate:    d.total > 0 ? +((d.replies ?? 0) / d.total * 100).toFixed(2) : 0,
  }));

  // Outcome funnel
  const totalContacted = (pdsD?.total ?? 0) + (stphD?.total ?? 0);
  const interested = repD?.by_classification?.INTERESTED ?? repD?.by_classification?.interested ?? 0;
  const funnelData = [
    { stage: "Contacted",   value: totalContacted,                    fill: GOLD     },
    { stage: "Replied",     value: repD?.total ?? 0,                  fill: BLUE     },
    { stage: "Interested",  value: interested,                        fill: GREEN    },
    { stage: "Opportunity", value: ghlData?.open_opportunities ?? 0,  fill: "#9B59B6" },
  ];

  // Trade data
  const tradeData = Object.entries(pdsD?.by_trade ?? {})
    .filter(([t]) => t && t !== "Other" && t !== "unknown")
    .map(([trade, v]) => ({
      trade:    trade.length > 18 ? trade.slice(0, 16) + "…" : trade,
      sends:    v.total,
      forms:    v.form,
      emails:   v.email,
      replies:  v.replies ?? 0,
      replyPct: v.total > 0 ? +((v.replies ?? 0) / v.total * 100).toFixed(1) : 0,
    }))
    .sort((a, b) => b.sends - a.sends)
    .slice(0, 20);

  const TAB_BTN = (id: AnalyticsTab, label: string) => (
    <button key={id} onClick={() => setAnalyticsTab(id)} style={{ padding: "6px 18px", background: analyticsTab === id ? GOLD : "transparent", color: analyticsTab === id ? DARK : MUTED, border: `1px solid ${analyticsTab === id ? GOLD : BORDER}`, borderRadius: 6, fontSize: 10, fontFamily: "monospace", letterSpacing: 1, cursor: "pointer", fontWeight: analyticsTab === id ? 700 : 400 }}>
      {label}
    </button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", gap: 8 }}>
        {TAB_BTN("volume",    "VOLUME")}
        {TAB_BTN("trades",    "TRADES")}
        {TAB_BTN("senders",   "SENDERS")}
        {TAB_BTN("territory", "TERRITORY")}
      </div>

      {/* VOLUME */}
      {analyticsTab === "volume" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <ChartCard title="30-DAY SEND VOLUME">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={vol30} margin={{ top: 4, right: 16, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
                <XAxis dataKey="date" tick={CHART_TICK} interval={4} />
                <YAxis tick={CHART_TICK} />
                <Tooltip {...CHART_TOOLTIP} />
                <Legend {...CHART_LEGEND} />
                <Line type="monotone" dataKey="pds"     stroke={GOLD} strokeWidth={2} dot={false} name="PDS" />
                <Line type="monotone" dataKey="stephie" stroke={BLUE} strokeWidth={2} dot={false} name="Stephie" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="7-DAY REPLY RATE TREND">
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={replyTrend} margin={{ top: 4, right: 16, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
                <XAxis dataKey="date" tick={CHART_TICK} />
                <YAxis tick={CHART_TICK} unit="%" domain={[0, "auto"]} />
                <Tooltip {...CHART_TOOLTIP} formatter={(v: number | undefined) => [`${v ?? 0}%`, "Reply Rate"]} />
                <Line type="monotone" dataKey="rate" stroke={GREEN} strokeWidth={2} dot={{ r: 3, fill: GREEN }} name="Reply %" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="OUTCOME FUNNEL">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={funnelData} layout="vertical" margin={{ top: 4, right: 40, bottom: 0, left: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={BORDER} horizontal={false} />
                <XAxis type="number" tick={CHART_TICK} />
                <YAxis type="category" dataKey="stage" tick={{ ...CHART_TICK, fontSize: 9 }} width={70} />
                <Tooltip {...CHART_TOOLTIP} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {funnelData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 8 }}>
              {funnelData.map(f => (
                <div key={f.stage} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: f.fill, display: "inline-block" }} />
                  <span style={{ fontSize: 9, color: MUTED, fontFamily: "monospace" }}>{f.stage}: {f.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </ChartCard>
        </div>
      )}

      {/* TRADES */}
      {analyticsTab === "trades" && (
        <ChartCard title="SENDS + REPLY RATE BY TRADE (TOP 20)">
          {tradeData.length === 0
            ? <div style={{ padding: 40, textAlign: "center", color: MUTED, fontSize: 11, fontFamily: "monospace" }}>No trade data yet</div>
            : <ResponsiveContainer width="100%" height={Math.max(320, tradeData.length * 28)}>
                <BarChart data={tradeData} layout="vertical" margin={{ top: 4, right: 60, bottom: 4, left: 130 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={BORDER} horizontal={false} />
                  <XAxis type="number" tick={CHART_TICK} />
                  <YAxis type="category" dataKey="trade" tick={{ ...CHART_TICK, fontSize: 9 }} width={120} />
                  <Tooltip {...CHART_TOOLTIP} />
                  <Legend {...CHART_LEGEND} />
                  <Bar dataKey="forms"   stackId="a" fill={BLUE}    name="Forms"   />
                  <Bar dataKey="emails"  stackId="a" fill="#1A6FA0" name="Emails"  />
                  <Bar dataKey="replies" fill={GREEN} name="Replies" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
          }
        </ChartCard>
      )}

      {/* SENDERS */}
      {analyticsTab === "senders" && (
        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${BORDER}` }}>
            <span style={{ fontSize: 10, color: MUTED, fontFamily: "monospace", letterSpacing: 2 }}>SENDER PERFORMANCE</span>
          </div>
          <SenderTable byS={pdsD?.by_sender ?? {}} />
        </div>
      )}

      {/* TERRITORY */}
      {analyticsTab === "territory" && (() => {
        const byT  = pdsD?.by_territory ?? {};
        const byC  = pdsD?.by_city ?? {};
        const territories = [...Object.keys(byT)].sort((a, b) => byT[b].total - byT[a].total);
        const sortedTerrNames = [...territories].sort();
        const terrColor = (t: string) => PALETTE_COLORS[sortedTerrNames.indexOf(t) % PALETTE_COLORS.length] ?? MUTED;

        const barData = territories.map(t => ({
          name:  t.length > 14 ? t.slice(0, 13) + "…" : t,
          full:  t,
          sends: byT[t].total,
          reach: byT[t].total > 0 ? +((byT[t].form + byT[t].email) / byT[t].total * 100).toFixed(1) : 0,
        }));

        const dates30 = byT[territories[0]]?.rolling_30d?.map(d => d.date.slice(5)) ?? [];
        const trend30 = dates30.map((date, i) => {
          const pt: Record<string, number | string> = { date };
          for (const t of territories) {
            pt[t.length > 14 ? t.slice(0, 13) + "…" : t] = byT[t].rolling_30d?.[i]?.total ?? 0;
          }
          return pt as Record<string, number>;
        });

        if (territories.length === 0) return (
          <div style={{ padding: 40, textAlign: "center", color: MUTED, fontSize: 11, fontFamily: "monospace" }}>
            No territory data — address field must be populated in outreach logs
          </div>
        );

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(territories.length, 4)}, 1fr)`, gap: 12 }}>
              {territories.map(t => {
                const v     = byT[t];
                const color = terrColor(t);
                const reach = v.total > 0 ? ((v.form + v.email) / v.total * 100).toFixed(1) : "0.0";
                const rr    = terrReplyRate[t];
                const replyPct = rr && rr.sends > 0 ? (rr.replies / rr.sends * 100).toFixed(1) : null;
                return (
                  <div key={t} style={{ background: PANEL, border: `1px solid ${color}33`, borderRadius: 10, padding: 16 }}>
                    <div style={{ fontSize: 9, color: MUTED, fontFamily: "monospace", letterSpacing: 1, marginBottom: 6 }}>TERRITORY</div>
                    <div style={{ fontSize: 12, color, fontFamily: "monospace", fontWeight: 700, marginBottom: 10 }}>{t.toUpperCase()}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                      {[
                        { l: "SENDS",    v: v.total.toLocaleString(),                         c: TEXT  },
                        { l: "REACH %",  v: `${reach}%`,                                      c: color },
                        { l: "FORMS",    v: v.form.toLocaleString(),                          c: BLUE  },
                        { l: "EMAILS",   v: v.email.toLocaleString(),                         c: BLUE  },
                        { l: "~REPLY %", v: replyPct !== null ? `${replyPct}%` : "—",         c: replyPct !== null ? GREEN : MUTED },
                      ].map(({ l, v: val, c }) => (
                        <div key={l}>
                          <div style={{ fontSize: 8, color: MUTED, fontFamily: "monospace", letterSpacing: 1 }}>{l}</div>
                          <div style={{ fontSize: 13, color: c, fontFamily: "monospace", fontWeight: 600 }}>{val}</div>
                        </div>
                      ))}
                    </div>
                    {v.top_trades.length > 0 && (
                      <div style={{ marginTop: 10, borderTop: `1px solid ${BORDER}`, paddingTop: 8 }}>
                        <div style={{ fontSize: 8, color: MUTED, fontFamily: "monospace", letterSpacing: 1, marginBottom: 4 }}>TOP TRADES</div>
                        {v.top_trades.map(tr => (
                          <div key={tr.trade} style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                            <span style={{ fontSize: 9, color: MUTED, fontFamily: "monospace" }}>{tr.trade.replace(/_/g, " ")}</span>
                            <span style={{ fontSize: 9, color: TEXT,  fontFamily: "monospace" }}>{tr.count}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <ChartCard title="SEND DENSITY MAP">
              {/* Territory filter */}
              <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                <button onClick={() => setMapTerrFilter("")} style={{ background: !mapTerrFilter ? GOLD + "22" : "transparent", border: `1px solid ${!mapTerrFilter ? GOLD : BORDER}`, borderRadius: 6, padding: "4px 12px", fontSize: 9, color: !mapTerrFilter ? GOLD : MUTED, fontFamily: "monospace", letterSpacing: 1, cursor: "pointer" }}>
                  ALL
                </button>
                {sortedTerrNames.map((t, i) => (
                  <button key={t} onClick={() => setMapTerrFilter(mapTerrFilter === t ? "" : t)} style={{ background: mapTerrFilter === t ? PALETTE_COLORS[i % PALETTE_COLORS.length] + "22" : "transparent", border: `1px solid ${mapTerrFilter === t ? PALETTE_COLORS[i % PALETTE_COLORS.length] : BORDER}`, borderRadius: 6, padding: "4px 12px", fontSize: 9, color: mapTerrFilter === t ? PALETTE_COLORS[i % PALETTE_COLORS.length] : MUTED, fontFamily: "monospace", letterSpacing: 1, cursor: "pointer" }}>
                    {t}
                  </button>
                ))}
              </div>
              <TerritoryMap byCity={byC} territory={mapTerrFilter || undefined} />
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 10 }}>
                {sortedTerrNames.map((t, i) => (
                  <div key={t} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: PALETTE_COLORS[i % PALETTE_COLORS.length], display: "inline-block", opacity: 0.8 }} />
                    <span style={{ fontSize: 9, color: MUTED, fontFamily: "monospace" }}>{t}</span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 9, color: MUTED, fontFamily: "monospace", marginTop: 8 }}>
                ~REPLY % is estimated from recent activity feed. For full territory reply analytics, update push-stats-cache.py to include replies per territory.
              </div>
            </ChartCard>

            <ChartCard title="30-DAY SEND VOLUME BY TERRITORY">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trend30} margin={{ top: 4, right: 16, bottom: 0, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
                  <XAxis dataKey="date" tick={CHART_TICK} interval={4} />
                  <YAxis tick={CHART_TICK} />
                  <Tooltip {...CHART_TOOLTIP} />
                  <Legend {...CHART_LEGEND} />
                  {territories.map(t => {
                    const key = t.length > 14 ? t.slice(0, 13) + "…" : t;
                    return <Line key={t} type="monotone" dataKey={key} stroke={terrColor(t)} strokeWidth={2} dot={false} />;
                  })}
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="REACH RATE BY TERRITORY">
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={barData} margin={{ top: 4, right: 16, bottom: 0, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
                  <XAxis dataKey="name" tick={CHART_TICK} />
                  <YAxis tick={CHART_TICK} unit="%" domain={[0, 100]} />
                  <Tooltip {...CHART_TOOLTIP} formatter={(v: number | undefined) => [`${v ?? 0}%`, "Reach Rate"]} />
                  <Bar dataKey="reach" radius={[4, 4, 0, 0]}>
                    {barData.map((entry, i) => <Cell key={i} fill={terrColor(entry.full)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        );
      })()}
    </div>
  );
}
