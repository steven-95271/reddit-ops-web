"""
APScheduler-based daily pipeline scheduler.
"""

import logging
from datetime import datetime

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

import config

logger = logging.getLogger(__name__)

_scheduler = None


def run_daily_pipeline(project_id: str = None, use_mock: bool = False) -> dict:
    """
    Full pipeline: scrape → clean → generate → notify → purge.
    Returns result summary dict. If project_id is None, runs for all projects.
    """
    from reddit_scraper import RedditScraper
    from data_cleaner import DataCleaner
    from content_generator import ContentGenerator
    from notifier import Notifier
    from data_manager import DataManager
    import models

    date_str = datetime.now().strftime("%Y-%m-%d")
    logger.info(
        f"=== Pipeline start: {date_str} (mock={use_mock}) for project {project_id or 'ALL'} ==="
    )

    overall_results = {}

    projects = [models.get_project(project_id)] if project_id else models.get_projects()
    projects = [p for p in projects if p]

    dm = DataManager()
    scraper = RedditScraper()
    cleaner = DataCleaner()
    generator = ContentGenerator()
    notifier = Notifier()

    for project in projects:
        pid = project["id"]
        result = {
            "project_id": pid,
            "date": date_str,
            "steps": {},
            "success": False,
            "use_mock": use_mock,
        }
        try:
            # Step 1: Scrape
            logger.info(f"[{pid}] Step 1: Scraping Reddit...")
            if use_mock:
                posts = scraper.fetch_mock_posts(project, date_str)
            else:
                posts = scraper.fetch_posts(project, date_str)
            result["steps"]["scrape"] = {"status": "ok", "posts": len(posts)}
            logger.info(f"[{pid}]   Fetched {len(posts)} posts")

            # Step 2: Clean + Classify
            logger.info(f"[{pid}] Step 2: Cleaning and classifying...")
            candidates = cleaner.clean_and_classify(project, posts, date_str)
            result["steps"]["classify"] = {
                "status": "ok",
                "candidates": len(candidates),
            }
            logger.info(f"[{pid}]   Classified {len(candidates)} candidates")

            # Step 3: Generate Content
            logger.info(f"[{pid}] Step 3: Generating content...")
            content = generator.generate(project, candidates, date_str)
            result["steps"]["generate"] = {
                "status": "ok",
                "content_items": len(content),
            }
            logger.info(f"[{pid}]   Generated {len(content)} content items")

            # Step 4: Notify
            logger.info(f"[{pid}] Step 4: Sending notifications...")
            stats = dm.get_stats(pid, date_str)
            notify_result = notifier.send_pipeline_complete(stats)
            result["steps"]["notify"] = notify_result

            result["success"] = True
            logger.info(f"=== Pipeline complete for {pid} on {date_str} ===")
        except Exception as e:
            logger.error(f"[{pid}] Pipeline failed: {e}", exc_info=True)
            result["error"] = str(e)

        overall_results[pid] = result

    # Step 5: Purge old data
    logger.info("Step 5: Purging old data...")
    deleted = dm.purge_old_data()

    return {"date": date_str, "purged_dirs": deleted, "projects": overall_results}


def start_scheduler(app=None):
    """Start the background scheduler. Call once at app startup."""
    global _scheduler

    if _scheduler is not None:
        return _scheduler

    _scheduler = BackgroundScheduler(timezone="Asia/Shanghai")

    # Add per-project jobs based on their auto_scrape settings
    import models

    projects = models.get_projects()

    for project in projects:
        if project.get("auto_scrape_enabled"):
            schedule_time = project.get("scrape_schedule_time", "09:00")
            timezone = project.get("scrape_schedule_timezone", "Asia/Shanghai")
            hour, minute = map(int, schedule_time.split(":"))

            _scheduler.add_job(
                func=run_daily_pipeline,
                trigger=CronTrigger(hour=hour, minute=minute, timezone=timezone),
                id=f"pipeline_{project['id']}",
                name=f"Reddit Pipeline - {project['name']}",
                replace_existing=True,
                misfire_grace_time=3600,
                kwargs={"project_id": project["id"], "use_mock": False},
            )
            logger.info(
                f"Scheduled pipeline for project '{project['name']}' at {schedule_time} {timezone}"
            )

    # Add a fallback global job at default time (for projects without auto_scrape or as backup)
    _scheduler.add_job(
        func=run_daily_pipeline,
        trigger=CronTrigger(
            hour=config.SCHEDULE_HOUR,
            minute=config.SCHEDULE_MINUTE,
            timezone="Asia/Shanghai",
        ),
        id="daily_pipeline",
        name="Daily Reddit Pipeline (Global)",
        replace_existing=True,
        misfire_grace_time=3600,
    )

    _scheduler.start()
    logger.info(
        f"Scheduler started with {len([p for p in projects if p.get('auto_scrape_enabled')])} project jobs + 1 global job"
    )
    return _scheduler


def stop_scheduler():
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        logger.info("Scheduler stopped")


def restart_scheduler():
    """Restart the scheduler with updated project settings."""
    stop_scheduler()
    return start_scheduler()
