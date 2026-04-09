/**
 * AI API Client
 * 主模型: Kimi moonshot-v1-8k
 * 备用模型: MiniMax-M2.7-Highspeed
 */

import {
  ExtractedProductInfo,
  KeywordCategories,
  KeywordItem,
  SubredditCategories,
  ApifySearchConfig,
} from '@/lib/types/p1';

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY;
const MINIMAX_API_URL = process.env.MINIMAX_API_URL || 'https://api.minimaxi.chat/v1/text/chatcompletion_v2';
const MINIMAX_MODEL = process.env.MINIMAX_MODEL || 'MiniMax-M2.7-Highspeed';

interface MiniMaxMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface MiniMaxResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

/**
 * 尝试调用 Kimi，失败时使用 MiniMax-M2.7-Highspeed
 */
async function callAIWithFallback(messages: MiniMaxMessage[]): Promise<string> {
  // Primary: Try Kimi
  console.log('Trying Kimi moonshot-v1-8k...');
  try {
    const result = await callKimi(messages);
    console.log('Kimi moonshot-v1-8k success');
    return result;
  } catch (error) {
    console.error('Kimi moonshot-v1-8k failed:', error);
  }

  // Fallback to MiniMax
  console.log('Falling back to MiniMax-M2.7-Highspeed...');
  try {
    if (!MINIMAX_API_KEY) {
      throw new Error('MINIMAX_API_KEY not configured');
    }
    const result = await callMiniMax(messages);
    console.log('MiniMax API success');
    return result;
  } catch (error) {
    console.error('MiniMax API also failed:', error);
    throw error;
  }
}

/**
 * 调用 MiniMax API
 */
async function callMiniMax(messages: MiniMaxMessage[]): Promise<string> {
  if (!MINIMAX_API_KEY) {
    throw new Error('MINIMAX_API_KEY not configured');
  }

  const response = await fetch(MINIMAX_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MINIMAX_API_KEY}`,
    },
    body: JSON.stringify({
      model: MINIMAX_MODEL,
      messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`MiniMax API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  console.log('[MiniMax raw response]:', JSON.stringify(data, null, 2));

  const message = data.choices?.[0]?.message || {};
  const content = message.content ||
                  message.reasoning_content ||
                  data.choices?.[0]?.text ||
                  data.output ||
                  data.result ||
                  data.text ||
                  '';

  if (!content) {
    console.error('[MiniMax Error] Invalid response structure:', JSON.stringify(data, null, 2));
    throw new Error(`MiniMax API returned invalid response structure. Response: ${JSON.stringify(data).substring(0, 500)}`);
  }

  return content;
}

/**
 * 调用 Kimi API (moonshot-v1-8k)
 */
async function callKimi(messages: MiniMaxMessage[]): Promise<string> {
  const KIMI_API_KEY = process.env.KIMI_API_KEY
  const KIMI_API_URL = 'https://api.moonshot.cn/v1/chat/completions'
  const KIMI_MODEL = 'moonshot-v1-8k'

  if (!KIMI_API_KEY) {
    throw new Error('KIMI_API_KEY not configured');
  }

  const response = await fetch(KIMI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${KIMI_API_KEY}`,
    },
    body: JSON.stringify({
      model: KIMI_MODEL,
      messages,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`Kimi API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log('[Kimi raw response]:', JSON.stringify(data, null, 2));

  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    console.error('[Kimi Error] Invalid response structure:', data);
    throw new Error('Kimi API returned invalid response structure');
  }

  return data.choices[0].message.content || '';
}

/**
 * Round 1: 分析产品描述，提取结构化信息
 * 支持：文字描述、网站内容、文件内容
 */
