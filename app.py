"""
Flask application - Reddit Content Operations System
"""

import logging
import atexit
from datetime import datetime, timezone

from flask import Flask, render_template, request, jsonify, redirect, url_for
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

import config
import models
from data_manager import DataManager
from scheduler import (
    start_scheduler,
    stop_scheduler,
    run_daily_pipeline,
    restart_scheduler,
)
from keyword_advisor import advisor

# ─────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.secret_key = config.SECRET_KEY

dm = DataManager()


def get_current_project():
    projects = models.get_projects()
    if not projects:
        return None, []

    pid = request.args.get("project_id")
    if pid:
        current = models.get_project(pid)
        if current:
            return current, projects

    return projects[0], projects


# ─────────────────────────────────────────────
# Page Routes
# ─────────────────────────────────────────────
@app.route("/")
def index():
    return redirect(url_for("dashboard"))


@app.route("/dashboard")
def dashboard():
    current_project, all_projects = get_current_project()
    if not current_project:
        return "No projects found. Please create one.", 404

    pid = current_project["id"]
    dates = dm.list_dates(pid)
    date_str = request.args.get("date", dm.get_latest_date(pid))
    stats = dm.get_stats(pid, date_str)
    personas = models.get_personas(pid)

    return render_template(
        "dashboard.html",
        stats=stats,
        dates=dates,
        current_date=date_str,
        project=current_project,
        projects=all_projects,
        personas=personas,
        categories=config.CATEGORY_KEYWORDS,
    )


@app.route("/candidates")
def candidates():
    current_project, all_projects = get_current_project()
    if not current_project:
        return "No projects found.", 404

    pid = current_project["id"]
    dates = dm.list_dates(pid)
    date_str = request.args.get("date", dm.get_latest_date(pid))
    return render_template(
        "candidates.html",
        dates=dates,
        current_date=date_str,
        project=current_project,
        projects=all_projects,
        categories=config.CATEGORY_KEYWORDS,
    )


@app.route("/editor")
def editor():
    current_project, all_projects = get_current_project()
    if not current_project:
        return "No projects found.", 404

    pid = current_project["id"]
    dates = dm.list_dates(pid)
    date_str = request.args.get("date", dm.get_latest_date(pid))
    personas = models.get_personas(pid)
    return render_template(
        "editor.html",
        dates=dates,
        current_date=date_str,
        project=current_project,
        projects=all_projects,
        personas=personas,
    )


@app.route("/history")
def history():
    current_project, all_projects = get_current_project()
    if not current_project:
        return "No projects found.", 404

    pid = current_project["id"]
    personas = models.get_personas(pid)
    return render_template(
        "history.html",
        project=current_project,
        projects=all_projects,
        personas=personas,
    )


# ─────────────────────────────────────────────
# API Routes
# ─────────────────────────────────────────────


@app.route("/api/projects", methods=["GET"])
def api_get_projects():
    return jsonify({"projects": models.get_projects()})


@app.route("/api/projects", methods=["POST"])
def api_create_project():
    body = request.get_json() or {}
    name = body.get("name", "New Project")
    bg = body.get("background_info", "")
    query = body.get("search_query", config.SEARCH_QUERY)
    subreddits = body.get("subreddits", config.SUBREDDITS)
    auto_scrape = body.get("auto_scrape_enabled", 0)
    schedule_time = body.get("scrape_schedule_time", "09:00")
    schedule_tz = body.get("scrape_schedule_timezone", "Asia/Shanghai")
    pid = models.create_project(
        name, bg, query, subreddits, auto_scrape, schedule_time, schedule_tz
    )
    return jsonify({"ok": True, "project_id": pid})


@app.route("/api/projects/<project_id>/personas", methods=["POST"])
def api_create_persona(project_id):
    body = request.get_json() or {}
    name = body.get("name", "New Persona")
    username = body.get("username", "u/new_persona")
    emoji = body.get("avatar_emoji", "👤")
    color = body.get("avatar_color", "#888888")
    desc = body.get("description", "")
    desc_en = body.get("description_en", "")
    bg = body.get("background", "")
    tone = body.get("tone", "")
    focus = body.get("focus", [])
    writing = body.get("writing_style", "")
    ptypes = body.get("post_types", [])
    platform = body.get("platform", "Reddit")

    pid = models.create_persona(
        project_id,
        name,
        username,
        emoji,
        color,
        desc,
        desc_en,
        bg,
        tone,
        focus,
        writing,
        ptypes,
        platform,
    )
    return jsonify({"ok": True, "persona_id": pid})


