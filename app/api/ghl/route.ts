import { NextResponse } from "next/server";

const GHL_BASE = "https://services.leadconnectorhq.com";

const CLOSERS = [
  { name: "Joel Davis",      id: "ROTliRMFnbHzsAQOluMM", territory: "Coachella Valley (760)" },
  { name: "Frank Leon",      id: "Owc8Ufm2W1dkxrwAtTpq", territory: "LA County"              },
  { name: "Mickey Parson",   id: "neMkuaDwGNWQ0WAIRv9B", territory: "LA / Valley"             },
  { name: "Armen Pogosian",  id: "hLzXkVl8tladQpgHOEwQ", territory: "SFV / Desert"            },
  { name: "Taylor Posey",    id: "ma3kHGuqV7wPGuzRymB3", territory: "LA / Seattle"             },
];

const PIPELINE_ID = "G4VmlcBlqrNYPu5Uz3fx";

// ── Module-level cache (2-min TTL) ────────────────────────────────────────────
interface CacheEntry { data: unknown; ts: number }
const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 2 * 60 * 1000;

function getCached(key: string) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}

function setCached(key: string, data: unknown) {
  cache.set(key, { data, ts: Date.now() });
}

// ── GHL API helpers ───────────────────────────────────────────────────────────
async function ghlGet(path: string, apiKey: string, params?: Record<string, string>) {
  const url = new URL(`${GHL_BASE}${path}`);
  const locationId = process.env.GHL_LOCATION_ID || "";
  url.searchParams.set("locationId", locationId);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const resp = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Version: "2021-07-28",
      "Content-Type": "application/json",
    },
  });
  if (!resp.ok) {
    console.error(`[GHL] ${path} → ${resp.status}`);
    return null;
  }
  return resp.json();
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET() {
  const CACHE_KEY = "ghl_data";
  const cached = getCached(CACHE_KEY);
  if (cached) return NextResponse.json(cached);

  const apiKey = process.env.GHL_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GHL_API_KEY not configured" }, { status: 500 });
  }

  try {
    // 6 parallel calls
    const [totalRes, ...closerResults] = await Promise.all([
      ghlGet("/contacts/", apiKey, { limit: "1" }),
      ...CLOSERS.map(c => ghlGet("/contacts/", apiKey, { assignedTo: c.id, limit: "1" })),
    ]);

    // Opportunities
    const oppRes = await ghlGet("/opportunities/search", apiKey, {
      pipeline_id: PIPELINE_ID,
      status: "open",
      limit: "1",
    });

    const total_contacts = totalRes?.total ?? totalRes?.meta?.total ?? 0;
    const open_opportunities = oppRes?.meta?.total ?? 0;

    const closers = CLOSERS.map((c, i) => {
      const res = closerResults[i];
      const leads = res?.total ?? res?.meta?.total ?? 0;
      return {
        name: c.name,
        id: c.id,
        territory: c.territory,
        leads,
        sends: leads, // sends = contacts assigned (proxy until we have a sends field)
        cold: 0,      // cold deals require opportunity-level query; placeholder
      };
    });

    const result = { total_contacts, open_opportunities, closers };
    setCached(CACHE_KEY, result);
    return NextResponse.json(result);
  } catch (e: unknown) {
    console.error("[/api/ghl]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