export async function analyzeProductWithAI(
  description: string
): Promise<ExtractedProductInfo> {
  // 检测是否包含网站内容
  const isWebsiteContent = description.includes('网站标题:') && description.includes('网站内容:');
  
  const sourceType = isWebsiteContent ? '网站内容' : '产品描述';
  
  const prompt = `你是一个产品分析专家。Based on the following ${sourceType}, extract structured product information:

${sourceType}:
${description}

请分析并提取以下信息（以 JSON 格式输出）:
{
    "productType": "产品类型（如：开放式耳机、SaaS工具、护肤品等）",
    "productName": "产品名称（包括品牌名，如果有）",
    "sellingPoints": ["核心卖点1", "核心卖点2", "核心卖点3"],
    "targetAudience": ["目标人群1", "目标人群2"],
    "competitors": ["竞品品牌1", "竞品品牌2", "竞品品牌3"],
    "priceRange": "价格区间（如：$99-$149，如果没有则不填）",
    "seedKeywords": ["产品名本身", "品牌名", "品类关键词1", "品类关键词2", "品类关键词3"]
}

Instructions:
1. 从${sourceType}中识别产品类型和关键特性
2. 提取所有提及的卖点（selling points）
3. 识别目标使用人群
4. 找出提到的或隐含的竞品品牌
5. 提取价格信息
6. **种子关键词生成规则**（非常重要）：
   - 第1个必须是"产品名+品牌名"组合（如 "Shokz OpenRun", "Oladance OWS"）
   - 第2个必须是品牌名本身（如 "Shokz", "Oladance"）
   - 后面3-5个是英文品类关键词（如 "open ear headphones", "bone conduction"）

注意：
- 如果是网站内容，请从网站页面标题、产品描述、功能介绍、关于我们等部分提取信息
- 如果某些信息无法确定，可以留空或填"未知"
- 种子关键词应该是英文，适合在 Reddit 上搜索`;

  try {
    console.log('[generateKeywordsWithAI] Full prompt being sent to AI:', prompt)
    const content = await callAIWithFallback([{ role: 'user', content: prompt }]);
    console.log('[generateKeywordsWithAI] Raw AI response:', content)
    
    try {
      const result = JSON.parse(content);
      return {
        productType: result.productType || '',
        productName: result.productName,
        sellingPoints: result.sellingPoints || [],
        targetAudience: result.targetAudience || [],
        competitors: result.competitors || [],
        priceRange: result.priceRange,
        seedKeywords: result.seedKeywords || [],
      };
    } catch {
      // 如果 JSON 解析失败，使用备用提取逻辑
      return extractProductInfoFromText(content, description);
    }
  } catch (error) {
    console.error('AI analysis failed:', error);
    // 返回基于描述的简单提取
    return fallbackProductExtraction(description);
  }
}

/**
 * 竞品推断：基于产品类型推断常见竞品品牌
 */
function inferCompetitorsByProductType(productType: string, existingCompetitors: string[]): string[] {
  if (existingCompetitors.length >= 3) return existingCompetitors.slice(0, 5);

  const type = productType.toLowerCase();
  const inferred: string[] = [];

  // 开放式耳机 / 骨传导耳机
  if (type.includes('open ear') || type.includes('骨传导') || type.includes('开放式') || type.includes('bone conduction')) {
    inferred.push('Shokz', 'Oladance', 'Bose', 'Sony', 'Aftershokz', 'Soundcore', 'JBL');
  }
  // 降噪耳机
  else if (type.includes('降噪') || type.includes('noise cancel')) {
    inferred.push('Sony WH-1000XM5', 'Bose QC45', 'AirPods Pro', 'Sennheiser', 'JBL');
  }
  // 运动耳机
  else if (type.includes('运动') || type.includes('sport') || type.includes('running')) {
    inferred.push('Shokz', 'Jaybird', 'Beats Fit Pro', 'Jabra Elite', 'Soundcore');
  }
  // TWS / 真无线耳机
  else if (type.includes('tws') || type.includes('真无线') || type.includes('wireless earbud')) {
    inferred.push('AirPods Pro', 'Sony WF-1000XM5', 'Samsung Galaxy Buds', 'Bose', 'Jabra');
  }
  // SaaS / 软件工具
  else if (type.includes('saas') || type.includes('软件') || type.includes('tool') || type.includes('platform')) {
    inferred.push('competitor alternative', 'vs comparison', 'best software');
  }
  // 护肤品 / 美妆
  else if (type.includes('护肤') || type.includes('skincare') || type.includes('beauty') || type.includes('cosmetic')) {
    inferred.push('CeraVe', 'The Ordinary', 'La Roche-Posay', 'Neutrogena', 'Olay');
  }
  // 健身 / 运动装备
  else if (type.includes('fitness') || type.includes('健身') || type.includes('workout')) {
    inferred.push('competitor review', 'best fitness gear', 'vs comparison');
  }
  // 默认：通用推断
  else {
    inferred.push('competitor alternative', 'vs comparison', 'best alternative');
  }

  // 合并已有竞品和推断竞品，去重
  const allCompetitors = Array.from(new Set([...existingCompetitors, ...inferred]));
  return allCompetitors.slice(0, 5);
}

