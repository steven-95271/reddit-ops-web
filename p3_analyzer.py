"""
P3 Analyzer
P3 热帖识别分析器
复用现有评分和分类逻辑
"""

import json
import logging
from datetime import datetime, timezone
from typing import Dict, List, Any

import config
import models
from scoring import calculate_hot_score, score_batch_posts

logger = logging.getLogger(__name__)


class P3Analyzer:
    """P3 热帖识别分析器"""

    def __init__(self):
        self.data_cleaner = None

    def analyze(self, parent_card_id: str) -> Dict:
        """
        分析 P2 抓取数据，生成 P3 热帖识别卡

        Args:
            parent_card_id: P2 产品卡 ID

        Returns:
            Data Card JSON
        """
        # 获取 P2 产品卡
        p2_card = models.get_product_card(parent_card_id)
        if not p2_card:
            raise ValueError(f"P2 card not found: {parent_card_id}")

        p2_data = p2_card.get("card_data", {})
        scraping_data = p2_data.get("scraping_data", {})
        posts = scraping_data.get("posts", [])

        if not posts:
            raise ValueError("No posts data found in P2 card")

        logger.info(f"P3: 开始分析 {len(posts)} 条帖子")

        # 1. 评分计算
        scored_posts = self._calculate_scores(posts)

        # 2. 分类打标
        classified_posts = self._classify_posts(scored_posts)

        # 3. 生成候选热帖
        candidates = self._generate_candidates(classified_posts)

        # 4. 分类统计
        category_stats = self._calculate_category_stats(classified_posts)

        # 5. 生成关键词云
        keyword_cloud = self._generate_keyword_cloud(classified_posts)

        # 6. 构建 Data Card
        card_data = self._build_data_card(
            parent_card_id=parent_card_id,
            posts=posts,
            candidates=candidates,
            category_stats=category_stats,
            keyword_cloud=keyword_cloud,
        )

        return card_data

    def _calculate_scores(self, posts: List[Dict]) -> List[Dict]:
        """
        计算帖子评分
        复用 scoring.py 的逻辑
        """
        scored_posts = []
        now_ts = int(datetime.now().timestamp())

        for post in posts:
            # 准备评分数据
            created = post.get("created_utc", 0)
            age_hours = max(0, (now_ts - created) / 3600) if created else 24

            post_data = {
                "upvotes": post.get("upvotes", 0),
                "comments": post.get("comments", 0),
                "age_hours": age_hours,
                "keyword_matches": 1,  # 简化为1
            }

            # 计算热度评分
            hot_score, score_level, detailed_scores = calculate_hot_score(post_data)

            # 添加评分信息到帖子
            scored_post = post.copy()
            scored_post.update(
                {
                    "composite_score": round(detailed_scores.get("final_score", 0), 4),
                    "hot_score": hot_score,
                    "score_level": score_level,
                    "engagement_score": detailed_scores.get("engagement", 0),
                    "recency_score": detailed_scores.get("recency", 0),
                    "keyword_score": detailed_scores.get("keywords", 0),
                }
            )

            scored_posts.append(scored_post)

        # 按评分排序
        scored_posts.sort(key=lambda x: x["composite_score"], reverse=True)

        return scored_posts

    def _classify_posts(self, posts: List[Dict]) -> List[Dict]:
        """
        帖子分类打标
        基于关键词匹配的分类逻辑
        """
        classified_posts = []

        for post in posts:
            # 基于标题和内容进行分类
            category = self._classify_single_post(post)

            classified_post = post.copy()
            classified_post["category"] = category
            classified_post["category_name"] = self._get_category_name(category)
            classified_post["category_color"] = self._get_category_color(category)

            classified_posts.append(classified_post)

        return classified_posts

    def _classify_single_post(self, post: Dict) -> str:
        """对单条帖子进行分类"""
        title = post.get("title", "").lower()
        body = post.get("body", "").lower()
        full_text = title + " " + body

        # 基于 config.CATEGORY_KEYWORDS 进行分类
        category_scores = {}

        for cat_id, cat_info in config.CATEGORY_KEYWORDS.items():
            keywords = cat_info.get("keywords", [])
            score = 0
            for kw in keywords:
                if kw.lower() in full_text:
                    score += 1
            category_scores[cat_id] = score

        # 返回得分最高的分类
        if category_scores:
            # 找到最高分的分类
            best_cat = None
            best_score = -1
            for cat, score in category_scores.items():
                if score > best_score:
                    best_score = score
                    best_cat = cat
            if best_cat and best_score > 0:
                return best_cat

        return "uncategorized"

    def _generate_candidates(self, posts: List[Dict]) -> List[Dict]:
        """
        生成候选热帖列表
        筛选标准：
        - S 级：composite_score >= 0.8
        - A 级：composite_score >= 0.6
        - B 级：composite_score >= 0.4
        - C 级：composite_score < 0.4（不入选候选池）
        """
        candidates = []

        for post in posts:
            level = post.get("score_level", "C")

            # 只保留 B 级及以上
            if level in ["S", "A", "B"]:
                candidate = {
                    "post_id": post.get("post_id", ""),
                    "title": post.get("title", ""),
                    "body": post.get("body", "")[:500] + "..."
                    if len(post.get("body", "")) > 500
                    else post.get("body", ""),
                    "author": post.get("author", ""),
                    "subreddit": post.get("subreddit", ""),
                    "upvotes": post.get("upvotes", 0),
                    "comments": post.get("comments", 0),
                    "composite_score": post.get("composite_score", 0),
                    "score_level": level,
                    "category": post.get("category", ""),
                    "category_name": post.get("category_name", ""),
                    "url": post.get("url", ""),
                    "created_utc": post.get("created_utc", 0),
                    "reasoning": self._generate_candidate_reasoning(post),
                }
                candidates.append(candidate)

        return candidates

    def _calculate_category_stats(self, posts: List[Dict]) -> Dict:
        """计算分类统计"""
        stats = {
            "A": {"count": 0, "name": "结构型测评", "color": "blue"},
            "B": {"count": 0, "name": "场景痛点", "color": "red"},
            "C": {"count": 0, "name": "观点争议", "color": "yellow"},
            "D": {"count": 0, "name": "竞品KOL", "color": "purple"},
            "E": {"count": 0, "name": "平台趋势", "color": "green"},
            "uncategorized": {"count": 0, "name": "未分类", "color": "gray"},
        }

        score_distribution = {"S": 0, "A": 0, "B": 0, "C": 0}

        subreddit_breakdown = {}

        for post in posts:
            category = post.get("category", "uncategorized")
            if category in stats:
                stats[category]["count"] += 1
            else:
                stats["uncategorized"]["count"] += 1

            level = post.get("score_level", "C")
            if level in score_distribution:
                score_distribution[level] += 1

            subreddit = post.get("subreddit", "unknown")
            if subreddit not in subreddit_breakdown:
                subreddit_breakdown[subreddit] = {
                    "count": 0,
                    "avg_score": 0,
                    "total_score": 0,
                }
            subreddit_breakdown[subreddit]["count"] += 1
            subreddit_breakdown[subreddit]["total_score"] += post.get(
                "composite_score", 0
            )

        # 计算平均评分
        for subreddit, data in subreddit_breakdown.items():
            if data["count"] > 0:
                data["avg_score"] = round(data["total_score"] / data["count"], 2)

        return {
            "category_distribution": stats,
            "score_distribution": score_distribution,
            "subreddit_breakdown": subreddit_breakdown,
            "total_analyzed": len(posts),
            "candidates_count": sum(score_distribution[l] for l in ["S", "A", "B"]),
        }

    def _generate_keyword_cloud(self, posts: List[Dict]) -> List[Dict]:
        """生成关键词云"""
        from collections import Counter
        import re

        # 提取所有标题和内容的词
        all_text = " ".join(
            [p.get("title", "") + " " + p.get("body", "") for p in posts]
        )

        # 简单的词频统计
        words = re.findall(r"\b[a-zA-Z]{4,}\b", all_text.lower())

        # 过滤常见停用词
        stop_words = {
            "this",
            "that",
            "with",
            "have",
            "been",
            "they",
            "were",
            "from",
            "than",
            "when",
            "your",
            "what",
            "would",
            "there",
            "their",
            "about",
            "after",
            "before",
            "because",
            "could",
            "should",
        }
        words = [w for w in words if w not in stop_words and len(w) > 4]

        # 统计词频
        word_counts = Counter(words)

        # 取前 30 个
        top_words = word_counts.most_common(30)

        # 转换为关键词云格式
        keyword_cloud = [
            {
                "text": word,
                "count": count,
                "weight": count / top_words[0][1] if top_words else 1,
            }
            for word, count in top_words
        ]

        return keyword_cloud

    def _build_data_card(
        self,
        parent_card_id: str,
        posts: List[Dict],
        candidates: List[Dict],
        category_stats: Dict,
        keyword_cloud: List[Dict],
    ) -> Dict:
        """构建 P3 Data Card"""

        card_data = {
            "card_id": "",
            "card_name": f"热帖识别 - {len(candidates)}个候选",
            "level": "L2",
            "owner": "AI分析",
            "status": "draft",
            "tags": ["热帖识别", "评分分析", "内容分类"],
            "input_parameters": [
                {
                    "param_name": "min_candidate_score",
                    "data_type": "float",
                    "format": "0.0-1.0",
                    "is_required": False,
                    "default_value": "0.4",
                    "description": "候选热帖最低评分阈值",
                },
                {
                    "param_name": "category_weights",
                    "data_type": "object",
                    "format": "JSON",
                    "is_required": False,
                    "default_value": "{}",
                    "description": "分类权重配置",
                },
            ],
            "upstream_data": [
                {
                    "source_id": parent_card_id,
                    "source_name": "P2 内容抓取卡",
                    "storage_type": "SQLite",
                    "data_format": "JSON",
                    "owner": "P2ScrapingManager",
                    "description": f"包含 {len(posts)} 条原始 Reddit 帖子数据",
                }
            ],
            "outputs": [
                {
                    "output_id": "out_p3_candidates",
                    "output_name": "候选热帖列表",
                    "output_mode": "batch",
                    "storage_type": "SQLite",
                    "file_type": "JSON",
                    "volume_estimate": f"{len(candidates)}条",
                    "directory_structure": "product_cards table",
                    "description": f"经过评分和分类筛选的 {len(candidates)} 条候选热帖",
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
                            "field_name": "composite_score",
                            "data_type": "float",
                            "description": "综合评分 0-1",
                        },
                        {
                            "field_name": "score_level",
                            "data_type": "string",
                            "description": "评分等级 S/A/B/C",
                        },
                        {
                            "field_name": "category",
                            "data_type": "string",
                            "description": "内容分类 A/B/C/D/E",
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
                            "field_name": "reasoning",
                            "data_type": "string",
                            "description": "入选理由",
                        },
                    ],
                },
                {
                    "output_id": "out_p3_analysis_stats",
                    "output_name": "分析统计报告",
                    "output_mode": "single",
                    "storage_type": "SQLite",
                    "file_type": "JSON",
                    "volume_estimate": "1条",
                    "directory_structure": "product_cards table",
                    "description": "分类分布、评分分布、关键词云等统计数据",
                    "fields": [
                        {
                            "field_name": "category_distribution",
                            "data_type": "object",
                            "description": "分类分布统计",
                        },
                        {
                            "field_name": "score_distribution",
                            "data_type": "object",
                            "description": "评分等级分布",
                        },
                        {
                            "field_name": "subreddit_breakdown",
                            "data_type": "object",
                            "description": "各板块表现",
                        },
                        {
                            "field_name": "keyword_cloud",
                            "data_type": "array",
                            "description": "关键词云数据",
                        },
                        {
                            "field_name": "total_analyzed",
                            "data_type": "integer",
                            "description": "分析帖子总数",
                        },
                    ],
                },
            ],
            "downstream": [
                {
                    "target_id": "P4-1_persona",
                    "target_name": "P4-1 人设设计",
                    "relied_output_id": "out_p3_candidates",
                    "usage_description": "基于候选热帖设计针对性人设",
                    "contact_person": "系统",
                },
                {
                    "target_id": "P4-2_content",
                    "target_name": "P4-2 内容创作",
                    "relied_output_id": "out_p3_candidates",
                    "usage_description": "基于候选热帖创作互动内容",
                    "contact_person": "系统",
                },
            ],
            "processing_logic": {
                "engine": "Scoring + DataCleaner",
                "architecture_desc": "复用现有评分算法和分类器，对抓取数据进行全自动评分和分类",
                "processing_steps": [
                    "1. 从 P2 产品卡加载抓取数据",
                    "2. 计算综合评分：热度、时效性、互动深度、关键词匹配度",
                    "3. 5 维分类打标：结构测评、场景痛点、观点争议、竞品KOL、平台趋势",
                    "4. 筛选候选热帖（评分等级 B 及以上）",
                    "5. 生成分类统计和关键词云",
                    "6. 构建标准化 Data Card JSON",
                ],
                "manual_intervention": {
                    "is_required": True,
                    "trigger_condition": "需要调整评分阈值，或人工筛选特定类型的候选帖",
                    "intervention_steps": "1. 查看候选热帖列表 2. 调整评分阈值重新筛选 3. 手动标记重点关注帖子 4. 确认后进入内容创作阶段",
                },
            },
            # 分析数据
            "analysis_data": {
                "total_posts": len(posts),
                "candidates_count": len(candidates),
                "candidates_preview": candidates[:10],  # 前 10 条预览
                "category_stats": category_stats,
                "keyword_cloud": keyword_cloud,
                "score_thresholds": {"S": 0.8, "A": 0.6, "B": 0.4, "C": 0.0},
            },
        }

        return card_data

    def _get_category_name(self, category: str) -> str:
        """获取分类名称"""
        names = {
            "A": "结构型测评",
            "B": "场景痛点",
            "C": "观点争议",
            "D": "竞品KOL",
            "E": "平台趋势",
            "uncategorized": "未分类",
        }
        return names.get(category, "未分类")

    def _get_category_color(self, category: str) -> str:
        """获取分类颜色"""
        colors = {
            "A": "blue",
            "B": "red",
            "C": "yellow",
            "D": "purple",
            "E": "green",
            "uncategorized": "gray",
        }
        return colors.get(category, "gray")

    def _generate_candidate_reasoning(self, post: Dict) -> str:
        """生成候选入选理由"""
        reasons = []

        score = post.get("composite_score", 0)
        level = post.get("score_level", "C")
        upvotes = post.get("upvotes", 0)
        comments = post.get("comments", 0)
        category = post.get("category_name", "")

        # 评分理由
        if level == "S":
            reasons.append(f"综合评分优秀 ({score:.2f})")
        elif level == "A":
            reasons.append(f"综合评分良好 ({score:.2f})")
        elif level == "B":
            reasons.append(f"综合评分达标 ({score:.2f})")

        # 互动理由
        if upvotes > 1000:
            reasons.append(f"高点赞 ({upvotes})")
        if comments > 100:
            reasons.append(f"高讨论 ({comments})")

        # 分类理由
        if category:
            reasons.append(f"属于{category}")

        return "，".join(reasons) if reasons else "综合表现良好"

    def adjust_threshold(self, parent_card_id: str, min_score: float) -> Dict:
        """
        调整评分阈值重新筛选

        Args:
            parent_card_id: P2 产品卡 ID
            min_score: 最低评分阈值

        Returns:
            新的候选列表
        """
        # 重新获取 P2 数据
        p2_card = models.get_product_card(parent_card_id)
        if not p2_card:
            raise ValueError(f"P2 card not found: {parent_card_id}")

        p2_data = p2_card.get("card_data", {})
        scraping_data = p2_data.get("scraping_data", {})
        posts = scraping_data.get("posts", [])

        # 重新评分和分类
        scored_posts = self._calculate_scores(posts)
        classified_posts = self._classify_posts(scored_posts)

        # 使用新阈值筛选
        candidates = []
        for post in classified_posts:
            if post.get("composite_score", 0) >= min_score:
                candidate = {
                    "post_id": post.get("post_id", ""),
                    "title": post.get("title", ""),
                    "composite_score": post.get("composite_score", 0),
                    "score_level": post.get("score_level", "C"),
                    "category": post.get("category", ""),
                    "upvotes": post.get("upvotes", 0),
                    "comments": post.get("comments", 0),
                }
                candidates.append(candidate)

        return {
            "min_score": min_score,
            "candidates_count": len(candidates),
            "candidates": candidates,
        }
