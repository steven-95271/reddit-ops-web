"""
Subreddit Discovery API Routes
板块发现 API 路由
"""

import logging
from flask import Blueprint, request, jsonify

logger = logging.getLogger(__name__)

# 创建蓝图
discovery_bp = Blueprint("discovery", __name__, url_prefix="/api")


# 延迟导入以避免循环导入
def get_scraping_manager():
    from p2_scraping_manager import P2ScrapingManager

    return P2ScrapingManager()


@discovery_bp.route("/projects/<project_id>/discover-subreddits", methods=["POST"])
def discover_subreddits(project_id: str):
    """
    执行板块探测

    POST /api/projects/{project_id}/discover-subreddits

    Request Body:
    {
        "use_mock": false  // 可选，默认 false
    }

    Response:
    {
        "success": true,
        "data": {
            "discovery_id": "discovery_xxx",
            "brand_queries": [...],
            "discovered_subreddits": [...],
            "total_posts_analyzed": 100,
            "status": "completed",
            "message": "..."
        }
    }
    """
    try:
        data = request.get_json() or {}
        use_mock = data.get("use_mock", False)

        manager = get_scraping_manager()
        result = manager.discover_subreddits(project_id, use_mock=use_mock)

        return jsonify({"success": True, "data": result})

    except ValueError as e:
        logger.error(f"Project not found: {e}")
        return jsonify({"success": False, "error": str(e)}), 404
    except Exception as e:
        logger.error(f"Discovery failed: {e}")
        return jsonify({"success": False, "error": f"Discovery failed: {str(e)}"}), 500


@discovery_bp.route("/projects/<project_id>/discovered-subreddits", methods=["GET"])
def get_discovered_subreddits(project_id: str):
    """
    获取已保存的板块探测结果

    GET /api/projects/{project_id}/discovered-subreddits
    """
    try:
        manager = get_scraping_manager()
        result = manager.get_discovered_subreddits(project_id)

        return jsonify({"success": True, "data": result})

    except Exception as e:
        logger.error(f"Failed to get discovered subreddits: {e}")
        return jsonify({"success": False, "error": str(e)}), 500
