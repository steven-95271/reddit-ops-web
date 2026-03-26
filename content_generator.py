"""
Three-persona content generator using OpenAI API with template fallback.
"""
import uuid
import logging
import random
from datetime import datetime, timezone

import config
from data_manager import DataManager

logger = logging.getLogger(__name__)


class ContentGenerator:
    def __init__(self):
        self.dm = DataManager()
        self.has_openai = bool(config.OPENAI_API_KEY)
        if self.has_openai:
            try:
                from openai import OpenAI
                self.client = OpenAI(api_key=config.OPENAI_API_KEY)
                logger.info("OpenAI client initialized")
            except ImportError:
                self.has_openai = False
                logger.warning("openai package not installed, using template fallback")
        else:
            logger.info("No OPENAI_API_KEY, using template fallback")

    def generate(self, project: dict, candidates: list, date_str: str = None) -> list:
        """
        Generate persona-based content for top candidates.
        Returns list of generated content items.
        """
        import models
        
        if date_str is None:
            date_str = datetime.now().strftime("%Y-%m-%d")

        # Pick top candidates for content generation
        top_candidates = candidates[:min(len(candidates), 4)]
        if not top_candidates:
            logger.warning("No candidates to generate content from")
            return []

        project_id = project["id"]
        personas = models.get_personas(project_id)
        if not personas:
            logger.warning(f"No personas found for project {project_id}")
            return []

        all_content = []

        for persona in personas:
            persona_content = []
            # Each persona generates CONTENT_PER_PERSONA posts
            for i in range(config.CONTENT_PER_PERSONA):
                candidate = top_candidates[i % len(top_candidates)]
                try:
                    if self.has_openai:
                        item = self._generate_with_openai(project, persona, candidate)
                    else:
                        item = self._generate_from_template(project, persona, candidate)
                    pessoa_content_item = {
                        "id": str(uuid.uuid4()),
                        "persona_id": persona["id"],
                        "persona_name": persona["name"],
                        "persona_username": persona["username"],
                        "persona_emoji": persona["avatar_emoji"],
                        "persona_color": persona["avatar_color"],
                        "source_post_id": candidate["id"],
                        "source_post_title": candidate["title"],
                        "source_category": candidate.get("category", "E"),
                        "source_category_name": candidate.get("category_name", ""),
                        "title": item["title"],
                        "body": item["body"],
                        "tags": item.get("tags", []),
                        "platform": persona.get("platform", "Reddit"),
                        "status": "pending",
                        "generated_at": datetime.now(timezone.utc).isoformat(),
                        "method": "openai" if self.has_openai else "template",
                        "edited": False,
                    }
                    persona_content.append(pessoa_content_item)
                    logger.info(f"Generated content for {persona['name']} from post {candidate['id']}")
                except Exception as e:
                    logger.error(f"Failed to generate for {persona['name']}: {e}")

            all_content.extend(persona_content)

        # Save to file
        content_path = self.dm.get_content_path(project_id, date_str)
        self.dm.save_json(content_path, {
            "date": date_str,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "method": "openai" if self.has_openai else "template",
            "total_items": len(all_content),
            "content": all_content
        })

        logger.info(f"Generated {len(all_content)} content items for {date_str}")
        return all_content

    def _generate_with_openai(self, project: dict, persona: dict, candidate: dict) -> dict:
        """Generate content via OpenAI API."""
        prompt = self._build_prompt(project, persona, candidate)

        response = self.client.chat.completions.create(
            model=config.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": self._build_system_prompt(persona)},
                {"role": "user", "content": prompt}
            ],
            max_tokens=400,
            temperature=0.8,
        )

        raw = response.choices[0].message.content.strip()
        return self._parse_generated_text(raw, candidate)

    def _build_system_prompt(self, persona: dict) -> str:
        platform = persona.get("platform", "Reddit")
        return f"""You are {persona['name']}, a {platform} user/creator with this background:
{persona['background']}

Your writing style: {persona['writing_style']}
Your tone: {persona['tone']}
Your focus areas: {', '.join(persona['focus'])}

Write authentic {platform}-style posts (not promotional). First-person, conversational.
If {platform} is Twitter, keep it under 280 characters and concise. If Instagram, use appropriate spacing and hashtags.
ALWAYS respond in this exact format:
TITLE: [your post title here (or a short hook if Twitter)]
BODY: [your post body here]
TAGS: [tag1, tag2, tag3]"""

    def _build_prompt(self, project: dict, persona: dict, candidate: dict) -> str:
        background_info = project.get("background_info", "")
        project_context = f"\nPROJECT BACKGROUND:\n{background_info}\n" if background_info else ""
        platform = persona.get("platform", "Reddit")
        
        return f"""{project_context}Based on this trending Reddit post about our topic:

ORIGINAL POST: "{candidate['title']}"
CONTENT: "{candidate['selftext'][:300]}"
CATEGORY: {candidate.get('category_name_en', 'General')}
SUBREDDIT: r/{candidate.get('subreddit', 'headphones')}

Write a NEW {platform} post from your perspective as {persona['name']}.
Your angle: {persona.get('description_en', persona.get('description', ''))}
DO NOT copy the original post. Share YOUR unique perspective and experience adapted for {platform}'s audience and character limits."""

    def _generate_from_template(self, project: dict, persona: dict, candidate: dict) -> dict:
        """Template-based fallback content generation."""
        templates = CONTENT_TEMPLATES.get(persona["id"], {})
        category = candidate.get("category", "E")

        category_templates = templates.get(category, templates.get("default", []))
        if not category_templates:
            category_templates = DEFAULT_TEMPLATES

        template = random.choice(category_templates)
        title = template["title"].format(
            topic=project.get("search_query", config.SEARCH_QUERY),
            subreddit=candidate.get("subreddit", "general"),
        )
        body = template["body"].format(
            topic=project.get("search_query", config.SEARCH_QUERY),
            post_title=candidate["title"][:60],
        )

        return {
            "title": title,
            "body": body,
            "tags": template.get("tags", ["reddit", "discussion"])
        }

    def _parse_generated_text(self, raw: str, candidate: dict) -> dict:
        """Parse OpenAI response into structured dict."""
        title = ""
        body = ""
        tags = []

        lines = raw.split("\n")
        mode = None
        body_lines = []

        for line in lines:
            if line.startswith("TITLE:"):
                title = line.replace("TITLE:", "").strip()
                mode = "title"
            elif line.startswith("BODY:"):
                body_part = line.replace("BODY:", "").strip()
                if body_part:
                    body_lines.append(body_part)
                mode = "body"
            elif line.startswith("TAGS:"):
                tags_raw = line.replace("TAGS:", "").strip()
                tags = [t.strip().lstrip("#") for t in tags_raw.split(",")]
                mode = "tags"
            elif mode == "body" and line:
                body_lines.append(line)

        body = "\n".join(body_lines).strip()

        if not title:
            title = f"My thoughts"
        if not body:
            body = raw

        return {"title": title, "body": body, "tags": tags}


