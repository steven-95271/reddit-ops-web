/**
 * Reddit用户Profile分析模块
 * 用于分析标杆账号的写作风格和内容特征
 */

import { generateContent } from './minimax';

export interface ProfileAnalysis {
  username: string;
  profile_url: string;
  analysis_date: string;
  
  // 基础数据
  account_stats: {
    total_karma: number;
    post_karma: number;
    comment_karma: number;
    account_age_days: number;
    analyzed_posts_count: number;
    analyzed_comments_count: number;
  };
  
  // 语言风格分析（1-10分）
  language_style: {
    formality: number;      // 口语化(1) ←→ 正式(10)
    positivity: number;     // 消极(1) ←→ 积极(10)
    controversy: number;    // 温和(1) ←→ 尖锐(10)
    enthusiasm: number;     // 冷静(1) ←→ 热情(10)
  };
  
  // 内容特征
  content_features: {
    avg_post_length: number;           // 平均帖子长度（词数）
    avg_comment_length: number;        // 平均评论长度（词数）
    common_openers: string[];          // 最常用的3个开头句式
    common_phrases: string[];          // 最常用的5个短语/口头禅
    emoji_usage_frequency: number;     // 表情符号使用频率（0-1）
    shares_personal_experience: boolean; // 是否经常分享个人经历
    uses_data_or_facts: boolean;       // 是否经常引用数据/事实
    asks_questions: boolean;           // 是否经常提问
  };
  
  // 互动模式
  engagement_pattern: {
    reply_rate_estimate: number;       // 估计回复率（0-1）
    primary_interaction_style: string; // 主要互动方式
    post_to_comment_ratio: number;     // 发帖:评论比例
    top_active_subreddits: string[];   // 最常活跃的3个版块
  };
  
  // 品牌行为
  brand_behavior: {
    mentions_products: boolean;        // 是否提及产品
    recommendation_style: string;      // 推荐方式
    compares_products: boolean;        // 是否对比产品
    mentions_specific_brands: string[]; // 提及过的品牌
  };
  
  // 写作样本（用于生成时参考）
  writing_samples: {
    posts: string[];
    comments: string[];
  };
  
  // 可信度指标
  credibility_signals: string[];
}

export interface ScrapedUserContent {
  username: string;
  posts: {
    title: string;
    selftext: string;
    subreddit: string;
    score: number;
    created_utc: number;
  }[];
  comments: {
    body: string;
    subreddit: string;
    score: number;
    created_utc: number;
    parent_title?: string;
  }[];
}

/**
 * 解析Reddit Profile URL
 */
export function parseRedditProfileUrl(url: string): { username: string; is_valid: boolean } {
  // 支持的URL格式：
  // https://www.reddit.com/user/username
  // https://www.reddit.com/u/username
  // https://reddit.com/user/username/submitted/
  
  const patterns = [
    /reddit\.com\/(?:user|u)\/([^\/\?]+)/i,
    /reddit\.com\/(?:user|u)\/([^\/\?]+)\/(?:submitted|comments|overview)/i,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return { username: match[1], is_valid: true };
    }
  }
  
  return { username: '', is_valid: false };
}

/**
 * 抓取用户内容（使用Apify Reddit Scraper）
 * 注意：这是简化版本，实际应调用Apify Actor
 */
export async function scrapeUserContent(
  username: string,
  maxPosts: number = 20,
  maxComments: number = 30
): Promise<ScrapedUserContent> {
  // TODO: 实现实际的Apify抓取
  // 这里先返回模拟数据用于测试
  
  // 模拟数据示例
  return {
    username,
    posts: [
      {
        title: `Been using ${username}'s recommended setup for 3 months now`,
        selftext: `Just wanted to share my experience...`,
        subreddit: 'headphones',
        score: 245,
        created_utc: Date.now() / 1000 - 86400 * 7,
      },
    ],
    comments: [
      {
        body: `In my experience, the sound quality is actually better than expected...`,
        subreddit: 'headphones',
        score: 89,
        created_utc: Date.now() / 1000 - 86400 * 3,
      },
    ],
  };
}

