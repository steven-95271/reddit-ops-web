import sqlite3
import os
import uuid
import json
from datetime import datetime

import config

DB_PATH = os.path.join(config.DATA_DIR, "app.db")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                background_info TEXT,
                search_query TEXT,
                search_queries TEXT,
                subreddits TEXT,
                auto_scrape_enabled INTEGER DEFAULT 0,
                scrape_schedule_time TEXT DEFAULT '09:00',
                scrape_schedule_timezone TEXT DEFAULT 'Asia/Shanghai',
                brand_names TEXT,
                competitor_brands TEXT,
                suggested_keywords TEXT,
                classification_keywords TEXT,
                background_text TEXT,
                created_at TEXT
            )
        """)

        # Migration: add auto_scrape columns if not exist
        cursor = conn.execute("PRAGMA table_info(projects)").fetchall()
        columns = [row["name"] for row in cursor]
        if "auto_scrape_enabled" not in columns:
            conn.execute(
                "ALTER TABLE projects ADD COLUMN auto_scrape_enabled INTEGER DEFAULT 0"
            )
        if "scrape_schedule_time" not in columns:
            conn.execute(
                "ALTER TABLE projects ADD COLUMN scrape_schedule_time TEXT DEFAULT '09:00'"
            )
        if "scrape_schedule_timezone" not in columns:
            conn.execute(
                "ALTER TABLE projects ADD COLUMN scrape_schedule_timezone TEXT DEFAULT 'Asia/Shanghai'"
            )
        if "brand_names" not in columns:
            conn.execute("ALTER TABLE projects ADD COLUMN brand_names TEXT")
        if "competitor_brands" not in columns:
            conn.execute("ALTER TABLE projects ADD COLUMN competitor_brands TEXT")
        # Migration: add keyword advisor columns if not exist
        if "search_queries" not in columns:
            conn.execute("ALTER TABLE projects ADD COLUMN search_queries TEXT")
        if "suggested_keywords" not in columns:
            conn.execute("ALTER TABLE projects ADD COLUMN suggested_keywords TEXT")
        if "classification_keywords" not in columns:
            conn.execute("ALTER TABLE projects ADD COLUMN classification_keywords TEXT")
        if "background_text" not in columns:
            conn.execute("ALTER TABLE projects ADD COLUMN background_text TEXT")
        conn.execute("""
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
        """)

        # Migration: check if platform column exists
        cursor = conn.execute("PRAGMA table_info(personas)").fetchall()
        columns = [row["name"] for row in cursor]
        if "platform" not in columns:
            conn.execute(
                "ALTER TABLE personas ADD COLUMN platform TEXT DEFAULT 'Reddit'"
            )

        conn.commit()

        # Create scrape templates table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS scrape_templates (
                id TEXT PRIMARY KEY,
                project_id TEXT,
                name TEXT NOT NULL,
                template_config TEXT,
                created_at TEXT,
                FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
            )
        """)

        # Create brand mentions table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS brand_mentions (
                id TEXT PRIMARY KEY,
                project_id TEXT,
                brand_name TEXT,
                post_id TEXT,
                post_title TEXT,
                subreddit TEXT,
                sentiment TEXT,
                mention_context TEXT,
                scraped_at TEXT,
                FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
            )
        """)

        # Create post scoring table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS post_scores (
                id TEXT PRIMARY KEY,
                project_id TEXT,
                post_id TEXT,
                post_title TEXT,
                subreddit TEXT,
                hot_score REAL,
                score_level TEXT,
                upvotes INTEGER,
                comments INTEGER,
                engagement_depth REAL,
                keyword_match_score REAL,
                growth_rate REAL,
                age_hours REAL,
                status TEXT DEFAULT 'pending',
                confirmed_at TEXT,
                scraped_at TEXT,
                FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
            )
        """)

        conn.commit()

        # Seed default data if projects table is empty
        row = conn.execute("SELECT COUNT(*) as count FROM projects").fetchone()
        if row and row["count"] == 0:
            seed_defaults(conn)


