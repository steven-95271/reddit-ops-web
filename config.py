"""
Configuration for Reddit Content Operations Automation System
"""

import os

# ─────────────────────────────────────────────
# Reddit Scraping Config
# ─────────────────────────────────────────────
SEARCH_QUERY = "open ear earbuds"
SUBREDDITS = ["headphones", "earbuds", "audiophile", "running", "commuting", "Fitness"]
SCRAPE_HOURS = 48  # Look back 48 hours
MAX_POSTS = 100  # Max posts to fetch per run
MIN_SCORE = 5  # Minimum upvote score to keep

# Arctic Shift Pushshift mirror (pushshift.io deprecated)
PUSHSHIFT_BASE = "https://arctic-shift.photon-reddit.com/api"

# ─────────────────────────────────────────────
# Data Storage
# ─────────────────────────────────────────────
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
REDDIT_DATA_DIR = os.path.join(DATA_DIR, "reddit")
HISTORY_DIR = os.path.join(DATA_DIR, "history")
DATA_RETENTION_DAYS = 30

# ─────────────────────────────────────────────
# Classification Config
# ─────────────────────────────────────────────
CATEGORY_KEYWORDS = {
    "A": {  # Structural Review
        "name": "结构型测评",
        "name_en": "Structural Review",
        "keywords": [
            "review",
            "comparison",
            "vs",
            "best",
            "ranking",
            "top",
            "rated",
            "recommend",
            "worth",
            "rating",
        ],
        "color": "blue",
    },
    "B": {  # Scene Pain Point
        "name": "场景痛点",
        "name_en": "Scene Pain Point",
        "keywords": [
            "problem",
            "issue",
            "hate",
            "annoying",
            "broke",
            "bad",
            "terrible",
            "awful",
            "disappointed",
            "fail",
            "worst",
            "hurt",
        ],
        "color": "red",
    },
    "C": {  # Opinion Controversy
        "name": "观点争议",
        "name_en": "Opinion Controversy",
        "keywords": [
            "overrated",
            "unpopular",
            "change my mind",
            "fight me",
            "hot take",
            "controversial",
            "disagree",
            "opinion",
        ],
        "color": "yellow",
    },
    "D": {  # Competitor KOL
        "name": "竞品KOL",
        "name_en": "Competitor KOL",
        "keywords": [
            "shokz",
            "aftershokz",
            "bose",
            "sony",
            "apple",
            "jabra",
            "samsung",
            "anker",
            "soundcore",
            "jbl",
            "sennheiser",
        ],
        "color": "purple",
    },
    "E": {  # Platform Trend
        "name": "平台趋势",
        "name_en": "Platform Trend",
        "keywords": [
            "everyone",
            "trending",
            "popular",
            "viral",
            "love",
            "obsessed",
            "amazing",
            "game changer",
            "2024",
            "2025",
        ],
        "color": "green",
    },
}

# ─────────────────────────────────────────────
# Scoring Weights
# ─────────────────────────────────────────────
SCORE_WEIGHTS = {"upvotes": 0.4, "comments": 0.3, "recency": 0.3}
MIN_CANDIDATE_SCORE = 0.2

# ─────────────────────────────────────────────
# Three Persona Accounts
# ─────────────────────────────────────────────
PERSONAS = [
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
        "post_types": ["experience_share", "workout_tip", "gear_recommendation"],
    },
    {
        "id": "audio_geek",
        "name": "AudioGeek",
        "username": "u/hifi_marcus",
        "avatar_emoji": "🎧",
        "avatar_color": "#8b5cf6",
        "description": "音频发烧友 - 技术解析",
        "description_en": "Audio Enthusiast - Technical Analysis",
        "background": "多年音频设备评测经验，专注声学原理和技术参数",
        "tone": "analytical, technical, objective",
        "focus": [
            "audio quality",
            "specs",
            "technology",
            "driver",
            "frequency",
            "impedance",
        ],
        "writing_style": "专业技术分析，引用参数数据，客观评测",
        "post_types": ["technical_review", "spec_comparison", "deep_dive"],
    },
    {
        "id": "commuter_life",
        "name": "CommuterLife",
        "username": "u/subway_sarah",
        "avatar_emoji": "🚇",
        "avatar_color": "#f59e0b",
        "description": "通勤上班族 - 清单推荐",
        "description_en": "Daily Commuter - List Recommendations",
        "background": "每天通勤2小时，关注耳机的日常便携性和情景适应性",
        "tone": "practical, relatable, list-based",
        "focus": [
            "commute",
            "daily use",
            "battery life",
            "comfort",
            "convenience",
            "awareness",
        ],
        "writing_style": "实用清单式内容，贴近日常生活，易于参考",
        "post_types": ["listicle", "daily_tip", "commute_guide"],
    },
]

# ─────────────────────────────────────────────
# Content Generation
# ─────────────────────────────────────────────
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
APIFY_API_TOKEN = os.environ.get("APIFY_API_TOKEN", "")
OPENAI_MODEL = "gpt-4o-mini"

# ─────────────────────────────────────────────
# MiniMax LLM (for keyword suggestion)
# ─────────────────────────────────────────────
MINIMAX_API_KEY = os.environ.get("MINIMAX_API_KEY", "")
MINIMAX_API_URL = "https://api.minimaxi.chat/v1/text/chatcompletion_v2"
MINIMAX_MODEL = "MiniMax-Text-01"
CONTENT_PER_PERSONA = 2

# ─────────────────────────────────────────────
# Notification Config
# ─────────────────────────────────────────────
# Telegram
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "")

# Email (SMTP)
EMAIL_SMTP_HOST = os.environ.get("EMAIL_SMTP_HOST", "smtp.gmail.com")
EMAIL_SMTP_PORT = int(os.environ.get("EMAIL_SMTP_PORT", "587"))
EMAIL_USER = os.environ.get("EMAIL_USER", "")
EMAIL_PASSWORD = os.environ.get("EMAIL_PASSWORD", "")
EMAIL_TO = os.environ.get("EMAIL_TO", "")

# App URL for notification links
APP_URL = os.environ.get("APP_URL", "http://127.0.0.1:5000")

# ─────────────────────────────────────────────
# Scheduler
# ─────────────────────────────────────────────
SCHEDULE_HOUR = 9
SCHEDULE_MINUTE = 0

# ─────────────────────────────────────────────
# Flask
# ─────────────────────────────────────────────
FLASK_PORT = int(os.environ.get("PORT", "5000"))
FLASK_DEBUG = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
SECRET_KEY = os.environ.get("SECRET_KEY", "reddit-ops-secret-2024")
