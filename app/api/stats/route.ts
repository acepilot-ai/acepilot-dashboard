import { NextResponse } from "next/server";
import fs from "fs";
import readline from "readline";
import path from "path";

const TODAY = new Date().toISOString().slice(0, 10);

// ── Outcome classifier ────────────────────────────────────────────────────────
function classifyOutcome(outcome: string): "form" | "email" | "skip" | "error" {
  if (outcome === "submitted") return "form";
  if (outcome.includes("email_sent")) return "email";
  if (outcome === "no_website" || outcome === "captcha" || outcome === "no_form") return "skip";
  if (outcome.startsWith("error:")) return "error";
  return "skip";
}

// ── Agent status derivation ───────────────────────────────────────────────────
const SCHEDULES: Record<string, number> = {
  "reply-monitor.py": 30,
  "outreach.py": 1440,
  "stephie-outreach.py": 1440,
  "morning-report.py": 1440,
  "pipeline-monitor.py": 1440,
  "nightly-review.py": 1440,
  "taylor-email-cleanup.py": 720,
};

const LOG_PATHS: Record<string, string> = {
  "reply-monitor.py":        "second-brain/02-projects/pds-outreach/reply-monitor.log",
  "outreach.py":             "second-brain/02-projects/pds-outreach/cron.log",
  "morning-report.py":       "second-brain/02-projects/pds-outreach/cron.log",
  "stephie-outreach.py":     "second-brain/02-projects/stephie-outreach/cron.log",
  "pipeline-monitor.py":     "second-brain/02-projects/pds-outreach/pipeline-monitor.log",
  "taylor-email-cleanup.py": "second-brain/02-projects/pds-outreach/email-cleanup.log",
  "nightly-review.py":       "second-brain/_qmd/nightly-review.log",
};

function deriveAgentStatus(name: string, lastModified: string): "running" | "idle" | "error" {
  const interval = SCHEDULES[name];
  if (!interval || !lastModified) return "idle";
  const ageMins = (Date.now() - new Date(lastModified).getTime()) / 60000;
  if (ageMins < interval * 1.5) return "running";
  if (ageMins > interval * 3) return "error";
  return "idle";
}
void deriveAgentStatus; // used externally

// ── Territory derivation ──────────────────────────────────────────────────────
function deriveTerritory(address: string): string {
  const lower = address.toLowerCase();
  const coachella = ["palm springs", "palm desert", "rancho mirage", "cathedral city", "indio", "la quinta", "desert hot springs"];
  if (coachella.some(c => lower.includes(c))) return "Coachella Valley";
  if (lower.includes(", nc") || lower.includes(", sc") || lower.includes("charlotte")) return "Charlotte NC";
  if (lower.includes(", ca")) return "LA County";
  return "Other";
}

// ── JSONL streaming reader ────────────────────────────────────────────────────
async function streamJsonl(filePath: string): Promise<unknown[]> {
  if (!fs.existsSync(filePath)) return [];
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  const rows: unknown[] = [];
  for await (const line of rl) {
    const t = line.trim();
    if (!t) continue;
    try { rows.push(JSON.parse(t)); } catch { /* skip malformed */ }
  }
  return rows;
}

