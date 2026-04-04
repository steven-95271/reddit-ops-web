# PRD — Reddit 内容运营自动化系统

> 版本：v1.0  
> 最后更新：2026-04-05  
> 项目代号：Reddit Ops  
> 仓库：https://github.com/steven-95271/reddit-ops-web

---

## 1. 产品定位

### 1.1 一句话描述

一个帮助跨境电商 / DTC 品牌团队在 Reddit 上自动化运营的 Web 工具——从发现热帖、筛选机会，到 AI 生成内容、追踪发布效果，全流程在一个界面里完成。

### 1.2 目标用户

- **使用者**：2-3 人小团队（运营 + 市场），无需权限区分
- **使用场景**：内部工具，不对外销售
- **产品类型**：通用型，支持任何品类（耳机、智能家居、户外装备等）

### 1.3 核心价值

| 没有这个工具时 | 有了这个工具后 |
|---|---|
| 手动逛 Reddit 找帖子，效率低 | 自动抓取 + 评分，5 分钟找到高价值帖子 |
| 不知道在哪些 Subreddit 发帖 | AI 根据产品自动推荐板块和关键词 |
| 写回复内容费时，风格不统一 | AI 扮演人设自动生成内容，审核后发布 |
| 不知道品牌被提到了多少次 | 自动追踪品牌提及，衡量运营效果 |

---

## 2. 技术架构

### 2.1 技术栈（精简版）

| 层级 | 技术选择 | 说明 |
|---|---|---|
| 框架 | Next.js 14 (App Router) | 前后端一体，TypeScript |
| 样式 | Tailwind CSS | 已配置 |
| 数据库 | Vercel Postgres | 云端托管，免运维 |
| 抓取 | Apify API | Reddit 数据抓取 |
| AI 能力 | MiniMax API | 内容生成、关键词扩展 |
| 部署 | Vercel | 自动部署，绑定 GitHub |

### 2.2 架构决策记录

**决策：放弃 Python Flask 后端，走纯 Next.js 全栈路线。**

理由：
- 现有 Python 脚本（p1/p2/p3）本质是 API 调用编排 + 评分计算，不涉及重度数据科学
- 纯 Next.js 只需一个仓库、一个 Vercel 项目，部署和维护难度降为零
- 对 AI 编程工具（Cursor / Claude Code）更友好——单一语言、单一项目
- Python 脚本中的核心逻辑将逐步迁移到 Next.js API Routes

### 2.3 项目结构（目标）

```
reddit-ops-web/
├── app/
│   ├── page.tsx                    # 首页（项目列表）
│   ├── layout.tsx                  # 根布局
│   ├── globals.css                 # 全局样式
│   ├── dashboard/page.tsx          # 仪表盘
│   ├── history/page.tsx            # 历史记录
│   ├── workflow/
│   │   ├── layout.tsx              # 工作流共享布局（含进度条）
│   │   ├── config/page.tsx         # P1 配置
│   │   ├── scraping/page.tsx       # P2 抓取
│   │   ├── analysis/page.tsx       # P3 分析
│   │   ├── persona/page.tsx        # P4-1 人设
│   │   ├── content/page.tsx        # P4-2 内容创作
│   │   └── publish/page.tsx        # P5 发布
│   └── api/                        # API Routes（后端逻辑全部在这里）
│       ├── projects/route.ts       # 项目 CRUD
│       ├── scraping/route.ts       # 触发 Apify 抓取
│       ├── analysis/route.ts       # 评分 + 分类
│       ├── personas/route.ts       # 人设 CRUD
│       ├── content/route.ts        # AI 内容生成
│       ├── publish/route.ts        # 发布管理
│       └── stats/route.ts          # 统计数据
├── components/                     # 共享 UI 组件
│   ├── Sidebar.tsx
│   ├── BaseLayout.tsx
│   ├── Toast.tsx
│   ├── WorkflowProgress.tsx        # 流程进度条
│   └── DataTable.tsx               # 通用数据表格
├── lib/
│   ├── db.ts                       # 数据库连接 + 初始化
│   ├── apify.ts                    # Apify API 封装
│   ├── minimax.ts                  # MiniMax AI API 封装
│   └── scoring.ts                  # 评分算法
└── data/                           # 临时数据 / Mock 数据
```

---

## 3. 数据模型

### 3.1 数据库表设计

#### projects（项目表）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | TEXT PK | UUID |
| name | TEXT | 项目名称，如"开放式耳机推广" |
| product_name | TEXT | 产品名称 |
| product_description | TEXT | 产品描述 |
| target_audience | TEXT | 目标受众 |
| brand_names | TEXT | 自有品牌名（JSON 数组） |
| competitor_brands | TEXT | 竞品品牌名（JSON 数组） |
| keywords | TEXT | AI 扩展后的关键词（JSON） |
| subreddits | TEXT | 推荐的 Subreddit 列表（JSON） |
| status | TEXT | draft / active / archived |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

