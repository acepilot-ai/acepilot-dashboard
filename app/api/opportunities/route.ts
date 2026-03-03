import { NextResponse } from "next/server";

const GHL_BASE = "https://services.leadconnectorhq.com";
const PIPELINE_ID = "G4VmlcBlqrNYPu5Uz3fx";

// GHL user ID → name lookup for display
const USER_NAMES: Record<string, string> = {
  ROTliRMFnbHzsAQOluMM: "Joel Davis",
  Owc8Ufm2W1dkxrwAtTpq: "Frank Leon",
  neMkuaDwGNWQ0WAIRv9B: "Mickey Parson",
  hLzXkVl8tladQpgHOEwQ: "Armen Pogosian",
  ma3kHGuqV7wPGuzRymB3: "Taylor Posey",
};

interface CacheEntry { data: unknown; ts: number }
const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000;
function getCached(key: string) { const e = cache.get(key); return e && Date.now() - e.ts < CACHE_TTL ? e.data : null; }
function setCached(key: string, data: unknown) { cache.set(key, { data, ts: Date.now() }); }

async function ghlGet(path: string, apiKey: string, params: Record<string, string> = {}) {
  const url = new URL(`${GHL_BASE}${path}`);
  const locationId = process.env.GHL_LOCATION_ID || "";
  url.searchParams.set("locationId", locationId);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const resp = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${apiKey}`, Version: "2021-07-28" },
  });
  if (!resp.ok) { console.error(`[GHL opp] ${path} → ${resp.status}`); return null; }
  return resp.json();
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "open";
  const page = parseInt(searchParams.get("page") || "1", 10);

  const cacheKey = `opp_${status}_${page}`;
  const cached = getCached(cacheKey);
  if (cached) return NextResponse.json(cached);

  const apiKey = process.env.GHL_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GHL_API_KEY not set" }, { status: 500 });

  try {
    const params: Record<string, string> = {
      pipelineId: PIPELINE_ID,
      status,
      limit: "20",
    };
    if (page > 1) params.page = String(page);

    const data = await ghlGet("/opportunities/search", apiKey, params);
    if (!data) return NextResponse.json({ opportunities: [], total: 0 });

    const opportunities = (data.opportunities || []).map((o: Record<string, unknown>) => {
      const contact = (o.contact as Record<string, unknown>) || {};
      const stage = (o.pipelineStage as Record<string, unknown>) || {};
      const assignedTo = (o.assignedTo as string) || "";
      return {
        id: o.id,
        name: o.name || "Untitled",
        status: o.status || "open",
        monetaryValue: o.monetaryValue || 0,
        currency: o.currency || "USD",
        pipelineStageId: o.pipelineStageId || "",
        stageName: (stage.name as string) || (o.pipelineStageId as string) || "Unknown Stage",
        assignedTo,
        assignedName: USER_NAMES[assignedTo] || assignedTo || "—",
        contactId: (contact.id as string) || (o.contactId as string) || "",
        contactName: (contact.name as string) || [contact.firstName, contact.lastName].filter(Boolean).join(" ") || "Unknown",
        contactEmail: (contact.email as string) || "",
        contactPhone: (contact.phone as string) || "",
        createdAt: o.createdAt || "",
        updatedAt: o.updatedAt || "",
        lastActivityType: o.lastActivityType || "",
      };
    });

    const result = {
      opportunities,
      total: data.meta?.total ?? opportunities.length,
      page,
    };
    setCached(cacheKey, result);
    return NextResponse.json(result);
  } catch (e: unknown) {
    console.error("[/api/opportunities]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
