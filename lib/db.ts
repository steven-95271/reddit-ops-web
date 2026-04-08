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
          error_message TEXT,
          started_at TIMESTAMP,
          completed_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
      `
      console.log('[initDb] scraping_runs table created/verified')
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
