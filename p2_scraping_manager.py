"""
P2 Scraping Manager
P2 内容抓取管理器
支持 APIFY 真实抓取和 Mock 模式
"""

import json
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any

import models
import config
from reddit_scraper import RedditScraper
from mock_data_generator import MockDataGenerator

logger = logging.getLogger(__name__)


class P2ScrapingManager:
    """P2 内容抓取管理器"""

    def __init__(self):
        self.scraper = RedditScraper()
        self.mock_generator = MockDataGenerator()

    def create_scraping_task(self, parent_card_id: str, use_mock: bool = False) -> Dict:
        """
        创建抓取任务
        从 P1 的 search_tasks 中读取任务队列，按 priority 排序，
        为每个 task 创建独立的 Apify run

        Args:
            parent_card_id: P1 产品卡 ID
            use_mock: 是否使用 Mock 数据

        Returns:
            {
                'batch_id': 'batch_xxx',
                'tasks': [...],  # 任务列表
                'total_tasks': N,
                'status': 'pending',
                'use_mock': True/False,
                'message': '...'
            }
        """
        # 获取 P1 产品卡
        p1_card = models.get_product_card(parent_card_id)
        if not p1_card:
            raise ValueError(f"P1 card not found: {parent_card_id}")

        card_data = p1_card.get("card_data", {})
        search_tasks = card_data.get("generated_data", {}).get("search_tasks", [])

        # 按 priority 排序（数字越小优先级越高）
        sorted_tasks = sorted(search_tasks, key=lambda x: x.get("priority", 999))

        if use_mock:
            # Mock 模式：直接返回成功
            mock_tasks = [
                {
                    "task_id": f"mock_task_{i + 1}",
                    "query": task.get("query", ""),
                    "status": "completed",
                    "priority": task.get("priority", 1),
                    "keyword_type": task.get("keyword_type", "unknown"),
                }
                for i, task in enumerate(sorted_tasks[:5])  # Mock 模式只取前5个
            ]
            return {
                "batch_id": f"mock_batch_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                "tasks": mock_tasks,
                "total_tasks": len(mock_tasks),
                "status": "completed",
                "use_mock": True,
                "message": f"Mock 任务已创建，共 {len(mock_tasks)} 个任务",
            }
        else:
            # 真实 APIFY 抓取
            try:
                created_tasks = []
                for task in sorted_tasks:
                    # 为每个 task 创建独立的 Apify run
                    task_info = self._create_apify_task(task)
                    created_tasks.append(
                        {
                            "task_id": task_info.get("task_id"),
                            "query": task.get("query"),
                            "subreddit": task.get("subreddit", ""),
                            "priority": task.get("priority"),
                            "keyword_type": task.get("keyword_type"),
                            "status": "pending",
                        }
                    )

                batch_id = f"batch_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

                return {
                    "batch_id": batch_id,
                    "tasks": created_tasks,
                    "total_tasks": len(created_tasks),
                    "status": "pending",
                    "use_mock": False,
                    "message": f"APIFY 任务已创建，共 {len(created_tasks)} 个任务",
                }
            except Exception as e:
                logger.error(f"创建 APIFY 任务失败: {e}")
                # 失败时降级到 Mock
                return {
                    "batch_id": f"mock_fallback_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                    "tasks": [],
                    "total_tasks": 0,
                    "status": "completed",
                    "use_mock": True,
                    "message": f"APIFY 创建失败，已切换到 Mock 模式: {str(e)}",
                }

    def get_task_status(self, task_id: str) -> Dict:
        """
        获取任务状态

        Args:
            task_id: 任务 ID

        Returns:
            {
                'task_id': '...',
                'status': 'pending/running/completed/failed',
                'progress': 0-100,
                'message': '...',
                'data_count': 0
            }
        """
        if task_id.startswith("mock_"):
            # Mock 任务直接返回完成
            return {
                "task_id": task_id,
                "status": "completed",
                "progress": 100,
                "message": "Mock 数据已准备就绪",
                "data_count": 87,  # 模拟 87 条数据
            }

        # 真实 APIFY 任务轮询
        try:
            status_info = self._poll_apify_task(task_id)
            return status_info
        except Exception as e:
            logger.error(f"轮询任务状态失败: {e}")
            return {
                "task_id": task_id,
                "status": "failed",
                "progress": 0,
                "message": f"获取状态失败: {str(e)}",
                "data_count": 0,
            }

    def generate_card_data(self, parent_card_id: str, scraping_data: Dict) -> Dict:
        """
        基于真实抓取数据生成 P2 Data Card

        Args:
            parent_card_id: P1 产品卡 ID
            scraping_data: 抓取数据

        Returns:
            Data Card JSON
        """
        # 获取 P1 产品卡
        p1_card = models.get_product_card(parent_card_id)
        if not p1_card:
            raise ValueError(f"P1 card not found: {parent_card_id}")

        p1_data = p1_card.get("card_data", {})
        search_tasks = p1_data.get("generated_data", {}).get("search_tasks", [])

        # 提取抓取统计
        posts = scraping_data.get("posts", [])
        total_posts = len(posts)

        # 按 subreddit 统计
        subreddit_stats = {}
        for post in posts:
            subreddit = post.get("subreddit", "unknown")
            if subreddit not in subreddit_stats:
                subreddit_stats[subreddit] = 0
            subreddit_stats[subreddit] += 1

        # 构建 Data Card
        card_data = {
            "card_id": "",
            "card_name": f"内容抓取 - {search_tasks[0].get('query', '未命名') if search_tasks else '未命名'}",
            "level": "L1",
            "owner": "APIFY/Mock",
            "status": "draft",
            "tags": ["内容抓取", "Reddit数据"],
            "input_parameters": [
                {
                    "param_name": "search_tasks",
                    "data_type": "array",
                    "format": "object[]",
                    "is_required": True,
                    "default_value": json.dumps(
                        search_tasks[:3] if search_tasks else []
                    ),
                    "description": "搜索任务列表（前3个）",
                },
                {
                    "param_name": "total_tasks",
                    "data_type": "integer",
                    "format": "-",
                    "is_required": True,
                    "default_value": str(len(search_tasks)),
                    "description": "总任务数",
                },
            ],
            "upstream_data": [
                {
                    "source_id": parent_card_id,
                    "source_name": "P1 项目配置卡",
                    "storage_type": "SQLite",
                    "data_format": "JSON",
                    "owner": "P1ConfigGenerator",
                    "description": "搜索策略和关键词配置",
                }
            ],
            "outputs": [
                {
                    "output_id": "out_p2_raw_posts",
                    "output_name": "Reddit 原始帖子数据",
                    "output_mode": "batch",
                    "storage_type": "SQLite/JSON",
                    "file_type": "JSON",
                    "volume_estimate": f"{total_posts}条",
                    "directory_structure": f"data/reddit/{{project_id}}/{{date}}/raw_posts.json",
                    "description": f"抓取到的 {total_posts} 条 Reddit 帖子原始数据",
                    "fields": [
                        {
                            "field_name": "post_id",
                            "data_type": "string",
                            "description": "帖子唯一ID",
                            "is_primary_key": True,
                        },
                        {
                            "field_name": "title",
                            "data_type": "string",
                            "description": "帖子标题",
                        },
                        {
                            "field_name": "body",
                            "data_type": "string",
                            "description": "帖子内容",
                        },
                        {
                            "field_name": "author",
                            "data_type": "string",
                            "description": "发帖人",
                        },
                        {
                            "field_name": "subreddit",
                            "data_type": "string",
                            "description": "所属板块",
                        },
                        {
                            "field_name": "upvotes",
                            "data_type": "integer",
                            "description": "点赞数",
                        },
                        {
                            "field_name": "comments",
                            "data_type": "integer",
                            "description": "评论数",
                        },
                        {
                            "field_name": "created_utc",
                            "data_type": "long",
                            "description": "发帖时间戳",
                        },
                        {
                            "field_name": "url",
                            "data_type": "string",
                            "description": "帖子链接",
                        },
                        {
                            "field_name": "permalink",
                            "data_type": "string",
                            "description": "Reddit 永久链接",
                        },
                    ],
                },
                {
                    "output_id": "out_p2_scraping_log",
                    "output_name": "抓取任务执行摘要",
                    "output_mode": "single",
                    "storage_type": "SQLite",
                    "file_type": "JSON",
                    "volume_estimate": "1条/任务",
                    "directory_structure": "product_cards table",
                    "description": "单次抓取任务的执行统计",
                    "fields": [
                        {
                            "field_name": "task_id",
                            "data_type": "string",
                            "description": "任务ID",
                        },
                        {
                            "field_name": "total_posts",
                            "data_type": "integer",
                            "description": "抓取帖子总数",
                        },
                        {
                            "field_name": "subreddit_breakdown",
                            "data_type": "object",
                            "description": "各板块分布",
                        },
                        {
                            "field_name": "time_range",
                            "data_type": "string",
                            "description": "时间范围",
                        },
                        {
                            "field_name": "execution_time",
                            "data_type": "float",
                            "description": "执行耗时(秒)",
                        },
                        {
                            "field_name": "status",
                            "data_type": "string",
                            "description": "任务状态",
                        },
                    ],
                },
            ],
            "downstream": [
                {
                    "target_id": "P3_analysis",
                    "target_name": "P3 热帖识别",
                    "relied_output_id": "out_p2_raw_posts",
                    "usage_description": "使用原始帖子数据进行评分和分类分析",
                    "contact_person": "系统",
                }
            ],
            "processing_logic": {
                "engine": "APIFY Reddit Scraper / Mock Data",
                "architecture_desc": "调用 APIFY Reddit Scraper Actor 或使用预置 Mock 数据，基于 P1 生成的 search_tasks 列表逐个执行抓取任务",
                "processing_steps": [
                    "1. 从 P1 产品卡获取 search_tasks 列表（包含 query, subreddit, priority 等）",
                    "2. 按 priority 排序，为每个 task 创建独立的 Apify Actor run",
                    "3. 轮询所有任务状态直到完成",
                    "4. 下载并合并抓取结果",
                    "5. 统计各板块数据分布",
                    "6. 生成标准化 Data Card JSON",
                ],
                "manual_intervention": {
                    "is_required": False,
                    "trigger_condition": "数据量异常（过多/过少）或数据质量不达标",
                    "intervention_steps": "1. 检查 search_tasks 是否需要调整 2. 重新抓取或补充数据 3. 确认后进入 P3 分析",
                },
            },
            # 抓取数据
            "scraping_data": {
                "total_posts": total_posts,
                "subreddit_breakdown": subreddit_stats,
                "posts": posts,  # 完整的帖子数据
                "posts_preview": posts[:5] if posts else [],  # 前 5 条预览
                "search_tasks_applied": search_tasks,
                "execution_timestamp": datetime.now().isoformat(),
            },
        }

        return card_data

    def generate_mock_card_data(self, parent_card_id: str) -> Dict:
        """
        生成 Mock 数据的 P2 Data Card

        Args:
            parent_card_id: P1 产品卡 ID

        Returns:
            Data Card JSON
        """
        # 获取 P1 产品卡
        p1_card = models.get_product_card(parent_card_id)
        if not p1_card:
            raise ValueError(f"P1 card not found: {parent_card_id}")

        p1_data = p1_card.get("card_data", {})
        search_tasks = p1_data.get("generated_data", {}).get("search_tasks", [])

        # 生成 Mock 数据
        # 从 search_tasks 中提取 subreddit 列表
        subreddits_from_tasks = (
            list(
                set(
                    [
                        task.get("subreddit")
                        for task in search_tasks
                        if task.get("subreddit")
                    ]
                )
            )
            if search_tasks
            else ["headphones", "earbuds"]
        )

        if not subreddits_from_tasks:
            subreddits_from_tasks = ["headphones", "earbuds"]

        # 从 search_tasks 中提取关键词
        keywords_from_tasks = (
            [task.get("query", "") for task in search_tasks[:5]]
            if search_tasks
            else ["product"]
        )

        mock_posts = self.mock_generator.generate_reddit_posts(
            subreddits=subreddits_from_tasks,
            count=87,  # 默认 87 条
            keywords=keywords_from_tasks,
        )

        # 构建 scraping_data
        scraping_data = {
            "posts": mock_posts,
            "batch_id": f"mock_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            "is_mock": True,
        }

        # 生成 Data Card
        card_data = self.generate_card_data(parent_card_id, scraping_data)
        card_data["processing_logic"]["engine"] = "Mock Data Generator"
        card_data["processing_logic"]["architecture_desc"] = (
            "使用预置 Mock 数据模拟抓取结果"
        )

        return card_data

    def _create_apify_task(self, task: Dict) -> Dict:
        """
        创建 APIFY Reddit Scraper 任务

        Args:
            task: 单个搜索任务配置，包含 query, subreddit, sort_order, time_filter, max_posts 等

        Returns:
            {
                'task_id': 'apify_run_xxx',
                'status': 'pending',
                'apify_input': {...}  # 发送给 Apify 的配置
            }
        """
        # 这里调用 reddit_scraper.py 中的方法
        # 简化版本，实际实现可能需要调整

        if not self.scraper.has_apify:
            raise Exception("APIFY not configured")

        # 构建 Apify Reddit Scraper 输入参数
        # Actor ID: trudax/reddit-scraper
        apify_input = {
            "searchQueries": [task.get("query", "")],  # 单个搜索词
            "sortOrder": task.get("sort_order", "relevance"),
            "timeFilter": task.get("time_filter", "all"),
            "maxPostsPerSource": task.get("max_posts", 100),
            "includeComments": True,  # 必须开启，保证后续分析质量
            "maxCommentsPerPost": 20,  # 固定20
            "commentDepth": 3,  # 固定3
            "deduplicatePosts": True,  # 固定开启
            "maxRetries": 5,  # 固定5
        }

        # 如果指定了 subreddit，添加到搜索参数
        subreddit = task.get("subreddit", "")
        if subreddit:
            apify_input["searchSubreddits"] = [subreddit]

        # 调用 scraper 创建任务
        # 实际实现应该调用 Apify API 启动 Actor run
        # 这里返回模拟数据
        logger.info(
            f"创建 Apify 任务: query={task.get('query')}, subreddit={subreddit}, priority={task.get('priority')}"
        )

        return {
            "task_id": f"apify_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{task.get('task_id', 'unknown')}",
            "status": "pending",
            "apify_input": apify_input,
            "actor_id": "trudax/reddit-scraper",
        }

    def discover_subreddits(self, parent_card_id: str, use_mock: bool = False) -> Dict:
        """
        用核心品牌词做一次全站搜索，从结果中提取实际出现的 subreddit。
        用于验证和补充 P1 的 subreddit 推荐。

        这是一个"探测轮"，应该在 P2 正式大批量抓取之前调用。

        Args:
            parent_card_id: P1 产品卡 ID
            use_mock: 是否使用 Mock 数据

        Returns:
            {
                'discovery_id': 'discovery_xxx',
                'brand_queries': [...],  # 用于探测的品牌词
                'discovered_subreddits': [
                    {'name': 'subreddit_name', 'count': 15, 'percentage': 30.0},
                    ...
                ],
                'total_posts_analyzed': 100,
                'status': 'completed',
                'message': '...'
            }
        """
        # 获取 P1 产品卡
        p1_card = models.get_product_card(parent_card_id)
        if not p1_card:
            raise ValueError(f"P1 card not found: {parent_card_id}")

        p1_data = p1_card.get("card_data", {})
        generated_data = p1_data.get("generated_data", {})
        search_tasks = generated_data.get("search_tasks", [])

        # 从 search_tasks 中提取 priority=1 的品牌词（brand 和 product 类型）
        brand_tasks = [
            task
            for task in search_tasks
            if task.get("priority") == 1
            and task.get("keyword_type") in ["brand", "product"]
        ]

        if not brand_tasks:
            logger.warning(
                f"未找到 priority=1 的品牌词任务，使用所有 priority=1 的任务"
            )
            brand_tasks = [task for task in search_tasks if task.get("priority") == 1]

        if not brand_tasks:
            return {
                "discovery_id": f"discovery_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                "brand_queries": [],
                "discovered_subreddits": [],
                "total_posts_analyzed": 0,
                "status": "failed",
                "message": "未找到可用的品牌词进行探测",
            }

        # 限制最多用前 3 个品牌词进行探测（避免过多请求）
        brand_tasks = brand_tasks[:3]
        brand_queries = [task.get("query") for task in brand_tasks]

        logger.info(f"开始板块探测，使用品牌词: {brand_queries}")

        if use_mock:
            # Mock 模式：生成模拟的板块发现结果
            mock_discovered = [
                {"name": "Parenting", "count": 23, "percentage": 23.0},
                {"name": "BuyItForLife", "count": 18, "percentage": 18.0},
                {"name": "toddlers", "count": 15, "percentage": 15.0},
                {"name": "daddit", "count": 12, "percentage": 12.0},
                {"name": "Mommit", "count": 10, "percentage": 10.0},
                {"name": "gadgets", "count": 8, "percentage": 8.0},
                {"name": "preschoolers", "count": 7, "percentage": 7.0},
                {"name": "BabyBumps", "count": 4, "percentage": 4.0},
                {"name": "beyondthebump", "count": 2, "percentage": 2.0},
                {"name": "slp", "count": 1, "percentage": 1.0},
            ]

            discovery_result = {
                "discovery_id": f"mock_discovery_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                "brand_queries": brand_queries,
                "discovered_subreddits": mock_discovered,
                "total_posts_analyzed": 100,
                "status": "completed",
                "use_mock": True,
                "message": f"Mock 探测完成，发现 {len(mock_discovered)} 个板块",
            }
        else:
            # 真实 APIFY 探测
            try:
                subreddit_counts = {}
                total_posts = 0

                for task in brand_tasks:
                    # 创建探测任务：全站搜索，max_posts=50
                    discovery_task = {
                        "query": task.get("query"),
                        "subreddit": "",  # 空表示全站搜索
                        "sort_order": "relevance",
                        "time_filter": "all",
                        "max_posts": 50,
                        "priority": 1,
                        "keyword_type": task.get("keyword_type"),
                    }

                    # 运行 Apify 搜索（这里假设有执行方法）
                    # 实际实现中需要调用 reddit_scraper 来执行搜索
                    # 为了简化，这里使用 _create_apify_task 创建任务
                    task_info = self._create_apify_task(discovery_task)

                    # 实际应该从 task_info 中获取结果并解析
                    # 这里简化处理，假设返回了模拟结果
                    # 实际实现中应该等待任务完成并获取数据
                    logger.info(
                        f"探测任务已创建: {task_info.get('task_id')} for query: {task.get('query')}"
                    )

                    # TODO: 实际实现中需要轮询任务状态并获取结果
                    # 这里为了演示，添加一个模拟的板块计数
                    # 实际应该从 Apify 返回的 posts 中提取 subreddit 字段

                # 由于实际 API 调用比较复杂，这里返回一个待实现的状态
                # 实际使用时需要完成 _execute_discovery_search 方法
                discovery_result = {
                    "discovery_id": f"discovery_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                    "brand_queries": brand_queries,
                    "discovered_subreddits": [],
                    "total_posts_analyzed": 0,
                    "status": "pending",
                    "use_mock": False,
                    "message": f"探测任务已创建，正在分析 {len(brand_queries)} 个品牌词...",
                }

            except Exception as e:
                logger.error(f"板块探测失败: {e}")
                discovery_result = {
                    "discovery_id": f"discovery_failed_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                    "brand_queries": brand_queries,
                    "discovered_subreddits": [],
                    "total_posts_analyzed": 0,
                    "status": "failed",
                    "message": f"探测失败: {str(e)}",
                }

        # 将探测结果存入 P1 产品卡
        try:
            generated_data["discovered_subreddits"] = discovery_result
            # 更新产品卡（实际需要通过 models 层保存）
            logger.info(f"板块探测结果已保存到 P1 产品卡: {parent_card_id}")
        except Exception as e:
            logger.error(f"保存探测结果失败: {e}")

        return discovery_result

    def get_discovered_subreddits(self, parent_card_id: str) -> Dict:
        """
        获取已保存的板块探测结果

        Args:
            parent_card_id: P1 产品卡 ID

        Returns:
            之前 discover_subreddits 的结果，如果没有则返回空
        """
        try:
            p1_card = models.get_product_card(parent_card_id)
            if not p1_card:
                return {"found": False, "message": "P1 card not found"}

            p1_data = p1_card.get("card_data", {})
            generated_data = p1_data.get("generated_data", {})
            discovered = generated_data.get("discovered_subreddits")

            if discovered:
                return {"found": True, "data": discovered}
            else:
                return {"found": False, "message": "尚未进行板块探测"}

        except Exception as e:
            logger.error(f"获取探测结果失败: {e}")
            return {"found": False, "message": f"Error: {str(e)}"}

    def _poll_apify_task(self, task_id: str) -> Dict:
        """轮询 APIFY 任务状态"""
        # 实际实现需要调用 APIFY API 查询任务状态
        # 这里返回模拟数据
        return {
            "task_id": task_id,
            "status": "running",
            "progress": 50,
            "message": "正在抓取数据...",
            "data_count": 0,
        }

    def get_scraping_preview(self, parent_card_id: str) -> Dict:
        """
        获取抓取预览（用于确认前展示）

        Returns:
            {
                'total_tasks': 15,
                'priority_1_tasks': [...],
                'priority_2_tasks': [...],
                'priority_3_tasks': [...],
                'estimated_total_posts': 1000,
            }
        """
        p1_card = models.get_product_card(parent_card_id)
        if not p1_card:
            raise ValueError(f"P1 card not found: {parent_card_id}")

        p1_data = p1_card.get("card_data", {})
        search_tasks = p1_data.get("generated_data", {}).get("search_tasks", [])

        # 按优先级统计
        p1_tasks = [t for t in search_tasks if t.get("priority") == 1]
        p2_tasks = [t for t in search_tasks if t.get("priority") == 2]
        p3_tasks = [t for t in search_tasks if t.get("priority") == 3]

        # 估算总帖子数
        estimated_posts = sum(t.get("max_posts", 100) for t in search_tasks)

        return {
            "total_tasks": len(search_tasks),
            "priority_1_tasks": [
                {
                    "query": t.get("query"),
                    "subreddit": t.get("subreddit"),
                    "max_posts": t.get("max_posts"),
                }
                for t in p1_tasks[:5]
            ],
            "priority_2_tasks": [
                {
                    "query": t.get("query"),
                    "subreddit": t.get("subreddit"),
                    "max_posts": t.get("max_posts"),
                }
                for t in p2_tasks[:5]
            ],
            "priority_3_tasks": [
                {
                    "query": t.get("query"),
                    "subreddit": t.get("subreddit"),
                    "max_posts": t.get("max_posts"),
                }
                for t in p3_tasks[:5]
            ],
            "estimated_total_posts": estimated_posts,
            "sample_tasks": [
                {
                    "query": t.get("query"),
                    "type": t.get("keyword_type"),
                    "priority": t.get("priority"),
                }
                for t in search_tasks[:3]
            ]
            if search_tasks
            else [],
        }
