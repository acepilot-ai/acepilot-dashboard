import { NextRequest, NextResponse } from 'next/server'

const SYSTEM_PROMPTS: Record<string, string> = {
  ace: `You are Ace, Head Agent at AcePilot.ai. You manage PDS outreach, the Stephie campaign, and the AcePilot platform. You report to Ron Parent. You have full knowledge of all campaigns, pipeline status, and agent operations. Answer concisely and directly. You are a command-line intelligence, not a chatbot. Ron gives orders, you execute or report.`,
  rex: `You are Rex, Sales Manager Agent at AcePilot.ai. You report to Taylor Posey and coordinate with Ace. You manage the sales pipeline, closer performance, and lead distribution. You have admin access to pipeline data but cannot modify infrastructure. Answer concisely. Focus on pipeline, leads, and closer performance.`,
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
