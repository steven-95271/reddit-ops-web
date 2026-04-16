const AUTH_COOKIE_NAME = 'reddit_ops_session'
const AUTH_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7
const DEFAULT_LOGIN_REDIRECT_PATH = '/workflow/config'
const AUTH_CONFIG_ERROR_MESSAGE = '认证未配置，请设置 AUTH_USERNAME、AUTH_PASSWORD 和 AUTH_SECRET 环境变量'

interface AuthConfig {
  username: string
  password: string
  secret: string
}

/**
 * 读取账号认证配置。
 */
function getAuthConfig(): AuthConfig | null {
  const username = process.env.AUTH_USERNAME?.trim()
  const password = process.env.AUTH_PASSWORD
  const secret = process.env.AUTH_SECRET?.trim()

  if (!username || !password || !secret) {
    return null
  }

  return {
    username,
    password,
    secret,
  }
}

/**
 * 判断当前环境是否已配置认证所需变量。
 */
function isAuthConfigured(): boolean {
  return getAuthConfig() !== null
}

/**
 * 返回配置缺失时的提示信息。
 */
function getAuthConfigErrorMessage(): string {
  return AUTH_CONFIG_ERROR_MESSAGE
}

/**
 * 获取登录校验所需的账号密码配置。
 */
function requireAuthConfig(): AuthConfig {
  const config = getAuthConfig()

  if (!config) {
    throw new Error(AUTH_CONFIG_ERROR_MESSAGE)
  }

  return config
}

/**
 * 创建服务端可验证的会话令牌。
 */
async function createSessionToken(): Promise<string> {
  const config = requireAuthConfig()
  const raw = `${config.username}:${config.password}:${config.secret}`
  const data = new TextEncoder().encode(raw)
  const digest = await crypto.subtle.digest('SHA-256', data)

  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * 校验 cookie 中的会话令牌是否合法。
 */
async function isValidSessionToken(token?: string): Promise<boolean> {
  if (!token || !isAuthConfigured()) {
    return false
  }

  const expected = await createSessionToken()
  return token === expected
}

/**
 * 清洗登录后跳转地址，避免开放重定向。
 */
function sanitizeRedirectPath(path?: string | null): string {
  if (!path || !path.startsWith('/') || path.startsWith('//')) {
    return DEFAULT_LOGIN_REDIRECT_PATH
  }

  return path
}

/**
 * 返回登录态 cookie 的通用配置。
 */
function getSessionCookieOptions(maxAge: number = AUTH_SESSION_MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  }
}

export {
  AUTH_COOKIE_NAME,
  AUTH_SESSION_MAX_AGE_SECONDS,
  DEFAULT_LOGIN_REDIRECT_PATH,
  createSessionToken,
  getAuthConfigErrorMessage,
  getSessionCookieOptions,
  isAuthConfigured,
  isValidSessionToken,
  requireAuthConfig,
  sanitizeRedirectPath,
}
