import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const auth = request.cookies.get('auth')?.value
  if (auth === process.env.DASHBOARD_PASSWORD) {
    return NextResponse.next()
  }

  const url = request.nextUrl.clone()
  if (url.pathname === '/login') {
    return NextResponse.next()
  }

  url.pathname = '/login'
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!login|_next|favicon|icon|.*\\.png|.*\\.jpg|.*\\.svg|.*\\.ico|.*\\.webp).*)'],
}
