import { sql } from '@vercel/postgres'

export async function initDb() {
  // 1. projects 表 - 项目配置
  await sql`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      product_name TEXT,
      product_description TEXT,
      target_audience TEXT,
      brand_names TEXT,
      competitor_brands TEXT,
      keywords TEXT,
      subreddits TEXT,
      status TEXT DEFAULT 'draft',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `

  // 2. posts 表 - 抓取的 Reddit 帖子
  await sql`
    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      subreddit TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      author TEXT,
      url TEXT,
      score INTEGER DEFAULT 0,
      num_comments INTEGER DEFAULT 0,
      created_utc TIMESTAMP,
      hot_score REAL DEFAULT 0,
      composite_score REAL DEFAULT 0,
      category TEXT,
      is_candidate BOOLEAN DEFAULT FALSE,
      scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `

  // 3. personas 表 - 人设管理（增强版）
  await sql`
    CREATE TABLE IF NOT EXISTS personas (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      name TEXT NOT NULL,
      username TEXT,
      avatar_emoji TEXT,
      avatar_color TEXT,
      description TEXT,
      description_en TEXT,
      background TEXT,
      tone TEXT,
      focus TEXT,
      writing_style TEXT,
      post_types TEXT,
      platform TEXT DEFAULT 'Reddit',
      is_default BOOLEAN DEFAULT FALSE,
      -- 新增字段
      reddit_habits TEXT,       -- JSON: Reddit使用习惯
      writing_traits TEXT,      -- JSON: 写作特征
      brand_strategy TEXT,      -- 品牌提及策略
      flaws TEXT,               -- 人设的不完美点
      sample_comments TEXT,     -- JSON: 示例评论
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `

  // 4. contents 表 - 生成的内容（增强版）
  await sql`
    CREATE TABLE IF NOT EXISTS contents (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      post_id TEXT,
      persona_id TEXT,
      content_type TEXT DEFAULT 'comment',
      title TEXT,
      body TEXT NOT NULL,
      body_edited TEXT,
      status TEXT DEFAULT 'draft',
      brand_mention TEXT,
      -- 新增字段
      content_mode TEXT,          -- reply_post / reply_comment / free_compose
      target_comment TEXT,        -- 模式二：被回复的评论原文
      user_idea TEXT,             -- 模式三：用户输入的想法/主题
      target_subreddit TEXT,      -- 模式三：目标 Subreddit
      post_type TEXT,             -- 模式三：帖子类型
      quality_score INTEGER,      -- 自动质量评分（0-100）
      quality_issues TEXT,        -- 质量问题列表（JSON）
      ai_model_used TEXT,         -- 使用的 AI 模型
      generation_prompt TEXT,     -- 完整的生成 prompt（方便调试）
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      published_at TIMESTAMP,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE SET NULL,
      FOREIGN KEY(persona_id) REFERENCES personas(id) ON DELETE SET NULL
    )
  `

  // 5. publish_log 表 - 发布记录
  await sql`
    CREATE TABLE IF NOT EXISTS publish_log (
      id TEXT PRIMARY KEY,
      content_id TEXT NOT NULL,
      published_url TEXT,
      upvotes INTEGER DEFAULT 0,
      replies INTEGER DEFAULT 0,
      status TEXT DEFAULT 'published',
      published_at TIMESTAMP,
      last_tracked_at TIMESTAMP,
      FOREIGN KEY(content_id) REFERENCES contents(id) ON DELETE CASCADE
    )
  `
}

export { sql }
