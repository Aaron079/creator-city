import { NextRequest, NextResponse } from 'next/server'

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? 'creator_city_session'

function getStablePreviewUrl(req: NextRequest): URL | null {
  if (process.env.VERCEL_ENV !== 'preview') return null

  const branchHost = process.env.VERCEL_BRANCH_URL?.trim().toLowerCase()
  const requestHost = req.headers.get('host')?.split(':')[0]?.toLowerCase()
  if (!branchHost || !requestHost || branchHost === requestHost) return null

  const url = req.nextUrl.clone()
  url.protocol = 'https:'
  url.host = branchHost
  return url
}

const PROTECTED_PREFIXES = [
  '/me',
  '/account',
  '/admin',
  '/dashboard',
  '/projects',
  '/create',
  '/assets',
  '/billing',
  '/tools',
  '/providers',
  '/review',
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

  // Each Vercel Preview deployment has its own host, so its browser cookies are
  // isolated. Route page navigations through the branch URL before login, which
  // stays stable across commits on the same branch.
  if (req.method === 'GET' && !pathname.startsWith('/api/')) {
    const stablePreviewUrl = getStablePreviewUrl(req)
    if (stablePreviewUrl) return NextResponse.redirect(stablePreviewUrl)
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
