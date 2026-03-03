import { NextRequest, NextResponse } from "next/server";

const GIST_ID = process.env.WORKSPACE_GIST_ID || "";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const GIST_API = `https://api.github.com/gists/${GIST_ID}`;
const THREAD_FILE = "agent_thread.json";
const MAX_MESSAGES = 200;

export interface ThreadMessage {
  id: string;
  from: "ace" | "trinity";
  content: string;
  ts: string;
  sent_by: string; // "Ron" | "Taylor" | "ace" | "trinity"
}

async function readThread(): Promise<ThreadMessage[]> {
  if (!GIST_ID) return [];
  const resp = await fetch(GIST_API, {
    headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: "application/vnd.github.v3+json" },
    cache: "no-store",
  });
  if (!resp.ok) return [];
  const gist = await resp.json();
  try {
    return JSON.parse(gist.files?.[THREAD_FILE]?.content || "[]");
  } catch {
    return [];
  }
}

async function writeThread(messages: ThreadMessage[]) {
  await fetch(GIST_API, {
    method: "PATCH",
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ files: { [THREAD_FILE]: { content: JSON.stringify(messages, null, 2) } } }),
  });
}

// GET /api/agent-relay — return full thread
export async function GET() {
  if (!GIST_ID) return NextResponse.json([]);
  try {
    const thread = await readThread();
    return NextResponse.json(thread);
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

// POST /api/agent-relay — append a message
// Body: { from: "ace"|"trinity", content: string, sent_by: string }
export async function POST(req: NextRequest) {
  if (!GIST_ID) return NextResponse.json({ error: "WORKSPACE_GIST_ID not set" }, { status: 503 });
  try {
    const body = await req.json();
    const { from, content, sent_by } = body as { from: "ace" | "trinity"; content: string; sent_by: string };
    if (!from || !content) return NextResponse.json({ error: "from and content required" }, { status: 400 });

    const thread = await readThread();
    const msg: ThreadMessage = {
      id: Date.now().toString(),
      from,
      content: content.trim(),
      ts: new Date().toISOString(),
      sent_by: sent_by || from,
    };
    thread.push(msg);

    // Keep to MAX_MESSAGES
    const trimmed = thread.slice(-MAX_MESSAGES);
    await writeThread(trimmed);
    return NextResponse.json({ ok: true, message: msg });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
