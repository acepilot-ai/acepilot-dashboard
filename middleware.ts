import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const STATIC = /\.(png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|eot)$/i

function getUsers(): Record<string, { password: string; role: string }> {
  const users: Record<string, { password: string; role: string }> = {}
  if (process.env.DASHBOARD_USERNAME && process.env.DASHBOARD_PASSWORD) {
    users[process.env.DASHBOARD_USERNAME] = {
      password: process.env.DASHBOARD_PASSWORD,
      role: 'SUPER_ADMIN',
    }
  }
  if (process.env.TAYLOR_DASHBOARD_USERNAME && process.env.TAYLOR_DASHBOARD_PASSWORD) {
    users[process.env.TAYLOR_DASHBOARD_USERNAME] = {
      password: process.env.TAYLOR_DASHBOARD_PASSWORD,
      role: 'ADMIN',
    }
  }
  return users
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Always pass static assets — never gate images/fonts/etc
  if (STATIC.test(pathname)) return NextResponse.next()

  // Always allow the login page itself
  if (pathname === '/login') return NextResponse.next()

  const username = request.cookies.get('ace_user')?.value
  const password = request.cookies.get('auth')?.value
  const users = getUsers()

  if (username && users[username] && users[username].password === password) {
    return NextResponse.next()
  }

  return NextResponse.redirect(new URL('/login', request.url))
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|ace-logo.png|.*\\.png|.*\\.jpg|.*\\.svg|.*\\.ico|.*\\.webp).*)',],}
