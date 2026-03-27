import { NextRequest, NextResponse } from "next/server";

// ── Config ────────────────────────────────────────────────────────────────────
const GHL_BASE      = "https://services.leadconnectorhq.com";
const GHL_API_KEY   = process.env.GHL_API_KEY   || "";
const LOCATION_ID   = process.env.GHL_LOCATION_ID || "";
const PIPELINE_ID   = "G4VmlcBlqrNYPu5Uz3fx";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "";

// Base URL for internal API calls (agent-relay)
const INTERNAL_BASE = process.env.NEXT_PUBLIC_BASE_URL || "https://dashboard.acepilot.ai";

// ── Closer roster (mirrors /api/ghl/route.ts) ─────────────────────────────────
const CLOSERS = [
  { name: "Joel Davis",     id: "ROTliRMFnbHzsAQOluMM", territory: "Coachella Valley (760)", keywords: ["coachella", "760"] },
  { name: "Frank Leon",     id: "Owc8Ufm2W1dkxrwAtTpq", territory: "LA County",              keywords: ["county", "la county", "los angeles county"] },
  { name: "Mickey Parson",  id: "neMkuaDwGNWQ0WAIRv9B", territory: "LA / Valley",             keywords: ["valley", "la valley", "los angeles valley"] },
  { name: "Armen Pogosian", id: "hLzXkVl8tladQpgHOEwQ", territory: "SFV / Desert",            keywords: ["sfv", "desert", "san fernando", "palmdale", "lancaster"] },
  { name: "Taylor Posey",   id: "ma3kHGuqV7wPGuzRymB3", territory: "LA / Seattle",             keywords: ["seattle", "washington"] },
];
const DEFAULT_CLOSER = CLOSERS[1]; // Frank — general LA fallback

// ── Territory → Closer ────────────────────────────────────────────────────────
function assignCloser(territory: string) {
  const t = territory.toLowerCase();
  // Priority: Coachella first (contains "valley"), then SFV, then Valley, then County, then default
  if (CLOSERS[0].keywords.some(k => t.includes(k))) return CLOSERS[0]; // Joel — Coachella
  if (CLOSERS[3].keywords.some(k => t.includes(k))) return CLOSERS[3]; // Armen — SFV/Desert
  if (CLOSERS[2].keywords.some(k => t.includes(k))) return CLOSERS[2]; // Mickey — Valley
  if (CLOSERS[1].keywords.some(k => t.includes(k))) return CLOSERS[1]; // Frank — County
  if (CLOSERS[4].keywords.some(k => t.includes(k))) return CLOSERS[4]; // Taylor — Seattle
  return DEFAULT_CLOSER;
}

