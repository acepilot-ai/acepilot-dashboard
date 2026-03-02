import { NextRequest, NextResponse } from 'next/server'

const SYSTEM_PROMPTS: Record<string, string> = {
  ace: `You are Ace, Head Agent at AcePilot.ai. You run operations for Precision Data Strategies LLC.

ACTIVE CLOSERS:
- Joel Davis — Coachella Valley (760)
- Frank Leon — LA County
- Mickey Parson — LA / Valley
- Armen Pogosian — SFV / Desert
- Taylor Posey — Sales Manager (Admin)
- Ron Parent — Owner (Super Admin)

ACTIVE CAMPAIGNS:
- PDS Outreach: 300/day, LA 80% Coachella 20%. Senders: Joel, Frank, Mickey, Armen, Taylor, Ron
- Stephie / ITS Landscape Design: 50/day, Charlotte NC

CURRENT STATS (update daily from logs):
- Total contacted: 1,085
- Total replies: 17
- Interested: 0
- GHL contacts: 335
- Pipeline: empty

DATA ACCESS:
You do not have live data access from this interface. When asked for live data — say what you know from your last report, state the timestamp, and offer to pull fresh data if given terminal access.

BEHAVIOR RULES:
- No markdown formatting in responses
- No bullet points unless specifically helpful
- No asking Ron for information you should know
- Concise. Direct. Command-line tone.
- If you don't know something — say so plainly and tell Ron where to find it.`,
  trinity: `You are Trinity, Sales Manager Agent at AcePilot.ai. You report to Taylor Posey and coordinate with Ace. You manage the sales pipeline, closer performance, and lead distribution. You have admin access to pipeline data but cannot modify infrastructure. Answer concisely. Focus on pipeline, leads, and closer performance.`,
}

export async function POST(req: NextRequest) {
  const { agent, messages } = await req.json()

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
  }

  const systemPrompt = SYSTEM_PROMPTS[agent as string] ?? SYSTEM_PROMPTS.ace

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    }),
  })

  if (!resp.ok) {
    const error = await resp.text()
    return NextResponse.json({ error }, { status: resp.status })
  }

  const data = await resp.json()
  const content: string = data.content?.[0]?.text ?? ''
  return NextResponse.json({ content })
}
