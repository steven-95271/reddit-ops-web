import { sql } from '@vercel/postgres'

export async function initDb() {
  // 1. 项目表（扩展搜索策略字段）
  await sql`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      background_info TEXT,
      search_query TEXT,
      subreddits TEXT,
      search_queries TEXT,
      competitor_brands TEXT,
      classification_keywords TEXT,
      auto_scrape_enabled INTEGER DEFAULT 0,
      scrape_schedule_time TEXT DEFAULT '09:00',
      scrape_schedule_timezone TEXT DEFAULT 'Asia/Shanghai',
      created_at TEXT
    )
  `

  // 2. 人设表（扩展）
  await sql`
    CREATE TABLE IF NOT EXISTS personas (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      reddit_account_id TEXT,
      name TEXT NOT NULL,
      username TEXT,
      avatar_emoji TEXT,
      avatar_color TEXT,
      description TEXT,
      description_en TEXT,
      background TEXT,
      tone TEXT,
      writing_style TEXT,
      focus TEXT,
      post_types TEXT,
      platform TEXT DEFAULT 'Reddit',
      role_type TEXT DEFAULT 'casual_user',
      brand_integration_level TEXT DEFAULT 'subtle',
      content_strategy TEXT,
      generation_config TEXT,
      prototype_analysis TEXT,
      created_at TEXT,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `

  // 3. Reddit账号表（新增）
  await sql`
    CREATE TABLE IF NOT EXISTS reddit_accounts (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      username TEXT NOT NULL,
      email TEXT,
      password_encrypted TEXT,
      proxy_config TEXT,
      karma_post INTEGER DEFAULT 0,
      karma_comment INTEGER DEFAULT 0,
      account_status TEXT DEFAULT 'active',
      last_login TEXT,
      created_at TEXT,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `

  // 4. 抓取内容表（新增）
  await sql`
    CREATE TABLE IF NOT EXISTS scraped_posts (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      reddit_id TEXT,
      title TEXT NOT NULL,
      selftext TEXT,
      subreddit TEXT,
      author TEXT,
      score INTEGER DEFAULT 0,
      num_comments INTEGER DEFAULT 0,
      url TEXT,
      created_utc INTEGER,
      scraped_at TEXT,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `

  // 5. 内容生成任务表（新增）
  await sql`
    CREATE TABLE IF NOT EXISTS content_generation_tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      persona_id TEXT NOT NULL,
      reddit_account_id TEXT,
      content_type TEXT NOT NULL,
      source_content_id TEXT,
      generated_title TEXT,
      generated_body TEXT,
      brand_mention_score REAL DEFAULT 0,
      authenticity_score REAL DEFAULT 0,
      human_approval_status TEXT DEFAULT 'pending',
      was_edited INTEGER DEFAULT 0,
      rejection_reason TEXT,
      reviewed_at TEXT,
      scheduled_publish_time TEXT,
      published_at TEXT,
      reddit_post_id TEXT,
      created_at TEXT,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY(persona_id) REFERENCES personas(id) ON DELETE CASCADE
    )
  `

  // 6. 抓取配置模板表（新增）
  await sql`
    CREATE TABLE IF NOT EXISTS scrape_templates (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      config TEXT NOT NULL,
      created_at TEXT,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `

  // 7. 抓取历史记录表（新增）
  await sql`
    CREATE TABLE IF NOT EXISTS scrape_history (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      apify_run_id TEXT NOT NULL,
      name TEXT NOT NULL,
      search_query TEXT,
      search_subreddit TEXT,
      sort_order TEXT,
      time_filter TEXT,
      max_posts INTEGER,
      status TEXT DEFAULT 'running',
      dataset_id TEXT,
      posts_count INTEGER DEFAULT 0,
      started_at TEXT,
      finished_at TEXT,
      created_at TEXT,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `

  console.log('Database initialized successfully')
}

// 迁移：扩展现有表
export async function migrateDb() {
  // 检查并添加人设表的新列
  try {
    await sql`ALTER TABLE personas ADD COLUMN IF NOT EXISTS reddit_account_id TEXT`
    await sql`ALTER TABLE personas ADD COLUMN IF NOT EXISTS role_type TEXT DEFAULT 'casual_user'`
    await sql`ALTER TABLE personas ADD COLUMN IF NOT EXISTS brand_integration_level TEXT DEFAULT 'subtle'`
    await sql`ALTER TABLE personas ADD COLUMN IF NOT EXISTS content_strategy TEXT`
    await sql`ALTER TABLE personas ADD COLUMN IF NOT EXISTS generation_config TEXT`
    await sql`ALTER TABLE personas ADD COLUMN IF NOT EXISTS prototype_analysis TEXT`
  } catch (e) {
    console.log('Personas table migration:', e)
  }
  
  // 检查并添加projects表的新列
  try {
    await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS search_queries TEXT`
    await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS competitor_brands TEXT`
    await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS classification_keywords TEXT`
    await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS suggested_keywords TEXT`
  } catch (e) {
    console.log('Projects table migration:', e)
  }
  
  console.log('Database migration completed')
}

export { sql }