def get_pid_from_req():
    pid = request.args.get("project_id")
    if not pid:
        current_project, _ = get_current_project()
        if current_project:
            pid = current_project["id"]
    return pid


@app.route("/api/stats")
def api_stats():
    pid = get_pid_from_req()
    if not pid:
        return jsonify({"error": "No project"}), 404
    date_str = request.args.get("date", dm.get_latest_date(pid))
    return jsonify(dm.get_stats(pid, date_str))


@app.route("/api/candidates")
def api_candidates():
    pid = get_pid_from_req()
    if not pid:
        return jsonify({"error": "No project"}), 404

    date_str = request.args.get("date", dm.get_latest_date(pid))
    category = request.args.get("category", "")
    sort_by = request.args.get("sort", "composite_score")

    data = dm.load_candidates(pid, date_str)
    candidates = data.get("candidates", [])

    if category:
        candidates = [c for c in candidates if c.get("category") == category]

    if sort_by in ("composite_score", "score", "num_comments"):
        candidates.sort(key=lambda x: x.get(sort_by, 0), reverse=True)

    return jsonify(
        {
            "date": date_str,
            "total": len(candidates),
            "category_counts": data.get("category_counts", {}),
            "candidates": candidates,
        }
    )


@app.route("/api/content")
def api_content():
    pid = get_pid_from_req()
    if not pid:
        return jsonify({"error": "No project"}), 404

    date_str = request.args.get("date", dm.get_latest_date(pid))
    persona_id = request.args.get("persona", "")
    status = request.args.get("status", "")

    data = dm.load_content(pid, date_str)
    items = data.get("content", [])

    if persona_id:
        items = [i for i in items if i.get("persona_id") == persona_id]
    if status:
        items = [i for i in items if i.get("status") == status]

    return jsonify(
        {
            "date": date_str,
            "method": data.get("method", "unknown"),
            "total": len(items),
            "content": items,
        }
    )


@app.route("/api/content/<content_id>/status", methods=["POST"])
def api_update_status(content_id):
    pid = get_pid_from_req()
    if not pid:
        return jsonify({"error": "No project"}), 404

    body = request.get_json() or {}
    date_str = body.get("date", dm.get_latest_date(pid))
    status = body.get("status", "")
    note = body.get("note", "")

    if status not in ("pending", "approved", "rejected", "published"):
        return jsonify({"error": "Invalid status"}), 400

    success = dm.update_content_status(pid, date_str, content_id, status, note)
    if success:
        return jsonify({"ok": True, "content_id": content_id, "status": status})
    return jsonify({"error": "Content not found"}), 404


@app.route("/api/content/<content_id>/edit", methods=["POST"])
def api_edit_content(content_id):
    pid = get_pid_from_req()
    if not pid:
        return jsonify({"error": "No project"}), 404

    body = request.get_json() or {}
    date_str = body.get("date", dm.get_latest_date(pid))
    new_text = body.get("body", "")

    success = dm.update_content_text(pid, date_str, content_id, new_text)
    if success:
        return jsonify({"ok": True})
    return jsonify({"error": "Content not found"}), 404


@app.route("/api/history")
def api_history():
    pid = get_pid_from_req()
    if not pid:
        return jsonify({"error": "No project"}), 404

    persona_id = request.args.get("persona", "")
    status = request.args.get("status", "")
    date_from = request.args.get("date_from", "")

    history = dm.load_history(pid)

    if persona_id:
        history = [h for h in history if h.get("persona_id") == persona_id]
    if status:
        history = [h for h in history if h.get("status") == status]
    if date_from:
        history = [h for h in history if h.get("date", "") >= date_from]

    history.sort(key=lambda x: x.get("logged_at", ""), reverse=True)

    return jsonify({"total": len(history), "history": history})