#### posts（抓取的 Reddit 帖子）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | TEXT PK | Reddit 帖子 ID |
| project_id | TEXT FK | 所属项目 |
| subreddit | TEXT | 来源板块 |
| title | TEXT | 帖子标题 |
| body | TEXT | 帖子内容 |
| author | TEXT | 作者 |
| url | TEXT | 原帖链接 |
| score | INTEGER | Reddit 原始分数 |
| num_comments | INTEGER | 评论数 |
| created_utc | TIMESTAMP | Reddit 发帖时间 |
| hot_score | REAL | 热度评分 (0-100) |
| composite_score | REAL | 综合评分 (0-1) |
| category | TEXT | A/B/C/D/E 五维分类 |
| is_candidate | BOOLEAN | 是否为候选帖 |
| scraped_at | TIMESTAMP | 抓取时间 |

#### personas（人设表）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | TEXT PK | UUID |
| project_id | TEXT FK | 所属项目 |
| name | TEXT | 人设名称，如"运动达人 Alex" |
| username | TEXT | Reddit 用户名 |
| avatar_emoji | TEXT | 头像 emoji |
| description | TEXT | 人设描述（中文） |
| description_en | TEXT | 人设描述（英文，给 AI 用） |
| background | TEXT | 背景故事 |
| tone | TEXT | 语气风格 |
| focus | TEXT | 关注领域 |
| writing_style | TEXT | 写作风格 |
| is_default | BOOLEAN | 是否为默认人设 |
| created_at | TIMESTAMP | 创建时间 |

#### contents（生成的内容）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | TEXT PK | UUID |
| project_id | TEXT FK | 所属项目 |
| post_id | TEXT FK | 关联的原帖 |
| persona_id | TEXT FK | 使用的人设 |
| content_type | TEXT | comment / post |
| title | TEXT | 标题（如果是发帖） |
| body | TEXT | AI 生成的内容 |
| body_edited | TEXT | 人工编辑后的内容 |
| status | TEXT | draft / approved / published / rejected |
| brand_mention | TEXT | 品牌提及方式 |
| created_at | TIMESTAMP | 生成时间 |
| published_at | TIMESTAMP | 发布时间 |

#### publish_log（发布记录）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | TEXT PK | UUID |
| content_id | TEXT FK | 关联的内容 |
| published_url | TEXT | 发布后的链接 |
| upvotes | INTEGER | 点赞数（追踪） |
| replies | INTEGER | 回复数（追踪） |
| status | TEXT | published / deleted / flagged |
| published_at | TIMESTAMP | 发布时间 |
| last_tracked_at | TIMESTAMP | 最后追踪时间 |

---

## 4. 工作流详细设计

### 全流程概览

```
P1 项目配置 → P2 内容抓取 → P3 分析筛选 → P4-1 人设管理 → P4-2 内容创作 → P5 发布追踪
```

每个步骤可独立运行，但数据依次流转。顶部进度条始终显示当前所处阶段。

---

### P1 项目配置（/workflow/config）

#### 功能描述

用户创建一个运营项目，输入产品基本信息后，AI 自动扩展关键词并推荐合适的 Subreddit。

#### 用户操作流程

1. 填写项目基本信息表单：
   - 项目名称（必填）
   - 产品名称 + 简要描述（必填）
   - 目标受众（选填）
   - 自有品牌名（必填，支持多个）
   - 竞品品牌名（选填，支持多个）
   - 种子关键词（选填，AI 会扩展）

2. 点击"AI 生成配置"按钮

3. AI 返回：
   - 扩展后的关键词（核心词、长尾词、竞品词、场景词）
   - 推荐的 Subreddit 列表（附推荐理由和相关度）
   - 搜索策略建议

4. 用户可以：
   - 编辑 / 增删关键词
   - 编辑 / 增删 Subreddit
   - 满意后点击"保存配置"

#### API 设计

```
POST /api/projects
  Body: { name, product_name, product_description, target_audience, brand_names, competitor_brands, seed_keywords }
  → 调用 MiniMax API 扩展关键词 + 推荐 Subreddit
  → 返回完整配置 + 保存到数据库

GET /api/projects
  → 返回所有项目列表

GET /api/projects/[id]
  → 返回单个项目详情

PUT /api/projects/[id]
  → 更新项目配置

DELETE /api/projects/[id]
  → 删除项目
```

#### 页面要素

- 表单区域：基本信息输入
- 结果展示区域：关键词标签云 + Subreddit 卡片列表
- 操作按钮：AI 生成 / 保存 / 跳转到 P2

---

### P2 内容抓取（/workflow/scraping）

#### 功能描述

根据 P1 配置的关键词和 Subreddit，调用 Apify 抓取 Reddit 帖子。