def seed_defaults(conn):
    # Retrieve defaults from config if they exist, else provide hardcoded fallbacks
    default_query = getattr(config, "SEARCH_QUERY", "open ear earbuds")
    default_subreddits = getattr(
        config,
        "SUBREDDITS",
        ["headphones", "earbuds", "audiophile", "running", "commuting", "Fitness"],
    )
    default_subreddits_str = json.dumps(default_subreddits)

    pid = "default-project-1"
    conn.execute(
        "INSERT INTO projects (id, name, background_info, search_query, subreddits, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (
            pid,
            "Default Project",
            "关注开放式耳机的讨论",
            default_query,
            default_subreddits_str,
            datetime.now().isoformat(),
        ),
    )

    # Use existing config.PERSONAS if present, else fallback
    default_personas = getattr(config, "PERSONAS", [])
    if not default_personas:
        # Fallbacks just in case config is already stripped
        default_personas = [
            {
                "id": "sporty_runner",
                "name": "SportyRunner",
                "username": "u/trail_beats_ryan",
                "avatar_emoji": "🏃",
                "avatar_color": "#22c55e",
                "description": "运动跑者 - 体验分享",
                "description_en": "Athletic Runner - Experience Sharing",
                "background": "热爱跑步和户外运动，关注耳机在运动场景中的实际表现",
                "tone": "casual, energetic, first-person experience",
                "focus": ["running", "workout", "sports", "outdoor", "gym", "fitness"],
                "writing_style": "分享个人运动体验，语气活泼，强调实际感受",
                "post_types": [
                    "experience_share",
                    "workout_tip",
                    "gear_recommendation",
                ],
                "platform": "Reddit",
            }
        ]

    for p in default_personas:
        focus_str = json.dumps(p.get("focus", []))
        ptypes_str = json.dumps(p.get("post_types", []))

        conn.execute(
            """INSERT INTO personas 
               (id, project_id, name, username, avatar_emoji, avatar_color, description, description_en, background, tone, focus, writing_style, post_types, platform, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                p["id"],
                pid,
                p["name"],
                p["username"],
                p["avatar_emoji"],
                p["avatar_color"],
                p["description"],
                p.get("description_en", ""),
                p["background"],
                p["tone"],
                focus_str,
                p["writing_style"],
                ptypes_str,
                p.get("platform", "Reddit"),
                datetime.now().isoformat(),
            ),
        )
    conn.commit()


# --- Projects CRUD ---


def get_projects():
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM projects ORDER BY created_at ASC").fetchall()
        projects = []
        for r in rows:
            p = dict(r)
            try:
                p["subreddits"] = json.loads(p["subreddits"])
            except:
                p["subreddits"] = []
            projects.append(p)
        return projects


def get_project(project_id):
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM projects WHERE id = ?", (project_id,)
        ).fetchone()
        if row:
            p = dict(row)
            try:
                p["subreddits"] = json.loads(p["subreddits"])
            except:
                p["subreddits"] = []
            return p
        return None


def create_project(
    name,
    background,
    query,
    subreddits,
    auto_scrape_enabled=0,
    scrape_schedule_time="09:00",
    scrape_schedule_timezone="Asia/Shanghai",
):
    pid = str(uuid.uuid4())
    subreddits_str = (
        json.dumps(subreddits) if isinstance(subreddits, list) else subreddits
    )
    with get_db() as conn:
        conn.execute(
            "INSERT INTO projects (id, name, background_info, search_query, subreddits, auto_scrape_enabled, scrape_schedule_time, scrape_schedule_timezone, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                pid,
                name,
                background,
                query,
                subreddits_str,
                auto_scrape_enabled,
                scrape_schedule_time,
                scrape_schedule_timezone,
                datetime.now().isoformat(),
            ),
        )
        conn.commit()
    return pid


def update_project_scrape_settings(
    project_id,
    auto_scrape_enabled=None,
    scrape_schedule_time=None,
    scrape_schedule_timezone=None,
):
    with get_db() as conn:
        updates = []
        params = []
        if auto_scrape_enabled is not None:
            updates.append("auto_scrape_enabled = ?")
            params.append(1 if auto_scrape_enabled else 0)
        if scrape_schedule_time is not None:
            updates.append("scrape_schedule_time = ?")
            params.append(scrape_schedule_time)
        if scrape_schedule_timezone is not None:
            updates.append("scrape_schedule_timezone = ?")
            params.append(scrape_schedule_timezone)
        if not updates:
            return False
        params.append(project_id)
        conn.execute(f"UPDATE projects SET {', '.join(updates)} WHERE id = ?", params)
        conn.commit()
        return True


# --- Personas CRUD ---


def get_personas(project_id):
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM personas WHERE project_id = ? ORDER BY created_at ASC",
            (project_id,),
        ).fetchall()
        personas = []
        for r in rows:
            p = dict(r)
            try:
                p["focus"] = json.loads(p["focus"]) if p["focus"] else []
                p["post_types"] = json.loads(p["post_types"]) if p["post_types"] else []
            except:
                pass
            personas.append(p)
        return personas


def create_persona(
    project_id,
    name,
    username,
    emoji,
    color,
    desc,
    desc_en,
    background,
    tone,
    focus,
    writing,
    post_types,
    platform="Reddit",
):
    # If ID needs to be unique (like "sporty_runner"), could slugify the name. But UUID is safer.
    pid = str(uuid.uuid4())
    focus_str = json.dumps(focus) if isinstance(focus, list) else json.dumps([focus])
    post_types_str = (
        json.dumps(post_types)
        if isinstance(post_types, list)
        else json.dumps([post_types])
    )
    with get_db() as conn:
        conn.execute(
            """INSERT INTO personas 
               (id, project_id, name, username, avatar_emoji, avatar_color, description, description_en, background, tone, focus, writing_style, post_types, platform, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                pid,
                project_id,
                name,
                username,
                emoji,
                color,
                desc,
                desc_en,
                background,
                tone,
                focus_str,
                writing,
                post_types_str,
                platform,
                datetime.now().isoformat(),
            ),
        )
        conn.commit()
    return pid


