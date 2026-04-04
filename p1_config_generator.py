"""
P1 Config Generator
P1 项目配置卡生成器
使用 MiniMax API 进行多轮对话生成关键词和搜索策略
"""

import json
import logging
from typing import Dict, List, Any, Optional

import config

logger = logging.getLogger(__name__)


# 品类模板配置
CATEGORY_TEMPLATES = {
    "consumer_electronics": {
        "keyword_emphasis": "重点生成 problem_keywords 和 comparison_keywords",
        "sort_default": "relevance",
        "time_default": "all",
        "subreddit_hints": "寻找产品名专属板块、BuyItForLife、gadgets 等",
    },
    "baby_and_kids": {
        "keyword_emphasis": "重点生成 scenario_keywords 和 problem_keywords",
        "sort_default": "relevance",
        "time_default": "all",
        "subreddit_hints": "parenting, daddit, Mommit, toddlers, BuyingForBaby 等育儿板块",
    },
    "saas_tool": {
        "keyword_emphasis": "重点生成 comparison_keywords 和 scenario_keywords",
        "sort_default": "top",
        "time_default": "year",
        "subreddit_hints": "SaaS, startups, Entrepreneur, 以及产品对应的垂直领域板块",
    },
    "general": {
        "keyword_emphasis": "均衡生成各类关键词",
        "sort_default": "relevance",
        "time_default": "year",
        "subreddit_hints": "根据产品描述推断相关板块",
    },
}


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
                'competitor_brands': ['竞品1', '竞品2'],
                'product_category': '可选：consumer_electronics/baby_and_kids/saas_tool/general'
            }

        Returns:
            Data Card JSON
        """
        # 步骤 0：判断品类
        category = self._detect_category(input_data)
        category_template = CATEGORY_TEMPLATES.get(
            category, CATEGORY_TEMPLATES["general"]
        )
        logger.info(f"P1: 检测到产品品类: {category}, 模板: {category_template}")

        # 将品类信息存入 input_data 供后续使用
        input_data["_detected_category"] = category
        input_data["_category_template"] = category_template

        # 第一轮对话：扩展种子关键词
        logger.info("P1: 开始第一轮对话 - 扩展种子关键词")
        keyword_suggestions = self._generate_keywords(input_data)

        # 第二轮对话：推荐 Subreddits
        logger.info("P1: 开始第二轮对话 - 推荐 Subreddits")
        subreddit_suggestions = self._generate_subreddits(
            input_data, keyword_suggestions
        )

        # 第三轮：生成 APIFY 搜索任务列表
        logger.info("P1: 开始第三轮对话 - 生成搜索任务列表")
        search_tasks = self._generate_search_strategy(
            input_data, keyword_suggestions, subreddit_suggestions
        )

        # 构建 Data Card
        card_data = self._build_data_card(
            input_data, keyword_suggestions, subreddit_suggestions, search_tasks
        )

        # 添加品类信息到输出
        card_data["detected_category"] = category
        card_data["category_template"] = category_template

        return card_data

    def _detect_category(self, input_data: Dict) -> str:
        """
        判断产品所属品类

        优先使用用户提供的 product_category，如果没有则通过 AI 判断
        """
        # 1. 检查用户是否已指定品类
        user_category = input_data.get("product_category", "")
        if user_category and user_category in CATEGORY_TEMPLATES:
            logger.info(f"P1: 用户使用指定品类: {user_category}")
            return user_category

        # 2. 如果没有 API key，返回通用模板
        if not self.api_key:
            logger.warning("P1: API key 不可用，使用通用品类模板")
            return "general"

        # 3. 使用 AI 判断品类
        try:
            import httpx

            project_context = input_data.get("project_background", "")
            seed_keywords_for_category = input_data.get("seed_keywords", [])

            prompt = f"""请根据以下产品信息，判断它最可能属于哪个品类：

项目背景: {project_context}
种子关键词: {", ".join(seed_keywords_for_category)}

可选品类：
- consumer_electronics: 消费电子产品（耳机、音箱、智能设备等）
- baby_and_kids: 母婴儿童产品（玩具、育儿用品、儿童教育产品等）
- saas_tool: SaaS 工具/软件（效率工具、营销软件、企业服务等）
- general: 通用/其他