@app.route("/api/run-pipeline", methods=["POST"])
def api_run_pipeline():
    """Manually trigger the full pipeline."""
    pid = get_pid_from_req()
    body = request.get_json() or {}
    use_mock = body.get("use_mock", True)

    logger.info(f"Manual pipeline trigger (mock={use_mock}) for project {pid}")
    result = run_daily_pipeline(project_id=pid, use_mock=use_mock)
    return jsonify(result)


@app.route("/api/apify-webhook", methods=["POST"])
def api_apify_webhook():
    """
    Receive webhook from Apify when a Reddit Scraper run completes.

    Expected payload from Apify:
    {
        "actorId": "trudax/reddit-scraper",
        "runId": "xxx",
        "status": "SUCCEEDED",
        "data": { ... }
    }
    """
    body = request.get_json() or {}
    logger.info(f"Received Apify webhook: {body}")

    # Extract run info
    actor_id = body.get("actorId", "")
    run_id = body.get("runId", "")
    status = body.get("status", "")

    # Only process successful runs from reddit-scraper
    if "reddit-scraper" not in actor_id.lower():
        return jsonify({"error": "Not a reddit-scraper run"}), 400

    if status != "SUCCEEDED":
        return jsonify({"error": f"Run not succeeded: {status}"}), 400

    # Get project_id from body (you can pass project_id in webhook custom data)
    # Or use default project if not specified
    project_id = (
        body.get("projectId") or body.get("defaultDatasetId") or "default-project-1"
    )

    # For now, we'll return the webhook info and let the frontend decide what to do
    # In production, you might want to directly fetch the dataset and process
    try:
        from reddit_scraper import RedditScraper

        scraper = RedditScraper()

        # If we have a dataset ID, fetch and save
        dataset_id = body.get("defaultDatasetId")
        if dataset_id and scraper.has_apify:
            date_str = datetime.now().strftime("%Y-%m-%d")
            posts = []
            for item in scraper.client.dataset(dataset_id).iterate_items():
                posts.append(item)

            # Save as raw posts
            raw_path = scraper.dm.get_raw_path(project_id, date_str)
            scraper.dm.save_json(
                raw_path,
                {
                    "date": date_str,
                    "fetched_at": datetime.now(timezone.utc).isoformat(),
                    "apify_run_id": run_id,
                    "webhook_received": True,
                    "total_posts": len(posts),
                    "posts": posts,
                },
            )

            logger.info(
                f"Saved {len(posts)} posts from Apify webhook for project {project_id}"
            )
            return jsonify(
                {"ok": True, "posts_saved": len(posts), "project_id": project_id}
            )
    except Exception as e:
        logger.error(f"Error processing Apify webhook: {e}")
        return jsonify({"error": str(e)}), 500

    return jsonify({"ok": True, "message": "Webhook received", "run_id": run_id})


@app.route("/api/projects/<project_id>/scrape-settings", methods=["GET", "POST"])
def api_project_scrape_settings(project_id):
    """Get or update auto-scrape settings for a project."""
    project = models.get_project(project_id)
    if not project:
        return jsonify({"error": "Project not found"}), 404

    if request.method == "GET":
        return jsonify(
            {
                "auto_scrape_enabled": bool(project.get("auto_scrape_enabled")),
                "scrape_schedule_time": project.get("scrape_schedule_time", "09:00"),
                "scrape_schedule_timezone": project.get(
                    "scrape_schedule_timezone", "Asia/Shanghai"
                ),
            }
        )

    # POST - update settings
    body = request.get_json() or {}

    auto_scrape_enabled = body.get("auto_scrape_enabled")
    scrape_schedule_time = body.get("scrape_schedule_time")
    scrape_schedule_timezone = body.get("scrape_schedule_timezone")

    success = models.update_project_scrape_settings(
        project_id,
        auto_scrape_enabled=auto_scrape_enabled,
        scrape_schedule_time=scrape_schedule_time,
        scrape_schedule_timezone=scrape_schedule_timezone,
    )

    if success:
        # Restart scheduler to apply new settings
        restart_scheduler()
        return jsonify({"ok": True})
    return jsonify({"error": "Failed to update settings"}), 400


