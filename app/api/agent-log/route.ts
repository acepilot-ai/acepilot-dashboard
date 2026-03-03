import { NextResponse } from "next/server";
import fs from "fs";
import readline from "readline";
import path from "path";

const HOME = process.env.HOME || "/home/vivaciousvl";

// Map each script name to its log file (relative to HOME)
const LOG_PATHS: Record<string, string> = {
  "reply-monitor.py":        "second-brain/02-projects/pds-outreach/reply-monitor.log",
  "outreach.py":             "second-brain/02-projects/pds-outreach/cron.log",
  "morning-report.py":       "second-brain/02-projects/pds-outreach/cron.log",
  "stephie-outreach.py":     "second-brain/02-projects/stephie-outreach/cron.log",
  "pipeline-monitor.py":     "second-brain/02-projects/pds-outreach/pipeline-monitor.log",
  "taylor-email-cleanup.py": "second-brain/02-projects/pds-outreach/email-cleanup.log",
  "nightly-review.py":       "second-brain/_qmd/nightly-review.log",
};

const SCHEDULES: Record<string, number> = {
  "reply-monitor.py": 30,
  "outreach.py": 1440,
  "stephie-outreach.py": 1440,
  "morning-report.py": 1440,
  "pipeline-monitor.py": 1440,
  "nightly-review.py": 1440,
  "taylor-email-cleanup.py": 720,
};

async function readTailLines(filePath: string, n = 100): Promise<string[]> {
  if (!fs.existsSync(filePath)) return [];
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  const lines: string[] = [];
  for await (const line of rl) {
    lines.push(line);
    if (lines.length > n * 2) lines.splice(0, lines.length - n); // rolling window
  }
  return lines.slice(-n);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const script = searchParams.get("script") || "";
  const n = Math.min(parseInt(searchParams.get("n") || "80", 10), 200);

  if (!script) return NextResponse.json({ error: "script param required" }, { status: 400 });

  const relPath = LOG_PATHS[script];
  const logPath = relPath ? path.join(HOME, relPath) : "";

  let lines: string[] = [];
  let lastModified = "";
  let fileSize = 0;

  if (logPath && fs.existsSync(logPath)) {
    try {
      const stat = fs.statSync(logPath);
      lastModified = stat.mtime.toISOString();
      fileSize = stat.size;
      lines = await readTailLines(logPath, n);
    } catch {
      lines = ["[error reading log file]"];
    }
  } else {
    lines = logPath
      ? ["[log file not found — script may not have run yet]"]
      : ["[no log file configured for this agent]"];
  }

  const interval = SCHEDULES[script] ?? 0;
  let status: "running" | "idle" | "error" = "idle";
  if (interval && lastModified) {
    const ageMins = (Date.now() - new Date(lastModified).getTime()) / 60000;
    if (ageMins < interval * 1.5) status = "running";
    else if (ageMins > interval * 3) status = "error";
  }

  return NextResponse.json({
    script,
    log_path: relPath || null,
    last_modified: lastModified,
    file_size: fileSize,
    status,
    lines,
  });
}