请只返回品类名称（consumer_electronics/baby_and_kids/saas_tool/general），不要其他解释。"""

            response = httpx.post(
                self.api_url,
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={
                    "model": self.model,
                    "messages": [{"role": "user", "content": prompt}],
                },
                timeout=30.0,
            )

            if response.status_code == 200:
                result = response.json()
                content = (
                    result.get("choices", [{}])[0]
                    .get("message", {})
                    .get("content", "")
                    .strip()
                    .lower()
                )

                # 清理可能的额外字符
                for key in CATEGORY_TEMPLATES.keys():
                    if key in content:
                        logger.info(f"P1: AI 判断品类为: {key}")
                        return key

                logger.warning(f"P1: AI 返回无法识别的品类: {content}，使用通用模板")
                return "general"
            else:
                logger.warning(f"P1: 品类判断 API 调用失败: {response.status_code}")
                return "general"

        except Exception as e:
            logger.error(f"P1: 品类判断失败: {e}")
            return "general"

    def _generate_keywords(self, input_data: Dict) -> Dict:
        """第一轮：基于种子关键词生成扩展建议"""
        seed_keywords = input_data.get("seed_keywords", [])
        project_context = input_data.get("project_background", "")
        brand_names = input_data.get("brand_names", [])
        competitor_brands = input_data.get("competitor_brands", [])

        # 保存 competitor_brands 供 fallback 使用
        self._competitor_brands = competitor_brands

        # 获取品类模板信息
        category_template = input_data.get(
            "_category_template", CATEGORY_TEMPLATES["general"]
        )
        keyword_emphasis = category_template.get(
            "keyword_emphasis", "均衡生成各类关键词"
        )

        if not self.api_key:
            # 如果没有 API key，返回基础建议
            return self._generate_fallback_keywords(seed_keywords, competitor_brands)

        try:
            import httpx

            prompt = f"""你是一个 Reddit 营销专家。基于以下信息生成关键词建议：

项目背景: {project_context}
种子关键词: {", ".join(seed_keywords)}
品牌名称: {", ".join(brand_names)}
竞品品牌: {", ".join(competitor_brands)}

品类策略参考：{keyword_emphasis}

请生成 6 类关键词，每类 5-8 个：
1. brand_keywords：品牌名和产品名（如 toniebox, tonies）
2. product_keywords：具体型号（如 toniebox 2, yoto mini）
3. category_keywords：品类通用词（如 audio player for kids, toddler speaker）
4. comparison_keywords：对比词（如 toniebox vs yoto, best X vs Y）
5. scenario_keywords：使用场景词（如 bedtime routine toddler, screen-free toy）
6. problem_keywords：问题/痛点词（如 toniebox not charging, toniebox broken）

重要要求：
- 请生成 Reddit 用户实际会搜索的口语化表达，而不是书面化的产品描述词
- 参考品类策略，重点生成对应类型的关键词

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
                return self._generate_fallback_keywords(
                    seed_keywords, competitor_brands
                )

        except Exception as e:
            logger.error(f"关键词生成失败: {e}")
            return self._generate_fallback_keywords(seed_keywords, competitor_brands)

    def _generate_subreddits(self, input_data: Dict, keyword_suggestions: Dict) -> Dict:
        """第二轮：推荐 Subreddits"""
        seed_keywords = input_data.get("seed_keywords", [])
        target_audience = input_data.get("target_audience", "")

        # 获取品类模板信息
        category_template = input_data.get(
            "_category_template", CATEGORY_TEMPLATES["general"]
        )
        subreddit_hints = category_template.get(
            "subreddit_hints", "根据产品描述推断相关板块"
        )

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