// ── Local JSONL aggregation ───────────────────────────────────────────────────
async function buildFromLocal() {
  const submissionsPath = process.env.SUBMISSIONS_PATH || "";
  const repliesPath     = process.env.REPLIES_PATH || "";
  const stephiePath     = process.env.STEPHIE_PATH || "";

  const [submissions, replies, stephieRows] = await Promise.all([
    streamJsonl(submissionsPath),
    streamJsonl(repliesPath),
    streamJsonl(stephiePath),
  ]);

  // ── Pre-process replies for cross-referencing ─────────────────────────────
  const repliesBySender: Record<string, { total: number; interested: number }> = {};
  const repliesByTrade:  Record<string, { total: number; interested: number }> = {};
  const repliesByDate:   Record<string, { total: number; interested: number }> = {};

  for (const r of replies as Record<string, string>[]) {
    const sender     = r.sender || "unknown";
    const trade      = r.trade || "Other";
    const isInterested = (r.classification || r.label || "").toLowerCase() === "interested" ? 1 : 0;
    const rDate      = (r.ts || r.timestamp || "").slice(0, 10);

    if (!repliesBySender[sender]) repliesBySender[sender] = { total: 0, interested: 0 };
    repliesBySender[sender].total++;
    repliesBySender[sender].interested += isInterested;

    if (trade) {
      if (!repliesByTrade[trade]) repliesByTrade[trade] = { total: 0, interested: 0 };
      repliesByTrade[trade].total++;
      repliesByTrade[trade].interested += isInterested;
    }

    if (rDate) {
      if (!repliesByDate[rDate]) repliesByDate[rDate] = { total: 0, interested: 0 };
      repliesByDate[rDate].total++;
      repliesByDate[rDate].interested += isInterested;
    }
  }

  // ── PDS stats ─────────────────────────────────────────────────────────────
  const pds = {
    total: 0, today: 0,
    by_outcome:       { form: 0, email: 0, skip: 0, error: 0 },
    today_by_outcome: { form: 0, email: 0, skip: 0, error: 0 },
    by_sender:    {} as Record<string, { total: number; today: number; form: number; email: number; replies: number; interested: number }>,
    by_trade:     {} as Record<string, { total: number; form: number; email: number; replies: number; interested: number }>,
    by_territory: {} as Record<string, { total: number; form: number; email: number; rolling_30d: Array<{ date: string; total: number }>; top_trades: Array<{ trade: string; count: number }> }>,
    by_city:      {} as Record<string, { total: number; form: number; email: number; territory: string }>,
    rolling_7d:  [] as Array<{ date: string; total: number; form: number; email: number; replies: number }>,
    rolling_30d: [] as Array<{ date: string; total: number; form: number; email: number; skip: number; error: number }>,
  };

  const rolling: Record<string, { total: number; form: number; email: number; skip: number; error: number }> = {};
  // territory rolling: terr → date → count
  const terrRolling: Record<string, Record<string, number>> = {};
  // territory trade counts: terr → trade → count
  const terrTrades: Record<string, Record<string, number>> = {};

  for (const row of submissions as Record<string, string>[]) {
    if (!row.outcome) continue;
    const cls      = classifyOutcome(row.outcome);
    const rowDate  = (row.ts || row.timestamp || "").slice(0, 10);
    const sender   = row.sender || "unknown";
    const trade    = row.trade  || "Other";
    const addr     = row.address || "";
    const territory = addr ? deriveTerritory(addr) : "Other";

    pds.total++;
    pds.by_outcome[cls]++;

    if (rowDate === TODAY) {
      pds.today++;
      pds.today_by_outcome[cls]++;
    }

    // by_sender (enhanced)
    if (!pds.by_sender[sender]) pds.by_sender[sender] = { total: 0, today: 0, form: 0, email: 0, replies: 0, interested: 0 };
    pds.by_sender[sender].total++;
    if (cls === "form")  pds.by_sender[sender].form++;
    if (cls === "email") pds.by_sender[sender].email++;
    if (rowDate === TODAY) pds.by_sender[sender].today++;

    // by_trade
    if (!pds.by_trade[trade]) pds.by_trade[trade] = { total: 0, form: 0, email: 0, replies: 0, interested: 0 };
    pds.by_trade[trade].total++;
    if (cls === "form")  pds.by_trade[trade].form++;
    if (cls === "email") pds.by_trade[trade].email++;

    // by_territory
    if (!pds.by_territory[territory]) pds.by_territory[territory] = { total: 0, form: 0, email: 0, rolling_30d: [], top_trades: [] };
    pds.by_territory[territory].total++;
    if (cls === "form")  pds.by_territory[territory].form++;
    if (cls === "email") pds.by_territory[territory].email++;

    // by_city — extract city from address (addr = "Street, City, State Zip")
    if (addr) {
      const parts = addr.split(",");
      const city = parts[1]?.trim();
      if (city) {
        if (!pds.by_city[city]) pds.by_city[city] = { total: 0, form: 0, email: 0, territory };
        pds.by_city[city].total++;
        if (cls === "form")  pds.by_city[city].form++;
        if (cls === "email") pds.by_city[city].email++;
      }
    }

    // territory rolling daily
    if (rowDate) {
      if (!terrRolling[territory]) terrRolling[territory] = {};
      terrRolling[territory][rowDate] = (terrRolling[territory][rowDate] || 0) + 1;
    }

    // territory trade counts
    if (trade && trade !== "Other") {
      if (!terrTrades[territory]) terrTrades[territory] = {};
      terrTrades[territory][trade] = (terrTrades[territory][trade] || 0) + 1;
    }

    // global rolling daily
    if (rowDate) {
      if (!rolling[rowDate]) rolling[rowDate] = { total: 0, form: 0, email: 0, skip: 0, error: 0 };
      rolling[rowDate].total++;
      if (cls === "form")  rolling[rowDate].form++;
      if (cls === "email") rolling[rowDate].email++;
      if (cls === "skip")  rolling[rowDate].skip++;
      if (cls === "error") rolling[rowDate].error++;
    }
  }

  // Fill territory rolling_30d and top_trades
  for (const terr of Object.keys(pds.by_territory)) {
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      pds.by_territory[terr].rolling_30d.push({ date: d, total: terrRolling[terr]?.[d] || 0 });
    }
    pds.by_territory[terr].top_trades = Object.entries(terrTrades[terr] || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([trade, count]) => ({ trade, count }));
  }

  // Cross-ref replies/interested into by_sender and by_trade
  for (const [sender, counts] of Object.entries(repliesBySender)) {
    if (pds.by_sender[sender]) {
      pds.by_sender[sender].replies    = counts.total;
      pds.by_sender[sender].interested = counts.interested;
    }
  }
  for (const [trade, counts] of Object.entries(repliesByTrade)) {
    if (pds.by_trade[trade]) {
      pds.by_trade[trade].replies    = counts.total;
      pds.by_trade[trade].interested = counts.interested;
    }
  }

  // rolling_7d (with replies per day)
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    pds.rolling_7d.push({
      date: d,
      ...(rolling[d] || { total: 0, form: 0, email: 0 }),
      replies: repliesByDate[d]?.total || 0,
    });
  }

  // rolling_30d
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    pds.rolling_30d.push({ date: d, ...(rolling[d] || { total: 0, form: 0, email: 0, skip: 0, error: 0 }) });
  }

  // ── Stephie stats ─────────────────────────────────────────────────────────
  const stephieRolling: Record<string, { total: number; form: number; email: number; skip: number; error: number }> = {};
  const stephie = {
    total: 0, today: 0,
    by_outcome:       { form: 0, email: 0, skip: 0, error: 0 },
    today_by_outcome: { form: 0, email: 0, skip: 0, error: 0 },
    by_sender: {} as Record<string, { total: number; today: number }>,
    rolling_30d: [] as Array<{ date: string; total: number; form: number; email: number; skip: number; error: number }>,
  };

  for (const row of stephieRows as Record<string, string>[]) {
    if (!row.outcome) continue;
    const cls     = classifyOutcome(row.outcome);
    const rowDate = (row.ts || row.timestamp || "").slice(0, 10);

    stephie.total++;
    stephie.by_outcome[cls]++;
    if (rowDate === TODAY) {
      stephie.today++;
      stephie.today_by_outcome[cls]++;
    }
    const sender = row.from_address || row.sender || "unknown";
    if (!stephie.by_sender[sender]) stephie.by_sender[sender] = { total: 0, today: 0 };
    stephie.by_sender[sender].total++;
    if (rowDate === TODAY) stephie.by_sender[sender].today++;

    if (rowDate) {
      if (!stephieRolling[rowDate]) stephieRolling[rowDate] = { total: 0, form: 0, email: 0, skip: 0, error: 0 };
      stephieRolling[rowDate].total++;
      if (cls === "form")  stephieRolling[rowDate].form++;
      if (cls === "email") stephieRolling[rowDate].email++;
      if (cls === "skip")  stephieRolling[rowDate].skip++;
      if (cls === "error") stephieRolling[rowDate].error++;
    }
  }

  // Stephie rolling_30d
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    stephie.rolling_30d.push({ date: d, ...(stephieRolling[d] || { total: 0, form: 0, email: 0, skip: 0, error: 0 }) });
  }

  // ── Replies ───────────────────────────────────────────────────────────────
  const repliesData = {
    total: (replies as Record<string, string>[]).length,
    by_classification: {} as Record<string, number>,
  };
  for (const r of replies as Record<string, string>[]) {
    const cls = r.classification || "unknown";
    repliesData.by_classification[cls] = (repliesData.by_classification[cls] || 0) + 1;
  }

  // ── Activity feed — last 50 events merged, enriched ───────────────────────
  type ActivityRaw = { ts: string; type: string; msg: string; _sort: number; [k: string]: unknown };
  const activityItems: ActivityRaw[] = [];

  for (const row of (submissions as Record<string, string>[]).slice(-100)) {
    const rts = row.ts || row.timestamp || "";
    if (!rts) continue;
    const cls  = classifyOutcome(row.outcome || "");
    const type = cls === "error" ? "ERROR" : "SEND";
    const biz  = row.name || row.business_name || row.business || "unknown";
    const addr = row.address || "";
    const city = addr ? addr.split(",")[1]?.trim() || "" : "";
    activityItems.push({
      ts: rts.slice(11, 16),
      type,
      msg: `PDS → ${biz}${city ? ` (${city})` : ""} — ${row.outcome}`,
      _sort: new Date(rts).getTime(),
      business_name: biz,
      website:   row.website   || "",
      address:   addr,
      trade:     row.trade     || "",
      sender:    row.sender    || "",
      outcome:   row.outcome   || "",
      territory: addr ? deriveTerritory(addr) : "",
      place_id:  row.place_id  || "",
    });
  }

  for (const r of (replies as Record<string, string>[]).slice(-20)) {
    const rts = r.ts || r.timestamp || "";
    if (!rts) continue;
    activityItems.push({
      ts:   rts.slice(11, 16),
      type: "REPLY",
      msg:  `Reply from ${r.from || "unknown"} — ${r.classification || "unclassified"}`,
      _sort: new Date(rts).getTime(),
      business_name:  r.biz_name        || "",
      from_email:     r.from            || "",
      classification: r.classification  || "",
      trade:          r.trade           || "",
      sender:         r.sender          || "",
      ghl_contact:    r.ghl_contact     || "",
    });
  }

  activityItems.sort((a, b) => b._sort - a._sort);
  const activity = activityItems.slice(0, 50).map(({ _sort: _, ...rest }) => rest);

  // ── Agent statuses ────────────────────────────────────────────────────────
  const homeDir = process.env.HOME || "/home/vivaciousvl";
  const agentsRaw: Record<string, { last_modified: string; today_count: number }> = {};

  for (const script of Object.keys(SCHEDULES)) {
    const logPath = LOG_PATHS[script] ? path.join(homeDir, LOG_PATHS[script]) : "";
    let lastMod = "";
    if (logPath) {
      try {
        const stat = fs.statSync(logPath);
        lastMod = stat.mtime.toISOString();
      } catch { /* log not found yet */ }
    }
    agentsRaw[script] = { last_modified: lastMod, today_count: 0 };
  }

  const outreachToday = (submissions as Record<string, string>[])
    .filter(r => (r.ts || r.timestamp)?.slice(0, 10) === TODAY).length;
  if (agentsRaw["outreach.py"]) agentsRaw["outreach.py"].today_count = outreachToday;

  const stephieToday = (stephieRows as Record<string, string>[])
    .filter(r => (r.ts || r.timestamp)?.slice(0, 10) === TODAY).length;
  if (agentsRaw["stephie-outreach.py"]) agentsRaw["stephie-outreach.py"].today_count = stephieToday;

  // ── Campaign health array (generic — one entry per configured source) ─────
  type CampaignSrc = {
    total: number; today: number;
    by_outcome: { form: number; email: number; skip: number; error: number };
    today_by_outcome: { form: number; email: number; skip: number; error: number };
    rolling_30d: Array<{ date: string; total: number; form: number; email: number; skip: number; error: number }>;
  };
  function toCampaign(name: string, src: CampaignSrc) {
    const t = src.total || 1;
    const skip_rate  = src.by_outcome.skip  / t;
    const error_rate = src.by_outcome.error / t;
    const reach_rate = (src.by_outcome.form + src.by_outcome.email) / t;
    return {
      name,
      total:             src.total,
      today:             src.today,
      by_outcome:        src.by_outcome,
      today_by_outcome:  src.today_by_outcome,
      rolling_30d:       src.rolling_30d,
      skip_rate,
      error_rate,
      reach_rate,
      flagged: skip_rate > 0.20 || error_rate > 0.20,
    };
  }

  const campaigns = [
    toCampaign(process.env.SUBMISSIONS_LABEL || "PDS Outreach",     pds),
    toCampaign(process.env.STEPHIE_LABEL     || "Stephie Outreach", stephie),
  ];

  return {
    generated_at: new Date().toISOString(),
    pds,
    stephie,
    replies: repliesData,
    activity,
    agents: agentsRaw,
    campaigns,
  };
}

