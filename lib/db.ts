import { sql } from '@vercel/postgres'

export async function initDb() {
  await sql`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      background_info TEXT,
      search_query TEXT,
      subreddits TEXT,
      auto_scrape_enabled INTEGER DEFAULT 0,
      scrape_schedule_time TEXT DEFAULT '09:00',
      scrape_schedule_timezone TEXT DEFAULT 'Asia/Shanghai',
      created_at TEXT
    )
  `

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
      created_at TEXT,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `
}

export { sql }