/**
 * 使用MiniMax分析用户写作风格
 */
export async function analyzeWritingStyle(
  content: ScrapedUserContent
): Promise<Partial<ProfileAnalysis>> {
  const postsSample = content.posts.slice(0, 5).map(p => 
    `标题: ${p.title}\n内容: ${p.selftext?.substring(0, 300) || '(无正文)'}`
  ).join('\n\n---\n\n');
  
  const commentsSample = content.comments.slice(0, 10).map(c => 
    c.body.substring(0, 200)
  ).join('\n\n---\n\n');
  
  const systemPrompt = `你是Reddit内容分析专家。分析用户的写作风格和内容特征，输出JSON格式的分析报告。`;
  
  const userPrompt = `请分析Reddit用户 "${content.username}" 的写作风格：

【最近发帖样本】
${postsSample}

【最近评论样本】
${commentsSample}

请分析以下维度（输出JSON）：

1. language_style: 语言风格（1-10分）
   - formality: 正式度，口语化(1)到正式(10)
   - positivity: 情感倾向，消极(1)到积极(10)
   - controversy: 争议性，温和(1)到尖锐(10)
   - enthusiasm: 热情度，冷静(1)到热情(10)

2. content_features: 内容特征
   - avg_post_length: 平均帖子长度（估算词数）
   - avg_comment_length: 平均评论长度（估算词数）
   - common_openers: 最常用的3个开头句式
   - common_phrases: 最常用的5个口头禅/短语
   - emoji_usage_frequency: 表情符号使用频率(0-1)
   - shares_personal_experience: 是否经常分享个人经历(true/false)
   - uses_data_or_facts: 是否引用数据/事实(true/false)
   - asks_questions: 是否经常提问(true/false)

3. engagement_pattern: 互动模式
   - reply_rate_estimate: 估计回复率(0-1)
   - primary_interaction_style: 主要互动方式（"分享经验"/"提供建议"/"提问"/"辩论"/"幽默互动"）
   - post_to_comment_ratio: 发帖:评论比例估算(0.1-10)

4. brand_behavior: 品牌行为
   - mentions_products: 是否提及产品(true/false)
   - recommendation_style: 推荐方式（"直接点名"/"体验分享"/"对比分析"/"暗示"）
   - compares_products: 是否对比产品(true/false)

5. credibility_signals: 可信度建立方式（数组，如["分享个人经历", "提供具体数据", "长期使用体验"]）

输出严格的JSON格式。`;

  try {
    const analysisText = await generateContent(systemPrompt, userPrompt, 'MiniMax-Text-01');
    
    // 提取JSON部分
    const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('无法解析分析结果');
    }
    
    const analysis = JSON.parse(jsonMatch[0]);
    
    return {
      username: content.username,
      language_style: analysis.language_style,
      content_features: analysis.content_features,
      engagement_pattern: analysis.engagement_pattern,
      brand_behavior: analysis.brand_behavior,
      credibility_signals: analysis.credibility_signals,
      writing_samples: {
        posts: content.posts.slice(0, 3).map(p => p.selftext || p.title),
        comments: content.comments.slice(0, 5).map(c => c.body),
      },
    };
  } catch (error) {
    console.error('分析写作风格失败:', error);
    // 返回默认值
    return getDefaultAnalysis(content.username);
  }
}

/**
 * 完整的Profile分析流程
 */
