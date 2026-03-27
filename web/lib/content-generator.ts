/**
 * 双轨内容生成器
 * 支持发帖（Post）和评论（Comment）两种内容类型的生成
 */

import { generateContent } from './minimax';
import { GeneratedPersona } from './persona-generator';

export interface SourceContent {
  id: string;
  title: string;
  selftext: string;
  subreddit: string;
  score: number;
  url?: string;
  created_utc?: number;
}

export interface CommentContext {
  postTitle: string;
  postBody: string;
  postSubreddit: string;
  existingComments: {
    author: string;
    body: string;
    score: number;
  }[];
  targetCommentIndex?: number;  // 要回复的评论索引
}

export interface GeneratedPost {
  title: string;
  body: string;
  suggested_flair?: string;
  suggested_subreddit?: string;
  hashtags?: string[];
  brand_mention_score: number;  // 0-1，品牌提及程度
  authenticity_score: number;   // 0-1，真实度评分
  generation_metadata: {
    model: string;
    temperature: number;
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

export interface GeneratedComment {
  body: string;
  tone: 'agree' | 'neutral' | 'disagree' | 'humorous';
  brand_mention_score: number;
  authenticity_score: number;
  reply_to?: string;  // 回复给哪个用户
  generation_metadata: {
    model: string;
    temperature: number;
  };
}

export interface ContentGenerationOptions {
  enforce_brand_mention?: boolean;  // 是否强制提及品牌
  max_length?: number;              // 最大长度限制
  min_length?: number;              // 最小长度限制
  creativity_level?: 'conservative' | 'balanced' | 'creative';  // 创意程度
}

// ============================================
// 发帖内容生成（Post Generation）
// ============================================

export async function generatePost(
  persona: GeneratedPersona,
  sourceContent: SourceContent,
  projectInfo: {
    product_name: string;
    key_benefits: string[];
    use_cases: string[];
  },
  options: ContentGenerationOptions = {}
): Promise<GeneratedPost> {
  const strategy = persona.content_strategy.post;
  const brandRules = persona.content_strategy.comment.brand_mention_rules;
  
  // 构建System Prompt
  const systemPrompt = buildPostSystemPrompt(persona);
  
  // 构建User Prompt
  const userPrompt = buildPostUserPrompt(
    persona,
    sourceContent,
    projectInfo,
    options.enforce_brand_mention || false
  );
  
  // 设置生成参数
  const temperature = persona.generation_config.temperature;
  const maxTokens = persona.generation_config.max_tokens_post;
  
  try {
    const response = await generateContent(systemPrompt, userPrompt, 'MiniMax-M2.5');
    
    // 解析生成的内容
    const parsed = parseGeneratedPost(response);
    
    // 计算品牌提及分数
    const brandMentionScore = calculateBrandMentionScore(
      parsed.title + ' ' + parsed.body,
      projectInfo.product_name
    );
    
    // 计算真实度分数（基于人设匹配度）
    const authenticityScore = calculateAuthenticityScore(parsed, persona);
    
    return {
      ...parsed,
      brand_mention_score: brandMentionScore,
      authenticity_score: authenticityScore,
      generation_metadata: {
        model: 'MiniMax-M2.5',
        temperature,
      },
    };
  } catch (error) {
    console.error('生成发帖内容失败:', error);
    throw error;
  }
}

function buildPostSystemPrompt(persona: GeneratedPersona): string {
  const style = persona.content_strategy.post.style_config;
  
  return `你是${persona.name}（${persona.username}），一个${persona.description}。

【背景故事】
${persona.background}

【写作风格】
- 语气：${style.tone === 'casual' ? '轻松随意，像朋友聊天' : 
         style.tone === 'enthusiastic' ? '热情积极，充满激情' :
         style.tone === 'analytical' ? '理性客观，注重分析' :
         style.tone === 'skeptical' ? '谨慎质疑，追求真相' :
         style.tone === 'humorous' ? '幽默风趣，喜欢开玩笑' : '自然真实'}
- 平均长度：${style.avg_length === 'short' ? '简短精悍（100-200词）' :
             style.avg_length === 'medium' ? '中等长度（200-400词）' : '详细深入（400-700词）'}
- 表情使用：${style.emoji_usage === 'none' ? '不使用表情' :
              style.emoji_usage === 'minimal' ? '极少使用表情' :
              style.emoji_usage === 'moderate' ? '适度使用表情' : '大量使用表情'}
- 开头方式：${style.hook_style === 'personal_story' ? '以个人经历开头' :
              style.hook_style === 'provocative_question' ? '以引人思考的问题开头' :
              style.hook_style === 'data_point' ? '以数据或事实开头' : '以争议性观点开头'}

【身份约束】
1. 你是一个真实的Reddit用户，不是营销号
2. 使用第一人称"我"，分享真实的个人体验
3. 偶尔提到日常生活细节，增加可信度
4. 可以表达不确定性和困惑，显得更真实
5. 避免过度完美的描述，适当提及小缺点

输出格式：JSON，包含title、body、suggested_flair字段`;
}

function buildPostUserPrompt(
  persona: GeneratedPersona,
  source: SourceContent,
  projectInfo: { product_name: string; key_benefits: string[]; use_cases: string[] },
  enforceBrandMention: boolean
): string {
  const strategy = persona.content_strategy.post;
  const contentTypeDist = strategy.content_types;
  
  // 根据概率选择内容类型
  const rand = Math.random();
  let contentType: string = 'story_share';
  let cumulative = 0;
  for (const [type, prob] of Object.entries(contentTypeDist)) {
    cumulative += prob;
    if (rand <= cumulative) {
      contentType = type;
      break;
    }
  }
  
  const contentTypeDesc: Record<string, string> = {
    'story_share': '分享你的使用经历/故事',
    'question': '提出一个求助/讨论问题',
    'review': '写一份产品测评',
    'comparison': '对比不同产品',
    'trend_observation': '分享行业观察',
  };
  
  let prompt = `基于以下热门Reddit内容，以${persona.name}的身份写一篇新的帖子：

【参考内容】
原标题：${source.title}
原Subreddit：r/${source.subreddit}
热度：${source.score} upvotes
原文内容：${source.selftext?.substring(0, 500) || '(无正文)'}

【你的发帖策略】
内容类型：${contentTypeDesc[contentType]}
结束引导：${strategy.style_config.cta_type === 'question' ? '以一个问题结尾引发讨论' :
            strategy.style_config.cta_type === 'discussion' ? '邀请大家分享看法' :
            strategy.style_config.cta_type === 'advice_request' ? '请求建议和帮助' : '自然结束'}
`;

  if (enforceBrandMention || Math.random() < 0.2) {  // 20%概率提及品牌
    prompt += `
【品牌植入要求（轻度）】
产品名称：${projectInfo.product_name}
植入方式：以"我最近也在用..."或"我试了一下${projectInfo.product_name}..."的方式，轻描淡写地分享使用体验
植入要点（选1-2个）：
${projectInfo.key_benefits.map(b => `- ${b}`).join('\n')}

要求：
- 不要在开头就提品牌
- 只在自然合适的地方提及
- 保持客观，可以说优点也可以说小缺点
- 不要看起来像广告
`;
  }

  prompt += `
【输出要求】
1. 写一个吸引人的Reddit风格标题（不要太标题党）
2. 写正文内容（${strategy.style_config.avg_length}长度）
3. 建议的flair标签
4. 输出JSON格式：{ "title": "...", "body": "...", "suggested_flair": "..." }
`;

  return prompt;
}

function parseGeneratedPost(response: string): { title: string; body: string; suggested_flair?: string } {
  try {
    // 尝试提取JSON
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      return {
        title: data.title || data.post_title || 'Untitled',
        body: data.body || data.content || data.selftext || '',
        suggested_flair: data.suggested_flair || data.flair,
      };
    }
  } catch (e) {
    console.warn('JSON解析失败，使用文本解析');
  }
  
  // 如果JSON解析失败，尝试从文本中提取
  const lines = response.split('\n').filter(l => l.trim());
  const title = lines.find(l => !l.startsWith('{') && l.length > 10) || 'Untitled';
  const body = lines.slice(lines.indexOf(title) + 1).join('\n');
  
  return { title, body };
}

// ============================================
// 评论内容生成（Comment Generation）
// ============================================

export async function generateComment(
  persona: GeneratedPersona,
  context: CommentContext,
  projectInfo: {
    product_name: string;
    competitor_names?: string[];
  },
  options: ContentGenerationOptions = {}
): Promise<GeneratedComment> {
  const strategy = persona.content_strategy.comment;
  const brandRules = strategy.brand_mention_rules;
  
  // 构建System Prompt
  const systemPrompt = buildCommentSystemPrompt(persona);
  
  // 构建User Prompt
  const userPrompt = buildCommentUserPrompt(
    persona,
    context,
    projectInfo,
    brandRules.can_mention_brand && Math.random() < (brandRules.mention_frequency === 'occasional' ? 0.2 : 0.1)
  );
  
  const temperature = persona.generation_config.temperature;
  const maxTokens = persona.generation_config.max_tokens_comment;
  
  try {
    const response = await generateContent(systemPrompt, userPrompt, 'MiniMax-M2.5');
    
    // 解析评论内容
    const body = response.trim().replace(/^["']|["']$/g, '');
    
    // 检测评论基调
    const tone = detectCommentTone(body, context.existingComments);
    
    // 计算品牌提及分数
    const brandMentionScore = calculateBrandMentionScore(body, projectInfo.product_name);
    
    // 计算真实度
    const authenticityScore = calculateCommentAuthenticity(body, persona);
    
    return {
      body,
      tone,
      brand_mention_score: brandMentionScore,
      authenticity_score: authenticityScore,
      generation_metadata: {
        model: 'MiniMax-M2.5',
        temperature,
      },
    };
  } catch (error) {
    console.error('生成评论失败:', error);
    throw error;
  }
}

function buildCommentSystemPrompt(persona: GeneratedPersona): string {
  const style = persona.content_strategy.comment.content_style;
  
  return `你是${persona.name}（${persona.username}），正在浏览Reddit。

【评论风格】
- 贡献方式：${style.contribution_type === 'share_experience' ? '分享个人经历和经验' :
              style.contribution_type === 'add_info' ? '补充信息和知识' :
              style.contribution_type === 'ask_question' ? '提出问题和疑问' :
              style.contribution_type === 'mild_disagree' ? '温和地表达不同意见' : '幽默互动'}
- 观点倾向：${style.agreement_tendency === 'mostly_agree' ? '倾向于同意和支持' :
              style.agreement_tendency === 'neutral' ? '保持中立客观' : '建设性批评'}
- 论证方式：${style.evidence_type === 'personal_story' ? '基于个人经历' :
              style.evidence_type === 'data' ? '引用数据和事实' :
              style.evidence_type === 'logic' ? '逻辑推理' : '纯粹观点'}
- 评论长度：${style.avg_length === 'short' ? '简短（50-100词）' : '中等（100-150词）'}

【身份约束】
1. 像真实Reddit用户一样评论
2. 可以使用口语化表达和简写
3. 适当使用表情符号（如果符合人设）
4. 偶尔有错别字或语法不完美的句子（更真实）
5. 可以表达不确定（"I think...", "Not sure but..."）

直接输出评论文本，不要JSON格式。`;
}

function buildCommentUserPrompt(
  persona: GeneratedPersona,
  context: CommentContext,
  projectInfo: { product_name: string; competitor_names?: string[] },
  shouldMentionBrand: boolean
): string {
  const strategy = persona.content_strategy.comment;
  
  let prompt = `你看到以下Reddit帖子：

【帖子标题】
${context.postTitle}

【帖子内容】
${context.postBody?.substring(0, 300) || '(无正文)'}

【已有评论】
${context.existingComments.slice(0, 3).map((c, i) => 
  `${i + 1}. ${c.author}: ${c.body?.substring(0, 100)}...`
).join('\n')}

【你的评论策略】
- ${strategy.content_style.contribution_type === 'share_experience' ? '分享你的相关经历' :
    strategy.content_style.contribution_type === 'add_info' ? '补充有价值的信息' :
    strategy.content_style.contribution_type === 'ask_question' ? '提出相关问题' :
    strategy.content_style.contribution_type === 'mild_disagree' ? '温和地提出不同看法' : '幽默回应'}
`;

  if (shouldMentionBrand) {
    prompt += `
【品牌植入机会】
如果话题涉及${projectInfo.product_name}或相关产品，可以轻描淡写地分享你的使用体验。
示例方式：
- "我最近也在用类似的${projectInfo.product_name}，感觉..."
- "我试过几个不同的，包括${projectInfo.product_name}，个人更喜欢..."
- "说到这个，我正在用${projectInfo.product_name}，总体感觉..."

要求：自然融入，不要突兀；可以说优点也可以说小缺点；不要过度推销。
`;
  }

  prompt += `
【要求】
1. 像真实用户一样评论
2. 长度${persona.content_strategy.comment.content_style.avg_length === 'short' ? '50-100词' : '100-150词'}
3. 可以使用Reddit常用的简写和表达
4. 直接输出评论文本
`;

  return prompt;
}

function detectCommentTone(
  body: string,
  existingComments: CommentContext['existingComments']
): GeneratedComment['tone'] {
  const lowerBody = body.toLowerCase();
  
  // 检测不同意
  if (lowerBody.includes('disagree') || 
      lowerBody.includes("don't think") || 
      lowerBody.includes('not sure') ||
      lowerBody.includes('but')) {
    return 'disagree';
  }
  
  // 检测幽默
  if (lowerBody.includes('😂') || 
      lowerBody.includes('lol') || 
      lowerBody.includes('haha') ||
      lowerBody.includes('funny')) {
    return 'humorous';
  }
  
  // 检测同意
  if (lowerBody.includes('agree') || 
      lowerBody.includes('exactly') || 
      lowerBody.includes('totally') ||
      lowerBody.includes('yes')) {
    return 'agree';
  }
  
  return 'neutral';
}

// ============================================
// 评分和工具函数
// ============================================

function calculateBrandMentionScore(text: string, productName: string): number {
  const lowerText = text.toLowerCase();
  const lowerProduct = productName.toLowerCase();
  
  // 直接提及
  if (lowerText.includes(lowerProduct)) {
    return 0.8;
  }
  
  // 间接提及（产品类别词）
  const categoryWords = ['product', 'device', 'item', 'thing'];
  if (categoryWords.some(w => lowerText.includes(w))) {
    return 0.3;
  }
  
  return 0;
}

function calculateAuthenticityScore(
  post: { title: string; body: string },
  persona: GeneratedPersona
): number {
  let score = 0.7; // 基础分
  const text = (post.title + ' ' + post.body).toLowerCase();
  
  // 检查是否使用第一人称
  if (/\b(i|my|me|mine)\b/.test(text)) {
    score += 0.1;
  }
  
  // 检查是否有个人经历元素
  if (/\b(experience|tried|used|have been|recently)\b/.test(text)) {
    score += 0.1;
  }
  
  // 检查是否有不确定表达（更真实）
  if (/\b(i think|not sure|maybe|probably|might)\b/.test(text)) {
    score += 0.05;
  }
  
  // 检查是否有具体细节
  if (/\b(months?|weeks?|days?|times?)\b/.test(text)) {
    score += 0.05;
  }
  
  return Math.min(1, score);
}

function calculateCommentAuthenticity(body: string, persona: GeneratedPersona): number {
  let score = 0.75;
  const lowerBody = body.toLowerCase();
  
  // 口语化表达
  const casualPatterns = ['gonna', 'wanna', 'kinda', 'tbh', 'imo', 'tbh', 'ngl'];
  if (casualPatterns.some(p => lowerBody.includes(p))) {
    score += 0.05;
  }
  
  // 个人经历
  if (/\b(i|my)\b/.test(lowerBody) && /\b(have|had|tried|used|been)\b/.test(lowerBody)) {
    score += 0.1;
  }
  
  // 互动性
  if (/\?/.test(body) || lowerBody.includes('you')) {
    score += 0.05;
  }
  
  return Math.min(1, score);
}

// ============================================
// 批量生成API
// ============================================

export async function batchGeneratePosts(
  persona: GeneratedPersona,
  sources: SourceContent[],
  projectInfo: { product_name: string; key_benefits: string[]; use_cases: string[] },
  count: number
): Promise<GeneratedPost[]> {
  const posts: GeneratedPost[] = [];
  
  for (let i = 0; i < Math.min(count, sources.length); i++) {
    try {
      // 随机决定是否提及品牌（基于人设策略）
      const shouldMentionBrand = Math.random() < 0.2;  // 20%概率
      
      const post = await generatePost(persona, sources[i], projectInfo, {
        enforce_brand_mention: shouldMentionBrand,
      });
      
      posts.push(post);
    } catch (error) {
      console.error(`生成第${i + 1}篇帖子失败:`, error);
    }
  }
  
  return posts;
}

export async function batchGenerateComments(
  persona: GeneratedPersona,
  contexts: CommentContext[],
  projectInfo: { product_name: string; competitor_names?: string[] },
  count: number
): Promise<GeneratedComment[]> {
  const comments: GeneratedComment[] = [];
  const brandRules = persona.content_strategy.comment.brand_mention_rules;
  
  for (let i = 0; i < Math.min(count, contexts.length); i++) {
    try {
      // 根据规则决定是否提及品牌
      const mentionProb = brandRules.mention_frequency === 'occasional' ? 0.2 : 0.1;
      const shouldMentionBrand = brandRules.can_mention_brand && Math.random() < mentionProb;
      
      const comment = await generateComment(persona, contexts[i], projectInfo, {
        enforce_brand_mention: shouldMentionBrand,
      });
      
      comments.push(comment);
    } catch (error) {
      console.error(`生成第${i + 1}条评论失败:`, error);
    }
  }
  
  return comments;
}
