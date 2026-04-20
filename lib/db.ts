import { sql as vercelSql } from '@vercel/postgres'
import { Pool, type QueryResult, type QueryResultRow } from 'pg'

type SqlClient = {
  <T extends QueryResultRow = QueryResultRow>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<QueryResult<T>>
  query<T extends QueryResultRow = QueryResultRow>(
    queryText: string,
    values?: readonly unknown[]
  ): Promise<QueryResult<T>>
}

let localPool: Pool | null = null

function isLocalEnv(): boolean {
  const envMarkers = [
    process.env.APP_ENV,
    process.env.ENV,
    process.env.RUNTIME_ENV,
    process.env.NEXT_PUBLIC_APP_ENV,
  ]
    .filter(Boolean)
    .map((value) => value!.toLowerCase())

  if (envMarkers.includes('local')) {
    return true
  }

  if (process.env.NODE_ENV === 'development') {
    return true
  }

  const connectionString = process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? ''
  return /localhost|127\.0\.0\.1/.test(connectionString)
}

function getConnectionString(): string {
  const connectionString = process.env.POSTGRES_URL ?? process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error('Missing POSTGRES_URL or DATABASE_URL')
  }

  return connectionString
}

function getLocalPool(): Pool {
  if (localPool) {
    return localPool
  }

  localPool = new Pool({
    connectionString: getConnectionString(),
  })

  return localPool
}

function buildQuery(
  strings: TemplateStringsArray,
  values: readonly unknown[]
): { text: string; values: readonly unknown[] } {
  let text = strings[0] ?? ''

  for (let index = 0; index < values.length; index += 1) {
    text += `$${index + 1}${strings[index + 1] ?? ''}`
  }

  return { text, values }
}

const localSql = Object.assign(
  async function localSqlTag<T extends QueryResultRow = QueryResultRow>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<QueryResult<T>> {
    const { text, values: queryValues } = buildQuery(strings, values)
    return getLocalPool().query<T>(text, queryValues as unknown[])
  },
  {
    query<T extends QueryResultRow = QueryResultRow>(
      queryText: string,
      values: readonly unknown[] = []
    ): Promise<QueryResult<T>> {
      return getLocalPool().query<T>(queryText, values as unknown[])
    },
  }
) as SqlClient

export const sql: SqlClient = isLocalEnv()
  ? localSql
  : (vercelSql as unknown as SqlClient)

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
          scraping_run_id TEXT,
          apify_run_id TEXT,
          batch_id TEXT,
          phase TEXT,
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
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS project_id TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS scraping_run_id TEXT`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS apify_run_id TEXT`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS batch_id TEXT`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS phase TEXT`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS keyword TEXT`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS reddit_id TEXT`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS subreddit TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS body TEXT`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS author TEXT`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS url TEXT`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT 0`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS num_comments INTEGER DEFAULT 0`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS upvote_ratio REAL DEFAULT 0`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS created_utc TIMESTAMP`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS hot_score REAL DEFAULT 0`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS composite_score REAL DEFAULT 0`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS quality_score INTEGER DEFAULT 0`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS ai_score INTEGER DEFAULT 0`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS ai_scored_at TIMESTAMPTZ`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS ai_label TEXT`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS ai_reasoning TEXT`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS ai_relevance_score INTEGER`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS ai_intent_score INTEGER`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS ai_opportunity_score INTEGER`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS ai_suggested_angle TEXT`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS category TEXT`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_candidate BOOLEAN DEFAULT FALSE`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_ignored BOOLEAN DEFAULT FALSE`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS ignored BOOLEAN DEFAULT FALSE`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS candidate_marked_at TIMESTAMPTZ`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS relevance_score FLOAT DEFAULT 0`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS intent_score FLOAT DEFAULT 0`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS opportunity_score FLOAT DEFAULT 0`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS reddit_url TEXT`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS upvotes INTEGER DEFAULT 0`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS comments INTEGER DEFAULT 0`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS created_at_reddit TIMESTAMP`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS post_type TEXT`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS type TEXT`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS post_id TEXT`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS parent_id TEXT`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS depth INTEGER DEFAULT 0`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS post_title TEXT`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS subreddit_subscribers INTEGER DEFAULT 0`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS link_flair_text TEXT`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS permalink TEXT`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_stickied BOOLEAN DEFAULT FALSE`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_nsfw BOOLEAN DEFAULT FALSE`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS replies INTEGER DEFAULT 0`,
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS total_awards INTEGER DEFAULT 0`,
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

      const scrapingRunAlterStatements = [
        `ALTER TABLE scraping_runs ADD COLUMN IF NOT EXISTS cost_usd REAL DEFAULT 0`,
        `ALTER TABLE scraping_runs ADD COLUMN IF NOT EXISTS apify_status TEXT`,
        `ALTER TABLE scraping_runs ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMP`,
        `ALTER TABLE scraping_runs ADD COLUMN IF NOT EXISTS results_synced_at TIMESTAMP`,
        `ALTER TABLE scraping_runs ADD COLUMN IF NOT EXISTS sync_lock_token TEXT`,
        `ALTER TABLE scraping_runs ADD COLUMN IF NOT EXISTS sync_lock_expires_at TIMESTAMP`,
      ]

      for (const stmt of scrapingRunAlterStatements) {
        try {
          await sql.query(stmt)
          console.log('[initDb] Executed:', stmt.slice(0, 60))
        } catch (e: any) {
          console.log('[initDb] Column may already exist:', e?.message?.slice(0, 100))
        }
      }
    } catch (err) {
      console.error('[initDb] Error creating scraping_runs table:', err)
      throw err
    }

    try {
      await sql`
        UPDATE posts AS p
        SET
          apify_run_id = COALESCE(p.apify_run_id, sr.apify_run_id),
          batch_id = COALESCE(p.batch_id, sr.batch_id),
          phase = COALESCE(p.phase, sr.phase)
        FROM scraping_runs AS sr
        WHERE p.scraping_run_id = sr.id
          AND (
            p.apify_run_id IS NULL
            OR p.batch_id IS NULL
            OR p.phase IS NULL
          )
      `
      console.log('[initDb] Backfilled posts scraping metadata from scraping_runs')
    } catch (err) {
      console.error('[initDb] Error backfilling posts scraping metadata:', err)
      throw err
    }

    console.log('[initDb] All tables created successfully')
  } catch (error) {
    console.error('[initDb] Fatal error during database initialization:', error)
    throw error
  }
}