# ─────────────────────────────────────────────────────────────────────────────
# Template Library (fallback when no OpenAI key)
# ─────────────────────────────────────────────────────────────────────────────

CONTENT_TEMPLATES = {
    "sporty_runner": {
        "A": [
            {
                "title": "6 months of testing open ear earbuds for running – here's my verdict",
                "body": "Just wrapped up testing 3 different open ear earbuds for my marathon training. Here's what actually matters when you're logging 50+ miles a week.\n\nFit and stability is everything. I've lost earbuds on downhills before and it's the worst. Bone conduction stayed put 100% of the time.\n\nSound quality is secondary for me – I need situational awareness more than bass. Open ear wins here hands down. I can hear traffic, other runners, and trail conditions.\n\nBattery life: tested on a 3-hour long run. Still had charge at the end. Solid.",
                "tags": ["running", "earbuds", "marathon", "gearreview"]
            }
        ],
        "B": [
            {
                "title": "I finally fixed my open ear earbud slipping problem – here's how",
                "body": "After months of frustration with my open ear earbuds sliding during speed work, I finally figured it out.\n\nThe fix was surprisingly simple: I was wearing them wrong. Rotate the ear hook slightly forward before locking in. Sounds obvious but nobody told me this.\n\nAlso, don't put them on over a sweaty head – dry your hands first so they grip properly.\n\nHope this helps anyone else dealing with this issue!",
                "tags": ["running", "tips", "earbuds", "fitissue"]
            }
        ],
        "default": [
            {
                "title": "Running with open ear earbuds changed how I train",
                "body": "Three months into switching from regular earbuds to open ear and I'm not going back. The situational awareness alone makes every outdoor run safer and more enjoyable.\n\nI can hear my breathing, my footstrike, other runners approaching, and traffic – all while still enjoying my playlist.\n\nIf you run outdoors and haven't tried open ear yet, this is your sign.",
                "tags": ["running", "training", "earbuds", "outdoorrunning"]
            }
        ]
    },
    "audio_geek": {
        "A": [
            {
                "title": "Technical breakdown: Why open ear audio physics are more complex than you think",
                "body": "After measuring frequency response on several open ear earbuds, I want to share some observations that typical reviews miss.\n\nOpen ear transducers face a fundamental challenge: no acoustic seal means no bass reinforcement. Manufacturers compensate with DSP boosting below 200Hz, which introduces phase artifacts.\n\nBone conduction bypasses this entirely by transmitting vibration directly to the cochlea, but sacrifices soundstage width.\n\nFor reference: Shokz OpenRun Pro measures flat to about 4kHz before rapid rolloff. Perfectly adequate for speech and casual listening; poor for critical music evaluation.",
                "tags": ["audiophile", "acoustics", "openear", "measurements"]
            }
        ],
        "default": [
            {
                "title": "Objective analysis: Open ear earbuds for audiophiles",
                "body": "Let me give you the technical perspective on open ear earbuds since most reviews focus purely on lifestyle.\n\nThe physics are different from traditional transducers. Without an acoustic seal, you lose approximately 6-10dB of bass reinforcement. Manufacturers address this with digital signal processing.\n\nFor critical listening? No. For everything else? The technology has matured significantly in recent years and the convenience trade-offs make sense for many use cases.",
                "tags": ["audiophile", "technical", "earbuds", "audiotech"]
            }
        ]
    },
    "commuter_life": {
        "E": [
            {
                "title": "5 reasons open ear earbuds are the only choice for subway commuters",
                "body": "After 2 years of daily commuting, I've tried everything. Here's why I settled on open ear:\n\n1. **Hear announcements clearly** – no more missing your stop\n2. **Natural awareness** – people can actually get your attention\n3. **All-day comfort** – no ear fatigue on long commutes\n4. **No isolation anxiety** – I feel safer walking alone at night\n5. **Easy transitions** – from silent office to noisy subway without adjusting\n\nThe only downside: people can hear your audio if it's loud. Keep volume reasonable!",
                "tags": ["commuting", "productivity", "earbuds", "subwaylife"]
            }
        ],
        "default": [
            {
                "title": "My open ear earbud commute routine – what I've learned after 6 months",
                "body": "Six months of daily commuting with open ear earbuds. Here's my honest take:\n\n**What works:** Situational awareness is genuinely better. I've avoided awkward situations, heard important announcements, and stayed more alert.\n\n**What doesn't:** Sound quality in loud subway cars drops noticeably – outside noise bleeds in more than with sealed earbuds.\n\n**My verdict:** For commuters who prioritize safety and awareness over audio quality, it's worth it.",
                "tags": ["commuting", "worklifebalance", "earbuds", "dailyroutine"]
            }
        ]
    }
}

DEFAULT_TEMPLATES = [
    {
        "title": "Sharing my experience with {topic}",
        "body": "Just wanted to share my recent experience with {topic}. Saw a post about '{post_title}' and it got me thinking about my own journey with open ear audio.\n\nHonestly, the technology has come a long way. What are your thoughts?",
        "tags": ["earbuds", "audio", "community"]
    }
]
