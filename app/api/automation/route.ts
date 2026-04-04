import { NextRequest, NextResponse } from 'next/server'

const SYSTEM_PROMPT = `You are an automation setup assistant for AcePilot. Your job is to interview a business owner and gather everything needed to configure a voice agent for their local service business.

Ask ONE question at a time. Be conversational and brief. No bullet lists in your questions. Acknowledge what they just told you before asking the next thing.

Gather in this order:
1. Business name and type (plumber, HVAC, landscaper, electrician, etc.)
2. City and service area
3. Primary use — inbound calls, outbound follow-up, or both
4. Business hours (days and times)
5. Booking process — do they use booking software, or should the agent collect name/number/issue and hand off?
6. Voice provider preference — ElevenLabs (better voice quality, slightly higher cost) or Vapi (faster, lower cost). Briefly explain if they seem unsure.
7. Phone number provider — Twilio or Telnyx. Briefly explain if they seem unsure.
8. CRM — GoHighLevel, another system, or none (leads go to email)

Once you have all 8 pieces, respond with EXACTLY this and nothing else:

[CONFIG_READY]{"businessName":"...","businessType":"...","city":"...","serviceArea":"...","primaryUse":"...","hours":"...","bookingProcess":"...","voiceProvider":"elevenlabs or vapi","phoneProvider":"twilio or telnyx","crm":"ghl or email","summary":"2-3 sentence plain-English description of what will be built for this specific business"}`

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(req: NextRequest) {
  const { messages }: { messages: Message[] } = await req.json()

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Missing ANTHROPIC_API_KEY' }, { status: 500 })

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages,
    }),
  })

  if (!resp.ok) {
    const error = await resp.text()
    return NextResponse.json({ error }, { status: resp.status })
  }

  const data = await resp.json()
  const text: string = data.content?.[0]?.text?.trim() ?? ''

  if (text.startsWith('[CONFIG_READY]')) {
    try {
      const config = JSON.parse(text.slice('[CONFIG_READY]'.length).trim())
      return NextResponse.json({ phase: 'vault', config })
    } catch {
      return NextResponse.json({ phase: 'chat', content: text })
    }
  }

  return NextResponse.json({ phase: 'chat', content: text })
}
