"""
热帖评分算法模块
用于评估 Reddit 帖子的热度和价值
"""

from datetime import datetime
from typing import Dict, Tuple


def calculate_hot_score(post_data: Dict) -> Tuple[float, str, Dict]:
    """
    计算帖子的热度评分

    公式：
    Hot Score = (热度分 × 0.3) + (时效分 × 0.25) + (互动深度 × 0.2)
              + (关键词匹配 × 0.15) + (增长速率 × 0.1)

    Args:
        post_data: {
            'upvotes': int,
            'comments': int,
            'created_utc': timestamp or hours_ago,
            'keyword_matches': int,
            'subreddit': str
        }

    Returns:
        (hot_score, score_level, detailed_scores)
    """
    upvotes = post_data.get("upvotes", 0)
    comments = post_data.get("comments", 0)
    age_hours = post_data.get("age_hours", 0)
    keyword_matches = post_data.get("keyword_matches", 0)
    subreddit_subscribers = post_data.get("subreddit_subscribers", 100000)  # 默认值

    # 1. 热度分 (最高20分)
    # upvotes: 每100个upvote得1分，最多10分
    # comments: 每20个comment得1分，最多10分
    upvote_score = min(upvotes / 100, 10)
    comment_score = min(comments / 20, 10)
    heat_score = upvote_score + comment_score

    # 2. 时效分 (最高20分)
    # 24h内=20, 48h=15, 72h=10, >72h=5
    if age_hours <= 24:
        time_score = 20
    elif age_hours <= 48:
        time_score = 15
    elif age_hours <= 72:
        time_score = 10
    else:
        time_score = 5

    # 3. 互动深度 (最高20分)
    # comments / upvotes 比值 (互动深度)
    # >0.3 说明讨论激烈 = 20分
    # 0.1-0.3 = 15分
    # <0.1 = 10分
    if upvotes > 0:
        engagement_ratio = comments / upvotes
    else:
        engagement_ratio = 0

    if engagement_ratio > 0.3:
        engagement_score = 20
    elif engagement_ratio > 0.1:
        engagement_score = 15
    else:
        engagement_score = 10

    # 4. 关键词匹配 (最高20分)
    # 每匹配一个关键词得4分，最多20分
    keyword_score = min(keyword_matches * 4, 20)

    # 5. 增长速率 (最高20分)
    # upvotes / 帖子年龄(小时)
    # >10/hour = 20分, 5-10 = 15分, 1-5 = 10分, <1 = 5分
    if age_hours > 0:
        growth_rate = upvotes / age_hours
    else:
        growth_rate = upvotes

    if growth_rate > 10:
        growth_score = 20
    elif growth_rate > 5:
        growth_score = 15
    elif growth_rate > 1:
        growth_score = 10
    else:
        growth_score = 5

    # 计算总分 (权重后的分数)
    hot_score = (
        heat_score * 0.3
        + time_score * 0.25
        + engagement_score * 0.2
        + keyword_score * 0.15
        + growth_score * 0.1
    )

    # 确定等级
    if hot_score >= 70:
        score_level = "S"
    elif hot_score >= 50:
        score_level = "A"
    elif hot_score >= 30:
        score_level = "B"
    else:
        score_level = "C"

    detailed_scores = {
        "heat_score": round(heat_score, 2),
        "time_score": time_score,
        "engagement_score": engagement_score,
        "keyword_score": keyword_score,
        "growth_score": growth_score,
        "engagement_ratio": round(engagement_ratio, 3),
        "growth_rate": round(growth_rate, 2),
        "age_hours": age_hours,
    }

    return round(hot_score, 2), score_level, detailed_scores


def score_batch_posts(posts: list, target_keywords: list = None) -> list:
    """
    批量评分帖子

    Args:
        posts: list of post dicts from Apify
        target_keywords: list of keywords to match

    Returns:
        list of scored posts with score_data added
    """
    scored_posts = []

    for post in posts:
        # 计算关键词匹配数
        keyword_matches = 0
        if target_keywords:
            title = post.get("title", "").lower()
            body = post.get("selftext", "").lower()
            combined = title + " " + body

            for keyword in target_keywords:
                if keyword.lower() in combined:
                    keyword_matches += 1

        # 计算帖子年龄（小时）
        created_utc = post.get("created_utc")
        if created_utc:
            # 如果是timestamp
            if isinstance(created_utc, (int, float)):
                age_hours = (datetime.now().timestamp() - created_utc) / 3600
            else:
                age_hours = 0
        else:
            age_hours = post.get("age_hours", 0)

        post_data = {
            "upvotes": post.get("score", 0),
            "comments": post.get("num_comments", 0),
            "age_hours": age_hours,
            "keyword_matches": keyword_matches,
            "subreddit_subscribers": post.get("subreddit_subscribers", 100000),
        }

        hot_score, score_level, detailed = calculate_hot_score(post_data)

        scored_post = {
            **post,
            "score_data": {
                "hot_score": hot_score,
                "score_level": score_level,
                "detailed_scores": detailed,
            },
        }

        scored_posts.append(scored_post)

    # 按热度分排序
    scored_posts.sort(key=lambda x: x["score_data"]["hot_score"], reverse=True)

    return scored_posts


def get_worthy_posts(scored_posts: list, min_level: str = "B") -> list:
    """
    筛选值得抓取的帖子

    Args:
        scored_posts: 已评分的帖子列表
        min_level: 最低等级 (S/A/B/C)

    Returns:
        符合条件的帖子列表
    """
    level_priority = {"S": 4, "A": 3, "B": 2, "C": 1}
    min_priority = level_priority.get(min_level, 2)

    worthy = []
    for post in scored_posts:
        level = post["score_data"]["score_level"]
        if level_priority.get(level, 0) >= min_priority:
            worthy.append(post)

    return worthy
