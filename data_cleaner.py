"""
Data cleaner and 5-category classifier for Reddit posts
"""

import re
import time
import logging
from datetime import datetime, timezone

import config
from data_manager import DataManager
from scoring import calculate_hot_score, score_batch_posts, get_worthy_posts
import models

logger = logging.getLogger(__name__)


class DataCleaner:
    def __init__(self):
        self.dm = DataManager()

    def clean_and_classify(
        self, project: dict, posts: list, date_str: str = None
    ) -> list:
        """
        Clean posts, classify into 5 categories, score, and save candidates.
        Returns list of candidate dicts sorted by composite score.
        """

        if date_str is None:
            date_str = datetime.now().strftime("%Y-%m-%d")

        project_id = project["id"]
        candidates = []
        now_ts = int(time.time())

        # Get target keywords for scoring
        if target_keywords is None:
            target_keywords = [project.get("search_query", "")]
            subreddits = project.get("subreddits", [])
            if isinstance(subreddits, list):
                target_keywords.extend(subreddits)

        for post in posts:
            try:
                cleaned = self._clean_post(post)
                category = self._classify(cleaned)
                score = self._compute_score(cleaned, now_ts)

                if score < config.MIN_CANDIDATE_SCORE:
                    continue

                # Calculate age in hours for new scoring
                created = cleaned.get("created_utc", 0)
                age_hours = max(0, (now_ts - created) / 3600)

                # Calculate keyword matches
                keyword_matches = 0
                full_text = cleaned.get("full_text_lower", "")
                for kw in target_keywords:
                    if kw.lower() in full_text:
                        keyword_matches += 1

                # New scoring algorithm
                post_data = {
                    "upvotes": cleaned.get("score", 0),
                    "comments": cleaned.get("num_comments", 0),
                    "age_hours": age_hours,
                    "keyword_matches": keyword_matches,
                }
                hot_score, score_level, detailed_scores = calculate_hot_score(post_data)

                candidate = {
                    **cleaned,
                    "category": category,
                    "category_name": config.CATEGORY_KEYWORDS[category]["name"],
                    "category_name_en": config.CATEGORY_KEYWORDS[category]["name_en"],
                    "category_color": config.CATEGORY_KEYWORDS[category]["color"],
                    "composite_score": round(score, 4),
                    "hot_score": hot_score,
                    "score_level": score_level,
                    "score_details": detailed_scores,
                    "status": "pending",
                    "classified_at": datetime.now(timezone.utc).isoformat(),
                }
                candidates.append(candidate)

                # Save to database (for S/A level posts)
                if score_level in ["S", "A"]:
                    models.create_or_update_post_score(
                        project_id=project_id,
                        post_data={
                            "post_id": cleaned.get("id", ""),
                            "post_title": cleaned.get("title", "")[:200],
                            "subreddit": cleaned.get("subreddit", ""),
                            "upvotes": cleaned.get("score", 0),
                            "comments": cleaned.get("num_comments", 0),
                            "age_hours": age_hours,
                            "hot_score": hot_score,
                            "score_level": score_level,
                            "engagement_depth": detailed_scores.get(
                                "engagement_ratio", 0
                            ),
                            "keyword_match_score": detailed_scores.get(
                                "keyword_score", 0
                            ),
                            "growth_rate": detailed_scores.get("growth_rate", 0),
                        },
                    )

            except Exception as e:
                logger.warning(f"Failed to process post {post.get('id', '?')}: {e}")

        # Sort by hot score descending
        candidates.sort(key=lambda x: x.get("hot_score", 0), reverse=True)

        # Save candidates
        candidates_path = self.dm.get_candidates_path(project_id, date_str)
        self.dm.save_json(
            candidates_path,
            {
                "date": date_str,
                "classified_at": datetime.now(timezone.utc).isoformat(),
                "total_candidates": len(candidates),
                "category_counts": self._count_categories(candidates),
                "score_distribution": self._count_score_levels(candidates),
                "candidates": candidates,
            },
        )

        logger.info(f"Classified {len(candidates)} candidates for {date_str}")
        return candidates

    def _clean_post(self, post: dict) -> dict:
        """Clean and normalize a post."""
        title = self._clean_text(post.get("title", ""))
        selftext = self._clean_text(post.get("selftext", ""))
        full_text = f"{title} {selftext}".lower()

        return {
            "id": post.get("id", ""),
            "title": title,
            "selftext": selftext,
            "full_text_lower": full_text,
            "score": int(post.get("score", 0)),
            "num_comments": int(post.get("num_comments", 0)),
            "subreddit": post.get("subreddit", ""),
            "url": post.get("url", ""),
            "permalink": post.get("permalink", ""),
            "created_utc": int(post.get("created_utc", 0)),
            "author": post.get("author", "[deleted]"),
        }

    def _clean_text(self, text: str) -> str:
        if not text:
            return ""
        # Remove URLs
        text = re.sub(r"https?://\S+", "", text)
        # Remove Reddit formatting
        text = re.sub(r"\*+", "", text)
        text = re.sub(r"#{1,6}\s", "", text)
        text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
        # Collapse whitespace
        text = re.sub(r"\s+", " ", text).strip()
        return text[:500]

    def _classify(self, post: dict) -> str:
        """Classify post into one of 5 categories. Returns category code A-E."""
        text = post["full_text_lower"]
        scores = {}

        for cat_code, cat_info in config.CATEGORY_KEYWORDS.items():
            hits = sum(1 for kw in cat_info["keywords"] if kw in text)
            scores[cat_code] = hits

        # Special rules:
        # C (controversy): boost if high comment-to-score ratio
        if post["score"] > 0:
            ratio = post["num_comments"] / post["score"]
            if ratio > 0.5:
                scores["C"] = scores.get("C", 0) + 2

        # E (trend): boost if very high score
        if post["score"] >= 500:
            scores["E"] = scores.get("E", 0) + 2

        # Pick highest-scoring category, default to E (trend) if all zeros
        best_cat = max(scores, key=lambda k: scores[k])
        if scores[best_cat] == 0:
            best_cat = "E"

        return best_cat

    def _compute_score(self, post: dict, now_ts: int) -> float:
        """
        Compute composite score (0-1) from upvotes, comments, recency.
        """
        # Normalize upvotes (log scale, max ~1000)
        import math

        score_raw = max(post["score"], 0)
        upvote_norm = min(math.log1p(score_raw) / math.log1p(1000), 1.0)

        # Normalize comments (log scale, max ~500)
        comments_raw = max(post["num_comments"], 0)
        comments_norm = min(math.log1p(comments_raw) / math.log1p(500), 1.0)

        # Recency (decay over 48 hours)
        created = post.get("created_utc", 0)
        age_hours = max(0, (now_ts - created) / 3600)
        recency_norm = max(0, 1.0 - (age_hours / 48))

        w = config.SCORE_WEIGHTS
        composite = (
            w["upvotes"] * upvote_norm
            + w["comments"] * comments_norm
            + w["recency"] * recency_norm
        )
        return composite

    def _count_categories(self, candidates: list) -> dict:
        counts = {k: 0 for k in config.CATEGORY_KEYWORDS}
        for c in candidates:
            cat = c.get("category", "E")
            counts[cat] = counts.get(cat, 0) + 1
        return counts

    def _count_score_levels(self, candidates: list) -> dict:
        """Count distribution of S/A/B/C score levels"""
        counts = {"S": 0, "A": 0, "B": 0, "C": 0}
        for c in candidates:
            level = c.get("score_level", "C")
            counts[level] = counts.get(level, 0) + 1
        return counts