# --- Scrape Templates CRUD ---


def get_scrape_templates(project_id):
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM scrape_templates WHERE project_id = ? ORDER BY created_at DESC",
            (project_id,),
        ).fetchall()
        templates = []
        for r in rows:
            t = dict(r)
            try:
                t["template_config"] = (
                    json.loads(t["template_config"]) if t["template_config"] else {}
                )
            except:
                t["template_config"] = {}
            templates.append(t)
        return templates


def create_scrape_template(project_id, name, config):
    tid = str(uuid.uuid4())
    config_str = json.dumps(config) if isinstance(config, dict) else config
    with get_db() as conn:
        conn.execute(
            "INSERT INTO scrape_templates (id, project_id, name, template_config, created_at) VALUES (?, ?, ?, ?, ?)",
            (tid, project_id, name, config_str, datetime.now().isoformat()),
        )
        conn.commit()
    return tid


def delete_scrape_template(template_id):
    with get_db() as conn:
        conn.execute("DELETE FROM scrape_templates WHERE id = ?", (template_id,))
        conn.commit()
        return True


# --- Brand Mentions CRUD ---


def get_brand_mentions(project_id, start_date=None, end_date=None):
    with get_db() as conn:
        query = "SELECT * FROM brand_mentions WHERE project_id = ?"
        params = [project_id]

        if start_date:
            query += " AND scraped_at >= ?"
            params.append(start_date)
        if end_date:
            query += " AND scraped_at <= ?"
            params.append(end_date)

        query += " ORDER BY scraped_at DESC"

        rows = conn.execute(query, params).fetchall()
        return [dict(r) for r in rows]


