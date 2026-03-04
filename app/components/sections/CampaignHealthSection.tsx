"use client";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { GOLD, DARK, PANEL, BORDER, MUTED, GREEN, RED, BLUE } from "@/app/lib/theme";
import type { CampaignHealth } from "@/app/hooks/useDashboard";

export default function CampaignHealthSection({ campaigns }: { campaigns: CampaignHealth[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ fontSize: 11, letterSpacing: 2, color: MUTED, fontFamily: "monospace" }}>
        CAMPAIGN HEALTH — {campaigns.length} CAMPAIGN{campaigns.length !== 1 ? "S" : ""}
      </div>
      {campaigns.length === 0 && (
        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 40, textAlign: "center", color: MUTED, fontFamily: "monospace", fontSize: 12 }}>
          No campaign data available yet.
        </div>
      )}
      {campaigns.map(c => {
        const flagSkip      = c.skip_rate  > 0.20;
        const flagError     = c.error_rate > 0.20;
        const skipPct       = (c.skip_rate  * 100).toFixed(1);
        const errPct        = (c.error_rate * 100).toFixed(1);
        const reachPct      = (c.reach_rate * 100).toFixed(1);
        const todaySkipRate = c.today > 0 ? c.today_by_outcome.skip  / c.today : 0;
        const todayErrRate  = c.today > 0 ? c.today_by_outcome.error / c.today : 0;
        const sparkData     = c.rolling_30d.slice(-14);

        return (
          <div key={c.name} style={{ background: PANEL, border: `1px solid ${c.flagged ? RED : BORDER}`, borderRadius: 12, padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: c.flagged ? RED : GOLD, fontFamily: "monospace", fontWeight: 700, letterSpacing: 1 }}>{c.name.toUpperCase()}</div>
                <div style={{ fontSize: 10, color: MUTED, marginTop: 3 }}>{c.total.toLocaleString()} total · {c.today.toLocaleString()} today</div>
              </div>
              {c.flagged && (
                <div style={{ background: RED + "22", border: `1px solid ${RED}`, borderRadius: 6, padding: "4px 10px", fontSize: 10, color: RED, fontFamily: "monospace", letterSpacing: 1 }}>
                  ⚠ HIGH {flagSkip ? "SKIP" : "ERROR"} RATE
                </div>
              )}
            </div>

            {/* Rate badges */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {[
                { label: "REACH",      value: reachPct + "%",                        color: GOLD,  flag: false },
                { label: "SKIP",       value: skipPct  + "%",                        color: flagSkip  ? RED : MUTED, flag: flagSkip  },
                { label: "ERROR",      value: errPct   + "%",                        color: flagError ? RED : MUTED, flag: flagError },
                { label: "TODAY↑SKIP", value: (todaySkipRate * 100).toFixed(1) + "%", color: todaySkipRate > 0.20 ? RED : MUTED, flag: todaySkipRate > 0.20 },
                { label: "TODAY↑ERR",  value: (todayErrRate  * 100).toFixed(1) + "%", color: todayErrRate  > 0.20 ? RED : MUTED, flag: todayErrRate  > 0.20 },
              ].map(({ label, value, color, flag }) => (
                <div key={label} style={{ background: flag ? RED + "18" : DARK, border: `1px solid ${flag ? RED : BORDER}`, borderRadius: 6, padding: "6px 12px", minWidth: 80 }}>
                  <div style={{ fontSize: 9, color: MUTED, letterSpacing: 1, marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 15, fontFamily: "monospace", fontWeight: 700, color }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Outcome breakdown */}
            <div>
              <div style={{ fontSize: 9, color: MUTED, letterSpacing: 1, marginBottom: 6 }}>ALL-TIME OUTCOME BREAKDOWN</div>
              <div style={{ display: "flex", gap: 8 }}>
                {(["form", "email", "skip", "error"] as const).map(k => {
                  const count = c.by_outcome[k];
                  const pct   = c.total > 0 ? (count / c.total * 100).toFixed(1) : "0.0";
                  const col   = k === "form" ? GREEN : k === "email" ? BLUE : k === "error" ? RED : MUTED;
                  return (
                    <div key={k} style={{ flex: 1, textAlign: "center" }}>
                      <div style={{ fontSize: 14, fontFamily: "monospace", fontWeight: 700, color: col }}>{count.toLocaleString()}</div>
                      <div style={{ fontSize: 8, color: MUTED, letterSpacing: 1 }}>{k.toUpperCase()} {pct}%</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 14-day sparkline */}
            <div>
              <div style={{ fontSize: 9, color: MUTED, letterSpacing: 1, marginBottom: 6 }}>LAST 14 DAYS — SENDS / SKIP / ERROR</div>
              <ResponsiveContainer width="100%" height={80}>
                <BarChart data={sparkData} margin={{ top: 0, right: 0, left: -30, bottom: 0 }} barSize={8} barGap={1}>
                  <XAxis dataKey="date" tick={{ fontSize: 7, fill: MUTED }} tickFormatter={v => v.slice(5)} interval={2} />
                  <YAxis tick={false} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 10 }}
                    labelStyle={{ color: MUTED }}
                    formatter={(v: number | undefined, name: string | undefined) => [v?.toLocaleString() ?? 0, name ?? ""]}
                  />
                  <Bar dataKey="total" name="Total" fill={GOLD + "60"} stackId="a" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="skip"  name="Skip"  fill={MUTED}       stackId="b" />
                  <Bar dataKey="error" name="Error" fill={RED}         stackId="b" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })}
    </div>
  );
}