@app.route("/api/dates")
def api_dates():
    pid = get_pid_from_req()
    if not pid:
        return jsonify({"error": "No project"}), 404
    return jsonify({"dates": dm.list_dates(pid)})


@app.route("/api/personas")
def api_personas():
    pid = get_pid_from_req()
    if not pid:
        return jsonify({"error": "No project"}), 404
    return jsonify({"personas": models.get_personas(pid)})


# ─────────────────────────────────────────────
# Keyword Advisor Routes
# ─────────────────────────────────────────────


@app.route("/api/keyword-suggest", methods=["POST"])
def api_keyword_suggest():
    """
    Generate keyword suggestions from seed keywords using AI
    """
    body = request.get_json() or {}
    seed_keywords = body.get("seed_keywords", [])
    project_context = body.get("project_context", "")

    if not seed_keywords:
        return jsonify({"error": "No seed keywords provided"}), 400

    try:
        suggestions = advisor.suggest_from_keywords(seed_keywords, project_context)
        return jsonify({"ok": True, "suggestions": suggestions})
    except Exception as e:
        logger.error(f"Keyword suggestion failed: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/background-analyze", methods=["POST"])
def api_background_analyze():
    """
    Analyze project background and extract keyword strategy
    """
    body = request.get_json() or {}
    background_text = body.get("background_text", "")

    if not background_text:
        return jsonify({"error": "No background text provided"}), 400

    try:
        suggestions = advisor.suggest_from_background(background_text)
        return jsonify({"ok": True, "suggestions": suggestions})
    except Exception as e:
        logger.error(f"Background analysis failed: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/projects/<project_id>/keyword-config", methods=["GET", "POST"])
def api_project_keyword_config(project_id):
    """
    Get or update project keyword configuration
    """
    project = models.get_project(project_id)
    if not project:
        return jsonify({"error": "Project not found"}), 404

    if request.method == "GET":
        config_data = models.get_project_keyword_config(project_id)
        if config_data:
            return jsonify({"ok": True, "config": config_data})
        return jsonify({"ok": True, "config": {}})

    # POST - update keyword config
    body = request.get_json() or {}

    try:
        success = models.update_project_keyword_config(
            project_id,
            search_queries=body.get("search_queries"),
            subreddits=body.get("subreddits"),
            competitor_brands=body.get("competitor_brands"),
            classification_keywords=body.get("classification_keywords"),
            suggested_keywords=body.get("suggested_keywords"),
            background_text=body.get("background_text"),
        )

        if success:
            # Also update the main search_query field with first item from search_queries
            if body.get("search_queries") and len(body.get("search_queries")) > 0:
                search_query = body.get("search_queries")[0]
                with models.get_db() as conn:
                    conn.execute(
                        "UPDATE projects SET search_query = ? WHERE id = ?",
                        (search_query, project_id),
                    )
                    conn.commit()

            return jsonify({"ok": True})
        return jsonify({"error": "Failed to update configuration"}), 400
    except Exception as e:
        logger.error(f"Failed to update keyword config: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/upload-background", methods=["POST"])
def api_upload_background():
    """
    Upload and parse background file (PDF, DOCX, TXT)
    """
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    # Save file temporarily
    import tempfile
    import os

    temp_dir = tempfile.mkdtemp()
    file_path = os.path.join(temp_dir, file.filename)
    file.save(file_path)

    try:
        # Parse file
        text = advisor.parse_uploaded_file(file_path)

        # Clean up
        os.remove(file_path)
        os.rmdir(temp_dir)

        return jsonify({"ok": True, "text": text, "filename": file.filename})
    except Exception as e:
        # Clean up on error
        if os.path.exists(file_path):
            os.remove(file_path)
        if os.path.exists(temp_dir):
            os.rmdir(temp_dir)

        logger.error(f"File parsing failed: {e}")
        return jsonify({"error": str(e)}), 500


# ─────────────────────────────────────────────
# App Startup
# ─────────────────────────────────────────────
if __name__ == "__main__":
    logger.info("Initializing DB...")
    models.init_db()

    logger.info("Starting Reddit Ops System...")
    start_scheduler()
    atexit.register(stop_scheduler)
    app.run(host="0.0.0.0", port=config.FLASK_PORT, debug=config.FLASK_DEBUG)
