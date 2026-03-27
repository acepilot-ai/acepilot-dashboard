import { NextRequest, NextResponse } from "next/server";

const GIST_ID = process.env.WORKSPACE_GIST_ID || "";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const GIST_API = `https://api.github.com/gists/${GIST_ID}`;
const FILE_KEY = "campaign-controls.json";

export interface Territory {
  id: string;
  name: string;
  campaign: string;
  active: boolean;
  added_at: string;
}

export interface CampaignTemplate {
  id: string;
  name: string;
  type: "form" | "email";
  campaign: string;
  last_used: string;
  preview: string;
}

export interface CampaignControls {
  paused: Record<string, boolean>;
  territories: Territory[];
  templates: CampaignTemplate[];
}

function defaultControls(): CampaignControls {
  return { paused: {}, territories: [], templates: [] };
}

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

function parseControls(gist: unknown): CampaignControls {
  try {
    const files = (gist as { files: Record<string, { content: string }> }).files;
    const content = files?.[FILE_KEY]?.content;
    if (!content) return defaultControls();
    return JSON.parse(content);
  } catch {
    return defaultControls();
  }
}

export async function GET() {
  if (!GIST_ID) return NextResponse.json(defaultControls());
  try {
    const gist = await getGist();
    return NextResponse.json(parseControls(gist));
  } catch (e) {
    return NextResponse.json({ ...defaultControls(), _error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!GIST_ID) return NextResponse.json({ error: "WORKSPACE_GIST_ID not configured" }, { status: 503 });
  try {
    const body = await req.json();
    const gist = await getGist();
    const controls = parseControls(gist);

    if (body.action === "toggle_pause") {
      controls.paused[body.campaign] = !controls.paused[body.campaign];

    } else if (body.action === "add_territory") {
      controls.territories.push({
        id: Date.now().toString(),
        name: body.name,
        campaign: body.campaign,
        active: true,
        added_at: new Date().toISOString(),
      });

    } else if (body.action === "update_territory") {
      const idx = controls.territories.findIndex(t => t.id === body.id);
      if (idx !== -1) controls.territories[idx] = { ...controls.territories[idx], ...body.updates };

    } else if (body.action === "remove_territory") {
      controls.territories = controls.territories.filter(t => t.id !== body.id);

    } else {
      return NextResponse.json({ error: `Unknown action: ${body.action}` }, { status: 400 });
    }

    await patchGist({ [FILE_KEY]: { content: JSON.stringify(controls, null, 2) } });
    return NextResponse.json({ ok: true, controls });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
