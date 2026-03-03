import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const STATIC = /\.(png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|eot)$/i

function getEnvUsers(): Record<string, { password: string; role: string }> {
  const users: Record<string, { password: string; role: string }> = {}
  if (process.env.DASHBOARD_USERNAME && process.env.DASHBOARD_PASSWORD) {
    users[process.env.DASHBOARD_USERNAME] = { password: process.env.DASHBOARD_PASSWORD, role: 'SUPER_ADMIN' }
  }
  if (process.env.TAYLOR_DASHBOARD_USERNAME && process.env.TAYLOR_DASHBOARD_PASSWORD) {
    users[process.env.TAYLOR_DASHBOARD_USERNAME] = { password: process.env.TAYLOR_DASHBOARD_PASSWORD, role: 'ADMIN' }
  }
  return users
}

// Module-level cache — reused across requests within the same Edge isolate
let pwCache: { data: Record<string, string>; ts: number } | null = null
const PW_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

async function getGistPasswords(): Promise<Record<string, string>> {
  if (pwCache && Date.now() - pwCache.ts < PW_CACHE_TTL) return pwCache.data
  const gistId = process.env.WORKSPACE_GIST_ID
  const token = process.env.GITHUB_TOKEN
  if (!gistId) return {}
  try {
    const resp = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: token ? { Authorization: `token ${token}` } : {},
    })
    if (!resp.ok) return pwCache?.data ?? {}
    const gist = await resp.json()
    const data: Record<string, string> = JSON.parse(gist.files?.['user_passwords.json']?.content || '{}')
    pwCache = { data, ts: Date.now() }
    return data
  } catch {
    return pwCache?.data ?? {}
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (STATIC.test(pathname)) return NextResponse.next()
  if (pathname === '/login') return NextResponse.next()

  const username = request.cookies.get('ace_user')?.value
  const password = request.cookies.get('auth')?.value
  if (!username || !password) return NextResponse.redirect(new URL('/login', request.url))

  const envUsers = getEnvUsers()
  const user = envUsers[username]
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  // Fast path: env var password (matches on first login / before any change)
  if (user.password === password) return NextResponse.next()

  // Slow path: check gist for overridden password (after a password change)
  const gistPasswords = await getGistPasswords()
  if (gistPasswords[username] && gistPasswords[username] === password) return NextResponse.next()

  return NextResponse.redirect(new URL('/login', request.url))
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|ace-logo.png|.*\\.png|.*\\.jpg|.*\\.svg|.*\\.ico|.*\\.webp).*)',],}