板块推荐参考：{subreddit_hints}

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
    ) -> List[Dict]:
        """第三轮：生成 APIFY 搜索任务列表

        每个任务是一个独立的搜索配置，Apify Reddit Scraper 会单独运行每个任务。
        任务根据关键词类型有不同的优先级和配置。
        """
        search_tasks = []
        task_id = 0

        # 获取品类模板的默认配置
        category_template = input_data.get(
            "_category_template", CATEGORY_TEMPLATES["general"]
        )
        default_sort = category_template.get("sort_default", "relevance")
        default_time = category_template.get("time_default", "year")

        # 获取各类关键词
        brand_keywords = keyword_suggestions.get("brand_keywords", [])
        product_keywords = keyword_suggestions.get("product_keywords", [])
        comparison_keywords = keyword_suggestions.get("comparison_keywords", [])
        category_keywords = keyword_suggestions.get("category_keywords", [])
        scenario_keywords = keyword_suggestions.get("scenario_keywords", [])
        problem_keywords = keyword_suggestions.get("problem_keywords", [])

        # 获取推荐的 subreddits（用于品牌词额外任务）
        high_relevance = subreddit_suggestions.get("high_relevance", [])
        top_subreddits = [
            s.get("name", "") for s in high_relevance[:3] if s.get("name")
        ]

        # 1. brand_keywords: priority=1, max_posts=100, 使用品类默认 sort/time
        for kw in brand_keywords:
            task_id += 1
            search_tasks.append(
                {
                    "task_id": f"task_{task_id:03d}",
                    "query": kw,
                    "subreddit": "",
                    "sort_order": default_sort,
                    "time_filter": default_time,
                    "max_posts": 100,
                    "priority": 1,
                    "keyword_type": "brand",
                    "description": f"品牌词全站搜索: {kw}",
                }
            )

        # 2. product_keywords: priority=1, max_posts=100, 使用品类默认 sort/time
        for kw in product_keywords:
            task_id += 1
            search_tasks.append(
                {
                    "task_id": f"task_{task_id:03d}",
                    "query": kw,
                    "subreddit": "",
                    "sort_order": default_sort,
                    "time_filter": default_time,
                    "max_posts": 100,
                    "priority": 1,
                    "keyword_type": "product",
                    "description": f"产品型号全站搜索: {kw}",
                }
            )

        # 3. 对每个 brand_keyword，额外生成指定 subreddit 的任务（priority=3）
        for kw in brand_keywords[:3]:  # 限制前3个品牌词，避免任务过多
            for subreddit in top_subreddits:
                task_id += 1
                search_tasks.append(
                    {
                        "task_id": f"task_{task_id:03d}",
                        "query": kw,
                        "subreddit": subreddit,
                        "sort_order": default_sort,
                        "time_filter": default_time,
                        "max_posts": 50,
                        "priority": 3,
                        "keyword_type": "brand_subreddit",
                        "description": f"品牌词在 r/{subreddit} 搜索: {kw}",
                    }
                )

        # 4. comparison_keywords: priority=1, sort=top, time=year, max_posts=50
        for kw in comparison_keywords:
            task_id += 1
            search_tasks.append(
                {
                    "task_id": f"task_{task_id:03d}",
                    "query": kw,
                    "subreddit": "",
                    "sort_order": "top",
                    "time_filter": "year",
                    "max_posts": 50,
                    "priority": 1,
                    "keyword_type": "comparison",
                    "description": f"对比词高赞搜索: {kw}",
                }
            )

        # 5. category_keywords: priority=2, sort=top, time=year, max_posts=30
        for kw in category_keywords:
            task_id += 1
            search_tasks.append(
                {
                    "task_id": f"task_{task_id:03d}",
                    "query": kw,
                    "subreddit": "",
                    "sort_order": "top",
                    "time_filter": "year",
                    "max_posts": 30,
                    "priority": 2,
                    "keyword_type": "category",
                    "description": f"品类通用词搜索: {kw}",
                }
            )

        # 6. scenario_keywords: priority=2, sort=top, time=year, max_posts=30
        for kw in scenario_keywords:
            task_id += 1
            search_tasks.append(
                {
                    "task_id": f"task_{task_id:03d}",
                    "query": kw,
                    "subreddit": "",
                    "sort_order": "top",
                    "time_filter": "year",
                    "max_posts": 30,
                    "priority": 2,
                    "keyword_type": "scenario",
                    "description": f"场景词搜索: {kw}",
                }
            )

        # 7. problem_keywords: priority=2, 使用品类默认 sort/time, max_posts=30
        for kw in problem_keywords:
            task_id += 1
            search_tasks.append(
                {
                    "task_id": f"task_{task_id:03d}",
                    "query": kw,
                    "subreddit": "",
                    "sort_order": default_sort,
                    "time_filter": default_time,
                    "max_posts": 30,
                    "priority": 2,
                    "keyword_type": "problem",
                    "description": f"问题/痛点词搜索: {kw}",
                }
            )

        logger.info(f"生成了 {len(search_tasks)} 个搜索任务")
        return search_tasks

    def _build_data_card(
        self,
        input_data: Dict,
        keyword_suggestions: Dict,
        subreddit_suggestions: Dict,
        search_tasks: List[Dict],
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
                            "field_name": "search_tasks",
                            "data_type": "array",
                            "description": f"搜索任务列表 ({len(search_tasks)}个任务)",
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
                "search_tasks": search_tasks,
                "reasoning": keyword_suggestions.get("reasoning", ""),
            },
        }

        return card_data

    def _generate_fallback_keywords(
        self, seed_keywords: List[str], competitor_brands: Optional[List[str]] = None
    ) -> Dict:
        """当 API 不可用时生成基础关键词建议

        基于 seed_keywords 做简单扩展，使用通用模式：
        - 核心关键词：保持种子词完整，直接使用原始词组
        - 对比词：使用真实竞品品牌名进行对比
        - 品类词：使用种子词 + 品类通用修饰词
        """
        if not seed_keywords:
            seed_keywords = ["product"]
        if competitor_brands is None:
            competitor_brands = []

        # 1. brand_keywords: 直接使用原始种子关键词（保持词组完整）
        brand = seed_keywords[:3]

        # 2. product_keywords: 保持原始种子词，不做拆分
        # 只添加一些通用变体（如果种子词本身就是品牌+型号的组合，不应再添加 2/pro 等后缀）
        product = list(seed_keywords[:5])  # 直接使用原始种子词

        # 3. category_keywords: 种子词 + 品类通用词（保持种子词完整）
        category = []
        category_suffixes = [
            "review",
            "alternative",
            "worth it",
            "for kids",
            "audio player",
        ]
        for kw in seed_keywords[:5]:
            for suffix in category_suffixes:
                category.append(f"{kw} {suffix}")

        # 4. comparison_keywords: 使用真实竞品品牌名进行对比（如果种子词是词组，保持完整）
        comparison = []
        if competitor_brands:
            for kw in seed_keywords[:3]:
                for competitor in competitor_brands[:3]:
                    comparison.append(f"{kw} vs {competitor}")
        else:
            # 没有竞品时，生成通用对比模式
            for kw in seed_keywords[:3]:
                comparison.append(f"{kw} vs other")

        # 5. scenario_keywords: 保持种子词完整，添加通用场景词
        scenario = []
        scenario_suffixes = ["help", "advice", "experience", "tips", "recommendation"]
        for kw in seed_keywords[:5]:
            for suffix in scenario_suffixes:
                scenario.append(f"{kw} {suffix}")

        # 6. problem_keywords: 保持种子词完整，添加问题词
        problem = []
        problem_suffixes = ["problem", "issue", "not working", "broken", "review"]
        for kw in seed_keywords[:5]:
            for suffix in problem_suffixes:
                problem.append(f"{kw} {suffix}")

        return {
            "brand_keywords": list(set(brand))[:5],
            "product_keywords": list(set(product))[:6],
            "category_keywords": list(set(category))[:6],
            "comparison_keywords": list(set(comparison))[:5],
            "scenario_keywords": list(set(scenario))[:5],
            "problem_keywords": list(set(problem))[:6],
            "reasoning": "基于种子关键词和竞品生成的通用扩展，保持种子词完整，建议配置 API 后重新生成更精准的关键词",
        }

    def _generate_fallback_subreddits(self, seed_keywords: List[str]) -> Dict:
        """当 API 不可用时生成基础 Subreddit 建议"""
        # API 不可用时，不推荐任何具体板块
        # 将在 P2 阶段通过全站搜索自动发现相关板块
        return {
            "high_relevance": [],
            "medium_relevance": [],
            "reasoning": "API 不可用，无法推荐板块，将在 P2 阶段通过全站搜索自动发现相关板块",
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
        competitor_brands = input_data.get("competitor_brands", [])

        # 获取品类模板信息
        category_template = input_data.get(
            "_category_template", CATEGORY_TEMPLATES["general"]
        )
        keyword_emphasis = category_template.get(
            "keyword_emphasis", "均衡生成各类关键词"
        )

        if not self.api_key:
            return self._generate_fallback_keywords(seed_keywords, competitor_brands)

        try:
            import httpx

            prompt = f"""你是一个 Reddit 营销专家。用户有以下反馈，请重新生成关键词：

原始种子关键词: {", ".join(seed_keywords)}
用户反馈: {feedback}

品类策略参考：{keyword_emphasis}

请生成 6 类关键词，每类 5-8 个：
1. brand_keywords：品牌名和产品名
2. product_keywords：具体型号
3. category_keywords：品类通用词
4. comparison_keywords：对比词
5. scenario_keywords：使用场景词
6. problem_keywords：问题/痛点词

重要要求：
- 请生成 Reddit 用户实际会搜索的口语化表达，而不是书面化的产品描述词
- 参考品类策略，重点生成对应类型的关键词
- 根据用户反馈进行调整

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

        return self._generate_fallback_keywords(seed_keywords, competitor_brands)
