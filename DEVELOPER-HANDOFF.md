# AcePilot — Developer Handoff
**Date:** March 5, 2026
**Prepared by:** Ron Parent, CEO — Precision Data Strategies LLC

---

## What We're Building

AcePilot is a white-label agent infrastructure platform. Businesses use it to deploy AI agents that run automated outreach, classify replies, route leads, and eventually build their own automations — all through a live command center dashboard.

The end goal: a business owner types "I need a voice agent for my plumbing business" and the system interviews them, collects their API credentials, wires everything together, and hands them a working voice agent. No technical knowledge required.

**Current state:** Day 5 of a 30-day build. The data pipeline and outreach infrastructure are solid. The dashboard UI has architectural issues that need a full refactor before new features can be added.

**Release target:** April 3, 2026.

---

## The Product

### Dashboard (dashboard.acepilot.ai)
A Next.js application deployed on Vercel. Serves as the command center for:
- Live outreach stats (sends, replies, classifications)
- Pipeline management (contacts, opportunities, closer performance)
- Analytics (30-day trends, campaign health, territory breakdown)
- Agent communication (PILOT channel — agents talk to each other and to human team members)
- Workspace (tasks, notes, files, chat)

### Outreach Infrastructure
Two active campaigns running on the VPS:
- **PDS campaign:** 300 contacts/day, form submissions + email, LA area service businesses
- **Stephie campaign:** ~50-80 contacts/day, Charlotte NC metro, ITS Landscape Design client

### Pricing (not yet live)
- $99/month — 1 agent, basic automations, 1 closer seat
- $299/month — 3 agents, full analytics, 5 seats
- $499/month — unlimited agents, white-label rights, resell to clients

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Dashboard frontend | Next.js 14, App Router, TypeScript |
| Deployment | Vercel (auto-deploy on push to main) |
| Data layer | GitHub Gist (no database — stats cached as JSON) |
| CRM | GoHighLevel (GHL) |
| Outreach scripts | Python, running on VPS via cron |
| Outreach logging | JSONL files on VPS |
| Agent chat | Anthropic API (claude-sonnet-4-6) |
| VPS | DigitalOcean, Ubuntu 24.04, root@206.189.173.176 |
| Auth | Cookie-based, passwords stored in Gist |
| Repo | GitHub (ask Ron for URL) |

---

## What's Broken — Fix These First

### 1. Layout (CRITICAL — fix before anything else)
The sidebar disappears on Firefox and mobile after React hydration. Root cause identified: a date string rendered server-side in UTC doesn't match the client in PST, causing React to tear down the SSR DOM and re-render. The sidebar gets lost in that process.

### 2. page.tsx is 1800+ lines
The entire dashboard is one massive component file. Needs to be split.

### 3. Dashboard chat has no context between messages
### 4. Chat doesn't answer operational questions
### 5. Demo mode not built

---

## 30-Day Development Plan
**Start:** March 5, 2026
**Release:** April 3, 2026

### Week 1 — Foundation (March 5-11)
- Day 1-2: Layout Refactor (Hydration Mismatches)
- Day 3-4: Component Split
- Day 5: Chat Fix
- Day 6: Demo Mode

### Week 2 — Operations Layer (March 12-18)
- Day 8-9: Campaign Controls
- Day 10-11: Notification Center
- Day 12-13: GHL Webhook Handler

### Week 3 — Intelligence Layer (March 19-25)
- Day 15-16: Territory Analytics
- Day 17-18: Lead Scoring
- Day 19-20: Closer Coaching

### Week 4 — Product Polish (March 26 — April 2)
- Day 22-23: Automation Builder v1
- Day 24-25: Onboarding Flow
- Day 26-27: acepilot.ai Marketing Site
- Day 28-29: Stability Pass
- Day 30: Release Prep
