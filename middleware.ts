import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const STATIC = /\.(png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|eot)$/i

interface Seat {
  id: string
  human: { name: string; username: string; role: string; reports_to: string | null; manages: string[] }
  agent: { name: string; handle: string; model: string }
}

// Module-level caches — reused across requests within the same Edge isolate
let seatsCache: { data: Seat[]; ts: number } | null = null
let pwCache:    { data: Record<string, string>; ts: number } | null = null
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

async function fetchGistFile<T>(gistId: string, token: string, filename: string, fallback: T): Promise<T> {
  try {
    const resp = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: token ? { Authorization: `token ${token}` } : {},
    })
    if (!resp.ok) return fallback
    const gist = await resp.json()
    return JSON.parse(gist.files?.[filename]?.content || JSON.stringify(fallback))
  } catch {
    return fallback
  }
}

async function getSeats(): Promise<Seat[]> {
  if (seatsCache && Date.now() - seatsCache.ts < CACHE_TTL) return seatsCache.data
  const gistId = process.env.WORKSPACE_GIST_ID || ''
  const token  = process.env.GITHUB_TOKEN || ''
  if (!gistId) return []
  const data = await fetchGistFile<Seat[]>(gistId, token, 'seats.json', [])
  seatsCache = { data, ts: Date.now() }
  return data
}

async function getGistPasswords(): Promise<Record<string, string>> {
  if (pwCache && Date.now() - pwCache.ts < CACHE_TTL) return pwCache.data
  const gistId = process.env.WORKSPACE_GIST_ID || ''
  const token  = process.env.GITHUB_TOKEN || ''
  if (!gistId) return {}
  const data = await fetchGistFile<Record<string, string>>(gistId, token, 'user_passwords.json', {})
  pwCache = { data, ts: Date.now() }
  return data
}

// Env-var fallback — always available for Ron and Taylor even if Gist is down
function getEnvUsers(): Record<string, { password: string; role: string }> {
  const users: Record<string, { password: string; role: string }> = {}
  if (process.env.DASHBOARD_USERNAME && process.env.DASHBOARD_PASSWORD)
    users[process.env.DASHBOARD_USERNAME] = { password: process.env.DASHBOARD_PASSWORD, role: 'SUPER_ADMIN' }
  if (process.env.TAYLOR_DASHBOARD_USERNAME && process.env.TAYLOR_DASHBOARD_PASSWORD)
    users[process.env.TAYLOR_DASHBOARD_USERNAME] = { password: process.env.TAYLOR_DASHBOARD_PASSWORD, role: 'ADMIN' }
  return users
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (STATIC.test(pathname)) return NextResponse.next()
  if (pathname === '/login') return NextResponse.next()

  const username = request.cookies.get('ace_user')?.value
  const password = request.cookies.get('auth')?.value
  if (!username || !password) return NextResponse.redirect(new URL('/login', request.url))

  // 1. Look up user: seats.json first (all 6), env vars as fallback
  const [seats, gistPasswords] = await Promise.all([getSeats(), getGistPasswords()])
  const seat = seats.find(s => s.human.username === username)
  const envUsers = getEnvUsers()

  // User must exist in seats OR env vars
  if (!seat && !envUsers[username]) return NextResponse.redirect(new URL('/login', request.url))

  // 2. Validate password: gist takes precedence, env var as fallback
  const envPw  = envUsers[username]?.password
  const gistPw = gistPasswords[username]
  const expected = gistPw || envPw

  if (expected && expected === password) return NextResponse.next()

  return NextResponse.redirect(new URL('/login', request.url))
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|ace-logo.png|.*\\.png|.*\\.jpg|.*\\.svg|.*\\.ico|.*\\.webp).*)',],
}