export async function analyzeRedditProfile(
  profileUrl: string
): Promise<ProfileAnalysis> {
  // 1. 解析URL
  const { username, is_valid } = parseRedditProfileUrl(profileUrl);
  if (!is_valid) {
    throw new Error('无效的Reddit Profile URL');
  }
  
  // 2. 抓取用户内容
  const content = await scrapeUserContent(username, 20, 30);
  
  // 3. 分析写作风格
  const styleAnalysis = await analyzeWritingStyle(content);
  
  // 4. 计算账号统计
  const accountStats = {
    total_karma: content.posts.reduce((sum, p) => sum + p.score, 0) + 
                 content.comments.reduce((sum, c) => sum + c.score, 0),
    post_karma: content.posts.reduce((sum, p) => sum + p.score, 0),
    comment_karma: content.comments.reduce((sum, c) => sum + c.score, 0),
    account_age_days: 365, // TODO: 从Apify数据获取
    analyzed_posts_count: content.posts.length,
    analyzed_comments_count: content.comments.length,
  };
  
  // 5. 提取活跃版块
  const subredditCounts: Record<string, number> = {};
  [...content.posts, ...content.comments].forEach(item => {
    subredditCounts[item.subreddit] = (subredditCounts[item.subreddit] || 0) + 1;
  });
  const topSubreddits = Object.entries(subredditCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([sub]) => sub);
  
  // 6. 提取提及的品牌（简单关键词匹配）
  const allText = [
    ...content.posts.map(p => p.title + ' ' + (p.selftext || '')),
    ...content.comments.map(c => c.body),
  ].join(' ').toLowerCase();
  
  const brandKeywords = ['sony', 'bose', 'apple', 'samsung', 'xiaomi', 'huawei', 'audio-technica', 'sennheiser'];
  const mentionedBrands = brandKeywords.filter(brand => allText.includes(brand));
  
  return {
    username,
    profile_url: profileUrl,
    analysis_date: new Date().toISOString(),
    account_stats: accountStats,
    language_style: styleAnalysis.language_style || getDefaultLanguageStyle(),
    content_features: styleAnalysis.content_features || getDefaultContentFeatures(),
    engagement_pattern: {
      ...styleAnalysis.engagement_pattern,
      top_active_subreddits: topSubreddits,
    } as any,
    brand_behavior: {
      ...styleAnalysis.brand_behavior,
      mentions_specific_brands: mentionedBrands,
    } as any,
    writing_samples: styleAnalysis.writing_samples || { posts: [], comments: [] },
    credibility_signals: styleAnalysis.credibility_signals || ['分享个人经历'],
  };
}

function getDefaultAnalysis(username: string): Partial<ProfileAnalysis> {
  return {
    username,
    language_style: getDefaultLanguageStyle(),
    content_features: getDefaultContentFeatures(),
    engagement_pattern: {
      reply_rate_estimate: 0.5,
      primary_interaction_style: '分享经验',
      post_to_comment_ratio: 0.3,
      top_active_subreddits: [],
    },
    brand_behavior: {
      mentions_products: true,
      recommendation_style: '体验分享',
      compares_products: false,
      mentions_specific_brands: [],
    },
    credibility_signals: ['分享个人经历'],
    writing_samples: { posts: [], comments: [] },
  };
}

function getDefaultLanguageStyle() {
  return {
    formality: 4,
    positivity: 7,
    controversy: 5,
    enthusiasm: 6,
  };
}

function getDefaultContentFeatures() {
  return {
    avg_post_length: 250,
    avg_comment_length: 80,
    common_openers: ['I think', 'In my experience', 'Just wanted to'],
    common_phrases: ['to be honest', 'personally', 'from my perspective'],
    emoji_usage_frequency: 0.1,
    shares_personal_experience: true,
    uses_data_or_facts: false,
    asks_questions: true,
  };
}

/**
 * 计算两个人设之间的相似度
 */
export function calculatePersonaSimilarity(
  analysis1: ProfileAnalysis,
  analysis2: ProfileAnalysis
): number {
  // 基于语言风格和content features计算相似度
  const styleDiff = Math.abs(analysis1.language_style.formality - analysis2.language_style.formality) +
                   Math.abs(analysis1.language_style.positivity - analysis2.language_style.positivity) +
                   Math.abs(analysis1.language_style.enthusiasm - analysis2.language_style.enthusiasm);
  
  const styleSimilarity = 1 - (styleDiff / 30); // 归一化到0-1
  
  const lengthDiff = Math.abs(analysis1.content_features.avg_post_length - analysis2.content_features.avg_post_length) / 500;
  const lengthSimilarity = Math.max(0, 1 - lengthDiff);
  
  // 综合相似度
  return (styleSimilarity * 0.6 + lengthSimilarity * 0.4);
}