/**
 * Round 1: 生成关键词扩展（多步推理策略）
 * 步骤1: 推断竞品品牌
 * 步骤2: 基于竞品生成对比词
 * 步骤3: 生成核心+长尾+场景词
 * 步骤4: 合并去重
 */
export async function generateKeywordsWithAI(
  productInfo: ExtractedProductInfo,
  feedback?: string
): Promise<KeywordCategories> {
  const feedbackSection = feedback ? `\n\n用户反馈: ${feedback}\n请根据用户反馈调整关键词生成策略。` : '';

  const competitors = inferCompetitorsByProductType(productInfo.productType, productInfo.competitors);
  const brandName = productInfo.productName || productInfo.seedKeywords?.[0] || 'this product';
  const shortBrand = productInfo.productName?.split(' ')[0] || brandName;

  const prompt = `你是一个 Reddit 营销专家和关键词研究专家。Based on the following product information, generate comprehensive keyword suggestions optimized for Reddit search behavior.

产品信息:
- 产品类型: ${productInfo.productType}
- 产品名称: ${productInfo.productName || 'N/A'}
- 品牌名/简称: ${shortBrand}
- 核心卖点: ${productInfo.sellingPoints?.join(', ') || 'N/A'}
- 目标人群: ${productInfo.targetAudience?.join(', ') || 'N/A'}
- 竞品品牌（已推断）: ${competitors.join(', ')}
- 种子关键词: ${productInfo.seedKeywords?.join(', ') || 'N/A'}${feedbackSection}

请生成以下5类关键词（以 JSON 格式输出）：
{
    "brand": ["品牌词1", "品牌词2", "品牌词3"],
    "brand_reasoning": "该阶段选词逻辑说明（中文，50字以内）",
    "category": ["品类词1", "品类词2", "品类词3"],
    "category_reasoning": "该阶段选词逻辑说明（中文，50字以内）",
    "comparison": ["对比词1", "对比词2", "对比词3"],
    "comparison_reasoning": "该阶段选词逻辑说明（中文，50字以内）",
    "scenario": ["场景词1", "场景词2", "场景词3"],
    "scenario_reasoning": "该阶段选词逻辑说明（中文，50字以内）",
    "overall_reasoning": "整体生成逻辑说明（中文，100字以内）"
}

**1. Brand Keywords (品牌核心词): 3-5个，宁缺毋滥**
- 每个词 1-3 个单词，不要超过 3 个单词
- 不要加 review、recommendation、worth it、best 等修饰词
- 不要加年份
- 示例: "Oladance OWS Pro", "Oladance earbuds", "Oladance headphones"
- 错误示例: "Oladance OWS Pro review 2026"（太长+有年份）
- 重要：产品型号词（如 "Oladance OWS Pro"）合并到此分类，不要单独分类

**2. Category Keywords (品类词): 3-5个**
- 每个词 2-3 个单词
- 示例: "open ear earbuds", "bone conduction headphones"
- 错误示例: "best open ear wireless earbuds recommendations"

**3. Comparison Keywords (竞品对比词): 4-6个**
- 每个词 2-4 个单词，不要超过 4 个单词
- 不要加年份
- 优先 "X vs Y" 格式
- 示例: "Shokz vs Oladance", "Soundcore alternative", "Shokz problems"
- 错误示例: "Shokz vs open ear earbuds 2026", "switched from Shokz to something else"

**4. Scenario Keywords (场景+痛点词): 5-8个**
- 每个词 2-4 个单词，绝对不超过 5 个单词
- 模拟 Reddit 用户真实搜索的短语，不是句子
- 示例: "earbuds fall out running", "headphones hurt ears", "open ear cycling safety"
- 错误示例: "headphones for marathon training don't fall out"（8词，句子）
- 错误示例: "earbuds that don't hurt after hours of use"（9词，句子）

**绝对禁止规则（违反任何一条则整个输出作废）**：
1. 任何关键词不得超过 5 个英文单词
2. 不得包含年份数字（2024/2025/2026等）
3. 不得包含 "that"、"which"、"don't"、"doesn't" 等连接词（这说明你在写句子而不是搜索词）
4. 种子关键词仅作为参考，不要逐个扩展。前1-2个种子词是核心，其余仅供理解产品定位

**强制规则**:
- Brand 品牌词不超过 3 个单词
- Category 品类词不超过 3 个单词
- Comparison 对比词不超过 4 个单词
- Scenario 场景痛点词绝对不超过 5 个单词
- 所有关键词用英文，匹配 Reddit 用户真实搜索习惯
- 不要生成重复或过于相似的关键词`;

  try {
    const content = await callAIWithFallback([{ role: 'user', content: prompt }]);
    
    try {
      const result = JSON.parse(content);
      const toKeywordItem = (kw: string, reason: string): KeywordItem => ({
        keyword: kw,
        reason: reason,
        wordCount: kw.split(' ').length,
      });
      
      // Product 分类已删除，合并到 brand 里
      const allBrandKeywords = [
        ...(result.brand || []),
        ...(result.product || []),
      ];
      
      const keywords: KeywordCategories = {
        brand: allBrandKeywords.map((k: string) => toKeywordItem(k, result.brand_reasoning || '')),
        product: [],
        category: (result.category || []).map((k: string) => toKeywordItem(k, result.category_reasoning || '')),
        comparison: (result.comparison || []).map((k: string) => toKeywordItem(k, result.comparison_reasoning || '')),
        scenario: (result.scenario || []).map((k: string) => toKeywordItem(k, result.scenario_reasoning || '')),
        problem: [],
        reasoning: result.overall_reasoning || result.reasoning || '',
      };

      if (keywords.comparison.length === 0) {
        console.warn('Comparison keywords empty, generating from inferred competitors');
        const fallbackCmp = generateComparisonKeywords(shortBrand, competitors);
        keywords.comparison = fallbackCmp.map(k => toKeywordItem(k, '从竞品推断生成'));
      }

      return keywords;
    } catch {
      return extractKeywordsFromText(content);
    }
  } catch (error) {
    console.error('[generateKeywordsWithAI] Error during AI call or parsing:', error);
    console.error('[generateKeywordsWithAI] Error details:', JSON.stringify(error, null, 2));
    return fallbackKeywordGeneration(productInfo);
  }
}

