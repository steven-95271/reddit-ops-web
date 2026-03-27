import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Reddit Ops - 内容运营系统',
  description: 'Reddit内容运营自动化系统 – 抓取、分类、生成、审核一站式管理',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN" className="dark">
      <body className="bg-dark-bg text-dark-text font-sans min-h-screen flex">
        {children}
      </body>
    </html>
  )
}