import { NextResponse } from "next/server";

const GHL_BASE = "https://services.leadconnectorhq.com";

interface CacheEntry { data: unknown; ts: number }
const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 min

function getCached(key: string) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}
function setCached(key: string, data: unknown) {
  cache.set(key, { data, ts: Date.now() });
}

async function ghlGet(path: string, apiKey: string, params: Record<string, string> = {}) {
  const url = new URL(`${GHL_BASE}${path}`);
  const locationId = process.env.GHL_LOCATION_ID || "";
  url.searchParams.set("locationId", locationId);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const resp = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${apiKey}`, Version: "2021-07-28" },
  });
  if (!resp.ok) { console.error(`[GHL contacts] ${path} → ${resp.status}`); return null; }
  return resp.json();
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const closerId = searchParams.get("closerId") || "";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = 20;

  const cacheKey = `contacts_${closerId}_${page}`;
  const cached = getCached(cacheKey);
  if (cached) return NextResponse.json(cached);

  const apiKey = process.env.GHL_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GHL_API_KEY not set" }, { status: 500 });

  try {
    const params: Record<string, string> = { limit: String(limit) };
    if (closerId) params.assignedTo = closerId;
    // GHL pagination: use startAfterId for cursor or page param
    // Try both patterns for compatibility
    if (page > 1) params.page = String(page);

    const data = await ghlGet("/contacts/", apiKey, params);
    if (!data) return NextResponse.json({ contacts: [], total: 0 });

    const contacts = (data.contacts || []).map((c: Record<string, unknown>) => ({
      id: c.id,
      name: c.contactName || c.name || [c.firstName, c.lastName].filter(Boolean).join(" ") || "Unknown",
      firstName: c.firstName || "",
      lastName: c.lastName || "",
      phone: c.phone || "",
      email: c.email || "",
      companyName: c.companyName || "",
      address: [c.address1, c.city, c.state].filter(Boolean).join(", "),
      tags: (c.tags as string[]) || [],
      dateAdded: c.dateAdded || c.createdAt || "",
      assignedTo: c.assignedTo || "",
      lastActivity: c.lastActivityAt || c.updatedAt || "",
    }));

    const result = {
      contacts,
      total: data.total ?? data.meta?.total ?? contacts.length,
      page,
    };
    setCached(cacheKey, result);
    return NextResponse.json(result);
  } catch (e: unknown) {
    console.error("[/api/contacts]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