def create_brand_mention(
    project_id, brand_name, post_id, post_title, subreddit, sentiment, mention_context
):
    mid = str(uuid.uuid4())
    with get_db() as conn:
        conn.execute(
            """INSERT INTO brand_mentions 
               (id, project_id, brand_name, post_id, post_title, subreddit, sentiment, mention_context, scraped_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                mid,
                project_id,
                brand_name,
                post_id,
                post_title,
                subreddit,
                sentiment,
                mention_context,
                datetime.now().isoformat(),
            ),
        )
        conn.commit()
    return mid


def get_brand_mention_stats(project_id, days=30):
    with get_db() as conn:
        query = f"""
            SELECT 
                brand_name,
                COUNT(*) as mention_count,
                SUM(CASE WHEN sentiment = 'positive' THEN 1 ELSE 0 END) as positive_count,
                SUM(CASE WHEN sentiment = 'negative' THEN 1 ELSE 0 END) as negative_count,
                SUM(CASE WHEN sentiment = 'neutral' THEN 1 ELSE 0 END) as neutral_count
            FROM brand_mentions 
            WHERE project_id = ? 
            AND scraped_at >= datetime('now', '-{days} days')
            GROUP BY brand_name
        """

        rows = conn.execute(query, (project_id,)).fetchall()
        return [dict(r) for r in rows]


# --- Post Scoring CRUD ---


def get_post_scores(project_id, level=None, status=None, limit=50):
    with get_db() as conn:
        query = "SELECT * FROM post_scores WHERE project_id = ?"
        params = [project_id]

        if level:
            query += " AND score_level = ?"
            params.append(level)
        if status:
            query += " AND status = ?"
            params.append(status)

        query += " ORDER BY hot_score DESC LIMIT ?"
        params.append(limit)

        rows = conn.execute(query, params).fetchall()
        return [dict(r) for r in rows]


def create_or_update_post_score(project_id, post_data):
    sid = str(uuid.uuid4())

    with get_db() as conn:
        existing = conn.execute(
            "SELECT id FROM post_scores WHERE project_id = ? AND post_id = ?",
            (project_id, post_data["post_id"]),
        ).fetchone()

        if existing:
            conn.execute(
                """UPDATE post_scores SET
                   upvotes = ?, comments = ?, age_hours = ?,
                   hot_score = ?, score_level = ?,
                   engagement_depth = ?, keyword_match_score = ?, growth_rate = ?,
                   scraped_at = ?
                   WHERE id = ?""",
                (
                    post_data["upvotes"],
                    post_data["comments"],
                    post_data["age_hours"],
                    post_data["hot_score"],
                    post_data["score_level"],
                    post_data["engagement_depth"],
                    post_data["keyword_match_score"],
                    post_data["growth_rate"],
                    datetime.now().isoformat(),
                    existing["id"],
                ),
            )
            conn.commit()
            return existing["id"]
        else:
            conn.execute(
                """INSERT INTO post_scores 
                   (id, project_id, post_id, post_title, subreddit,
                    upvotes, comments, age_hours,
                    hot_score, score_level,
                    engagement_depth, keyword_match_score, growth_rate,
                    status, scraped_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    sid,
                    project_id,
                    post_data["post_id"],
                    post_data["post_title"],
                    post_data["subreddit"],
                    post_data["upvotes"],
                    post_data["comments"],
                    post_data["age_hours"],
                    post_data["hot_score"],
                    post_data["score_level"],
                    post_data["engagement_depth"],
                    post_data["keyword_match_score"],
                    post_data["growth_rate"],
                    "pending",
                    datetime.now().isoformat(),
                ),
            )
            conn.commit()
            return sid


def confirm_post_score(score_id):
    with get_db() as conn:
        conn.execute(
            "UPDATE post_scores SET status = 'confirmed', confirmed_at = ? WHERE id = ?",
            (datetime.now().isoformat(), score_id),
        )
        conn.commit()
        return True


