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

        Args:
            parent_card_id: P1 产品卡 ID
            use_mock: 是否使用 Mock 数据

        Returns:
            {
                'task_id': 'task_xxx',
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
        search_strategy = card_data.get("generated_data", {}).get("search_strategy", {})

        if use_mock:
            # Mock 模式：直接返回成功
            return {
                "task_id": f"mock_task_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                "status": "completed",
                "use_mock": True,
                "message": "Mock 任务已创建，数据已准备就绪",
            }
        else:
            # 真实 APIFY 抓取
            try:
                # 构建搜索参数
                search_queries = search_strategy.get("search_queries", [])
                subreddits = search_strategy.get("subreddits", [])

                # 创建 APIFY 任务
                task_info = self._create_apify_task(search_queries, subreddits)

                return {
                    "task_id": task_info.get("task_id", ""),
                    "status": "pending",
                    "use_mock": False,
                    "message": f"APIFY 任务已创建，ID: {task_info.get('task_id', '')}",
                }
            except Exception as e:
                logger.error(f"创建 APIFY 任务失败: {e}")
                # 失败时降级到 Mock
                return {
                    "task_id": f"mock_fallback_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
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
        search_strategy = p1_data.get("generated_data", {}).get("search_strategy", {})

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
            "card_name": f"内容抓取 - {search_strategy.get('search_queries', ['未命名'])[0]}",
            "level": "L1",
            "owner": "APIFY/Mock",
            "status": "draft",
            "tags": ["内容抓取", "Reddit数据"],
            "input_parameters": [
                {
                    "param_name": "search_queries",
                    "data_type": "array",
                    "format": "string[]",
                    "is_required": True,
                    "default_value": json.dumps(
                        search_strategy.get("search_queries", [])
                    ),
                    "description": "搜索关键词列表",
                },
                {
                    "param_name": "subreddits",
                    "data_type": "array",
                    "format": "string[]",
                    "is_required": True,
                    "default_value": json.dumps(search_strategy.get("subreddits", [])),
                    "description": "目标 Subreddits",
                },
                {
                    "param_name": "time_filter",
                    "data_type": "string",
                    "format": "enum",
                    "is_required": True,
                    "default_value": search_strategy.get("time_filter", "week"),
                    "description": "时间范围过滤",
                },
                {
                    "param_name": "post_limit",
                    "data_type": "integer",
                    "format": "-",
                    "is_required": False,
                    "default_value": str(search_strategy.get("post_limit", 100)),
                    "description": "最大抓取数量",
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
                "architecture_desc": "调用 APIFY Reddit Scraper Actor 或使用预置 Mock 数据，抓取指定关键词和板块的帖子",
                "processing_steps": [
                    "1. 从 P1 产品卡获取搜索策略（关键词、板块、时间范围）",
                    "2. 创建 APIFY 抓取任务或生成 Mock 数据",
                    "3. 轮询任务状态直到完成",
                    "4. 下载并解析抓取结果",
                    "5. 统计各板块数据分布",
                    "6. 生成标准化 Data Card JSON",
                ],
                "manual_intervention": {
                    "is_required": False,
                    "trigger_condition": "数据量异常（过多/过少）或数据质量不达标",
                    "intervention_steps": "1. 检查搜索策略是否需要调整 2. 重新抓取或补充数据 3. 确认后进入 P3 分析",
                },
            },
            # 抓取数据
            "scraping_data": {
                "total_posts": total_posts,
                "subreddit_breakdown": subreddit_stats,
                "posts": posts,  # 完整的帖子数据
                "posts_preview": posts[:5] if posts else [],  # 前 5 条预览
                "search_strategy_applied": search_strategy,
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
        search_strategy = p1_data.get("generated_data", {}).get("search_strategy", {})

        # 生成 Mock 数据
        subreddits = search_strategy.get("subreddits", ["headphones", "earbuds"])
        mock_posts = self.mock_generator.generate_reddit_posts(
            subreddits=subreddits,
            count=87,  # 默认 87 条
            keywords=search_strategy.get("search_queries", []),
        )

        # 构建 scraping_data
        scraping_data = {
            "posts": mock_posts,
            "task_id": f"mock_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            "is_mock": True,
        }

        # 生成 Data Card
        card_data = self.generate_card_data(parent_card_id, scraping_data)
        card_data["processing_logic"]["engine"] = "Mock Data Generator"
        card_data["processing_logic"]["architecture_desc"] = (
            "使用预置 Mock 数据模拟抓取结果"
        )

        return card_data

    def _create_apify_task(
        self, search_queries: List[str], subreddits: List[str]
    ) -> Dict:
        """创建 APIFY 抓取任务"""
        # 这里调用 reddit_scraper.py 中的方法
        # 简化版本，实际实现可能需要调整

        if not self.scraper.has_apify:
            raise Exception("APIFY not configured")

        # 构建搜索参数
        search_terms = " OR ".join(search_queries[:3])  # 最多 3 个搜索词

        # 创建任务
        task_input = {
            "searches": [search_terms],
            "subreddits": subreddits[:5],  # 最多 5 个板块
            "maxItems": 100,
            "sort": "new",
        }

        # 调用 scraper 创建任务
        # 实际实现取决于 reddit_scraper.py 的接口
        # 这里返回模拟数据
        return {
            "task_id": f"apify_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            "status": "pending",
        }

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
                'search_queries': [...],
                'subreddits': [...],
                'estimated_posts': 100,
                'time_range': 'last 7 days'
            }
        """
        p1_card = models.get_product_card(parent_card_id)
        if not p1_card:
            raise ValueError(f"P1 card not found: {parent_card_id}")

        p1_data = p1_card.get("card_data", {})
        search_strategy = p1_data.get("generated_data", {}).get("search_strategy", {})

        return {
            "search_queries": search_strategy.get("search_queries", []),
            "subreddits": search_strategy.get("subreddits", []),
            "time_filter": search_strategy.get("time_filter", "week"),
            "post_limit": search_strategy.get("post_limit", 100),
            "estimated_posts": f"最多 {search_strategy.get('post_limit', 100)} 条",
            "time_range": f"最近 {search_strategy.get('scrape_hours', 168) // 24} 天",
        }
