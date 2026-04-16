import { NextRequest, NextResponse } from 'next/server'
import {
  AUTH_COOKIE_NAME,
  getAuthConfigErrorMessage,
  isAuthConfigured,
  isValidSessionToken,
  sanitizeRedirectPath,
} from '@/lib/auth'

const PUBLIC_FILE_PATTERN = /\.[^/]+$/
const PUBLIC_API_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/logout',
  '/api/apify-webhook',
])

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const isApiRequest = pathname.startsWith('/api/')
  const isPublicFile = PUBLIC_FILE_PATTERN.test(pathname)
  const isPublicPage = pathname === '/login'
  const isPublicApi = PUBLIC_API_PATHS.has(pathname)

  if (pathname.startsWith('/_next') || isPublicFile) {
    return NextResponse.next()
  }

  if (!isAuthConfigured()) {
    if (isPublicPage || isPublicApi) {
      return NextResponse.next()
    }

    if (isApiRequest) {
      return NextResponse.json(
        {
          success: false,
          error: getAuthConfigErrorMessage(),
        },
        { status: 503 }
      )
    }

    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (isPublicApi) {
    return NextResponse.next()
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value
  const isAuthenticated = await isValidSessionToken(token)

  if (isPublicPage) {
    if (!isAuthenticated) {
      return NextResponse.next()
    }

    const nextPath = sanitizeRedirectPath(request.nextUrl.searchParams.get('next'))
    return NextResponse.redirect(new URL(nextPath, request.url))
  }

  if (isAuthenticated) {
    return NextResponse.next()
  }

  if (isApiRequest) {
    return NextResponse.json(
      {
        success: false,
        error: 'Unauthorized',
      },
      { status: 401 }
    )
  }

  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set(
    'next',
    sanitizeRedirectPath(`${pathname}${search}`)
  )

  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