/**
 * 基于推断的竞品品牌生成对比关键词
 */
function generateComparisonKeywords(brandName: string, competitors: string[]): string[] {
  const keywords: string[] = [];
  
  for (const competitor of competitors.slice(0, 4)) {
    keywords.push(`${brandName} vs ${competitor}`);
    keywords.push(`${competitor} vs ${brandName}`);
  }
  
  keywords.push(`${brandName} alternative`);
  keywords.push(`best alternative to ${brandName}`);
  keywords.push(`${brandName} or ${competitors[0] || 'competitor'}`);
  
  return Array.from(new Set(keywords)).slice(0, 8);
}

/**
 * Round 2: 推荐 Subreddits 和 Filter Keywords
 */
export async function generateSubredditsWithAI(
  productInfo: ExtractedProductInfo,
  keywords: KeywordCategories,
  feedback?: string
): Promise<{ subreddits: SubredditCategories; filterKeywords: string[] }> {
  const feedbackSection = feedback ? `

用户反馈: ${feedback}
请根据用户反馈调整推荐策略。` : '';

  const allKeywords = [
    ...productInfo.seedKeywords,
    ...keywords.brand.map(k => k.keyword),
    ...keywords.category.map(k => k.keyword),
    ...keywords.scenario.map(k => k.keyword),
  ].slice(0, 15);

  const prompt = `你是一个 Reddit 社区专家。Based on the following information, recommend relevant Subreddits and filter keywords:

目标人群: ${productInfo.targetAudience.join(', ')}
相关关键词: ${allKeywords.join(', ')}
产品类型: ${productInfo.productType}${feedbackSection}

请推荐（以 JSON 格式输出）:
{
    "highRelevance": [
        {"name": "subreddit_name", "reason": "用中文写推荐理由，30-50字，说明为什么这个社区适合推广该产品。绝对不要用英文写 reason。", "estimatedPosts": "daily"}
    ],
    "mediumRelevance": [
        {"name": "subreddit_name", "reason": "用中文写推荐理由，30-50字，说明为什么这个社区适合推广该产品。绝对不要用英文写 reason。", "estimatedPosts": "daily/weekly"}
    ],
    "filterKeywords": ["filter1", "filter2", "filter3", "filter4", "filter5"]
}

Requirements:
1. High Relevance Subreddits (高相关度): 5-8个，直接相关的板块，如 headphones, running
2. Medium Relevance Subreddits (中相关度): 3-5个，间接相关的板块，如 gadgets, audiophile
3. Filter Keywords: 5-10个用于过滤帖子内容的关键词，如 "comfortable", "review", "running", "workout", "vs", "comparison"

重要提醒：所有 reason 字段必须使用中文撰写，如果你写了英文，整个输出作废。

注意事项:
- Subreddit names should NOT include "r/" prefix
- estimatedPosts should be "daily" or "weekly"
- Filter keywords help ensure content relevance for scraping`;

  try {
    const content = await callAIWithFallback([{ role: 'user', content: prompt }]);
    
    try {
      const result = JSON.parse(content);
      return {
        subreddits: {
          high: result.highRelevance || result.high_relevance || [],
          medium: result.mediumRelevance || result.medium_relevance || [],
        },
        filterKeywords: result.filterKeywords || [],
      };
    } catch {
      return extractSubredditsFromText(content);
    }
  } catch (error) {
    console.error('Subreddit generation failed:', error);
    return fallbackSubredditGeneration();
  }
}

