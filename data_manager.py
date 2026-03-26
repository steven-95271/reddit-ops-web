"""
JSON-based data storage manager with 30-day retention.
"""
import os
import json
import shutil
import logging
from typing import Optional
from datetime import datetime, timedelta, timezone

import config

logger = logging.getLogger(__name__)


class DataManager:
    def __init__(self):
        os.makedirs(config.REDDIT_DATA_DIR, exist_ok=True)
        os.makedirs(config.HISTORY_DIR, exist_ok=True)

    # ─── Path Helpers ───────────────────────────────────────────────────────
    def _project_dir(self, project_id: str) -> str:
        path = os.path.join(config.REDDIT_DATA_DIR, project_id)
        os.makedirs(path, exist_ok=True)
        return path

    def _date_dir(self, project_id: str, date_str: str) -> str:
        path = os.path.join(self._project_dir(project_id), date_str)
        os.makedirs(path, exist_ok=True)
        return path

    def get_raw_path(self, project_id: str, date_str: str) -> str:
        return os.path.join(self._date_dir(project_id, date_str), "raw_posts.json")

    def get_candidates_path(self, project_id: str, date_str: str) -> str:
        return os.path.join(self._date_dir(project_id, date_str), "candidates.json")

    def get_content_path(self, project_id: str, date_str: str) -> str:
        return os.path.join(self._date_dir(project_id, date_str), "generated_content.json")

    def get_history_path(self, project_id: str) -> str:
        path = os.path.join(config.HISTORY_DIR, project_id)
        os.makedirs(path, exist_ok=True)
        return os.path.join(path, "publish_log.json")

    # ─── JSON I/O ────────────────────────────────────────────────────────────
    def save_json(self, path: str, data) -> None:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        logger.debug(f"Saved: {path}")

    def load_json(self, path: str, default=None):
        if not os.path.exists(path):
            return default
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Failed to load {path}: {e}")
            return default

    # ─── Date-specific Loaders ──────────────────────────────────────────────
    def load_raw(self, project_id: str, date_str: str) -> dict:
        return self.load_json(self.get_raw_path(project_id, date_str), {})

    def load_candidates(self, project_id: str, date_str: str) -> dict:
        return self.load_json(self.get_candidates_path(project_id, date_str), {})

    def load_content(self, project_id: str, date_str: str) -> dict:
        return self.load_json(self.get_content_path(project_id, date_str), {})

    def load_history(self, project_id: str) -> list:
        data = self.load_json(self.get_history_path(project_id), [])
        return data if isinstance(data, list) else []

    # ─── Content Status Update ───────────────────────────────────────────────
    def update_content_status(self, project_id: str, date_str: str, content_id: str, status: str, note: str = "") -> bool:
        """Update status of a generated content item. Returns True on success."""
        content_data = self.load_content(project_id, date_str)
        if not content_data:
            return False

        items = content_data.get("content", [])
        updated = False
        for item in items:
            if item.get("id") == content_id:
                item["status"] = status
                item["status_updated_at"] = datetime.now(timezone.utc).isoformat()
                item["note"] = note
                updated = True
                break

        if updated:
            self.save_json(self.get_content_path(project_id, date_str), content_data)

            # Log to history if published/approved
            if status in ("published", "approved"):
                self._log_history(project_id, date_str, content_id, status, items)

        return updated

    def update_content_text(self, project_id: str, date_str: str, content_id: str, new_text: str) -> bool:
        """Edit the body text of a content item."""
        content_data = self.load_content(project_id, date_str)
        if not content_data:
            return False
        for item in content_data.get("content", []):
            if item.get("id") == content_id:
                item["body"] = new_text
                item["edited"] = True
                item["edited_at"] = datetime.now(timezone.utc).isoformat()
                self.save_json(self.get_content_path(project_id, date_str), content_data)
                return True
        return False

    def _log_history(self, project_id: str, date_str: str, content_id: str, status: str, items: list):
        history = self.load_history(project_id)
        for item in items:
            if item.get("id") == content_id:
                entry = {
                    "date": date_str,
                    "content_id": content_id,
                    "status": status,
                    "persona_id": item.get("persona_id", ""),
                    "persona_name": item.get("persona_name", ""),
                    "title": item.get("title", ""),
                    "body_preview": item.get("body", "")[:100],
                    "source_post_id": item.get("source_post_id", ""),
                    "logged_at": datetime.now(timezone.utc).isoformat()
                }
                history.append(entry)
                self.save_json(self.get_history_path(project_id), history)
                break

    # ─── Date Listing ─────────────────────────────────────────────────────────
    def list_dates(self, project_id: str) -> list:
        """Return sorted list of date strings with data, newest first."""
        dates = []
        p_dir = self._project_dir(project_id)
        if os.path.exists(p_dir):
            for d in os.listdir(p_dir):
                if os.path.isdir(os.path.join(p_dir, d)):
                    dates.append(d)
        dates.sort(reverse=True)
        return dates

    def get_latest_date(self, project_id: str) -> Optional[str]:
        dates = self.list_dates(project_id)
        return dates[0] if dates else None

    # ─── Stats ────────────────────────────────────────────────────────────────
    def get_stats(self, project_id: str, date_str: str = None) -> dict:
        if date_str is None:
            date_str = self.get_latest_date(project_id)
        if not date_str:
            return {"date": None, "total_posts": 0, "total_candidates": 0,
                    "total_content": 0, "published": 0, "approved": 0,
                    "category_counts": {}, "has_data": False}

        raw = self.load_raw(project_id, date_str)
        candidates = self.load_candidates(project_id, date_str)
        content = self.load_content(project_id, date_str)

        content_items = content.get("content", [])
        published = sum(1 for c in content_items if c.get("status") == "published")
        approved = sum(1 for c in content_items if c.get("status") == "approved")

        return {
            "date": date_str,
            "total_posts": raw.get("total_posts", 0),
            "total_candidates": candidates.get("total_candidates", 0),
            "total_content": len(content_items),
            "published": published,
            "approved": approved,
            "is_mock": raw.get("is_mock", False),
            "category_counts": candidates.get("category_counts", {}),
            "has_data": bool(content_items or candidates.get("candidates")),
        }

    # ─── 30-day Retention ─────────────────────────────────────────────────────
    def purge_old_data(self) -> int:
        """Delete date directories older than DATA_RETENTION_DAYS. Returns count deleted."""
        import models
        cutoff = datetime.now() - timedelta(days=config.DATA_RETENTION_DAYS)
        deleted = 0
        projects = models.get_projects()
        for p in projects:
            p_id = p["id"]
            for date_str in self.list_dates(p_id):
                try:
                    date_obj = datetime.strptime(date_str, "%Y-%m-%d")
                    if date_obj < cutoff:
                        shutil.rmtree(os.path.join(self._project_dir(p_id), date_str))
                        deleted += 1
                        logger.info(f"Purged old data for {p_id}: {date_str}")
                except ValueError:
                    pass
        return deleted
