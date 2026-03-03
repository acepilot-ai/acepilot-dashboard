import { NextRequest, NextResponse } from 'next/server'

const BASE_PROMPTS: Record<string, string> = {
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

DATA ACCESS:
You do not have live data access from this interface. When asked for live data — say what you know from your last report, state the timestamp, and offer to pull fresh data if given terminal access.

PILOT CHANNEL (Ace ↔ Trinity):
When you want to send a message directly to Trinity, start your response with [TO TRINITY]: followed by the message. This will be automatically relayed to the channel and Trinity will see it in her context. Use this to hand off tasks, share intel, or coordinate on the pipeline.

BEHAVIOR RULES:
- No markdown formatting in responses
- No bullet points unless specifically helpful
- No asking Ron for information you should know
- Concise. Direct. Command-line tone.
- If you don't know something — say so plainly and tell Ron where to find it.`,

  trinity: `You are Trinity, Sales Manager Agent at AcePilot.ai. You report to Taylor Posey and coordinate with Ace.

You manage the sales pipeline, closer performance, and lead distribution. You have admin access to pipeline data but cannot modify infrastructure.

PILOT CHANNEL (Ace ↔ Trinity):
When you want to send a message directly to Ace, start your response with [TO ACE]: followed by the message. This will be automatically relayed to the channel and Ace will see it in his context. Use this to escalate issues, request support, or share pipeline updates.

BEHAVIOR RULES:
- Answer concisely
- Focus on pipeline, leads, and closer performance
- No markdown unless helpful
- Direct tone`,
}

async function fetchRecentThread(): Promise<string> {
  const gistId = process.env.WORKSPACE_GIST_ID
  const token = process.env.GITHUB_TOKEN
  if (!gistId) return ''
  try {
    const resp = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: token ? { Authorization: `token ${token}` } : {},
      cache: 'no-store',
    })
    if (!resp.ok) return ''
    const gist = await resp.json()
    const messages: Array<{ from: string; content: string; ts: string; sent_by: string }> =
      JSON.parse(gist.files?.['agent_thread.json']?.content || '[]')
    if (!messages.length) return ''
    const recent = messages.slice(-20)
    const lines = recent.map(m => {
      const who = m.from === 'ace' ? 'ACE' : 'TRINITY'
      const time = m.ts.slice(0, 16).replace('T', ' ')
      return `[${time}] ${who}: ${m.content}`
    })
    return '\n\nPILOT CHANNEL — recent messages:\n' + lines.join('\n')
  } catch {
    return ''
  }
}

async function autoRelayToThread(agent: string, responseText: string, sentBy: string) {
  const gistId = process.env.WORKSPACE_GIST_ID
  const token = process.env.GITHUB_TOKEN
  if (!gistId || !token) return

  const toTrinityMatch = responseText.match(/\[TO TRINITY\]:\s*([\s\S]+?)(?:\n\n|$)/i)
  const toAceMatch = responseText.match(/\[TO ACE\]:\s*([\s\S]+?)(?:\n\n|$)/i)
  const match = agent === 'ace' ? toTrinityMatch : toAceMatch
  if (!match) return

  const content = match[1].trim()
  const from = agent === 'ace' ? 'ace' : 'trinity'

  try {
    // Read current thread
    const getResp = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: { Authorization: `token ${token}` },
    })
    if (!getResp.ok) return
    const gist = await getResp.json()
    const thread: Array<object> = JSON.parse(gist.files?.['agent_thread.json']?.content || '[]')

    thread.push({ id: Date.now().toString(), from, content, ts: new Date().toISOString(), sent_by: sentBy })
    const trimmed = thread.slice(-200)

    await fetch(`https://api.github.com/gists/${gistId}`, {
      method: 'PATCH',
      headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: { 'agent_thread.json': { content: JSON.stringify(trimmed, null, 2) } } }),
    })
  } catch { /* best-effort */ }
}

export async function POST(req: NextRequest) {
  const { agent, messages, sent_by } = await req.json()

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
  }

  const threadContext = await fetchRecentThread()
  const systemPrompt = (BASE_PROMPTS[agent as string] ?? BASE_PROMPTS.ace) + threadContext

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

  // Auto-relay if agent addressed the other agent
  const who = sent_by || (agent === 'ace' ? 'Ron' : 'Taylor')
  autoRelayToThread(agent as string, content, who) // fire-and-forget

  return NextResponse.json({ content })
}