/**
 * Round 3: 生成 APIFY 搜索策略
 */
export async function generateSearchStrategyWithAI(
  productInfo: ExtractedProductInfo,
  keywords: KeywordCategories,
  subreddits: SubredditCategories,
  filterKeywords: string[],
  feedback?: string
): Promise<ApifySearchConfig> {
  const feedbackSection = feedback ? `

用户反馈: ${feedback}
请根据用户反馈调整搜索策略。` : '';

  const highRelevanceSubreddits = subreddits.high.map(s => s.name).slice(0, 5);
  const allKeywords = [
    ...keywords.brand.slice(0, 3),
    ...keywords.category.slice(0, 2),
  ];

  const prompt = `你是一个 APIFY 搜索策略专家。Based on the following information, generate a comprehensive Reddit scraping strategy:

产品信息:
- 类型: ${productInfo.productType}
- 竞品: ${productInfo.competitors.join(', ')}
- 品牌关键词: ${keywords.brand.join(', ')}
- 品类关键词: ${keywords.category.join(', ')}
- 场景关键词: ${keywords.scenario.join(', ')}
- 高相关Subreddits: ${highRelevanceSubreddits.join(', ')}
- Filter Keywords: ${filterKeywords.join(', ')}${feedbackSection}

请生成 APIFY 配置（以 JSON 格式输出）:
{
    "searches": [
        {
            "searchQuery": "搜索词",
            "searchSubreddit": "板块名",
            "filterKeywords": ["filter1", "filter2"],
            "sortOrder": "relevance|hot|top|new",
            "timeFilter": "hour|day|week|month|year|all",
            "maxPosts": 100
        }
    ],
    "comments": {
        "includeComments": true,
        "maxCommentsPerPost": 30,
        "commentDepth": 3
    },
    "filtering": {
        "deduplicatePosts": true,
        "keywordMatchMode": "title + body"
    }
}

Requirements:
1. Generate 4-6 search tasks with different combinations of keywords and subreddits
2. Each search task should have 2-4 relevant filter keywords
3. Vary timeFilter and maxPosts based on search type:
   - Core product searches: timeFilter="week", maxPosts=100
   - Competitor comparison: timeFilter="month", maxPosts=50
   - Technical discussions: sortOrder="hot", maxPosts=60
4. Include comments configuration (30 comments per post, depth 3)
5. Enable deduplication and keyword matching in title+body

Example search tasks:
- Task 1: "open ear earbuds" + headphones + [comfortable, review]
- Task 2: "running headphones" + running + [workout, comfortable]
- Task 3: "Shokz vs Oladance" + headphones + [comparison, vs]`;

  try {
    const content = await callAIWithFallback([{ role: 'user', content: prompt }]);
    
    try {
      const result = JSON.parse(content);
      return {
        searches: result.searches || [],
        comments: result.comments || {
          includeComments: true,
          maxCommentsPerPost: 30,
          commentDepth: 3,
        },
        filtering: result.filtering || {
          deduplicatePosts: true,
          keywordMatchMode: 'title + body',
        },
      };
    } catch {
      return fallbackSearchStrategy(productInfo, keywords, subreddits);
    }
  } catch (error) {
    console.error('Search strategy generation failed:', error);
    return fallbackSearchStrategy(productInfo, keywords, subreddits);
  }
}

