import { NextRequest, NextResponse } from "next/server";

const GIST_ID = process.env.WORKSPACE_GIST_ID || "";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const GIST_API = `https://api.github.com/gists/${GIST_ID}`;

// ── Gist helpers ──────────────────────────────────────────────────────────────
async function getGist() {
  if (!GIST_ID) throw new Error("WORKSPACE_GIST_ID not configured");
  const resp = await fetch(GIST_API, {
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
    },
    cache: "no-store",
  });
  if (!resp.ok) throw new Error(`Gist GET failed: ${resp.status}`);
  return resp.json();
}

async function patchGist(files: Record<string, { content: string } | null>) {
  if (!GIST_ID) throw new Error("WORKSPACE_GIST_ID not configured");
  const resp = await fetch(GIST_API, {
    method: "PATCH",
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ files }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Gist PATCH failed: ${resp.status} ${text}`);
  }
  return resp.json();
}

function parseFile<T>(gist: Record<string, { files: Record<string, { content: string }> }>, name: string, fallback: T): T {
  try {
    const files = (gist as unknown as { files: Record<string, { content: string }> }).files;
    const content = files?.[name]?.content;
    if (!content) return fallback;
    return JSON.parse(content) as T;
  } catch {
    return fallback;
  }
}

// ── GET /api/workspace ────────────────────────────────────────────────────────
export async function GET() {
  if (!GIST_ID) {
    return NextResponse.json({ todos: [], notes: "# Workspace Notes\n", files: [], _error: "WORKSPACE_GIST_ID not set" });
  }
  try {
    const gist = await getGist();
    const files = (gist as unknown as { files: Record<string, { content: string }> }).files;

    const todos = parseFile(gist as unknown as Record<string, { files: Record<string, { content: string }> }>, "workspace_todos.json", []);
    const notes = files?.["workspace_notes.md"]?.content ?? "# Workspace Notes\n";
    const filesList = parseFile(gist as unknown as Record<string, { files: Record<string, { content: string }> }>, "workspace_files.json", []);

    return NextResponse.json({ todos, notes, files: filesList });
  } catch (e: unknown) {
    console.error("[/api/workspace GET]", e);
    return NextResponse.json(
      { todos: [], notes: "# Workspace Notes\n", files: [], _error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

// ── POST /api/workspace ───────────────────────────────────────────────────────
// Body shape:
//   { action: "save_todos", todos: Todo[] }
//   { action: "save_notes", notes: string }
//   { action: "upload_file", name, size, uploaded_by, content_b64 }
//   { action: "delete_file", gist_file_key }
export async function POST(req: NextRequest) {
  if (!GIST_ID) {
    return NextResponse.json({ error: "WORKSPACE_GIST_ID not configured" }, { status: 503 });
  }
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "save_todos") {
      await patchGist({ "workspace_todos.json": { content: JSON.stringify(body.todos, null, 2) } });
      return NextResponse.json({ ok: true });
    }

    if (action === "save_notes") {
      await patchGist({ "workspace_notes.md": { content: body.notes } });
      return NextResponse.json({ ok: true });
    }

    if (action === "upload_file") {
      const gist = await getGist();
      const filesList = parseFile(gist as unknown as Record<string, { files: Record<string, { content: string }> }>, "workspace_files.json", [] as Array<Record<string, unknown>>);

      const fileKey = `file_${Date.now()}_${body.name.replace(/[^a-z0-9.]/gi, "_")}`;
      const now = new Date().toISOString();
      const newEntry = {
        name: body.name,
        size: body.size,
        uploaded_at: now,
        uploaded_by: body.uploaded_by || "user",
        gist_file_key: fileKey,
        download_url: `https://gist.github.com/${GIST_ID}/raw/${fileKey}`,
      };

      filesList.push(newEntry);

      await patchGist({
        [fileKey]: { content: body.content_b64 },
        "workspace_files.json": { content: JSON.stringify(filesList, null, 2) },
      });
      return NextResponse.json({ ok: true, entry: newEntry });
    }

    if (action === "delete_file") {
      const gist = await getGist();
      const filesList = parseFile(gist as unknown as Record<string, { files: Record<string, { content: string }> }>, "workspace_files.json", [] as Array<Record<string, unknown>>);
      const updated = filesList.filter((f) => f.gist_file_key !== body.gist_file_key);

      // Setting file content to null deletes it from the gist
      await patchGist({
        [body.gist_file_key]: null,
        "workspace_files.json": { content: JSON.stringify(updated, null, 2) },
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e: unknown) {
    console.error("[/api/workspace POST]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
