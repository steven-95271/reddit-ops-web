"""
Keyword Advisor - AI-powered keyword and subreddit suggestion using MiniMax LLM
"""

import os
import json
import logging
from typing import List, Dict, Any, Optional
import requests

try:
    from PyPDF2 import PdfReader

    HAS_PDF = True
except ImportError:
    HAS_PDF = False

try:
    from docx import Document

    HAS_DOCX = True
except ImportError:
    HAS_DOCX = False

import config

logger = logging.getLogger(__name__)


class KeywordAdvisor:
    """
    AI advisor for generating Reddit search strategies using MiniMax LLM
    """

    def __init__(self):
        self.api_key = config.MINIMAX_API_KEY
        self.api_url = config.MINIMAX_API_URL
        self.model = config.MINIMAX_MODEL
        self.enabled = bool(self.api_key)

        if not self.enabled:
            logger.warning("MINIMAX_API_KEY not configured, keyword advisor disabled")

    def _call_minimax(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 2000,
    ) -> str:
        """
        Call MiniMax API for text generation
        """
        if not self.enabled:
            raise RuntimeError("MiniMax API not configured")

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        try:
            response = requests.post(
                self.api_url, headers=headers, json=payload, timeout=60
            )
            response.raise_for_status()

            data = response.json()
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            return content

        except requests.exceptions.RequestException as e:
            logger.error(f"MiniMax API call failed: {e}")
            raise RuntimeError(f"MiniMax API error: {e}")
        except (KeyError, IndexError) as e:
            logger.error(f"Failed to parse MiniMax response: {e}")
            raise RuntimeError(f"Invalid response from MiniMax: {e}")

    def suggest_from_keywords(
        self, seed_keywords: List[str], project_context: str = ""
    ) -> Dict[str, Any]:
        """
        Generate keyword suggestions based on seed keywords

        Args:
            seed_keywords: List of seed keywords provided by user
            project_context: Optional additional project background

        Returns:
            Dictionary with search_queries, subreddits, competitor_brands, etc.
        """
        if not self.enabled:
            return self._get_fallback_suggestions(seed_keywords)

        system_prompt = """You are an expert Reddit content operations and social media monitoring specialist. 
Your task is to recommend a comprehensive Reddit search monitoring strategy based on seed keywords.

Analyze the keywords and generate:
1. 10-20 English search queries suitable for Reddit search (covering product terms, use-case scenarios, pain points, comparisons, long-tail queries)
2. 5-15 most relevant subreddits with explanations
3. Competitor brands to monitor
4. Classification keywords for post categorization (review, pain_point, controversy, competitor, trend)

You must respond with a valid JSON object in this exact format:
{
  "search_queries": ["query1", "query2", ...],
  "subreddits": [
    {"name": "subreddit_name", "reason": "why relevant", "relevance": "high/medium/low"}
  ],
  "competitor_brands": ["brand1", "brand2", ...],
  "classification_keywords": {
    "review": ["keyword1", "keyword2"],
    "pain_point": ["keyword1", "keyword2"],
    "controversy": ["keyword1", "keyword2"],
    "competitor": ["keyword1", "keyword2"],
    "trend": ["keyword1", "keyword2"]
  },
  "reasoning": "Brief explanation of your recommendations"
}

Be strategic and comprehensive. Consider:
- Product category terms
- Use case scenarios (sports, commuting, work, etc.)
- Comparison queries (vs, best, top)
- Problem/pain point searches
- Trending/hot topic queries
- Community-specific terminology"""

        keywords_str = ", ".join(seed_keywords)
        user_prompt = f"""My seed keywords are: {keywords_str}

{project_context if project_context else ""}

Please provide your recommendations in the specified JSON format."""

        try:
            response = self._call_minimax(system_prompt, user_prompt)
            # Extract JSON from response (handle markdown code blocks)
            json_content = self._extract_json(response)
            suggestions = json.loads(json_content)

            # Validate structure
            self._validate_suggestions(suggestions)
            return suggestions

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse MiniMax response as JSON: {e}")
            logger.debug(f"Raw response: {response}")
            return self._get_fallback_suggestions(seed_keywords)
        except Exception as e:
            logger.error(f"Error in suggest_from_keywords: {e}")
            return self._get_fallback_suggestions(seed_keywords)

    def suggest_from_background(self, background_text: str) -> Dict[str, Any]:
        """
        Analyze project background and extract keyword strategy

        Args:
            background_text: Project background/brief text

        Returns:
            Dictionary with extracted info and recommendations
        """
        if not self.enabled:
            return self._get_fallback_suggestions(["product"])

        system_prompt = """You are a senior market research analyst specializing in extracting social media monitoring strategies from project briefs.

Analyze the provided project background and extract:
1. Product/service name and description
2. Target audience profile
3. Key selling points and value propositions
4. Recommended Reddit search queries (10-15)
5. Relevant subreddits to monitor (5-12)
6. Competitor brands mentioned or implied
7. Classification keywords for content categorization

You must respond with a valid JSON object:
{
  "extracted_info": {
    "product_name": "name",
    "product_category": "category",
    "target_audience": "description",
    "key_selling_points": ["point1", "point2"],
    "market_positioning": "description"
  },
  "search_queries": ["query1", "query2", ...],
  "subreddits": [
    {"name": "subreddit_name", "reason": "why relevant", "relevance": "high/medium"}
  ],
  "competitor_brands": ["brand1", "brand2", ...],
  "classification_keywords": {
    "review": [...],
    "pain_point": [...],
    "controversy": [...],
    "competitor": [...],
    "trend": [...]
  },
  "reasoning": "Analysis summary"
}

Be thorough and strategic. Consider both explicit mentions and implicit opportunities."""

        user_prompt = f"""Here is the project background information:

---
{background_text}
---

Please analyze this and provide your recommendations in the specified JSON format."""

        try:
            response = self._call_minimax(system_prompt, user_prompt)
            json_content = self._extract_json(response)
            suggestions = json.loads(json_content)

            self._validate_suggestions(suggestions)
            return suggestions

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse MiniMax response as JSON: {e}")
            return self._get_fallback_suggestions(["product"])
        except Exception as e:
            logger.error(f"Error in suggest_from_background: {e}")
            return self._get_fallback_suggestions(["product"])

    def parse_uploaded_file(self, file_path: str) -> str:
        """
        Parse uploaded file (PDF, DOCX, TXT) to text

        Args:
            file_path: Path to uploaded file

        Returns:
            Extracted text content
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")

        file_ext = os.path.splitext(file_path)[1].lower()

        if file_ext == ".pdf":
            return self._parse_pdf(file_path)
        elif file_ext == ".docx":
            return self._parse_docx(file_path)
        elif file_ext in [".txt", ".md", ".rst"]:
            with open(file_path, "r", encoding="utf-8") as f:
                return f.read()
        else:
            raise ValueError(f"Unsupported file format: {file_ext}")

    def _parse_pdf(self, file_path: str) -> str:
        """Extract text from PDF"""
        if not HAS_PDF:
            raise ImportError(
                "PyPDF2 is required for PDF parsing. Install: pip install PyPDF2"
            )

        try:
            reader = PdfReader(file_path)
            text = ""
            for page in reader.pages:
                text += page.extract_text() + "\n"
            return text.strip()
        except Exception as e:
            logger.error(f"PDF parsing failed: {e}")
            raise

    def _parse_docx(self, file_path: str) -> str:
        """Extract text from Word document"""
        if not HAS_DOCX:
            raise ImportError(
                "python-docx is required for DOCX parsing. Install: pip install python-docx"
            )

        try:
            doc = Document(file_path)
            text = "\n".join([paragraph.text for paragraph in doc.paragraphs])
            return text.strip()
        except Exception as e:
            logger.error(f"DOCX parsing failed: {e}")
            raise

    def _extract_json(self, text: str) -> str:
        """Extract JSON from text, handling markdown code blocks"""
        text = text.strip()

        # Try to find JSON in markdown code blocks
        if "```json" in text:
            start = text.find("```json") + 7
            end = text.find("```", start)
            if end != -1:
                return text[start:end].strip()
        elif "```" in text:
            start = text.find("```") + 3
            end = text.find("```", start)
            if end != -1:
                return text[start:end].strip()

        # Try to find JSON between braces
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1:
            return text[start : end + 1]

        return text

    def _validate_suggestions(self, suggestions: Dict[str, Any]) -> None:
        """Validate suggestion structure, add defaults if missing"""
        required_keys = ["search_queries", "subreddits"]
        for key in required_keys:
            if key not in suggestions:
                suggestions[key] = []

        # Ensure subreddits have the right structure
        if suggestions.get("subreddits"):
            for i, sub in enumerate(suggestions["subreddits"]):
                if isinstance(sub, str):
                    suggestions["subreddits"][i] = {
                        "name": sub,
                        "reason": "Recommended",
                        "relevance": "medium",
                    }

        # Ensure classification_keywords has all categories
        if "classification_keywords" not in suggestions:
            suggestions["classification_keywords"] = (
                self._get_default_classification_keywords()
            )

        for category in ["review", "pain_point", "controversy", "competitor", "trend"]:
            if category not in suggestions["classification_keywords"]:
                suggestions["classification_keywords"][category] = []

    def _get_fallback_suggestions(self, seed_keywords: List[str]) -> Dict[str, Any]:
        """Generate fallback suggestions when AI is unavailable"""
        base_query = " ".join(seed_keywords[:2]) if seed_keywords else "product"

        return {
            "search_queries": [
                base_query,
                f"best {base_query}",
                f"{base_query} review",
                f"{base_query} vs",
                f"{base_query} reddit",
            ],
            "subreddits": [
                {
                    "name": "headphones",
                    "reason": "Audio equipment discussion",
                    "relevance": "high",
                },
                {
                    "name": "BuyItForLife",
                    "reason": "Product recommendations",
                    "relevance": "medium",
                },
            ],
            "competitor_brands": [],
            "classification_keywords": self._get_default_classification_keywords(),
            "reasoning": "Fallback suggestions (AI service unavailable)",
        }

    def _get_default_classification_keywords(self) -> Dict[str, List[str]]:
        """Get default classification keywords"""
        return {
            "review": [
                "review",
                "comparison",
                "vs",
                "best",
                "recommend",
                "worth",
                "rating",
            ],
            "pain_point": [
                "problem",
                "issue",
                "hate",
                "annoying",
                "bad",
                "terrible",
                "worst",
            ],
            "controversy": [
                "overrated",
                "unpopular",
                "hot take",
                "controversial",
                "disagree",
            ],
            "competitor": ["alternative", "competitor", "compared to", "instead of"],
            "trend": [
                "trending",
                "popular",
                "viral",
                "love",
                "obsessed",
                "game changer",
            ],
        }


# Singleton instance for easy import
advisor = KeywordAdvisor()
