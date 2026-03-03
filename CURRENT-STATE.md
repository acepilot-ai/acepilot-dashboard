# AcePilot Dashboard — Current State
_Last updated: 2026-03-03 | Deploy 36_

## Stack
Next.js 16, TypeScript, App Router, Recharts, deployed to dashboard.acepilot.ai via Vercel.

## File Map (key files only)
```
app/
  page.tsx                        1820 lines — main shell, layout, hooks wiring, all nav sections
  layout.tsx                      ~35 lines  — metadata, fonts
  globals.css                     sidebar/hamburger CSS classes
  lib/theme.ts                    shared color constants + chart config
  hooks/useDashboard.ts           all TS interfaces + 4 polling hooks (useStats, useGHL, useWorkspace, useClock)
  hooks/usePilotChannel.ts        real-time pilot chat channel hook
  components/
    TerritoryMap.tsx              Leaflet map (ssr:false dynamic import)
    sections/
      AnalyticsSection.tsx        analytics tab — volume/trades/senders/territory charts
      CampaignHealthSection.tsx   per-campaign health cards + sparklines
  api/
    stats/route.ts                JSONL reader (local) + Gist fallback; returns StatsCache
    ghl/route.ts                  GHL proxy — contacts + pipeline (2-min module cache)
    workspace/route.ts            Gist CRUD — todos / notes / files / chat exports
    agent-log/route.ts            tails log files for agent status panel
    chat/route.ts                 Claude API relay
    contacts/route.ts             GHL contact search
    opportunities/route.ts        GHL opportunities
    suppress/route.ts             submission suppression list
~/second-brain/_scripts/
  push-stats-cache.py             reads JSONL files, writes aggregates to Gist (cron every 10 min after outreach)
```

## Nav Sections (page.tsx)
| ID | Roles | Status |
|----|-------|--------|
| mission | ALL | Live — agent status cards, activity feed, stat cards |
| pipeline | SUPER_ADMIN, ADMIN, CLOSER | Live — GHL closers, opportunities |
| analytics | SUPER_ADMIN, ADMIN | Live — volume/trades/senders/territory (4 tabs) |
| campaigns | SUPER_ADMIN, ADMIN | Live — per-campaign health + sparklines |
| outreach | SUPER_ADMIN, ADMIN | Live — suppression list |
| agents | SUPER_ADMIN, ADMIN | Live — agent log viewer |
| workspace | SUPER_ADMIN, ADMIN | Live — todos/notes/files/chat export (Gist-backed) |
| settings | SUPER_ADMIN | Live — seat config, API key viewer |

## Data Flow
- `/api/stats` polls JSONL files (local) or Gist fallback (Vercel) → 60s interval
- `/api/ghl` polls GHL API → 120s interval, 2-min module cache
- `/api/workspace` → GitHub Gist CRUD on mount + after mutations

## Roles
- SUPER_ADMIN: Ron — everything
- ADMIN: Taylor — pipeline, campaigns, analytics, workspace (no API keys/billing)
- CLOSER: Joel, Frank, Mickey, Armen — own data only
- CLIENT: future

## Env Vars Required
```
SUBMISSIONS_PATH, REPLIES_PATH, STEPHIE_PATH   (JSONL files)
STATS_GIST_ID, WORKSPACE_GIST_ID, GITHUB_TOKEN
GHL_API_KEY, GHL_LOCATION_ID
ANTHROPIC_API_KEY
```

## Next Priorities
1. Demo mode (`?demo=1`) — seeded fake data, no auth required, shareable preview URL
2. Priority 3.1 — pause/resume toggle per campaign
3. Priority 3.2 — territory manager UI
4. Priority 3.3 — template viewer (read-only)