// ── Gist fallback ─────────────────────────────────────────────────────────────
async function buildFromGist() {
  const gistId = process.env.STATS_GIST_ID;
  const token  = process.env.GITHUB_TOKEN;
  if (!gistId) throw new Error("STATS_GIST_ID not set");

  const resp = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers: token ? { Authorization: `token ${token}` } : {},
    next: { revalidate: 60 },
  });
  if (!resp.ok) throw new Error(`Gist fetch failed: ${resp.status}`);
  const data = await resp.json();
  const content = data.files?.["stats_cache.json"]?.content;
  if (!content) throw new Error("stats_cache.json not in gist");
  return JSON.parse(content);
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET() {
  try {
    const hasLocal = !!(process.env.SUBMISSIONS_PATH && fs.existsSync(process.env.SUBMISSIONS_PATH));
    const stats = hasLocal ? await buildFromLocal() : await buildFromGist();
    return NextResponse.json(stats);
  } catch (e: unknown) {
    console.error("[/api/stats]", e);
    return NextResponse.json({
      generated_at: new Date().toISOString(),
      pds: {
        total: 0, today: 0,
        by_outcome: { form: 0, email: 0, skip: 0, error: 0 },
        today_by_outcome: { form: 0, email: 0, skip: 0, error: 0 },
        by_sender: {}, by_trade: {}, by_territory: {}, by_city: {}, rolling_7d: [], rolling_30d: [],
      },
      stephie: {
        total: 0, today: 0,
        by_outcome: { form: 0, email: 0, skip: 0, error: 0 },
        today_by_outcome: { form: 0, email: 0, skip: 0, error: 0 },
        rolling_30d: [],
      },
      replies: { total: 0, by_classification: {} },
      activity: [],
      agents: {},
      campaigns: [],
      _error: e instanceof Error ? e.message : String(e),
    });
  }
}