// Helper functions for fallback extraction

function extractProductInfoFromText(text: string, originalDescription: string): ExtractedProductInfo {
  // Simple regex-based extraction as fallback
  const productTypeMatch = text.match(/productType["']?\s*:\s*["']([^"']+)["']/);
  const seedKeywords: string[] = [];
  
  // Extract English words that look like keywords
  const words = originalDescription.match(/\b[a-zA-Z]{3,}\b/g) || [];
  const uniqueWords = Array.from(new Set(words)).slice(0, 5);
  
  return {
    productType: productTypeMatch?.[1] || 'Product',
    sellingPoints: [],
    targetAudience: [],
    competitors: [],
    seedKeywords: uniqueWords.length > 0 ? uniqueWords : ['product', 'review'],
  };
}

function fallbackProductExtraction(description: string): ExtractedProductInfo {
  const words = description.toLowerCase().match(/\b[a-zA-Z]{4,}\b/g) || [];
  const uniqueWords = Array.from(new Set(words)).slice(0, 5);
  
  return {
    productType: 'Product',
    sellingPoints: [],
    targetAudience: [],
    competitors: [],
    seedKeywords: uniqueWords.length > 0 ? uniqueWords : ['product', 'review', 'best'],
  };
}

function extractKeywordsFromText(text: string): KeywordCategories {
  const matches = text.match(/["']([^"']+)["']/g) || [];
  const keywords = matches.map(m => m.replace(/["']/g, '')).filter(k => k.length > 2);
  
  const toKeywordItem = (kw: string): KeywordItem => ({
    keyword: kw,
    reason: '从AI输出提取',
    wordCount: kw.split(' ').length,
  });
  
  return {
    brand: keywords.slice(0, 5).map(toKeywordItem),
    product: [],
    category: keywords.slice(5, 10).map(toKeywordItem),
    comparison: keywords.slice(10, 15).map(toKeywordItem),
    scenario: keywords.slice(15, 20).map(toKeywordItem),
    problem: [],
  };
}

function fallbackKeywordGeneration(productInfo: ExtractedProductInfo): KeywordCategories {
  const seedKeywords = productInfo.seedKeywords;
  const brandItems: KeywordItem[] = seedKeywords.slice(0, 5).map(kw => ({
    keyword: kw,
    reason: '种子关键词',
    wordCount: kw.split(' ').length,
  }));
  
  const productStrings: string[] = [];
  const categoryStrings: string[] = [];
  const scenarioStrings: string[] = [];
  const problemStrings: string[] = [];
  
  const competitors = inferCompetitorsByProductType(productInfo.productType, productInfo.competitors);
  const brandName = productInfo.productName || seedKeywords[0] || 'product';
  const shortBrand = brandName.split(' ')[0];
  
  for (const kw of seedKeywords.slice(0, 5)) {
    productStrings.push(`${kw} 2`, `${kw} pro`);
    categoryStrings.push(`best ${kw}`, `${kw} review`, `${kw} worth it`, `${kw} alternative`);
    scenarioStrings.push(`${kw} help`, `${kw} advice`, `${kw} experience`);
    problemStrings.push(`${kw} problem`, `${kw} issue`, `${kw} not working`);
  }
  
  const comparisonStrings = generateComparisonKeywords(shortBrand, competitors);
  
  const toKeywordItem = (kw: string, reason: string): KeywordItem => ({
    keyword: kw,
    reason,
    wordCount: kw.split(' ').length,
  });
  
  return {
    brand: brandItems.length > 0 ? brandItems : [toKeywordItem('product', '默认关键词')],
    product: Array.from(new Set(productStrings)).slice(0, 6).map(kw => toKeywordItem(kw, '生成型号词')),
    category: Array.from(new Set(categoryStrings)).slice(0, 6).map(kw => toKeywordItem(kw, '生成品类词')),
    comparison: comparisonStrings.length > 0 
      ? comparisonStrings.map(kw => toKeywordItem(kw, '推断竞品生成'))
      : [`${shortBrand} alternative`, `${shortBrand} vs`, `best ${shortBrand} alternative`].map(kw => toKeywordItem(kw, '推断竞品生成')),
    scenario: Array.from(new Set(scenarioStrings)).slice(0, 6).map(kw => toKeywordItem(kw, '生成场景词')),
    problem: Array.from(new Set(problemStrings)).slice(0, 6).map(kw => toKeywordItem(kw, '生成问题词')),
  };
}

function extractSubredditsFromText(text: string): { subreddits: SubredditCategories; filterKeywords: string[] } {
  const subredditMatches = text.match(/r\/(\w+)|["'](\w+)["']/g) || [];
  const subreddits = subredditMatches
    .map(m => m.replace(/r\//, '').replace(/["']/g, ''))
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 8);
  
  return {
    subreddits: {
      high: subreddits.slice(0, 4).map(name => ({ name, reason: 'AI推荐', estimatedPosts: 'daily' as const })),
      medium: subreddits.slice(4).map(name => ({ name, reason: 'AI推荐', estimatedPosts: 'weekly' as const })),
    },
    filterKeywords: ['review', 'best', 'vs'],
  };
}

function fallbackSubredditGeneration(): { subreddits: SubredditCategories; filterKeywords: string[] } {
  return {
    subreddits: {
      high: [
        { name: 'headphones', reason: '耳机讨论主社区', estimatedPosts: 'daily' },
        { name: 'running', reason: '运动场景', estimatedPosts: 'daily' },
        { name: 'earbuds', reason: '耳塞专门讨论区', estimatedPosts: 'daily' },
      ],
      medium: [
        { name: 'gadgets', reason: '科技产品讨论', estimatedPosts: 'daily' },
        { name: 'audiophile', reason: '音质发烧友', estimatedPosts: 'daily' },
      ],
    },
    filterKeywords: ['review', 'comfortable', 'best'],
  };
}

function fallbackSearchStrategy(
  productInfo: ExtractedProductInfo,
  keywords: KeywordCategories,
  subreddits: SubredditCategories
): ApifySearchConfig {
  const highSubreddits = subreddits.high.map(s => s.name).slice(0, 3);
  const brandKws = keywords.brand.map(k => k.keyword).slice(0, 3);
  
  return {
    searches: [
      {
        searchQuery: brandKws[0] || 'product',
        searchSubreddit: highSubreddits[0] || 'headphones',
        filterKeywords: ['review', 'best'],
        sortOrder: 'relevance',
        timeFilter: 'week',
        maxPosts: 100,
      },
      {
        searchQuery: brandKws[1] || brandKws[0] || 'product review',
        searchSubreddit: highSubreddits[1] || highSubreddits[0] || 'headphones',
        filterKeywords: ['comparison', 'vs'],
        sortOrder: 'relevance',
        timeFilter: 'month',
        maxPosts: 50,
      },
    ],
    comments: {
      includeComments: true,
      maxCommentsPerPost: 30,
      commentDepth: 3,
    },
    filtering: {
      deduplicatePosts: true,
      keywordMatchMode: 'title + body',
    },
  };
}