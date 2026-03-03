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

// Map each script to its cron log file — log mtime is the true "last ran" signal.
// Scripts don't modify themselves on each run, so script mtime is useless for status.
const LOG_PATHS: Record<string, string> = {
  "reply-monitor.py":      "second-brain/02-projects/pds-outreach/reply-monitor.log",
  "outreach.py":           "second-brain/02-projects/pds-outreach/cron.log",
  "morning-report.py":     "second-brain/02-projects/pds-outreach/cron.log",
  "stephie-outreach.py":   "second-brain/02-projects/stephie-outreach/cron.log",
  "pipeline-monitor.py":   "second-brain/02-projects/pds-outreach/pipeline-monitor.log",
  "taylor-email-cleanup.py": "second-brain/02-projects/pds-outreach/email-cleanup.log",
  "nightly-review.py":     "second-brain/_qmd/nightly-review.log",
};

function deriveAgentStatus(name: string, lastModified: string): "running" | "idle" | "error" {
  const interval = SCHEDULES[name];
  if (!interval || !lastModified) return "idle";
  const ageMins = (Date.now() - new Date(lastModified).getTime()) / 60000;
  if (ageMins < interval * 1.5) return "running";
  if (ageMins > interval * 3) return "error";
  return "idle";
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
  const repliesPath = process.env.REPLIES_PATH || "";
  const stephiePath = process.env.STEPHIE_PATH || "";

  const [submissions, replies, stephieRows] = await Promise.all([
    streamJsonl(submissionsPath),
    streamJsonl(repliesPath),
    streamJsonl(stephiePath),
  ]);

  // PDS stats
  const pds = {
    total: 0, today: 0,
    by_outcome: { form: 0, email: 0, skip: 0, error: 0 },
    today_by_outcome: { form: 0, email: 0, skip: 0, error: 0 },
    by_sender: {} as Record<string, { total: number; today: number }>,
    rolling_7d: [] as Array<{ date: string; total: number; form: number; email: number }>,
  };

  const rolling: Record<string, { total: number; form: number; email: number }> = {};

  for (const row of submissions as Record<string, string>[]) {
    if (!row.outcome) continue;
    const cls = classifyOutcome(row.outcome);
    pds.total++;
    pds.by_outcome[cls]++;

    const rowDate = (row.ts || row.timestamp || "").slice(0, 10);
    if (rowDate === TODAY) {
      pds.today++;
      pds.today_by_outcome[cls]++;
    }

    const sender = row.sender || "unknown";
    if (!pds.by_sender[sender]) pds.by_sender[sender] = { total: 0, today: 0 };
    pds.by_sender[sender].total++;
    if (rowDate === TODAY) pds.by_sender[sender].today++;

    if (rowDate) {
      if (!rolling[rowDate]) rolling[rowDate] = { total: 0, form: 0, email: 0 };
      rolling[rowDate].total++;
      if (cls === "form") rolling[rowDate].form++;
      if (cls === "email") rolling[rowDate].email++;
    }
  }

  // rolling 7d
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    pds.rolling_7d.push({ date: d, ...(rolling[d] || { total: 0, form: 0, email: 0 }) });
  }

  // Stephie stats
  const stephie = {
    total: 0, today: 0,
    by_outcome: { form: 0, email: 0, skip: 0, error: 0 },
    today_by_outcome: { form: 0, email: 0, skip: 0, error: 0 },
    by_sender: {} as Record<string, { total: number; today: number }>,
  };

  for (const row of stephieRows as Record<string, string>[]) {
    if (!row.outcome) continue;
    const cls = classifyOutcome(row.outcome);
    stephie.total++;
    stephie.by_outcome[cls]++;
    const rowDate = (row.ts || row.timestamp || "").slice(0, 10);
    if (rowDate === TODAY) {
      stephie.today++;
      stephie.today_by_outcome[cls]++;
    }
    const sender = row.from_address || row.sender || "unknown";
    if (!stephie.by_sender[sender]) stephie.by_sender[sender] = { total: 0, today: 0 };
    stephie.by_sender[sender].total++;
    if (rowDate === TODAY) stephie.by_sender[sender].today++;
  }

  // Replies
  const repliesData = {
    total: (replies as Record<string, string>[]).length,
    by_classification: {} as Record<string, number>,
  };
  for (const r of replies as Record<string, string>[]) {
    const cls = r.classification || "unknown";
    repliesData.by_classification[cls] = (repliesData.by_classification[cls] || 0) + 1;
  }

  // Activity feed — last 50 events merged
  const activityItems: Array<{ ts: string; type: string; msg: string; _sort: number }> = [];

  for (const row of (submissions as Record<string, string>[]).slice(-100)) {
    const rts = row.ts || row.timestamp || "";
    if (!rts) continue;
    const cls = classifyOutcome(row.outcome || "");
    const type = cls === "error" ? "ERROR" : "SEND";
    const biz = row.name || row.business_name || row.business || "unknown";
    const addr = row.address || "";
    const city = addr ? addr.split(",")[1]?.trim() || "" : "";
    activityItems.push({
      ts: rts.slice(11, 16),
      type,
      msg: `PDS → ${biz}${city ? ` (${city})` : ""} — ${row.outcome}`,
      _sort: new Date(rts).getTime(),
    });
  }

  for (const r of (replies as Record<string, string>[]).slice(-20)) {
    const rts = r.ts || r.timestamp || "";
    if (!rts) continue;
    activityItems.push({
      ts: rts.slice(11, 16),
      type: "REPLY",
      msg: `Reply from ${r.from || "unknown"} — ${r.classification || "unclassified"}`,
      _sort: new Date(rts).getTime(),
    });
  }

  activityItems.sort((a, b) => b._sort - a._sort);
  const activity = activityItems.slice(0, 50).map(({ _sort: _, ...rest }) => rest);

  // Agent statuses — derive from log file modification times (log mtime = last run time)
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

  // Enrich today_count from submissions (field is ts, not timestamp)
  const outreachToday = (submissions as Record<string, string>[])
    .filter(r => (r.ts || r.timestamp)?.slice(0, 10) === TODAY).length;
  if (agentsRaw["outreach.py"]) agentsRaw["outreach.py"].today_count = outreachToday;

  const stephieToday = (stephieRows as Record<string, string>[])
    .filter(r => (r.ts || r.timestamp)?.slice(0, 10) === TODAY).length;
  if (agentsRaw["stephie-outreach.py"]) agentsRaw["stephie-outreach.py"].today_count = stephieToday;

  return {
    generated_at: new Date().toISOString(),
    pds,
    stephie,
    replies: repliesData,
    activity,
    agents: agentsRaw,
  };
}

// ── Gist fallback ─────────────────────────────────────────────────────────────
async function buildFromGist() {
  const gistId = process.env.STATS_GIST_ID;
  const token = process.env.GITHUB_TOKEN;
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
    // Return minimal valid shape so UI doesn't crash
    return NextResponse.json({
      generated_at: new Date().toISOString(),
      pds: { total: 0, today: 0, by_outcome: { form: 0, email: 0, skip: 0, error: 0 }, today_by_outcome: { form: 0, email: 0, skip: 0, error: 0 }, by_sender: {}, rolling_7d: [] },
      stephie: { total: 0, today: 0, by_outcome: { form: 0, email: 0, skip: 0, error: 0 }, today_by_outcome: { form: 0, email: 0, skip: 0, error: 0 } },
      replies: { total: 0, by_classification: {} },
      activity: [],
      agents: {},
      _error: e instanceof Error ? e.message : String(e),
    });
  }
}
