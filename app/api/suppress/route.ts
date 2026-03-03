import { NextResponse } from "next/server";
import { NextRequest } from "next/server";

async function fetchGist(gistId: string, token: string) {
  const resp = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers: token ? { Authorization: `token ${token}` } : {},
    cache: "no-store",
  });
  if (!resp.ok) return null;
  return resp.json();
}

async function patchGist(gistId: string, token: string, files: Record<string, { content: string }>) {
  const resp = await fetch(`https://api.github.com/gists/${gistId}`, {
    method: "PATCH",
    headers: { Authorization: `token ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ files }),
  });
  return resp.ok;
}

export async function POST(req: NextRequest) {
  const { domain } = await req.json();
  if (!domain) return NextResponse.json({ error: "domain required" }, { status: 400 });

  const gistId = process.env.WORKSPACE_GIST_ID || "";
  const token  = process.env.GITHUB_TOKEN || "";
  if (!gistId) return NextResponse.json({ error: "WORKSPACE_GIST_ID not configured" }, { status: 500 });

  const clean = domain.toLowerCase()
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .replace(/^www\./, "")
    .split("?")[0];

  try {
    const gist = await fetchGist(gistId, token);
    const existing: string[] = JSON.parse(gist?.files?.["suppressed_domains.json"]?.content || "[]");

    if (existing.includes(clean)) {
      return NextResponse.json({ already_suppressed: true, domain: clean });
    }

    const updated = [...existing, clean];
    const ok = await patchGist(gistId, token, {
      "suppressed_domains.json": { content: JSON.stringify(updated, null, 2) },
    });

    return NextResponse.json({ suppressed: ok, domain: clean, total: updated.length });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
