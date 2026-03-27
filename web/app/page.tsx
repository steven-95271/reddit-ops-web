import Link from 'next/link'

export default function Home() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-dark-bg">
      <div className="text-center">
        <h1 className="text-4xl font-black text-dark-text mb-4">Reddit Ops</h1>
        <p className="text-dark-muted mb-8">内容运营系统</p>
        <Link 
          href="/dashboard"
          className="inline-flex items-center gap-2 px-6 py-3 bg-reddit-orange text-white rounded-xl font-semibold hover:bg-[#E63E00] transition-colors"
        >
          进入系统 →
        </Link>
      </div>
    </div>
  )
}