#### 用户操作流程

1. 选择要抓取的项目（从 P1 配置中选）
2. 设置抓取参数：
   - 时间范围（最近 24h / 7天 / 30天）
   - 最大抓取数量
   - 排序方式（hot / new / top）
3. 点击"开始抓取"
4. 显示抓取进度（实时日志 + 进度条）
5. 抓取完成后展示结果概览：抓取总数、成功数、Subreddit 分布

#### API 设计

```
POST /api/scraping
  Body: { project_id, time_range, max_posts, sort_by }
  → 调用 Apify API 启动抓取任务
  → 返回 task_id

GET /api/scraping/[task_id]/status
  → 返回抓取进度

POST /api/scraping/webhook
  → Apify 回调：抓取完成 → 写入 posts 表
```

#### 页面要素

- 项目选择器
- 参数设置面板
- 实时进度展示（进度条 + 日志窗口）
- 结果概览统计卡片
- 操作按钮：开始抓取 / 跳转到 P3

---

### P3 分析筛选（/workflow/analysis）

#### 功能描述

对抓取到的帖子进行多维评分和分类，筛选出高价值候选帖。

#### 评分算法

**Hot Score (0-100)**：基于帖子的 upvotes、评论数、发帖时间计算热度。

**Composite Score (0-1)**：综合热度、相关性、互动质量的加权分数。

**分级**：S (≥0.8) / A (≥0.6) / B (≥0.4) / C (<0.4)

**五维分类**：
- A 类：结构型测评帖（"Best XX for YY"）
- B 类：场景痛点帖（用户抱怨某个问题）
- C 类：观点争议帖（对比讨论）
- D 类：竞品/KOL 帖（提到竞品的帖子）
- E 类：平台趋势帖（社区热门话题）

#### 用户操作流程

1. 选择项目 → 自动加载该项目的帖子
2. 系统自动计算评分和分类
3. 展示评分结果表格（可排序、可筛选）
4. 用户可手动标记/取消候选帖
5. 确认候选列表 → 跳转到 P4

#### API 设计

```
POST /api/analysis
  Body: { project_id }
  → 对该项目所有帖子跑评分算法
  → 更新 posts 表的 hot_score / composite_score / category

GET /api/analysis/[project_id]
  → 返回评分结果列表（支持筛选和排序）

PUT /api/analysis/candidates
  Body: { post_ids, is_candidate }
  → 批量更新候选状态
```

#### 页面要素

- 统计概览：各评级数量、各分类分布图
- 帖子列表表格：标题、评分、分类、操作
- 筛选栏：按评级、按分类、按 Subreddit
- 批量操作：全选标记候选

---

### P4-1 人设管理（/workflow/persona）

#### 功能描述

管理 Reddit 回复时使用的虚拟人设，每个人设有独立的性格、语气和专业背景。

#### 默认人设（系统内置 3 个）

| 人设 | 定位 | 语气 |
|---|---|---|
| 运动达人 Alex | 热爱跑步和户外运动 | 热情、分享型、爱用感叹号 |
| 音频极客 Sam | 发烧友、技术控 | 专业、客观、喜欢对比数据 |
| 通勤白领 Jordan | 每天地铁通勤 | 实用主义、简洁、注重性价比 |

#### 用户操作流程

1. 查看现有人设列表
2. 可创建自定义人设（填写性格描述、语气风格等）
3. 可编辑/删除人设
4. 每个人设可关联到多个项目

#### 页面要素

- 人设卡片列表（头像 emoji + 名称 + 描述）
- 新建/编辑表单
- 预览区域（展示该人设会用什么语气回复）

---

### P4-2 内容创作（/workflow/content）

#### 功能描述

AI 扮演选定的人设，针对候选帖子自动生成回复内容。

#### 用户操作流程

1. 选择项目 → 加载候选帖列表
2. 选择一个候选帖 → 查看原帖内容
3. 选择一个人设
4. 点击"AI 生成回复"
5. AI 生成内容（含品牌自然提及）
6. 用户审核：
   - 通过 → 状态改为 approved
   - 编辑后通过 → 保存到 body_edited
   - 拒绝 → 可重新生成
7. 批量生成：对多个候选帖 + 多个人设组合生成

#### API 设计

```
POST /api/content/generate
  Body: { post_id, persona_id, project_id }
  → 调用 MiniMax API，用人设 prompt + 原帖内容生成回复
  → 保存到 contents 表

GET /api/content?project_id=xxx&status=draft
  → 返回内容列表

PUT /api/content/[id]
  Body: { body_edited, status }
  → 更新内容状态
```

#### 页面要素

- 左侧：候选帖列表
- 右侧上：原帖预览
- 右侧下：AI 生成的回复 + 编辑器
- 底部：审核按钮（通过 / 编辑 / 拒绝 / 重新生成）

