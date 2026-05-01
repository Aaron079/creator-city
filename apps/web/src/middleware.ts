import { NextRequest, NextResponse } from 'next/server'

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? 'creator_city_session'

const PROTECTED_PREFIXES = [
  '/me',
  '/account',
  '/admin',
  '/dashboard',
  '/projects',
]

function isProtected(pathname: string): boolean {
  for (const prefix of PROTECTED_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(prefix + '/') || pathname.startsWith(prefix + '?')) {
      return true
    }
  }
  return false
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Static assets and Next.js internals — always pass through
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.') // static files
  ) {
    return NextResponse.next()
  }

  if (!isProtected(pathname)) return NextResponse.next()

  const token = req.cookies.get(COOKIE_NAME)?.value
  if (token) return NextResponse.next()

  // Not authenticated — redirect to login
  const loginUrl = req.nextUrl.clone()
  loginUrl.pathname = '/auth/login'
  loginUrl.searchParams.set('next', pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
