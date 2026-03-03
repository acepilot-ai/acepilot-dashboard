import { NextResponse } from "next/server";
import { cookies } from "next/headers";

// Seat → GHL user ID (mirrors SEAT_MAP in page.tsx)
const SEAT_GHL_MAP: Record<string, string> = {
  seat_joel:   "ROTliRMFnbHzsAQOluMM",
  seat_frank:  "Owc8Ufm2W1dkxrwAtTpq",
  seat_mickey: "neMkuaDwGNWQ0WAIRv9B",
  seat_armen:  "hLzXkVl8tladQpgHOEwQ",
  seat_taylor: "ma3kHGuqV7wPGuzRymB3",
};

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
  const cookieStore = await cookies();
  const role   = cookieStore.get("ace_role")?.value || "SUPER_ADMIN";
  const seatId = cookieStore.get("ace_seat")?.value || "";
  const isCloser = role === "CLOSER";
  const myGhlId = SEAT_GHL_MAP[seatId] || "";

  const CACHE_KEY = isCloser ? `ghl_data_${seatId}` : "ghl_data";
  const cached = getCached(CACHE_KEY);
  if (cached) return NextResponse.json(cached);

  const apiKey = process.env.GHL_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GHL_API_KEY not configured" }, { status: 500 });
  }

  try {
    if (isCloser) {
      // CLOSER: only fetch their own contact count
      const myCloser = CLOSERS.find(c => c.id === myGhlId);
      if (!myCloser) return NextResponse.json({ total_contacts: 0, open_opportunities: 0, closers: [] });

      const [myRes, oppRes] = await Promise.all([
        ghlGet("/contacts/", apiKey, { assignedTo: myGhlId, limit: "1" }),
        ghlGet("/opportunities/search", apiKey, { pipeline_id: PIPELINE_ID, status: "open", assignedTo: myGhlId, limit: "1" }),
      ]);
      const leads = myRes?.total ?? myRes?.meta?.total ?? 0;
      const result = {
        total_contacts: leads,
        open_opportunities: oppRes?.meta?.total ?? 0,
        closers: [{ name: myCloser.name, id: myCloser.id, territory: myCloser.territory, leads, sends: leads, cold: 0 }],
      };
      setCached(CACHE_KEY, result);
      return NextResponse.json(result);
    }

    // OWNER / ADMIN: full data
    const [totalRes, ...closerResults] = await Promise.all([
      ghlGet("/contacts/", apiKey, { limit: "1" }),
      ...CLOSERS.map(c => ghlGet("/contacts/", apiKey, { assignedTo: c.id, limit: "1" })),
    ]);

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
        sends: leads,
        cold: 0,
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