// ── GHL helpers ───────────────────────────────────────────────────────────────
async function ghlRequest(method: string, path: string, body?: unknown) {
  const resp = await fetch(`${GHL_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${GHL_API_KEY}`,
      Version: "2021-07-28",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await resp.json().catch(() => null);
  return { ok: resp.ok, status: resp.status, data };
}

async function findContactByEmail(email: string): Promise<string | null> {
  const { ok, data } = await ghlRequest("GET", `/contacts/?locationId=${LOCATION_ID}&email=${encodeURIComponent(email)}`);
  if (!ok) return null;
  const contacts = data?.contacts ?? data?.data ?? [];
  return contacts.length > 0 ? contacts[0].id : null;
}

async function createContact(payload: Record<string, unknown>): Promise<string | null> {
  const { ok, data } = await ghlRequest("POST", "/contacts/", payload);
  if (!ok) { console.error("[webhook/reply] GHL createContact failed", data); return null; }
  return data?.contact?.id ?? data?.id ?? null;
}

async function updateContact(contactId: string, payload: Record<string, unknown>): Promise<boolean> {
  const { ok } = await ghlRequest("PUT", `/contacts/${contactId}`, payload);
  return ok;
}

// ── PILOT relay ───────────────────────────────────────────────────────────────
async function firePilotToTrinity(message: string): Promise<void> {
  try {
    await fetch(`${INTERNAL_BASE}/api/agent-relay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: "ace", to: "trinity", content: message, sent_by: "webhook" }),
    });
  } catch (e) {
    console.error("[webhook/reply] PILOT relay failed", e);
  }
}

// ── Webhook body shape (sent by VPS reply-monitor.py) ─────────────────────────
interface ReplyPayload {
  secret: string;
  classification: string;
  business_name?: string;
  from_email?: string;
  address?: string;
  territory?: string;
  trade?: string;
  sender?: string;
  reply_body?: string;
  place_id?: string;
  website?: string;
}

// ── GET /api/webhook/reply — health check + config summary ────────────────────
export async function GET() {
  return NextResponse.json({
    endpoint: `${INTERNAL_BASE}/api/webhook/reply`,
    method: "POST",
    secret_configured: !!WEBHOOK_SECRET,
    ghl_configured: !!GHL_API_KEY && !!LOCATION_ID,
    note: "VPS sends POST with { secret, classification, business_name, from_email, address, territory, trade, sender, reply_body }",
  });
}

// ── POST /api/webhook/reply ────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let body: ReplyPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // 1. Validate secret
  if (WEBHOOK_SECRET && body.secret !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Only handle INTERESTED replies
  if (body.classification !== "INTERESTED") {
    return NextResponse.json({ ok: true, skipped: true, reason: `classification is ${body.classification}` });
  }

  // 3. Require GHL config
  if (!GHL_API_KEY || !LOCATION_ID) {
    return NextResponse.json({ error: "GHL not configured" }, { status: 503 });
  }

  const territory    = body.territory    || "Unknown";
  const businessName = body.business_name || "Unknown Business";
  const email        = body.from_email    || "";
  const trade        = body.trade         || "Unknown";
  const replyText    = body.reply_body    || "";
  const website      = body.website       || "";
  const address      = body.address       || "";

  // 4. Assign closer by territory
  const closer = assignCloser(territory);

  const contactPayload = {
    locationId: LOCATION_ID,
    companyName: businessName,
    firstName: businessName,
    email: email || undefined,
    address1: address || undefined,
    website: website || undefined,
    source: "AcePilot Outreach",
    tags: ["interested", "auto-created", trade.toLowerCase().replace(/\s+/g, "-"), territory.toLowerCase().replace(/\s+/g, "-")],
    assignedTo: closer.id,
    customFields: [
      { key: "trade",        value: trade },
      { key: "territory",    value: territory },
      { key: "reply_text",   value: replyText.slice(0, 500) },
    ],
  };

  // 5. Create or update GHL contact
  let contactId: string | null = null;
  let action = "created";

  if (email) {
    const existing = await findContactByEmail(email);
    if (existing) {
      await updateContact(existing, { assignedTo: closer.id, tags: contactPayload.tags });
      contactId = existing;
      action = "updated";
    }
  }

  if (!contactId) {
    contactId = await createContact(contactPayload);
  }

  // 6. Create opportunity in pipeline (if contact was created)
  if (contactId && action === "created") {
    await ghlRequest("POST", "/opportunities/", {
      pipelineId: PIPELINE_ID,
      locationId: LOCATION_ID,
      name: `${businessName} — ${trade}`,
      status: "open",
      assignedTo: closer.id,
      contactId,
    });
  }

  // 7. Fire PILOT message to Trinity
  const pilotMsg =
    `INTERESTED REPLY — ${businessName} (${trade}, ${territory}). ` +
    `Reply from: ${email || "no email"}. ` +
    `GHL contact ${action}. Assigned to: ${closer.name} (${closer.territory}). ` +
    (replyText ? `Reply: "${replyText.slice(0, 120)}${replyText.length > 120 ? "..." : ""}"` : "");

  await firePilotToTrinity(pilotMsg);

  return NextResponse.json({
    ok: true,
    contact_id: contactId,
    contact_action: action,
    assigned_to: { name: closer.name, territory: closer.territory },
    pilot_fired: true,
  });
}