def reject_post_score(score_id):
    with get_db() as conn:
        conn.execute(
            "UPDATE post_scores SET status = 'rejected' WHERE id = ?",
            (score_id,),
        )
        conn.commit()
        return True


# --- Project Brand/Competitor Config ---


def update_project_brands(project_id, brand_names, competitor_brands):
    brand_names_str = (
        json.dumps(brand_names) if isinstance(brand_names, list) else brand_names
    )
    competitor_str = (
        json.dumps(competitor_brands)
        if isinstance(competitor_brands, list)
        else competitor_brands
    )

    with get_db() as conn:
        conn.execute(
            "UPDATE projects SET brand_names = ?, competitor_brands = ? WHERE id = ?",
            (brand_names_str, competitor_str, project_id),
        )
        conn.commit()
        return True


def get_project_brands(project_id):
    with get_db() as conn:
        row = conn.execute(
            "SELECT brand_names, competitor_brands FROM projects WHERE id = ?",
            (project_id,),
        ).fetchone()

        if row:
            try:
                brand_names = (
                    json.loads(row["brand_names"]) if row["brand_names"] else []
                )
            except:
                brand_names = []
            try:
                competitor_brands = (
                    json.loads(row["competitor_brands"])
                    if row["competitor_brands"]
                    else []
                )
            except:
                competitor_brands = []
            return {"brand_names": brand_names, "competitor_brands": competitor_brands}
        return {"brand_names": [], "competitor_brands": []}


def update_project_keyword_config(
    project_id,
    search_queries=None,
    subreddits=None,
    competitor_brands=None,
    classification_keywords=None,
    suggested_keywords=None,
    background_text=None,
):
    """Update project keyword configuration from AI suggestions"""
    with get_db() as conn:
        updates = []
        params = []

        if search_queries is not None:
            updates.append("search_queries = ?")
            params.append(
                json.dumps(search_queries)
                if isinstance(search_queries, list)
                else search_queries
            )
        if subreddits is not None:
            updates.append("subreddits = ?")
            params.append(
                json.dumps(subreddits) if isinstance(subreddits, list) else subreddits
            )
        if competitor_brands is not None:
            updates.append("competitor_brands = ?")
            params.append(
                json.dumps(competitor_brands)
                if isinstance(competitor_brands, list)
                else competitor_brands
            )
        if classification_keywords is not None:
            updates.append("classification_keywords = ?")
            params.append(
                json.dumps(classification_keywords)
                if isinstance(classification_keywords, dict)
                else classification_keywords
            )
        if suggested_keywords is not None:
            updates.append("suggested_keywords = ?")
            params.append(
                json.dumps(suggested_keywords)
                if isinstance(suggested_keywords, dict)
                else suggested_keywords
            )
        if background_text is not None:
            updates.append("background_text = ?")
            params.append(background_text)

        if not updates:
            return False

        params.append(project_id)
        conn.execute(f"UPDATE projects SET {', '.join(updates)} WHERE id = ?", params)
        conn.commit()
        return True


def get_project_keyword_config(project_id):
    """Get project keyword configuration"""
    with get_db() as conn:
        row = conn.execute(
            """SELECT search_queries, subreddits, competitor_brands, 
                      classification_keywords, suggested_keywords, background_text 
               FROM projects WHERE id = ?""",
            (project_id,),
        ).fetchone()

        if not row:
            return None

        result = {}
        json_fields = [
            "search_queries",
            "subreddits",
            "competitor_brands",
            "classification_keywords",
            "suggested_keywords",
        ]

        for field in json_fields:
            value = row[field]
            try:
                result[field] = (
                    json.loads(value)
                    if value
                    else (
                        []
                        if field != "classification_keywords"
                        and field != "suggested_keywords"
                        else {}
                    )
                )
            except:
                result[field] = (
                    []
                    if field != "classification_keywords"
                    and field != "suggested_keywords"
                    else {}
                )

        result["background_text"] = row["background_text"] or ""
        return result
