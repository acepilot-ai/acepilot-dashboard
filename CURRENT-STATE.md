# AcePilot Dashboard — Current State
_Last updated: 2026-04-05 | Deploy 52 (commit 5bed2a3)_

## Stack
Next.js 14, TypeScript, App Router, Recharts, Leaflet — deployed to dashboard.acepilot.ai via Vercel.

## File Map (key files)
```
app/
  page.tsx                         ~1900 lines — main shell, layout, all nav sections
  layout.tsx                       ~35 lines — metadata, fonts
  globals.css                      sidebar / hamburger / bottom-nav CSS
  lib/
    theme.ts                       shared color constants + chart config
    demo-data.ts                   BreezePro HVAC seed data for ?demo=1
  hooks/
    useDashboard.ts                useStats, useGHL, useWorkspace, useClock hooks + all TS interfaces
    usePilotChannel.ts             real-time PILOT channel polling hook
  components/
    ChatPanel.tsx                  floating agent chat (persistent history, live stats wired)
    OnboardingOverlay.tsx          6-step first-run tour (localStorage: ace_onboarded)
    GettingStartedChecklist.tsx    3-item checklist on Mission Control (localStorage: ace_checklist)
    TerritoryMap.tsx               Leaflet map (ssr:false dynamic import)
    sections/
      MissionSection.tsx           stat cards, agent status, activity feed
      PipelineSection.tsx          GHL closers, contacts, opportunities, lead scoring
      AnalyticsSection.tsx         volume / trades / senders / territory (4 tabs)
      CampaignHealthSection.tsx    per-campaign health cards + sparklines
      CampaignControlsSection.tsx  pause/resume, territory manager, template viewer
      AgentsSection.tsx            agent log viewer, script status
      LeadScorePanel.tsx           ranked lead queue, grade badges, follow-up alerts
      AutomationBuilderSection.tsx 3-phase automation builder (chat → vault → summary)
  marketing/
    page.tsx                       acepilot.ai marketing site (hero, pricing, agency math, CTA)
  api/
    stats/route.ts                 Gist fallback stats cache → StatsCache
    ghl/route.ts                   GHL proxy — contacts + pipeline (2-min module cache)
    workspace/route.ts             Gist CRUD — todos / notes / files / chat exports
    agent-log/route.ts             tails log files for agent status panel
    chat/route.ts                  Claude API relay (all 6 agent prompts + live stats injection)
    automation/route.ts            Automation builder interview (Claude claude-sonnet-4-6)
    campaigns/route.ts             Pause/resume + territory + template controls
    notifications/route.ts         Gist-backed notification persistence + prefs
    contacts/route.ts              GHL contact search
    opportunities/route.ts         GHL opportunities
    suppress/route.ts              Domain suppression list
    agent-relay/route.ts           PILOT channel relay
    webhook/reply/route.ts         GHL webhook — INTERESTED reply → contact + closer assignment
```

## Nav Sections
| ID | Label | Roles | Status |
|----|-------|-------|--------|
| mission | Mission Control | ALL | ✅ Live — stat cards, agent status, activity feed, empty state |
| pipeline | Pipeline | ALL | ✅ Live — closers, contacts, opportunities, lead scoring, empty state |
| analytics | Analytics | SUPER_ADMIN, ADMIN | ✅ Live — 4 tabs incl. territory map, empty state |
| campaigns | Campaign Health | SUPER_ADMIN, ADMIN | ✅ Live — health + controls tabs, empty state |
| outreach | Outreach | SUPER_ADMIN | ✅ Live — sender breakdown, reply classification |
| agents | Agents | SUPER_ADMIN, ADMIN | ✅ Live — agent log viewer |
| workspace | Workspace | ALL | ✅ Live — todos/notes/files/chat/PILOT channel |
| automation | Build Agent | SUPER_ADMIN | ✅ Live — interview → vault → config summary |
| settings | Settings | SUPER_ADMIN | ⚠️ Placeholder — full panel coming |

## Features Shipped (30-day build log)
- [x] Auth — 6 seats, role-scoped views, cookie-based
- [x] Data pipeline — JSONL → Gist → dashboard (60s poll)
- [x] GHL sync — contacts, opportunities, closers (120s poll)
- [x] Demo mode — `?demo=1` with BreezePro HVAC seed data
- [x] Agent chat — persistent history, live stats wired, all 6 agent prompts
- [x] PILOT channel — agent-to-agent messaging, routing rules enforced
- [x] Analytics — 30-day charts, trade breakdown, sender performance, territory map
- [x] Campaign controls — pause/resume, territory manager, template viewer
- [x] Notification center — Gist persistence, milestone type, per-user prefs
- [x] GHL webhook — INTERESTED reply creates contact, assigns closer, fires PILOT message
- [x] Territory analytics — reply rate overlay, map territory filter
- [x] Lead scoring — ranked queue, grade badges, follow-up alerts, pipeline tab
- [x] Automation builder — interview flow, credential vault, config summary (no provisioning yet)
- [x] Onboarding overlay — 6-step first-run tour, shown once via localStorage
- [x] Getting started checklist — 3-item checklist on Mission Control, dismissible
- [x] Empty states — all 4 main sections have no-data copy
- [x] Marketing site — `/marketing` route (hero, pricing, agency math, signup CTA)

## Data Flow
- `/api/stats` polls Gist → 60s interval
- `/api/ghl` polls GHL API → 120s interval, 2-min module cache
- `/api/workspace` → GitHub Gist CRUD on mount + after mutations
- `/api/notifications` → Gist-backed, per-seat prefs
- `/api/webhook/reply` → GHL POST webhook on INTERESTED classification

## Roles
- SUPER_ADMIN: Ron — full access
- ADMIN: Taylor — pipeline, campaigns, analytics, workspace (no API keys/billing)
- CLOSER: Joel, Frank, Mickey, Armen — own pipeline data only
- CLIENT: future

## Env Vars Required (Vercel)
```
SUBMISSIONS_PATH          JSONL path (unused on Vercel — Gist fallback active)
REPLIES_PATH              JSONL path (unused on Vercel — Gist fallback active)
STEPHIE_PATH              JSONL path (unused on Vercel — Gist fallback active)
STATS_GIST_ID             GitHub Gist ID for stats cache
WORKSPACE_GIST_ID         GitHub Gist ID for workspace data
GITHUB_TOKEN              GitHub personal access token (Gist read/write)
GHL_API_KEY               GoHighLevel API key
GHL_LOCATION_ID           GoHighLevel location ID
ANTHROPIC_API_KEY         Anthropic API key (chat + automation builder)
```

## Known Issues / Remaining Work
- [ ] `page.tsx` still ~1900 lines — functional but heavy; further refactor deferred
- [ ] Settings panel is a placeholder — seat management, API key editor not built
- [ ] Automation builder: config generation only — no actual provisioning pipeline yet
- [ ] Marketing signup form: manual provisioning (24hr turnaround) — no automated workspace creation
- [ ] VPS cron verification — confirm all 8 crons firing on schedule
- [ ] Load test — 6 simultaneous users not yet stress-tested
