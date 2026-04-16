import LoginForm from '@/app/login/LoginForm'
import { sanitizeRedirectPath } from '@/lib/auth'

interface LoginPageProps {
  searchParams?: {
    next?: string
  }
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  const nextPath = sanitizeRedirectPath(searchParams?.next)

  return (
    <main className="min-h-screen w-full bg-[radial-gradient(circle_at_top,#fef3c7_0%,#fff7ed_32%,#e2e8f0_100%)] px-6 py-10 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[2rem] border border-white/70 bg-white/80 shadow-[0_24px_80px_rgba(15,23,42,0.16)] backdrop-blur-xl lg:grid-cols-[1.15fr_0.85fr]">
          <section className="relative overflow-hidden bg-slate-900 px-8 py-10 text-white sm:px-12 sm:py-14">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.28),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(251,146,60,0.2),transparent_30%)]" />
            <div className="relative">
              <div className="mb-12 inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-400 text-lg text-slate-900">
                  R
                </span>
                Reddit Ops
              </div>

              <h1 className="max-w-md text-4xl font-black leading-tight sm:text-5xl">
                先登录，再操作整套 Reddit 工作流
              </h1>
              <p className="mt-5 max-w-lg text-sm leading-7 text-slate-300 sm:text-base">
                现在所有页面和 API 都需要登录后才能访问。账号密码通过环境变量配置，
                适合当前项目的内网或小团队使用场景。
              </p>

              <div className="mt-10 space-y-4 text-sm text-slate-200">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="font-semibold text-white">覆盖范围</div>
                  <div className="mt-1 text-slate-300">页面路由、业务 API、退出登录都已统一收口。</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="font-semibold text-white">接入方式</div>
                  <div className="mt-1 text-slate-300">
                    使用 `AUTH_USERNAME`、`AUTH_PASSWORD`、`AUTH_SECRET` 三个环境变量控制。
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="px-8 py-10 sm:px-12 sm:py-14">
            <div className="mx-auto max-w-sm">
              <div className="mb-8">
                <div className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-500">
                  Sign In
                </div>
                <h2 className="mt-3 text-3xl font-black text-slate-900">账号密码登录</h2>
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  登录成功后会回到你刚才要访问的页面。
                </p>
              </div>

              <LoginForm nextPath={nextPath} />
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
