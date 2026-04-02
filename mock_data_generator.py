"""
Mock Data Generator
Mock 数据生成器
用于生成逼真的 Reddit 帖子数据供测试和演示
"""

import random
from datetime import datetime, timedelta
from typing import List, Dict, Optional


class MockDataGenerator:
    """Mock 数据生成器"""

    # 模拟帖子标题模板
    TITLE_TEMPLATES = {
        "headphones": [
            "Best {keyword} for {activity}?",
            "{keyword} vs Traditional Headphones - My Experience",
            "Looking for recommendations: {keyword} under ${price}",
            "{keyword} Review After {duration} of Use",
            "Is {brand} {keyword} worth it?",
            "Help me choose: {keyword} for {activity}",
            "{keyword} - Love them or Hate them?",
            "My {keyword} journey: From skeptic to believer",
            "What's your experience with {keyword}?",
            "{keyword} buying guide for beginners",
        ],
        "earbuds": [
            "{brand} {keyword} - Honest Review",
            "Best {keyword} for {activity} in {year}?",
            "{keyword} Comfort Test - {duration} wear",
            "Should I buy {keyword}? Pros and Cons",
            "{keyword} Sound Quality Comparison",
            "Budget {keyword} that surprised me",
            "{keyword} for commuting - Worth it?",
            "My top 3 {keyword} picks for {activity}",
            "{keyword} durability after {duration}",
            "Why I switched to {keyword}",
        ],
        "running": [
            "{keyword} for marathon training?",
            "Best audio setup for {activity}",
            "{keyword} staying power during long runs",
            "Sweat-proof {keyword} recommendations",
            "{keyword} vs nothing while running",
            "My {activity} gear includes {keyword}",
            "{keyword} for outdoor {activity}",
            "Running with {keyword} - Safety concerns?",
            "{keyword} battery life on long runs",
            "Trail running with {keyword} - Review",
        ],
        "general": [
            "Just got my {keyword} - Initial impressions",
            "{keyword} - Game changer or gimmick?",
            "Long-term {keyword} user here, AMA",
            "Comparing {brand1} vs {brand2} {keyword}",
            "{keyword} for daily use - My thoughts",
            "The truth about {keyword} marketing",
            "{keyword} alternatives worth considering",
            "Why {keyword} didn't work for me",
            "{keyword} hidden features you should know",
            "Final verdict: {keyword} after {duration}",
        ],
    }

    # 模拟帖子内容模板
    BODY_TEMPLATES = [
        "Hey everyone, I've been using {keyword} for {duration} now and wanted to share my experience...",
        "So I finally pulled the trigger on {keyword} after reading tons of reviews here...",
        "Long time lurker, first time poster. Been testing {keyword} and here's what I found...",
        "Wanted to get the community's thoughts on {keyword}. I've tried a few different models...",
        "After going through {count} different pairs, I think I've found the perfect {keyword}...",
        "Quick review of {keyword} - TL;DR at the bottom for the impatient...",
        "Been researching {keyword} for weeks and finally made a decision. Here's my journey...",
        "As someone who uses {keyword} for {activity} daily, I have some thoughts...",
        "Unpopular opinion: {keyword} are overrated. Here's why...",
        "Hot take: {keyword} changed how I experience {activity}. Let me explain...",
    ]

    # 模拟用户名
    USERNAME_PREFIXES = [
        "tech",
        "audio",
        "music",
        "run",
        "fit",
        "gym",
        "travel",
        "commute",
        "work",
        "game",
    ]
    USERNAME_SUFFIXES = [
        "lover",
        "fanatic",
        "enthusiast",
        "addict",
        "junkie",
        "geek",
        "nerd",
        "guy",
        "girl",
        "user",
    ]

    # 模拟品牌名
    BRANDS = [
        "Shokz",
        "Bose",
        "Sony",
        "Apple",
        "Jabra",
        "Samsung",
        "Anker",
        "Soundcore",
        "JBL",
        "Sennheiser",
        "AfterShokz",
    ]

    # 关键词
    KEYWORDS = [
        "open ear earbuds",
        "bone conduction",
        "sport headphones",
        "wireless earbuds",
        "bluetooth headphones",
        "running headphones",
        "workout earbuds",
    ]

    # 活动场景
    ACTIVITIES = [
        "running",
        "working out",
        "commuting",
        "working",
        "gaming",
        "hiking",
        "cycling",
        "yoga",
    ]

    # 价格范围
    PRICES = [50, 100, 150, 200, 250, 300, 400, 500]

    # 时间范围
    DURATIONS = [
        "1 week",
        "2 weeks",
        "1 month",
        "3 months",
        "6 months",
        "1 year",
        "2 years",
    ]

    def __init__(self):
        self.random_seed = None

    def generate_reddit_posts(
        self,
        subreddits: List[str],
        count: int = 87,
        keywords: Optional[List[str]] = None,
    ) -> List[Dict]:
        """
        生成模拟 Reddit 帖子

        Args:
            subreddits: 目标板块列表
            count: 生成数量
            keywords: 关键词列表

        Returns:
            帖子列表
        """
        posts = []
        keywords = keywords or self.KEYWORDS

        # 确保至少有一些帖子
        count = max(count, 20)

        for i in range(count):
            subreddit = (
                random.choice(subreddits)
                if subreddits
                else random.choice(["headphones", "earbuds", "running"])
            )
            post = self._generate_single_post(subreddit, keywords, i)
            posts.append(post)

        return posts

    def _generate_single_post(
        self, subreddit: str, keywords: List[str], index: int
    ) -> Dict:
        """生成单条帖子"""
        keyword = random.choice(keywords)
        brand = random.choice(self.BRANDS)
        activity = random.choice(self.ACTIVITIES)
        duration = random.choice(self.DURATIONS)
        price = random.choice(self.PRICES)

        # 选择标题模板
        if subreddit in self.TITLE_TEMPLATES:
            template = random.choice(self.TITLE_TEMPLATES[subreddit])
        else:
            template = random.choice(self.TITLE_TEMPLATES["general"])

        # 填充标题
        title = template.format(
            keyword=keyword,
            brand=brand,
            activity=activity,
            duration=duration,
            price=price,
            year=datetime.now().year,
            brand1=random.choice(self.BRANDS),
            brand2=random.choice(self.BRANDS),
            count=random.randint(3, 10),
        )

        # 生成内容
        body_template = random.choice(self.BODY_TEMPLATES)
        body = body_template.format(
            keyword=keyword,
            duration=duration,
            activity=activity,
            brand=brand,
            count=random.randint(3, 10),
        )

        # 添加更多内容段落
        body += self._generate_body_paragraphs(keyword, brand, activity)

        # 生成互动数据
        upvotes = self._generate_upvotes()
        comments = self._generate_comments(upvotes)

        # 生成时间戳（最近 7 天内）
        created_utc = self._generate_timestamp()

        # 生成 post_id
        post_id = f"t3_mock_{index:04d}_{random.randint(1000, 9999)}"

        return {
            "post_id": post_id,
            "title": title,
            "body": body,
            "author": self._generate_username(),
            "subreddit": subreddit,
            "upvotes": upvotes,
            "comments": comments,
            "upvote_ratio": round(random.uniform(0.7, 0.98), 2),
            "created_utc": created_utc,
            "url": f"https://reddit.com/r/{subreddit}/comments/{post_id[-6:]}/",
            "permalink": f"/r/{subreddit}/comments/{post_id[-6:]}/",
            "is_self": True,
            "num_comments": comments,
            "score": upvotes,
            "subreddit_subscribers": random.randint(10000, 1000000),
            "keyword": keyword,
            "brand_mentioned": brand if random.random() > 0.5 else None,
        }

    def _generate_body_paragraphs(self, keyword: str, brand: str, activity: str) -> str:
        """生成帖子正文段落"""
        paragraphs = [
            f"\n\nI've been using them mainly for {activity}, and they've been performing really well.",
            f"\n\nThe sound quality is {random.choice(['amazing', 'decent', 'okay', 'surprisingly good', 'disappointing'])}.",
            f"\n\nBattery life lasts about {random.randint(4, 12)} hours which is {random.choice(['great', 'adequate', 'not enough'])} for my needs.",
            f"\n\nCompared to my previous {random.choice(['Sony', 'Bose', 'Apple'])} setup, these are {random.choice(['much better', 'slightly better', 'about the same', 'worse'])}.",
            f"\n\nPros:\n- {random.choice(['Comfortable', 'Good sound', 'Long battery', 'Great value'])}\n- {random.choice(['Lightweight', 'Easy to pair', 'Stable connection', 'Good build quality'])}\n\nCons:\n- {random.choice(['Expensive', 'Average bass', 'Short cable', 'Bulky case'])}",
            f"\n\nWould I recommend them? {random.choice(['Absolutely!', 'Maybe', 'Depends on your use case', 'Not really'])}",
        ]

        # 随机选择 2-4 个段落
        selected = random.sample(paragraphs, random.randint(2, min(4, len(paragraphs))))
        return "".join(selected)

    def _generate_username(self) -> str:
        """生成用户名"""
        prefix = random.choice(self.USERNAME_PREFIXES)
        suffix = random.choice(self.USERNAME_SUFFIXES)
        number = random.randint(1, 9999)

        patterns = [
            f"{prefix}_{suffix}_{number}",
            f"{prefix}{suffix}{number}",
            f"{prefix}_{number}_{suffix}",
            f"{prefix}{number}",
            f"{prefix}_{suffix}",
        ]

        return random.choice(patterns)

    def _generate_upvotes(self) -> int:
        """生成点赞数（符合 Reddit 分布）"""
        # 使用幂律分布模拟
        r = random.random()
        if r < 0.5:
            return random.randint(5, 50)
        elif r < 0.8:
            return random.randint(50, 200)
        elif r < 0.95:
            return random.randint(200, 1000)
        else:
            return random.randint(1000, 5000)

    def _generate_comments(self, upvotes: int) -> int:
        """生成评论数（与点赞数相关）"""
        # 评论数通常是点赞数的 5-20%
        ratio = random.uniform(0.05, 0.20)
        comments = int(upvotes * ratio)
        return max(comments, random.randint(0, 5))  # 至少 0-5 条

    def _generate_timestamp(self) -> int:
        """生成时间戳（最近 7 天内）"""
        now = datetime.now()
        days_ago = random.randint(0, 7)
        hours_ago = random.randint(0, 23)
        minutes_ago = random.randint(0, 59)

        post_time = now - timedelta(days=days_ago, hours=hours_ago, minutes=minutes_ago)
        return int(post_time.timestamp())

    def generate_mock_dataset(self, scenario: str = "default") -> Dict:
        """
        生成完整的 Mock 数据集

        Args:
            scenario: 场景类型 (default/viral/mixed)

        Returns:
            {
                'posts': [...],
                'statistics': {...},
                'scenario': '...'
            }
        """
        if scenario == "viral":
            # 高互动场景
            posts = self._generate_viral_posts()
        elif scenario == "mixed":
            # 混合场景
            posts = self._generate_mixed_posts()
        else:
            # 默认场景
            posts = self.generate_reddit_posts(
                subreddits=["headphones", "earbuds", "running", "audiophile"], count=87
            )

        # 计算统计信息
        stats = self._calculate_statistics(posts)

        return {
            "posts": posts,
            "statistics": stats,
            "scenario": scenario,
            "generated_at": datetime.now().isoformat(),
            "is_mock": True,
        }

    def _generate_viral_posts(self) -> List[Dict]:
        """生成高互动帖子（模拟 viral 内容）"""
        posts = []

        # 生成一些高互动帖子
        for i in range(10):
            post = self._generate_single_post("headphones", ["open ear earbuds"], i)
            post["upvotes"] = random.randint(2000, 10000)
            post["comments"] = random.randint(200, 1000)
            posts.append(post)

        # 生成一些普通帖子
        normal_posts = self.generate_reddit_posts(
            subreddits=["headphones", "earbuds"], count=77
        )

        posts.extend(normal_posts)
        random.shuffle(posts)

        return posts

    def _generate_mixed_posts(self) -> List[Dict]:
        """生成混合场景帖子"""
        posts = []

        subreddits_config = {
            "headphones": 30,
            "earbuds": 25,
            "running": 15,
            "audiophile": 10,
            "commuting": 7,
        }

        for subreddit, count in subreddits_config.items():
            sub_posts = self.generate_reddit_posts(subreddits=[subreddit], count=count)
            posts.extend(sub_posts)

        random.shuffle(posts)
        return posts

    def _calculate_statistics(self, posts: List[Dict]) -> Dict:
        """计算统计信息"""
        if not posts:
            return {}

        total_posts = len(posts)
        total_upvotes = sum(p["upvotes"] for p in posts)
        total_comments = sum(p["comments"] for p in posts)

        # 按 subreddit 统计
        subreddit_counts = {}
        for post in posts:
            sub = post["subreddit"]
            subreddit_counts[sub] = subreddit_counts.get(sub, 0) + 1

        # 高互动帖子
        high_engagement = [p for p in posts if p["upvotes"] > 500]

        return {
            "total_posts": total_posts,
            "total_upvotes": total_upvotes,
            "total_comments": total_comments,
            "avg_upvotes": round(total_upvotes / total_posts, 2),
            "avg_comments": round(total_comments / total_posts, 2),
            "subreddit_breakdown": subreddit_counts,
            "high_engagement_posts": len(high_engagement),
            "engagement_rate": round((total_comments / total_upvotes) * 100, 2)
            if total_upvotes > 0
            else 0,
        }

    def generate_preview_data(self, count: int = 5) -> List[Dict]:
        """生成用于预览的少量数据"""
        return self.generate_reddit_posts(
            subreddits=["headphones", "earbuds"], count=count
        )
