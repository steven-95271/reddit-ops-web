import { sql } from '@vercel/postgres'

export async function initDb() {
  try {
    console.log('[initDb] Creating tables...')
    
    // 1. projects 表 - 项目配置
    try {
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
      console.log('[initDb] projects table created/verified')
    } catch (err) {
      console.error('[initDb] Error creating projects table:', err)
      throw err
    }

    // 2. posts 表 - 抓取的 Reddit 帖子
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS posts (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          reddit_id TEXT,
          subreddit TEXT NOT NULL,
          title TEXT NOT NULL,
          body TEXT,
          author TEXT,
          url TEXT,
          score INTEGER DEFAULT 0,
          num_comments INTEGER DEFAULT 0,
          upvote_ratio REAL DEFAULT 0,
          created_utc TIMESTAMP,
          hot_score REAL DEFAULT 0,
          composite_score REAL DEFAULT 0,
          quality_score INTEGER DEFAULT 0,
          ai_relevance_score INTEGER,
          ai_intent_score INTEGER,
          ai_opportunity_score INTEGER,
          ai_suggested_angle TEXT,
          ai_scored_at TIMESTAMP,
          category TEXT,
          is_candidate BOOLEAN DEFAULT FALSE,
          candidate_marked_at TIMESTAMP,
          ignored BOOLEAN DEFAULT FALSE,
          scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
      `
      console.log('[initDb] posts table created/verified')
    } catch (err) {
      console.error('[initDb] Error creating posts table:', err)
      throw err
    }

    // 补充 posts 表可能缺失的字段（Postgres 支持 ADD COLUMN IF NOT EXISTS）
    // 注意：CREATE TABLE IF NOT EXISTS 只在表不存在时创建，旧部署的表可能缺少后来加的列
    const alterColumns = [
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS ai_score INTEGER DEFAULT 0`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS ai_scored_at TIMESTAMPTZ`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS ai_label TEXT`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS ai_reasoning TEXT`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_candidate BOOLEAN DEFAULT FALSE`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_ignored BOOLEAN DEFAULT FALSE`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS quality_score INTEGER DEFAULT 0`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS hot_score FLOAT DEFAULT 0`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS relevance_score FLOAT DEFAULT 0`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS scraping_run_id TEXT`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS candidate_marked_at TIMESTAMPTZ`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS intent_score FLOAT DEFAULT 0`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS opportunity_score FLOAT DEFAULT 0`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS reddit_id TEXT`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS reddit_url TEXT`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS upvotes INTEGER DEFAULT 0`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS comments INTEGER DEFAULT 0`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS created_at_reddit TIMESTAMP`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS post_type TEXT`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS keyword TEXT`,
    ]

    for (const stmt of alterColumns) {
      try {
        await sql.query(stmt)
        console.log('[initDb] Executed:', stmt.slice(0, 60))
      } catch (e: any) {
        console.log('[initDb] Column may already exist:', e?.message?.slice(0, 100))
      }
    }

    // 3. personas 表 - 人设管理（增强版）
    try {
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
          reddit_habits TEXT,
          writing_traits TEXT,
          brand_strategy TEXT,
          flaws TEXT,
          sample_comments TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
      `
      console.log('[initDb] personas table created/verified')
    } catch (err) {
      console.error('[initDb] Error creating personas table:', err)
      throw err
    }

    // 补充 personas 表可能缺失的字段
    const personaAlters = [
      'ALTER TABLE personas ADD COLUMN IF NOT EXISTS age INTEGER',
      'ALTER TABLE personas ADD COLUMN IF NOT EXISTS gender TEXT',
      'ALTER TABLE personas ADD COLUMN IF NOT EXISTS occupation TEXT',
      'ALTER TABLE personas ADD COLUMN IF NOT EXISTS pain_points TEXT',
      'ALTER TABLE personas ADD COLUMN IF NOT EXISTS goals TEXT',
      'ALTER TABLE personas ADD COLUMN IF NOT EXISTS reddit_behavior TEXT',
      'ALTER TABLE personas ADD COLUMN IF NOT EXISTS avatar_style TEXT',
      'ALTER TABLE personas ADD COLUMN IF NOT EXISTS tone_of_voice TEXT',
      'ALTER TABLE personas ADD COLUMN IF NOT EXISTS is_active INTEGER DEFAULT 1',
    ]
    for (const stmt of personaAlters) {
      try {
        await sql.query(stmt)
        console.log('[initDb] personas alter ok:', stmt.slice(30, 70))
      } catch (e: any) {
        if (!e.message?.includes('already exists')) {
          console.error('[initDb] personas alter error:', e.message?.slice(0, 100))
        }
      }
    }

    // 4. contents 表 - 生成的内容（增强版）
    try {
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
          content_mode TEXT,
          target_comment TEXT,
          user_idea TEXT,
          target_subreddit TEXT,
          post_type TEXT,
          quality_score INTEGER,
          quality_issues TEXT,
          ai_model_used TEXT,
          generation_prompt TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          published_at TIMESTAMP,
          FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
          FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE SET NULL,
          FOREIGN KEY(persona_id) REFERENCES personas(id) ON DELETE SET NULL
        )
      `
      console.log('[initDb] contents table created/verified')
    } catch (err) {
      console.error('[initDb] Error creating contents table:', err)
      throw err
    }

    // 5. publish_log 表 - 发布记录
    try {
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
      console.log('[initDb] publish_log table created/verified')
    } catch (err) {
      console.error('[initDb] Error creating publish_log table:', err)
      throw err
    }

    // 6. scraping_runs 表 - 每个查询词的运行记录
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS scraping_runs (
          id TEXT PRIMARY KEY,
          batch_id TEXT NOT NULL,
          project_id TEXT NOT NULL,
          phase TEXT NOT NULL,
          query TEXT NOT NULL,
          subreddit TEXT,
          apify_run_id TEXT,
          apify_dataset_id TEXT,
          status TEXT DEFAULT 'pending',
          params TEXT,
          total_posts INTEGER DEFAULT 0,
          inserted_posts INTEGER DEFAULT 0,
          skipped_posts INTEGER DEFAULT 0,
          cost_usd REAL DEFAULT 0,
          error_message TEXT,
          started_at TIMESTAMP,
          completed_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
      `
      console.log('[initDb] scraping_runs table created/verified')

      // Add cost_usd column if it doesn't exist (for existing tables)
      try {
        await sql`ALTER TABLE scraping_runs ADD COLUMN cost_usd REAL DEFAULT 0`
        console.log('[initDb] Added cost_usd column to scraping_runs')
      } catch {
        // Column may already exist, ignore
      }
    } catch (err) {
      console.error('[initDb] Error creating scraping_runs table:', err)
      throw err
    }

    console.log('[initDb] All tables created successfully')
  } catch (error) {
    console.error('[initDb] Fatal error during database initialization:', error)
    throw error
  }
}

export { sql }
