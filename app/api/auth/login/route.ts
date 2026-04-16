import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import {
  AUTH_COOKIE_NAME,
  createSessionToken,
  getAuthConfigErrorMessage,
  getSessionCookieOptions,
  isAuthConfigured,
  requireAuthConfig,
  sanitizeRedirectPath,
} from '@/lib/auth'

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }

  return timingSafeEqual(leftBuffer, rightBuffer)
}

export async function POST(request: NextRequest) {
  try {
    if (!isAuthConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: getAuthConfigErrorMessage(),
        },
        { status: 503 }
      )
    }

    const body = await request.json().catch(() => null)
    const username = typeof body?.username === 'string' ? body.username.trim() : ''
    const password = typeof body?.password === 'string' ? body.password : ''
    const nextPath =
      typeof body?.next === 'string' ? sanitizeRedirectPath(body.next) : undefined

    if (!username || !password) {
      return NextResponse.json(
        {
          success: false,
          error: '请输入账号和密码',
        },
        { status: 400 }
      )
    }

    const config = requireAuthConfig()
    const isValid =
      safeEqual(username, config.username) && safeEqual(password, config.password)

    if (!isValid) {
      return NextResponse.json(
        {
          success: false,
          error: '账号或密码错误',
        },
        { status: 401 }
      )
    }

    const token = await createSessionToken()
    const response = NextResponse.json({
      success: true,
      redirect_to: nextPath,
    })

    response.cookies.set(AUTH_COOKIE_NAME, token, getSessionCookieOptions())

    return response
  } catch (error) {
    console.error('[auth/login] Failed to sign in:', error)
    return NextResponse.json(
      {
        success: false,
        error: '登录失败，请稍后重试',
      },
      { status: 500 }
    )
  }
}
