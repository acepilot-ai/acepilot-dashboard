import type { StatsCache, GHLData } from "../hooks/useDashboard";

// ── Date helpers ───────────────────────────────────────────────────────────────

function lastDays(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (n - 1 - i));
    return d.toISOString().slice(0, 10);
  });
}

const MIN = 60_000;
const HOUR = 3_600_000;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

// ── Daily send volumes (30 days) ───────────────────────────────────────────────
// Realistic pattern: ~300/day Mon–Sat, 0 on Sundays, one slow day midweek

const PDS_DAY = [
  287, 312, 298, 145, 301, 318, 0, 295, 310, 323,
  288, 275, 305, 311, 0, 298, 287, 315, 302, 289,
  318, 303, 0, 275, 309, 296, 312, 285, 307, 287,
];

const COM_DAY = [
  62, 71, 58, 0, 65, 68, 0, 59, 70, 63,
  67, 55, 72, 61, 0, 64, 68, 57, 71, 63,
  58, 67, 0, 60, 72, 65, 69, 58, 64, 47,
];

const DATES = lastDays(30);

function buildPdsDay(date: string, total: number) {
  const form  = Math.round(total * 0.33);
  const skip  = Math.round(total * 0.07);
  const error = Math.round(total * 0.03);
  const email = Math.max(0, total - form - skip - error);
  return { date, total, form, email, skip, error };
}

function buildComDay(date: string, total: number) {
  const form  = Math.round(total * 0.22);
  const skip  = Math.round(total * 0.08);
  const error = Math.round(total * 0.04);
  const email = Math.max(0, total - form - skip - error);
  return { date, total, form, email, skip, error };
}

const pds30d = DATES.map((date, i) => buildPdsDay(date, PDS_DAY[i]));
const com30d = DATES.map((date, i) => buildComDay(date, COM_DAY[i]));

// ── Demo stats — BreezePro HVAC (Phoenix, AZ) ──────────────────────────────────

