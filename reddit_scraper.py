"""
Reddit scraper using Apify API (trudax/reddit-scraper)
"""

import os
import time
import json
import logging
from datetime import datetime, timezone

import config
from data_manager import DataManager

try:
    from apify_client import ApifyClient

    HAS_APIFY_CLIENT = True
except ImportError:
    HAS_APIFY_CLIENT = False

logger = logging.getLogger(__name__)


class RedditScraper:
    def __init__(self):
        self.dm = DataManager()
        self.has_apify = bool(config.APIFY_API_TOKEN) and HAS_APIFY_CLIENT
        if self.has_apify:
            self.client = ApifyClient(config.APIFY_API_TOKEN)
            logger.info("Apify client initialized")
        else:
            logger.warning(
                "No APIFY_API_TOKEN or apify-client missing, fallback to mock"
            )

    def fetch_posts(self, project: dict, date_str: str = None) -> list:
        """
        Fetch posts using Apify trudax/reddit-scraper.
        Supports multiple search queries from project configuration.
        """
        if not self.has_apify:
            logger.warning("Apify not configured. Returning mock posts.")
            return self.fetch_mock_posts(project, date_str)

        if date_str is None:
            date_str = datetime.now().strftime("%Y-%m-%d")

        project_id = project["id"]
        subreddits = project.get("subreddits", [])

        # Support multiple search queries - use search_queries field if available, fallback to search_query
        search_queries = project.get("search_queries", [])
        if not search_queries:
            search_query = project.get("search_query", config.SEARCH_QUERY)
            search_queries = [search_query] if search_query else []

        logger.info(
            f"Starting Apify trudax/reddit-scraper for project {project_id} with {len(search_queries)} search queries"
        )

        all_posts = []

        # Fetch for each search query
        for idx, query in enumerate(search_queries):
            logger.info(f"Fetching query {idx + 1}/{len(search_queries)}: '{query}'")

            run_input = {
                "searches": [query],
                "subreddits": subreddits,
                "maxItems": config.MAX_POSTS,
                "type": "post",
                "sort": "hot",
            }

            try:
                run = self.client.actor("trudax/reddit-scraper").call(
                    run_input=run_input
                )
                dataset_id = run.get("defaultDatasetId")

                query_posts = 0
                for item in self.client.dataset(dataset_id).iterate_items():
                    # Parse created_utc
                    created_utc_val = item.get("createdAt", 0)
                    if isinstance(created_utc_val, str):
                        try:
                            dt = datetime.fromisoformat(
                                created_utc_val.replace("Z", "+00:00")
                            )
                            created_utc_val = int(dt.timestamp())
                        except ValueError:
                            created_utc_val = int(time.time())

                    post_id = str(item.get("id", "") or item.get("dataTypeId", ""))

                    post = {
                        "id": post_id,
                        "title": item.get("title", ""),
                        "selftext": (
                            item.get("text", "") or item.get("body", "") or ""
                        )[:2000],
                        "score": item.get("upvotes", 0) or item.get("score", 0),
                        "num_comments": item.get("numComments", 0)
                        or item.get("comments", 0),
                        "subreddit": item.get("subreddit", ""),
                        "url": item.get("url", ""),
                        "permalink": item.get("url", "").replace(
                            "https://www.reddit.com", ""
                        ),
                        "created_utc": created_utc_val,
                        "author": item.get("author", "[deleted]"),
                        "is_self": not bool(item.get("scrapedContentUrl")),
                        "search_query": query,  # Track which query found this post
                    }

                    if post["id"] and post["title"]:
                        all_posts.append(post)
                        query_posts += 1

                logger.info(f"Query '{query}' returned {query_posts} posts")

            except Exception as e:
                logger.error(f"Apify fetch failed for query '{query}': {e}")
                continue

        # Deduplicate by post ID
        seen = set()
        unique_posts = []
        for p in all_posts:
            if p["id"] not in seen:
                seen.add(p["id"])
                unique_posts.append(p)

        # Filter by minimum score and sort
        filtered = [p for p in unique_posts if p["score"] >= config.MIN_SCORE]
        filtered = sorted(filtered, key=lambda x: x["score"], reverse=True)[
            : config.MAX_POSTS
        ]

        logger.info(
            f"Apify fetch complete. Total unique: {len(unique_posts)}, Filtered: {len(filtered)}"
        )

        # Save raw data
        raw_path = self.dm.get_raw_path(project_id, date_str)
        self.dm.save_json(
            raw_path,
            {
                "date": date_str,
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "queries": search_queries,
                "subreddits": subreddits,
                "total_posts": len(filtered),
                "posts": filtered,
            },
        )

        return filtered

    def fetch_mock_posts(self, project: dict, date_str: str = None) -> list:
        """Return mock data for testing without API calls."""
        if date_str is None:
            date_str = datetime.now().strftime("%Y-%m-%d")

        project_id = project["id"]
        subreddits = project.get("subreddits", [])
        search_query = project.get("search_query", getattr(config, "SEARCH_QUERY", ""))

        now_ts = int(time.time())
        mock_posts = [
            {
                "id": f"mock_{int(time.time())}_1",
                "title": f"[{search_query}] Discussion thread",
                "selftext": "Been thinking about this lately...",
                "score": 400,
                "num_comments": 89,
                "subreddit": subreddits[0] if subreddits else "general",
                "url": "https://reddit.com/r/test",
                "permalink": "/r/test/mock1",
                "created_utc": now_ts - 3600,
                "author": "tester_1",
                "is_self": True,
            },
            {
                "id": f"mock_{int(time.time())}_2",
                "title": "Hot take on the recent news",
                "selftext": "Honestly, I have strong opinions on this.",
                "score": 518,
                "num_comments": 143,
                "subreddit": subreddits[0] if subreddits else "general",
                "url": "https://reddit.com/r/test2",
                "permalink": "/r/test/mock2",
                "created_utc": now_ts - 7200,
                "author": "tester_2",
                "is_self": True,
            },
        ]

        raw_path = self.dm.get_raw_path(project_id, date_str)
        self.dm.save_json(
            raw_path,
            {
                "date": date_str,
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "query": search_query,
                "subreddits": subreddits,
                "total_posts": len(mock_posts),
                "posts": mock_posts,
                "is_mock": True,
            },
        )

        return mock_posts
