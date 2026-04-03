"""
P1 Config Generator
P1 项目配置卡生成器
使用 MiniMax API 进行多轮对话生成关键词和搜索策略
"""

import json
import logging
from typing import Dict, List, Any

import config

logger = logging.getLogger(__name__)


class P1ConfigGenerator:
    """P1 项目配置卡生成器"""

    def __init__(self):
        self.api_key = config.MINIMAX_API_KEY
        self.api_url = config.MINIMAX_API_URL
        self.model = config.MINIMAX_MODEL

    def generate(self, input_data: Dict) -> Dict:
        """
        生成 P1 项目配置卡 Data Card JSON

        Args:
            input_data: {
                'project_background': '项目背景',
                'target_audience': '目标人群',
                'unique_selling_points': ['卖点1', '卖点2'],
                'seed_keywords': ['种子关键词1', '种子关键词2'],
                'brand_names': ['品牌名'],
                'competitor_brands': ['竞品1', '竞品2']
            }

        Returns:
            Data Card JSON
        """
        # 第一轮对话：扩展种子关键词
        logger.info("P1: 开始第一轮对话 - 扩展种子关键词")
        keyword_suggestions = self._generate_keywords(input_data)

        # 第二轮对话：推荐 Subreddits
        logger.info("P1: 开始第二轮对话 - 推荐 Subreddits")
        subreddit_suggestions = self._generate_subreddits(
            input_data, keyword_suggestions
        )

        # 第三轮对话：生成 APIFY 搜索策略
        logger.info("P1: 开始第三轮对话 - 生成搜索策略")
        search_strategy = self._generate_search_strategy(
            input_data, keyword_suggestions, subreddit_suggestions
        )

        # 构建 Data Card
        card_data = self._build_data_card(
            input_data, keyword_suggestions, subreddit_suggestions, search_strategy
        )

        return card_data

    def _generate_keywords(self, input_data: Dict) -> Dict:
        """第一轮：基于种子关键词生成扩展建议"""
        seed_keywords = input_data.get("seed_keywords", [])
        project_context = input_data.get("project_background", "")
        brand_names = input_data.get("brand_names", [])
        competitor_brands = input_data.get("competitor_brands", [])

        if not self.api_key:
            # 如果没有 API key，返回基础建议
            return self._generate_fallback_keywords(seed_keywords)

        try:
            import httpx

            prompt = f"""你是一个 Reddit 营销专家。基于以下信息生成关键词建议：

项目背景: {project_context}
种子关键词: {", ".join(seed_keywords)}
品牌名称: {", ".join(brand_names)}
竞品品牌: {", ".join(competitor_brands)}

请生成 6 类关键词，每类 5-8 个：
1. brand_keywords：品牌名和产品名（如 toniebox, tonies）
2. product_keywords：具体型号（如 toniebox 2, yoto mini）
3. category_keywords：品类通用词（如 audio player for kids, toddler speaker）
4. comparison_keywords：对比词（如 toniebox vs yoto, best X vs Y）
5. scenario_keywords：使用场景词（如 bedtime routine toddler, screen-free toy）
6. problem_keywords：问题/痛点词（如 toniebox not charging, toniebox broken）

重要要求：请生成 Reddit 用户实际会搜索的口语化表达，而不是书面化的产品描述词。

以 JSON 格式输出：
{{
    "brand_keywords": ["..."],
    "product_keywords": ["..."],
    "category_keywords": ["..."],
    "comparison_keywords": ["..."],
    "scenario_keywords": ["..."],
    "problem_keywords": ["..."],
    "reasoning": "简要说明推荐理由"
}}"""

            response = httpx.post(
                self.api_url,
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={
                    "model": self.model,
                    "messages": [{"role": "user", "content": prompt}],
                },
                timeout=60.0,
            )

            if response.status_code == 200:
                result = response.json()
                content = (
                    result.get("choices", [{}])[0].get("message", {}).get("content", "")
                )

                # 尝试解析 JSON
                try:
                    keywords_data = json.loads(content)
                    return keywords_data
                except:
                    # 如果解析失败，提取关键词
                    return self._extract_keywords_from_text(content, seed_keywords)
            else:
                logger.warning(f"MiniMax API 调用失败: {response.status_code}")
                return self._generate_fallback_keywords(seed_keywords)

        except Exception as e:
            logger.error(f"关键词生成失败: {e}")
            return self._generate_fallback_keywords(seed_keywords)

    def _generate_subreddits(self, input_data: Dict, keyword_suggestions: Dict) -> Dict:
        """第二轮：推荐 Subreddits"""
        seed_keywords = input_data.get("seed_keywords", [])
        target_audience = input_data.get("target_audience", "")

        if not self.api_key:
            return self._generate_fallback_subreddits(seed_keywords)

        try:
            import httpx

            all_keywords = (
                seed_keywords
                + keyword_suggestions.get("brand_keywords", [])
                + keyword_suggestions.get("category_keywords", [])
                + keyword_suggestions.get("scenario_keywords", [])
            )

            prompt = f"""你是一个 Reddit 社区专家。基于以下信息推荐合适的 Subreddits：

目标人群: {target_audience}
相关关键词: {", ".join(all_keywords[:10])}

请推荐：
1. 高相关度 Subreddits（5-8 个）
2. 中相关度 Subreddits（3-5 个）
3. 每个推荐理由

以 JSON 格式输出：
{{
    "high_relevance": [
        {{"name": "subreddit_name", "reason": "推荐理由", "estimated_posts": "daily/weekly"}}
    ],
    "medium_relevance": [
        {{"name": "subreddit_name", "reason": "推荐理由", "estimated_posts": "daily/weekly"}}
    ],
    "reasoning": "整体推荐逻辑"
}}"""

            response = httpx.post(
                self.api_url,
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={
                    "model": self.model,
                    "messages": [{"role": "user", "content": prompt}],
                },
                timeout=60.0,
            )

            if response.status_code == 200:
                result = response.json()
                content = (
                    result.get("choices", [{}])[0].get("message", {}).get("content", "")
                )

                try:
                    subreddits_data = json.loads(content)
                    return subreddits_data
                except:
                    return self._extract_subreddits_from_text(content)
            else:
                return self._generate_fallback_subreddits(seed_keywords)

        except Exception as e:
            logger.error(f"Subreddit 推荐失败: {e}")
            return self._generate_fallback_subreddits(seed_keywords)

    def _generate_search_strategy(
        self, input_data: Dict, keyword_suggestions: Dict, subreddit_suggestions: Dict
    ) -> Dict:
        """第三轮：生成 APIFY 搜索策略"""
        seed_keywords = input_data.get("seed_keywords", [])
        brand_names = input_data.get("brand_names", [])
        competitor_brands = input_data.get("competitor_brands", [])

        # 构建搜索策略
        brand_keywords = keyword_suggestions.get("brand_keywords", seed_keywords)
        product_keywords = keyword_suggestions.get("product_keywords", [])
        comparison_keywords = keyword_suggestions.get("comparison_keywords", [])

        # 基础搜索词：优先使用品牌词和产品词
        search_queries = []
        for kw in brand_keywords[:2]:
            search_queries.append(kw)
        for kw in product_keywords[:2]:
            search_queries.append(kw)

        # 添加对比词
        for kw in comparison_keywords[:1]:
            search_queries.append(kw)

        # 添加竞品相关搜索
        for brand in competitor_brands[:2]:
            for kw in seed_keywords[:2]:
                search_queries.append(f"{brand} {kw}")

        # 获取推荐的 subreddits
        high_relevance = subreddit_suggestions.get("high_relevance", [])
        subreddits = [s.get("name", "") for s in high_relevance[:5]]

        # 如果没有推荐，使用默认值
        if not subreddits:
            subreddits = ["headphones", "earbuds", "audiophile"]

        strategy = {
            "search_queries": list(set(search_queries))[:5],  # 去重，最多 5 个
            "subreddits": subreddits,
            "time_filter": "week",  # 默认最近一周
            "post_limit": 100,
            "scrape_hours": 168,  # 7 天
            "min_score": 5,
            "search_strategy_logic": f"基于品牌关键词 {', '.join(brand_keywords[:3])} 进行搜索",
        }

        return strategy

    def _build_data_card(
        self,
        input_data: Dict,
        keyword_suggestions: Dict,
        subreddit_suggestions: Dict,
        search_strategy: Dict,
    ) -> Dict:
        """构建完整的 Data Card JSON"""

        # 合并所有关键词
        all_keywords = []
        all_keywords.extend(input_data.get("seed_keywords", []))
        all_keywords.extend(keyword_suggestions.get("brand_keywords", []))
        all_keywords.extend(keyword_suggestions.get("product_keywords", []))
        all_keywords.extend(keyword_suggestions.get("category_keywords", []))
        all_keywords.extend(keyword_suggestions.get("comparison_keywords", []))
        all_keywords.extend(keyword_suggestions.get("scenario_keywords", []))
        all_keywords.extend(keyword_suggestions.get("problem_keywords", []))
        all_keywords = list(set(all_keywords))  # 去重

        card_data = {
            "card_id": "",  # 由外部填充
            "card_name": f"项目配置 - {input_data.get('project_background', '未命名')[:30]}",
            "level": "L1",
            "owner": "AI生成",
            "status": "draft",
            "tags": ["项目配置", "关键词策略"],
            "input_parameters": [
                {
                    "param_name": "project_background",
                    "data_type": "string",
                    "format": "-",
                    "is_required": True,
                    "default_value": "",
                    "description": input_data.get("project_background", ""),
                },
                {
                    "param_name": "target_audience",
                    "data_type": "string",
                    "format": "-",
                    "is_required": True,
                    "default_value": "",
                    "description": input_data.get("target_audience", ""),
                },
                {
                    "param_name": "seed_keywords",
                    "data_type": "array",
                    "format": "string[]",
                    "is_required": True,
                    "default_value": json.dumps(input_data.get("seed_keywords", [])),
                    "description": "种子关键词列表",
                },
                {
                    "param_name": "brand_names",
                    "data_type": "array",
                    "format": "string[]",
                    "is_required": False,
                    "default_value": json.dumps(input_data.get("brand_names", [])),
                    "description": "品牌名称列表",
                },
                {
                    "param_name": "competitor_brands",
                    "data_type": "array",
                    "format": "string[]",
                    "is_required": False,
                    "default_value": json.dumps(
                        input_data.get("competitor_brands", [])
                    ),
                    "description": "竞品品牌列表",
                },
            ],
            "upstream_data": [],  # P1 是起始，没有上游
            "outputs": [
                {
                    "output_id": "out_p1_config",
                    "output_name": "项目配置数据",
                    "output_mode": "single",
                    "storage_type": "SQLite",
                    "file_type": "JSON",
                    "volume_estimate": "1条/项目",
                    "directory_structure": "product_cards table",
                    "description": "包含项目配置、关键词策略、搜索策略的完整数据卡",
                    "fields": [
                        {
                            "field_name": "project_background",
                            "data_type": "string",
                            "description": "项目背景",
                        },
                        {
                            "field_name": "target_audience",
                            "data_type": "string",
                            "description": "目标人群",
                        },
                        {
                            "field_name": "unique_selling_points",
                            "data_type": "array",
                            "description": "核心卖点",
                        },
                        {
                            "field_name": "brand_keywords",
                            "data_type": "array",
                            "description": f"品牌关键词 ({len(keyword_suggestions.get('brand_keywords', []))}个)",
                        },
                        {
                            "field_name": "product_keywords",
                            "data_type": "array",
                            "description": f"产品型号关键词 ({len(keyword_suggestions.get('product_keywords', []))}个)",
                        },
                        {
                            "field_name": "category_keywords",
                            "data_type": "array",
                            "description": f"品类通用词 ({len(keyword_suggestions.get('category_keywords', []))}个)",
                        },
                        {
                            "field_name": "comparison_keywords",
                            "data_type": "array",
                            "description": f"对比词 ({len(keyword_suggestions.get('comparison_keywords', []))}个)",
                        },
                        {
                            "field_name": "scenario_keywords",
                            "data_type": "array",
                            "description": f"场景关键词 ({len(keyword_suggestions.get('scenario_keywords', []))}个)",
                        },
                        {
                            "field_name": "problem_keywords",
                            "data_type": "array",
                            "description": f"问题/痛点词 ({len(keyword_suggestions.get('problem_keywords', []))}个)",
                        },
                        {
                            "field_name": "recommended_subreddits",
                            "data_type": "array",
                            "description": f"推荐Subreddits ({len(subreddit_suggestions.get('high_relevance', []))}个)",
                        },
                        {
                            "field_name": "search_strategy",
                            "data_type": "object",
                            "description": "APIFY搜索策略配置",
                        },
                    ],
                }
            ],
            "downstream": [
                {
                    "target_id": "P2_scraping",
                    "target_name": "P2 内容抓取",
                    "relied_output_id": "out_p1_config",
                    "usage_description": "使用搜索策略和关键词配置进行 Reddit 数据抓取",
                    "contact_person": "系统",
                }
            ],
            "processing_logic": {
                "engine": "MiniMax AI",
                "architecture_desc": "三轮对话生成项目配置：1)关键词扩展 2)Subreddit推荐 3)搜索策略生成",
                "processing_steps": [
                    "1. 接收用户输入：项目背景、目标人群、种子关键词等",
                    "2. 第一轮对话：基于种子关键词扩展为6类关键词（品牌/产品/品类/对比/场景/问题）",
                    "3. 第二轮对话：基于目标人群和关键词推荐高/中相关度 Subreddits",
                    "4. 第三轮对话：整合信息生成 APIFY 搜索策略（搜索词、板块、时间范围等）",
                    "5. 构建标准化 Data Card JSON 输出",
                ],
                "manual_intervention": {
                    "is_required": True,
                    "trigger_condition": "AI生成的关键词或搜索策略不符合预期，或需要人工调整",
                    "intervention_steps": "1. 查看生成的关键词建议 2. 手动添加/删除关键词 3. 调整 Subreddit 推荐 4. 修改搜索策略参数 5. 确认后进入下一阶段",
                },
            },
            # 附加数据
            "generated_data": {
                "all_keywords": all_keywords,
                "brand_keywords": keyword_suggestions.get("brand_keywords", []),
                "product_keywords": keyword_suggestions.get("product_keywords", []),
                "category_keywords": keyword_suggestions.get("category_keywords", []),
                "comparison_keywords": keyword_suggestions.get(
                    "comparison_keywords", []
                ),
                "scenario_keywords": keyword_suggestions.get("scenario_keywords", []),
                "problem_keywords": keyword_suggestions.get("problem_keywords", []),
                "subreddit_suggestions": subreddit_suggestions,
                "search_strategy": search_strategy,
                "reasoning": keyword_suggestions.get("reasoning", ""),
            },
        }

        return card_data

    def _generate_fallback_keywords(self, seed_keywords: List[str]) -> Dict:
        """当 API 不可用时生成基础关键词建议"""
        brand = seed_keywords[:3] if seed_keywords else ["brand"]

        product = []
        for kw in seed_keywords[:2]:
            product.extend([f"{kw} 2", f"{kw} mini", f"{kw} pro"])
        if not product:
            product = ["product model"]

        category = ["best alternative", "top rated", "budget option"]

        comparison = []
        for kw in seed_keywords[:2]:
            comparison.append(f"{kw} vs")
        if not comparison:
            comparison = ["X vs Y"]

        scenario = []
        for kw in seed_keywords[:2]:
            scenario.extend([f"{kw} for daily use", f"{kw} for travel"])
        if not scenario:
            scenario = ["everyday use"]

        problem = []
        for kw in seed_keywords[:2]:
            problem.extend([f"{kw} not working", f"{kw} broken"])
        if not problem:
            problem = ["not working"]

        return {
            "brand_keywords": list(set(brand))[:5],
            "product_keywords": list(set(product))[:5],
            "category_keywords": list(set(category))[:5],
            "comparison_keywords": list(set(comparison))[:5],
            "scenario_keywords": list(set(scenario))[:5],
            "problem_keywords": list(set(problem))[:5],
            "reasoning": "基于种子关键词的基础扩展（API 不可用时使用）",
        }

    def _generate_fallback_subreddits(self, seed_keywords: List[str]) -> Dict:
        """当 API 不可用时生成基础 Subreddit 建议"""
        # 默认推荐
        defaults = [
            {
                "name": "headphones",
                "reason": "耳机讨论主社区",
                "estimated_posts": "daily",
            },
            {"name": "earbuds", "reason": "耳塞专门讨论区", "estimated_posts": "daily"},
            {"name": "audiophile", "reason": "音质发烧友", "estimated_posts": "daily"},
            {"name": "running", "reason": "运动场景", "estimated_posts": "daily"},
            {"name": "commuting", "reason": "通勤场景", "estimated_posts": "weekly"},
        ]

        return {
            "high_relevance": defaults[:3],
            "medium_relevance": defaults[3:],
            "reasoning": "默认推荐（API 不可用时使用）",
        }

    def _extract_keywords_from_text(self, text: str, seed_keywords: List[str]) -> Dict:
        """从文本中提取关键词（备用方法）"""
        lines = text.split("\n")
        keywords = []

        for line in lines:
            # 简单提取带引号的词或列表项
            if '"' in line or "'" in line:
                import re

                matches = re.findall(r'["\']([^"\']+)["\']', line)
                keywords.extend(matches)

        return {
            "brand_keywords": keywords[:6] if keywords else seed_keywords,
            "product_keywords": [],
            "category_keywords": [],
            "comparison_keywords": [],
            "scenario_keywords": [],
            "problem_keywords": [],
            "reasoning": "从文本中提取的关键词",
        }

    def _extract_subreddits_from_text(self, text: str) -> Dict:
        """从文本中提取 Subreddits（备用方法）"""
        import re

        # 匹配 r/subreddit 或 subreddit 格式
        matches = re.findall(r"r/(\w+)|^\s*(\w+)\s*$", text, re.MULTILINE)
        subreddits = [m[0] or m[1] for m in matches if m[0] or m[1]]

        subreddit_objs = [
            {"name": s, "reason": "AI推荐", "estimated_posts": "daily"}
            for s in subreddits[:8]
        ]

        return {
            "high_relevance": subreddit_objs[:5],
            "medium_relevance": subreddit_objs[5:],
            "reasoning": "从文本中提取的Subreddits",
        }

    def regenerate_keywords(self, input_data: Dict, feedback: str) -> Dict:
        """
        根据用户反馈重新生成关键词

        Args:
            input_data: 原始输入
            feedback: 用户反馈（如"需要更多运动相关关键词"）

        Returns:
            新的关键词建议
        """
        seed_keywords = input_data.get("seed_keywords", [])

        if not self.api_key:
            return self._generate_fallback_keywords(seed_keywords)

        try:
            import httpx

            prompt = f"""你是一个 Reddit 营销专家。用户有以下反馈，请重新生成关键词：

原始种子关键词: {", ".join(seed_keywords)}
用户反馈: {feedback}

请生成 6 类关键词，每类 5-8 个：
1. brand_keywords：品牌名和产品名
2. product_keywords：具体型号
3. category_keywords：品类通用词
4. comparison_keywords：对比词
5. scenario_keywords：使用场景词
6. problem_keywords：问题/痛点词

重要要求：请生成 Reddit 用户实际会搜索的口语化表达，而不是书面化的产品描述词。

请根据反馈调整关键词建议，以 JSON 格式输出：
{{
    "brand_keywords": ["..."],
    "product_keywords": ["..."],
    "category_keywords": ["..."],
    "comparison_keywords": ["..."],
    "scenario_keywords": ["..."],
    "problem_keywords": ["..."],
    "changes": "相比之前的改动说明"
}}"""

            response = httpx.post(
                self.api_url,
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={
                    "model": self.model,
                    "messages": [{"role": "user", "content": prompt}],
                },
                timeout=60.0,
            )

            if response.status_code == 200:
                result = response.json()
                content = (
                    result.get("choices", [{}])[0].get("message", {}).get("content", "")
                )

                try:
                    return json.loads(content)
                except:
                    return self._extract_keywords_from_text(content, seed_keywords)

        except Exception as e:
            logger.error(f"重新生成关键词失败: {e}")

        return self._generate_fallback_keywords(seed_keywords)
