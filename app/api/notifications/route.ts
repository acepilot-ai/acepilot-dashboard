import { NextRequest, NextResponse } from "next/server";

const GIST_ID = process.env.WORKSPACE_GIST_ID || "";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const GIST_API = `https://api.github.com/gists/${GIST_ID}`;

async function getGist() {
  if (!GIST_ID) throw new Error("WORKSPACE_GIST_ID not configured");
  const resp = await fetch(GIST_API, {
    headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: "application/vnd.github.v3+json" },
    cache: "no-store",
  });
  if (!resp.ok) throw new Error(`Gist GET failed: ${resp.status}`);
  return resp.json();
}

async function patchGist(files: Record<string, { content: string }>) {
  if (!GIST_ID) throw new Error("WORKSPACE_GIST_ID not configured");
  const resp = await fetch(GIST_API, {
    method: "PATCH",
    headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: "application/vnd.github.v3+json", "Content-Type": "application/json" },
    body: JSON.stringify({ files }),
  });
  if (!resp.ok) throw new Error(`Gist PATCH failed: ${resp.status}`);
  return resp.json();
}

function parse<T>(gist: unknown, key: string, fallback: T): T {
  try {
    const files = (gist as { files: Record<string, { content: string }> }).files;
    const content = files?.[key]?.content;
    if (!content) return fallback;
    return JSON.parse(content) as T;
  } catch { return fallback; }
}

// GET /api/notifications — load notifications + prefs from Gist
export async function GET() {
  if (!GIST_ID) return NextResponse.json({ notifications: [], prefs: {} });
  try {
    const gist = await getGist();
    const notifications = parse(gist, "notifications.json", []);
    const prefs = parse(gist, "notification-prefs.json", {});
    return NextResponse.json({ notifications, prefs });
  } catch (e) {
    return NextResponse.json({ notifications: [], prefs: {}, _error: String(e) }, { status: 500 });
  }
}

// POST /api/notifications
// { action: "save_notifications", notifications: [...] }
// { action: "save_prefs", seatId: string, prefs: Record<string, boolean> }
export async function POST(req: NextRequest) {
  if (!GIST_ID) return NextResponse.json({ error: "WORKSPACE_GIST_ID not configured" }, { status: 503 });
  try {
    const body = await req.json();

    if (body.action === "save_notifications") {
      await patchGist({ "notifications.json": { content: JSON.stringify(body.notifications ?? [], null, 2) } });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "save_prefs") {
      const gist = await getGist();
      const allPrefs = parse(gist, "notification-prefs.json", {} as Record<string, Record<string, boolean>>);
      allPrefs[body.seatId] = body.prefs;
      await patchGist({ "notification-prefs.json": { content: JSON.stringify(allPrefs, null, 2) } });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: `Unknown action: ${body.action}` }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
