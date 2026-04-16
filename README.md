# Reddit Ops Web

> 基于 Next.js 14 的 Reddit 内容运营工作台，覆盖项目配置、抓取、分析、人设、创作、发布与历史追踪。

## 当前状态

这个仓库当前是一个单体 `Next.js` 应用
- 前端：`app/` 下的 App Router 页面
- 后端：`app/api/*` 下的 Route Handlers
- 数据库：`@vercel/postgres`
- AI：`MiniMax`
- 抓取：`Apify Reddit Scraper`

## 工作流

```text
P1 配置 -> P2 抓取 -> P3 分析 -> P4-1 人设 -> P4-2 创作 -> P5 发布
```

| 阶段 | 路由 | 当前实现 |
|------|------|----------|
| P1 配置 | `/workflow/config` | 创建项目、从产品 URL 提取信息、AI 扩展关键词与 subreddit 策略 |
| P2 抓取 | `/workflow/scraping` | 按 phase 批量发起 Apify 抓取、轮询状态、同步结果到 `posts` |
| P3 分析 | `/workflow/analysis` | 帖子筛选、AI 评分、候选标记、忽略管理 |
| P4-1 人设 | `/workflow/persona` | AI 生成人设、预览、编辑、自定义新增 |
| P4-2 创作 | `/workflow/content` | 三种模式生成内容：回复帖、回复评论、自由发帖 |
| P5 发布 | `/workflow/publish` | 待发布队列、复制内容、手动登记发布链接、维护互动数据 |
| 仪表盘 | `/dashboard` | 漏斗、项目进度、评分分布、内容状态 |
| 历史 | `/history` | 按项目查看已生成内容与状态 |

## 技术栈

- `Next.js 14`
- `React 18`
- `TypeScript`
- `Tailwind CSS`
- `@vercel/postgres`
- `MiniMax API`
- `Apify API`

## 本地运行

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

至少需要以下变量：

```bash
POSTGRES_URL=...
MINIMAX_API_KEY=...
MINIMAX_GROUP_ID=...
APIFY_API_TOKEN=...
NEXT_PUBLIC_APIFY_TOKEN=...
AUTH_USERNAME=...
AUTH_PASSWORD=...
AUTH_SECRET=...
```

可选变量：

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_BASE_URL=http://localhost:3000
MINIMAX_API_URL=...
MINIMAX_MODEL=MiniMax-M2.7-Highspeed
VERCEL_URL=...
```

### 3. 启动开发服务器

```bash
npm run dev
```

默认访问 [http://localhost:3000](http://localhost:3000)。

启动后，页面和大部分 API 会先跳转到 `/login`，使用上面配置的账号密码登录。

### 4. 初始化数据库

首次运行后访问：

```text
/api/init
```

该接口会创建并补齐当前代码使用的表结构：

- `projects`
- `posts`
- `personas`
- `contents`
- `publish_log`
- `scraping_runs`

## 目录结构

```text
app/
  api/                 Next.js API 路由
  workflow/            P1-P5 页面
  dashboard/           数据仪表盘
  history/             内容历史
components/            页面组件与工作流组件
lib/                   数据库、AI、Apify、评分与类型
docs/                  项目文档
```

## 实现边界

当前仓库里仍有少量“设计稿/占位接口”文件，但不应视为已完整上线能力：

- `app/api/run-pipeline/route.ts` 目前返回的是示例结果，不是完整自动流水线
- 发布阶段是“半自动”：在页面中复制内容并手动去 Reddit 发布
- 文档中的 GitHub Pages 静态文档仍可参考，但以应用代码行为为准

## 文档入口

- [docs/index.md](/Users/tianzhipeng/Documents/private/cnm/vt/reddit-ops-web/docs/index.md)
- [docs/workflow/overview.md](/Users/tianzhipeng/Documents/private/cnm/vt/reddit-ops-web/docs/workflow/overview.md)

最后更新：2026-04-16