---

### P5 发布追踪（/workflow/publish）

#### 功能描述

管理已审核通过的内容的发布状态和效果追踪。

> **MVP 阶段**：手动复制内容到 Reddit 发布，然后粘贴链接回来追踪。  
> **未来优化**：接入 Reddit API 实现半自动发布。

#### 用户操作流程

1. 查看待发布队列（status = approved 的内容）
2. 点击内容 → 复制回复文本
3. 手动在 Reddit 发布
4. 回来粘贴发布链接
5. 系统定期追踪链接的点赞和回复数

#### 页面要素

- 待发布队列
- 已发布列表（附效果数据）
- 品牌提及追踪面板

---

### 仪表盘（/dashboard）

- 全局统计：项目数、总帖子数、候选数、已生成内容数、已发布数
- 最近活动时间线
- 各项目进度概览

### 历史记录（/history）

- 所有操作的时间线日志
- 按项目筛选

---

## 5. 开发计划

### 5.1 MVP（第一阶段）—— P1 + P2 跑通

**目标**：能创建项目、配置关键词、抓取到真实 Reddit 数据并存到数据库。

| 任务 | 说明 | 预计耗时 |
|---|---|---|
| 补齐数据库表 | 在 lib/db.ts 中添加 posts 表 | 0.5 天 |
| 重写 /api/projects | 实现完整 CRUD + AI 关键词扩展 | 1 天 |
| 重写 P1 前端页面 | 对接真实 API，去掉 mock 数据 | 1 天 |
| 实现 /api/scraping | 封装 Apify 调用 + 数据入库 | 1.5 天 |
| 重写 P2 前端页面 | 抓取触发 + 进度展示 + 结果预览 | 1 天 |
| 联调测试 | 端到端走通一遍 | 0.5 天 |
| **合计** | | **5.5 天** |

### 5.2 第二阶段 —— P3 分析

| 任务 | 说明 | 预计耗时 |
|---|---|---|
| 实现评分算法 | 从 Python 迁移 hot_score + composite_score | 1 天 |
| 实现五维分类 | 调用 AI 或规则分类 | 1 天 |
| P3 前端页面 | 表格 + 筛选 + 候选标记 | 1.5 天 |
| **合计** | | **3.5 天** |

### 5.3 第三阶段 —— P4 人设 + 内容

| 任务 | 说明 | 预计耗时 |
|---|---|---|
| 人设 CRUD API + 页面 | | 1.5 天 |
| AI 内容生成 API | MiniMax 集成 + prompt 工程 | 2 天 |
| 内容审核页面 | 原帖预览 + AI 回复 + 编辑 | 2 天 |
| **合计** | | **5.5 天** |

### 5.4 第四阶段 —— P5 发布 + 仪表盘

| 任务 | 说明 | 预计耗时 |
|---|---|---|
| 发布管理 API + 页面 | | 2 天 |
| 仪表盘统计 | | 1 天 |
| 历史记录 | | 0.5 天 |
| **合计** | | **3.5 天** |

---

## 6. 开发原则（Vibe Coding 心法）

### 6.1 小步迭代

- 每次只改一个功能点
- 改完立即测试，确认没问题再继续
- 不要一次让 AI 改太多东西

### 6.2 版本管理

- 每完成一个功能就 git commit
- commit message 写清楚改了什么
- 遇到 AI 改崩了就 git checkout 回退

### 6.3 AI 协作技巧

- 把这份 PRD 作为上下文喂给 Cursor / Claude Code
- 每次只给 AI 一个明确的小任务
- 报错信息直接复制给 AI，让它帮你修
- 不要同时开多个功能的开发

### 6.4 测试策略

- MVP 阶段不写自动化测试，手动测试即可
- 每个 API 用浏览器或 curl 验证一遍
- 前端页面每次改完刷新看效果

---

## 7. 环境变量

```env
# Vercel Postgres
POSTGRES_URL=

# MiniMax AI API
MINIMAX_API_KEY=

# Apify（Reddit 抓取）
APIFY_API_TOKEN=
```

---

## 附录：从现有代码迁移清单

以下是需要从 Python 迁移到 TypeScript 的核心逻辑：

| Python 文件 | 核心逻辑 | 迁移到 |
|---|---|---|
| p1_config_generator.py | AI 关键词扩展 + Subreddit 推荐 | /api/projects/route.ts |
| p2_scraping_manager.py | Apify 调用 + 数据解析 | /api/scraping/route.ts + lib/apify.ts |
| p3_analyzer.py | Hot Score + Composite Score + 分类 | /api/analysis/route.ts + lib/scoring.ts |
| product_card_manager.py | 产品卡片管理 | 暂不迁移（非 MVP） |
| mock_data_generator.py | 测试数据生成 | 保留，开发阶段可用 |