export const DEMO_STATS: StatsCache = {
  generated_at: new Date().toISOString(),

  pds: {
    total: 27842,
    today: 287,
    by_outcome: { form: 9178, email: 16248, skip: 1723, error: 693 },
    today_by_outcome: { form: 95, email: 172, skip: 14, error: 6 },

    by_sender: {
      "Marcus Webb":  { total: 7234, today: 78, form: 2387, email: 4312, replies: 452, interested: 89 },
      "Sarah Kim":    { total: 6890, today: 65, form: 2270, email: 4095, replies: 421, interested: 76 },
      "Derek Torres": { total: 5621, today: 52, form: 1855, email: 3340, replies: 348, interested: 58 },
      "Lisa Patel":   { total: 5102, today: 58, form: 1684, email: 3025, replies: 318, interested: 53 },
      "James Okafor": { total: 2995, today: 34, form:  982, email: 1776, replies: 183, interested: 31 },
    },

    by_trade: {
      "HVAC Installation": { total: 5847, form: 1928, email: 3444, replies: 380, interested: 68 },
      "AC Repair":         { total: 5231, form: 1726, email: 3082, replies: 341, interested: 61 },
      "Furnace Service":   { total: 3872, form: 1278, email: 2282, replies: 252, interested: 43 },
      "Duct Cleaning":     { total: 3190, form: 1053, email: 1880, replies: 208, interested: 36 },
      "Mini-Split":        { total: 2840, form:  937, email: 1673, replies: 185, interested: 31 },
      "Commercial HVAC":   { total: 2418, form:  798, email: 1425, replies: 157, interested: 28 },
      "Heat Pump":         { total: 1842, form:  607, email: 1086, replies: 120, interested: 19 },
      "Air Quality":       { total: 1534, form:  506, email:  904, replies: 100, interested: 16 },
      "Refrigeration":     { total:  768, form:  253, email:  453, replies:  50, interested:  8 },
      "Ventilation":       { total:  300, form:   99, email:  177, replies:  20, interested:  3 },
    },

    by_territory: {
      "Phoenix Metro": {
        total: 15234, form: 5027, email: 8988,
        rolling_30d: DATES.map((date, i) => ({ date, total: Math.round(PDS_DAY[i] * 0.55) })),
        top_trades: [
          { trade: "HVAC Installation", count: 3200 },
          { trade: "AC Repair",         count: 2870 },
          { trade: "Furnace Service",   count: 2120 },
          { trade: "Duct Cleaning",     count: 1750 },
          { trade: "Mini-Split",        count: 1560 },
        ],
      },
      "East Valley / Scottsdale": {
        total: 8190, form: 2703, email: 4832,
        rolling_30d: DATES.map((date, i) => ({ date, total: Math.round(PDS_DAY[i] * 0.30) })),
        top_trades: [
          { trade: "HVAC Installation", count: 1726 },
          { trade: "AC Repair",         count: 1543 },
          { trade: "Mini-Split",        count:  902 },
          { trade: "Heat Pump",         count:  751 },
          { trade: "Commercial HVAC",   count:  690 },
        ],
      },
      "Tucson Metro": {
        total: 4418, form: 1448, email: 2428,
        rolling_30d: DATES.map((date, i) => ({ date, total: Math.round(PDS_DAY[i] * 0.15) })),
        top_trades: [
          { trade: "AC Repair",         count: 934 },
          { trade: "HVAC Installation", count: 821 },
          { trade: "Furnace Service",   count: 612 },
          { trade: "Duct Cleaning",     count: 489 },
          { trade: "Commercial HVAC",   count: 378 },
        ],
      },
    },

    by_city: {
      "Phoenix, AZ":    { total: 5234, form: 1727, email: 3087, territory: "Phoenix Metro" },
      "Mesa, AZ":       { total: 3891, form: 1284, email: 2295, territory: "Phoenix Metro" },
      "Glendale, AZ":   { total: 3218, form: 1062, email: 1898, territory: "Phoenix Metro" },
      "Tempe, AZ":      { total: 2891, form:  954, email: 1706, territory: "East Valley / Scottsdale" },
      "Scottsdale, AZ": { total: 2842, form:  938, email: 1675, territory: "East Valley / Scottsdale" },
      "Chandler, AZ":   { total: 1998, form:  659, email: 1179, territory: "East Valley / Scottsdale" },
      "Tucson, AZ":     { total: 2892, form:  954, email: 1707, territory: "Tucson Metro" },
      "Marana, AZ":     { total:  876, form:  289, email:  517, territory: "Tucson Metro" },
    },

    rolling_7d: DATES.slice(-7).map((date, i) => {
      const total = PDS_DAY[23 + i];
      const form  = Math.round(total * 0.33);
      const email = Math.round(total * 0.57);
      return { date, total, form, email, replies: Math.round(total * 0.08) };
    }),

    rolling_30d: pds30d,
  },

  stephie: {
    total: 4508,
    today: 47,
    by_outcome: { form: 990, email: 3069, skip: 315, error: 134 },
    today_by_outcome: { form: 10, email: 33, skip: 3, error: 1 },
    rolling_30d: com30d,
  },

  replies: {
    total: 2108,
    by_classification: {
      INTERESTED:     487,
      NOT_INTERESTED: 831,
      CALLBACK:       548,
      UNCLASSIFIED:   242,
    },
  },

  activity: [
    { ts: "14:23", type: "SEND",  msg: "BreezePro → Desert Cool HVAC (Phoenix, AZ) — submitted",       business_name: "Desert Cool HVAC",        website: "desertcoolhvac.com",       address: "2148 W Camelback Rd, Phoenix, AZ 85015",      trade: "HVAC Installation", sender: "Marcus Webb",  outcome: "submitted",  territory: "Phoenix Metro" },
    { ts: "14:21", type: "SEND",  msg: "BreezePro → SunState Air (Mesa, AZ) — email_sent",              business_name: "SunState Air",             website: "sunstateair.com",          address: "4521 E Main St, Mesa, AZ 85205",               trade: "AC Repair",         sender: "Sarah Kim",   outcome: "email_sent", territory: "Phoenix Metro" },
    { ts: "14:19", type: "REPLY", msg: "Reply from info@arizonaclimatepro.com — INTERESTED",             from_email: "info@arizonaclimatepro.com",  classification: "INTERESTED",        sender: "Derek Torres" },
    { ts: "14:18", type: "SEND",  msg: "BreezePro → Valley Comfort Systems (Scottsdale, AZ) — submitted",business_name: "Valley Comfort Systems",   website: "valleycomfortsystems.com", address: "8834 E Shea Blvd, Scottsdale, AZ 85260",      trade: "Mini-Split",        sender: "Marcus Webb", outcome: "submitted",  territory: "East Valley / Scottsdale" },
    { ts: "14:16", type: "SEND",  msg: "BreezePro → Sun City HVAC (Glendale, AZ) — email_sent",         business_name: "Sun City HVAC",            website: "suncityhvac.com",          address: "5901 W Bell Rd, Glendale, AZ 85308",          trade: "Furnace Service",   sender: "Lisa Patel",  outcome: "email_sent", territory: "Phoenix Metro" },
    { ts: "14:14", type: "REPLY", msg: "Reply from mgr@oasiscooling.com — CALLBACK",                    from_email: "mgr@oasiscooling.com",        classification: "CALLBACK",          sender: "Sarah Kim" },
    { ts: "14:12", type: "SEND",  msg: "BreezePro → Oasis Cooling (Tempe, AZ) — submitted",             business_name: "Oasis Cooling",            website: "oasiscoolingaz.com",       address: "1234 S Mill Ave, Tempe, AZ 85281",            trade: "AC Repair",         sender: "Sarah Kim",   outcome: "submitted",  territory: "East Valley / Scottsdale" },
    { ts: "14:11", type: "SEND",  msg: "BreezePro → Southwest Air Solutions (Phoenix, AZ) — email_sent",business_name: "Southwest Air Solutions",  website: "southwestairaz.com",       address: "3312 N 7th Ave, Phoenix, AZ 85013",           trade: "Duct Cleaning",     sender: "Derek Torres",outcome: "email_sent", territory: "Phoenix Metro" },
    { ts: "14:09", type: "SEND",  msg: "BreezePro → Blue Sky Climate (Chandler, AZ) — submitted",       business_name: "Blue Sky Climate",         website: "blueskyclimate.com",       address: "1200 W Chandler Blvd, Chandler, AZ 85224",    trade: "Heat Pump",         sender: "Lisa Patel",  outcome: "submitted",  territory: "East Valley / Scottsdale" },
    { ts: "14:07", type: "REPLY", msg: "Reply from service@sonoranHVAC.com — NOT_INTERESTED",            from_email: "service@sonoranHVAC.com",     classification: "NOT_INTERESTED",    sender: "James Okafor" },
    { ts: "14:06", type: "SEND",  msg: "BreezePro → Sonoran HVAC (Tucson, AZ) — email_sent",            business_name: "Sonoran HVAC",             website: "sonoranHVAC.com",          address: "4250 E Broadway Blvd, Tucson, AZ 85711",      trade: "HVAC Installation", sender: "James Okafor",outcome: "email_sent", territory: "Tucson Metro" },
    { ts: "14:04", type: "SEND",  msg: "BreezePro → Phoenix Mechanical (Phoenix, AZ) — submitted",      business_name: "Phoenix Mechanical",       website: "phoenixmechanical.com",    address: "2800 S 16th St, Phoenix, AZ 85034",           trade: "Commercial HVAC",   sender: "Marcus Webb", outcome: "submitted",  territory: "Phoenix Metro" },
    { ts: "14:02", type: "SEND",  msg: "BreezePro → Desert Air Engineering (Mesa, AZ) — email_sent",    business_name: "Desert Air Engineering",   website: "desertairengineering.com", address: "6700 E Baseline Rd, Mesa, AZ 85206",          trade: "Air Quality",       sender: "Sarah Kim",   outcome: "email_sent", territory: "Phoenix Metro" },
    { ts: "14:00", type: "REPLY", msg: "Reply from owner@cactusclimate.com — INTERESTED",                from_email: "owner@cactusclimate.com",     classification: "INTERESTED",        sender: "Derek Torres" },
    { ts: "13:58", type: "SEND",  msg: "BreezePro → Cactus Climate Control (Phoenix, AZ) — submitted",  business_name: "Cactus Climate Control",   website: "cactusclimate.com",        address: "1455 W Indian School Rd, Phoenix, AZ 85015",  trade: "Furnace Service",   sender: "Derek Torres",outcome: "submitted",  territory: "Phoenix Metro" },
    { ts: "13:56", type: "SEND",  msg: "BreezePro → Mojave Air Services (Glendale, AZ) — email_sent",   business_name: "Mojave Air Services",      website: "mojaveair.com",            address: "7300 N 43rd Ave, Glendale, AZ 85301",         trade: "Duct Cleaning",     sender: "Lisa Patel",  outcome: "email_sent", territory: "Phoenix Metro" },
    { ts: "13:54", type: "SEND",  msg: "BreezePro → AZ Comfort Systems (Scottsdale, AZ) — submitted",   business_name: "AZ Comfort Systems",       website: "azcomfortsystems.com",     address: "9200 E Pima Center Pkwy, Scottsdale, AZ 85258",trade: "Mini-Split",        sender: "Marcus Webb", outcome: "submitted",  territory: "East Valley / Scottsdale" },
    { ts: "13:52", type: "REPLY", msg: "Reply from billing@copperstatehvac.com — CALLBACK",              from_email: "billing@copperstatehvac.com", classification: "CALLBACK",          sender: "Sarah Kim" },
    { ts: "13:50", type: "SEND",  msg: "BreezePro → Copper State HVAC (Tempe, AZ) — email_sent",        business_name: "Copper State HVAC",        website: "copperstatehvac.com",      address: "780 E Elliot Rd, Tempe, AZ 85284",            trade: "AC Repair",         sender: "Sarah Kim",   outcome: "email_sent", territory: "East Valley / Scottsdale" },
    { ts: "13:48", type: "SEND",  msg: "BreezePro → Saguaro Cooling (Tucson, AZ) — submitted",          business_name: "Saguaro Cooling",          website: "saguarocooling.com",       address: "3050 N Oracle Rd, Tucson, AZ 85705",          trade: "HVAC Installation", sender: "James Okafor",outcome: "submitted",  territory: "Tucson Metro" },
    { ts: "13:46", type: "SCAN",  msg: "Territory scan completed — 847 contacts flagged for follow-up",  territory: "Phoenix Metro" },
    { ts: "13:44", type: "SEND",  msg: "BreezePro → Arizona Air Masters (Phoenix, AZ) — email_sent",    business_name: "Arizona Air Masters",      website: "arizonairmasters.com",     address: "5512 S 32nd St, Phoenix, AZ 85040",           trade: "Refrigeration",     sender: "Derek Torres",outcome: "email_sent", territory: "Phoenix Metro" },
    { ts: "13:42", type: "REPLY", msg: "Reply from hello@sunsetsystems.com — INTERESTED",                from_email: "hello@sunsetsystems.com",     classification: "INTERESTED",        sender: "Marcus Webb" },
    { ts: "13:40", type: "SEND",  msg: "BreezePro → Sunset Air Systems (Mesa, AZ) — submitted",         business_name: "Sunset Air Systems",       website: "sunsetsystems.com",        address: "1820 W Southern Ave, Mesa, AZ 85202",         trade: "Heat Pump",         sender: "Marcus Webb", outcome: "submitted",  territory: "Phoenix Metro" },
    { ts: "13:38", type: "SEND",  msg: "BreezePro → Sun Devil HVAC (Tempe, AZ) — email_sent",           business_name: "Sun Devil HVAC",           website: "sundevilhvac.com",         address: "3700 S McClintock Dr, Tempe, AZ 85282",       trade: "Ventilation",       sender: "Lisa Patel",  outcome: "email_sent", territory: "East Valley / Scottsdale" },
    { ts: "13:36", type: "SEND",  msg: "BreezePro → Tucson Climate Pros (Tucson, AZ) — submitted",      business_name: "Tucson Climate Pros",      website: "tucsonclimate.com",        address: "5100 E Speedway Blvd, Tucson, AZ 85712",      trade: "HVAC Installation", sender: "James Okafor",outcome: "submitted",  territory: "Tucson Metro" },
    { ts: "13:34", type: "REPLY", msg: "Reply from info@valleyairpros.com — NOT_INTERESTED",             from_email: "info@valleyairpros.com",      classification: "NOT_INTERESTED",    sender: "Derek Torres" },
    { ts: "13:32", type: "SEND",  msg: "BreezePro → Valley Air Pros (Chandler, AZ) — email_sent",       business_name: "Valley Air Pros",          website: "valleyairpros.com",        address: "2600 W Ray Rd, Chandler, AZ 85224",           trade: "AC Repair",         sender: "Derek Torres",outcome: "email_sent", territory: "East Valley / Scottsdale" },
    { ts: "13:30", type: "SEND",  msg: "BreezePro → Gilbert Climate Control (Gilbert, AZ) — submitted", business_name: "Gilbert Climate Control",   website: "gilbertclimate.com",       address: "1100 S Gilbert Rd, Gilbert, AZ 85296",        trade: "Duct Cleaning",     sender: "Sarah Kim",   outcome: "submitted",  territory: "East Valley / Scottsdale" },
    { ts: "13:28", type: "SEND",  msg: "BreezePro → Peoria Air Solutions (Peoria, AZ) — email_sent",    business_name: "Peoria Air Solutions",     website: "peoriaair.com",            address: "9875 W Peoria Ave, Peoria, AZ 85345",         trade: "Mini-Split",        sender: "Marcus Webb", outcome: "email_sent", territory: "Phoenix Metro" },
    { ts: "13:26", type: "ALERT", msg: "High interest rate detected — AC Repair replies up 23% this week", territory: "Phoenix Metro" },
    { ts: "13:24", type: "SEND",  msg: "BreezePro → Mesa AC Specialists (Mesa, AZ) — submitted",        business_name: "Mesa AC Specialists",      website: "mesaacspecialists.com",    address: "2350 W University Dr, Mesa, AZ 85201",        trade: "AC Repair",         sender: "Sarah Kim",   outcome: "submitted",  territory: "Phoenix Metro" },
    { ts: "13:22", type: "REPLY", msg: "Reply from owner@arizonacoolingco.com — INTERESTED",             from_email: "owner@arizonacoolingco.com",  classification: "INTERESTED",        sender: "Lisa Patel" },
    { ts: "13:20", type: "SEND",  msg: "BreezePro → Arizona Cooling Co (Phoenix, AZ) — email_sent",     business_name: "Arizona Cooling Co",       website: "arizonacoolingco.com",     address: "4120 N 35th Ave, Phoenix, AZ 85017",          trade: "HVAC Installation", sender: "Lisa Patel",  outcome: "email_sent", territory: "Phoenix Metro" },
    { ts: "13:18", type: "SEND",  msg: "BreezePro → Scottsdale Air Works (Scottsdale, AZ) — submitted", business_name: "Scottsdale Air Works",      website: "scottsdaleairworks.com",   address: "15300 N Hayden Rd, Scottsdale, AZ 85260",     trade: "Commercial HVAC",   sender: "Marcus Webb", outcome: "submitted",  territory: "East Valley / Scottsdale" },
    { ts: "13:16", type: "SEND",  msg: "BreezePro → Marana HVAC Services (Marana, AZ) — email_sent",    business_name: "Marana HVAC Services",     website: "maranahvac.com",           address: "3750 W Ina Rd, Marana, AZ 85741",             trade: "Furnace Service",   sender: "James Okafor",outcome: "email_sent", territory: "Tucson Metro" },
    { ts: "13:14", type: "REPLY", msg: "Reply from contact@glendalecooling.com — CALLBACK",              from_email: "contact@glendalecooling.com", classification: "CALLBACK",          sender: "Lisa Patel" },
    { ts: "13:12", type: "SEND",  msg: "BreezePro → Glendale Cooling Pros (Glendale, AZ) — submitted",  business_name: "Glendale Cooling Pros",    website: "glendalecooling.com",      address: "5845 W Glendale Ave, Glendale, AZ 85301",     trade: "AC Repair",         sender: "Lisa Patel",  outcome: "submitted",  territory: "Phoenix Metro" },
    { ts: "13:10", type: "SEND",  msg: "BreezePro → Central AZ Mechanical (Phoenix, AZ) — email_sent",  business_name: "Central AZ Mechanical",    website: "centralazmechanical.com",  address: "1900 S 16th St, Phoenix, AZ 85034",           trade: "Commercial HVAC",   sender: "Derek Torres",outcome: "email_sent", territory: "Phoenix Metro" },
    { ts: "13:08", type: "SEND",  msg: "BreezePro → Sunrise HVAC (Mesa, AZ) — submitted",               business_name: "Sunrise HVAC",             website: "sunrisehvacmesa.com",      address: "780 W Broadway Rd, Mesa, AZ 85210",           trade: "Air Quality",       sender: "Sarah Kim",   outcome: "submitted",  territory: "Phoenix Metro" },
    { ts: "13:06", type: "REPLY", msg: "Reply from office@tempeaircomfort.com — NOT_INTERESTED",         from_email: "office@tempeaircomfort.com",  classification: "NOT_INTERESTED",    sender: "Derek Torres" },
    { ts: "13:04", type: "SEND",  msg: "BreezePro → Tempe Air Comfort (Tempe, AZ) — email_sent",        business_name: "Tempe Air Comfort",        website: "tempeaircomfort.com",      address: "620 S Mill Ave, Tempe, AZ 85281",             trade: "HVAC Installation", sender: "Derek Torres",outcome: "email_sent", territory: "East Valley / Scottsdale" },
    { ts: "13:02", type: "SEND",  msg: "BreezePro → Chandler Climate Solutions (Chandler, AZ) — submitted",business_name: "Chandler Climate Solutions",website: "chandlerclimate.com",     address: "3050 W Chandler Blvd, Chandler, AZ 85226",    trade: "Heat Pump",         sender: "Marcus Webb", outcome: "submitted",  territory: "East Valley / Scottsdale" },
    { ts: "13:00", type: "SEND",  msg: "BreezePro → Tucson Cooling Specialists (Tucson, AZ) — email_sent",business_name: "Tucson Cooling Specialists",website: "tuccooling.com",          address: "6500 E Grant Rd, Tucson, AZ 85715",           trade: "HVAC Installation", sender: "James Okafor",outcome: "email_sent", territory: "Tucson Metro" },
    { ts: "12:58", type: "SCAN",  msg: "Nightly review complete — 6.5% reply rate above 5.8% target",   territory: "All" },
    { ts: "12:56", type: "SEND",  msg: "BreezePro → Peach State Cooling (Phoenix, AZ) — submitted",     business_name: "Peach State Cooling",      website: "peachstatecooling.com",    address: "4800 N Central Ave, Phoenix, AZ 85012",       trade: "Mini-Split",        sender: "Lisa Patel",  outcome: "submitted",  territory: "Phoenix Metro" },
    { ts: "12:54", type: "REPLY", msg: "Reply from sales@acplusplus.com — INTERESTED",                   from_email: "sales@acplusplus.com",        classification: "INTERESTED",        sender: "Sarah Kim" },
    { ts: "12:52", type: "SEND",  msg: "BreezePro → AC Plus Plus (Phoenix, AZ) — email_sent",           business_name: "AC Plus Plus",             website: "acplusplus.com",           address: "2340 W Thomas Rd, Phoenix, AZ 85015",         trade: "AC Repair",         sender: "Sarah Kim",   outcome: "email_sent", territory: "Phoenix Metro" },
    { ts: "12:50", type: "SEND",  msg: "BreezePro → High Desert HVAC (Tucson, AZ) — submitted",         business_name: "High Desert HVAC",         website: "highdeserthvac.com",       address: "7800 S Nogales Hwy, Tucson, AZ 85756",        trade: "Refrigeration",     sender: "James Okafor",outcome: "submitted",  territory: "Tucson Metro" },
  ],

  agents: {
    "outreach.py":        { last_modified: ago(2 * HOUR),      today_count: 287 },
    "reply-monitor.py":   { last_modified: ago(8 * MIN),       today_count: 0 },
    "push-stats-cache.py":{ last_modified: ago(45 * MIN),      today_count: 0 },
    "morning-report.py":  { last_modified: ago(12 * HOUR),     today_count: 0 },
    "nightly-review.py":  { last_modified: ago(18 * HOUR),     today_count: 0 },
    "stephie.py":         { last_modified: ago(5 * HOUR),      today_count: 47 },
  },

  campaigns: [
    {
      name: "BreezePro Outreach",
      total: 27842,
      today: 287,
      by_outcome: { form: 9178, email: 16248, skip: 1723, error: 693 },
      today_by_outcome: { form: 95, email: 172, skip: 14, error: 6 },
      rolling_30d: pds30d,
      skip_rate:  0.0619,
      error_rate: 0.0249,
      reach_rate: 0.9132,
      flagged: false,
    },
    {
      name: "Commercial Pipeline",
      total: 4508,
      today: 47,
      by_outcome: { form: 990, email: 3069, skip: 315, error: 134 },
      today_by_outcome: { form: 10, email: 33, skip: 3, error: 1 },
      rolling_30d: com30d,
      skip_rate:  0.0699,
      error_rate: 0.0297,
      reach_rate: 0.9004,
      flagged: false,
    },
  ],
};

// ── Demo GHL — BreezePro HVAC closer team ─────────────────────────────────────

export const DEMO_GHL: GHLData = {
  total_contacts: 4218,
  open_opportunities: 187,
  closers: [
    { name: "Marcus Webb",  id: "demo_1", territory: "Phoenix Metro",          leads: 1340, sends: 1340, cold: 2 },
    { name: "Sarah Kim",    id: "demo_2", territory: "East Valley / Scottsdale",leads: 1050, sends: 1050, cold: 1 },
    { name: "Derek Torres", id: "demo_3", territory: "Tucson Metro",           leads:  890, sends:  890, cold: 0 },
    { name: "Lisa Patel",   id: "demo_4", territory: "Phoenix West",           leads:  680, sends:  680, cold: 3 },
    { name: "James Okafor", id: "demo_5", territory: "Commercial Accounts",    leads:  258, sends:  258, cold: 0 },
  ],
};
