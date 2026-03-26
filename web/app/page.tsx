import Link from 'next/link'

export default function Home() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-4xl font-black text-slate-900 mb-4">Reddit Ops</h1>
        <p className="text-slate-500 mb-8">内容运营系统</p>
        <Link 
          href="/dashboard"
          className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-colors"
        >
          进入系统 →
        </Link>
      </div>
    </div>
  )
}