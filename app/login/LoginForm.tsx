'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'

interface LoginFormProps {
  nextPath: string
}

export default function LoginForm({ nextPath }: LoginFormProps) {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!username.trim() || !password) {
      setErrorMessage('请输入账号和密码')
      return
    }

    setIsSubmitting(true)
    setErrorMessage('')

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username.trim(),
          password,
          next: nextPath,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        setErrorMessage(result.error || '登录失败，请稍后重试')
        return
      }

      router.replace(result.redirect_to || nextPath)
      router.refresh()
    } catch (error) {
      console.error('[login] Failed to sign in:', error)
      setErrorMessage('登录失败，请检查网络后重试')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <label className="block">
        <div className="mb-2 text-sm font-semibold text-slate-700">账号</div>
        <input
          autoComplete="username"
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-orange-100"
          disabled={isSubmitting}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="输入账号"
          type="text"
          value={username}
        />
      </label>

      <label className="block">
        <div className="mb-2 text-sm font-semibold text-slate-700">密码</div>
        <input
          autoComplete="current-password"
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-orange-100"
          disabled={isSubmitting}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="输入密码"
          type="password"
          value={password}
        />
      </label>

      {errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {errorMessage}
        </div>
      ) : null}

      <button
        className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? '登录中...' : '登录'}
      </button>
    </form>
  )
}
