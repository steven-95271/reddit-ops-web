/**
 * AI人设生成器
 * 基于标杆账号分析和项目信息，使用MiniMax生成新人设
 */

import { generateContent } from './minimax';
import { ProfileAnalysis } from './persona-analyzer';
import { PersonaTemplate, getPersonaTemplate } from './persona-templates';

export interface ProjectInfo {
  name: string;
  product_name: string;
  category: string;
  target_audience: string;
  key_benefits: string[];
  competitors: string[];
  unique_selling_points: string[];
}

export interface GeneratedPersona {
  name: string;
  username: string;
  avatar_emoji: string;
  avatar_color: string;
  description: string;
  description_en: string;
  background: string;
  tone: string;
  writing_style: string;
  focus: string[];
  post_types: string[];
  platform: string;
  role_type: string;
  brand_integration_level: string;
  content_strategy: {
    post: {
      frequency: string;
      preferred_days: number[];
      preferred_hours: number[];
      content_types: Record<string, number>;
      style_config: {
        tone: string;
        avg_length: string;
        emoji_usage: string;
        hook_style: string;
        cta_type: string;
      };
    };
    comment: {
      target_post_types: string[];
      trigger_keywords: string[];
      reply_behavior: {
        max_daily_comments: number;
        reply_timing: string;
        target_subreddits: string[];
      };
      content_style: {
        contribution_type: string;
        agreement_tendency: string;
        evidence_type: string;
        avg_length: string;
      };
      brand_mention_rules: {
        can_mention_brand: boolean;
        mention_frequency: string;
        mention_style: string;
        avoid_competitor_praise: boolean;
      };
    };
  };
  generation_config: {
    temperature: number;
    max_tokens_post: number;
    max_tokens_comment: number;
  };
  prototype_analysis?: {
    source_username: string;
    similarity_score: number;
    differentiation_notes: string;
  };
}

export interface GenerationOptions {
  template_id?: string;           // 使用预置模板
  differentiation: 'high' | 'medium' | 'low';  // 与标杆账号的差异化程度
  role_type?: 'expert' | 'enthusiast' | 'casual_user' | 'newcomer';
  count: number;                  // 生成数量
}

/**
 * 基于标杆账号生成单个人设
 */
export async function generatePersonaFromPrototype(
  prototype: ProfileAnalysis,
  projectInfo: ProjectInfo,
  options: GenerationOptions
): Promise<GeneratedPersona> {
  const systemPrompt = `你是Reddit运营专家。基于标杆账号分析，为特定产品生成一个新的Reddit运营人设。
人设必须是真实的用户视角，轻度品牌植入，看起来像普通Reddit用户而非营销号。
输出严格的JSON格式。`;

  const differentiationPrompt = {
    high: '与标杆账号明显不同，差异化程度70-80%',
    medium: '与标杆账号有30-40%相似，差异化程度60-70%',
    low: '与标杆账号风格接近，差异化程度50-60%',
  }[options.differentiation];

  const userPrompt = `为产品 "${projectInfo.product_name}" 生成Reddit运营人设。

【标杆账号分析】
用户名: ${prototype.username}
语言风格:
- 正式度: ${prototype.language_style.formality}/10
- 情感倾向: ${prototype.language_style.positivity}/10  
- 争议性: ${prototype.language_style.controversy}/10
- 热情度: ${prototype.language_style.enthusiasm}/10

内容特征:
- 平均帖子长度: ${prototype.content_features.avg_post_length}词
- 常用开头: ${prototype.content_features.common_openers.join(', ')}
- 常用短语: ${prototype.content_features.common_phrases.join(', ')}
- 表情使用频率: ${(prototype.content_features.emoji_usage_frequency * 100).toFixed(0)}%
- 分享个人经历: ${prototype.content_features.shares_personal_experience ? '是' : '否'}

互动模式:
- 主要风格: ${prototype.engagement_pattern.primary_interaction_style}
- 发帖:评论比例: ${prototype.engagement_pattern.post_to_comment_ratio.toFixed(1)}

品牌行为:
- 是否提及产品: ${prototype.brand_behavior.mentions_products ? '是' : '否'}
- 推荐方式: ${prototype.brand_behavior.recommendation_style}

可信度建立方式: ${prototype.credibility_signals.join(', ')}

【项目信息】
产品名称: ${projectInfo.product_name}
产品品类: ${projectInfo.category}
目标用户: ${projectInfo.target_audience}
核心卖点: ${projectInfo.key_benefits.join(', ')}
竞品: ${projectInfo.competitors.join(', ')}

【生成要求】
1. 人设角色: ${options.role_type || '根据标杆特征自动判断'}
2. 差异化策略: ${differentiationPrompt}
3. 品牌植入: 轻度（平均每5条内容中可自然提及1次产品）
4. 发帖人设: 分享真实使用体验，偶尔求助/提问引发讨论
5. 评论人设: 基于经验提供建议，轻描淡写提及产品使用体验
6. 可信度: 通过分享个人经历建立信任

【输出JSON格式】
{
  "name": "人设显示名",
  "username": "u/用户名",
  "avatar_emoji": "适合的表情符号",
  "avatar_color": "主色调十六进制代码",
  "description": "中文描述",
  "description_en": "English description",
  "background": "详细背景故事（200-300字）",
  "tone": "语气描述",
  "writing_style": "写作风格描述",
  "focus": ["关注点1", "关注点2", "关注点3"],
  "post_types": ["发帖类型1", "发帖类型2"],
  "role_type": "casual_user|enthusiast|expert|newcomer",
  "content_strategy": {
    "post": {
      "frequency": "low|medium|high",
      "preferred_days": [1,3,5],
      "preferred_hours": [9,14,20],
      "content_types": {"story_share": 0.4, "question": 0.3, "review": 0.2, "comparison": 0.0, "trend_observation": 0.1},
      "style_config": {
        "tone": "casual|enthusiastic|analytical|skeptical|humorous",
        "avg_length": "short|medium|long",
        "emoji_usage": "none|minimal|moderate|heavy",
        "hook_style": "personal_story|provocative_question|data_point|controversial_opinion",
        "cta_type": "none|question|discussion|advice_request"
      }
    },
    "comment": {
      "target_post_types": ["类型1", "类型2"],
      "trigger_keywords": ["关键词1", "关键词2"],
      "reply_behavior": {
        "max_daily_comments": 10,
        "reply_timing": "immediate|delayed|strategic",
        "target_subreddits": []
      },
      "content_style": {
        "contribution_type": "share_experience|add_info|ask_question|mild_disagree|humor",
        "agreement_tendency": "mostly_agree|neutral|constructive_critic",
        "evidence_type": "personal_story|data|logic|opinion_only",
        "avg_length": "short|medium"
      },
      "brand_mention_rules": {
        "can_mention_brand": true,
        "mention_frequency": "rare|occasional",
        "mention_style": "direct|subtle_hint|personal_experience",
        "avoid_competitor_praise": true
      }
    }
  },
  "generation_config": {
    "temperature": 0.75,
    "max_tokens_post": 600,
    "max_tokens_comment": 150
  }
}`;

  try {
    const response = await generateContent(systemPrompt, userPrompt, 'MiniMax-Text-01');
    
    // 提取JSON
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('生成的人设格式不正确');
    }
    
    const personaData = JSON.parse(jsonMatch[0]);
    
    // 添加原型分析信息
    const similarityScore = calculateSimilarityScore(prototype, personaData);
    
    return {
      ...personaData,
      platform: 'Reddit',
      brand_integration_level: 'subtle',
      prototype_analysis: {
        source_username: prototype.username,
        similarity_score: similarityScore,
        differentiation_notes: generateDifferentiationNotes(prototype, personaData),
      },
    };
  } catch (error) {
    console.error('生成人设失败:', error);
    throw error;
  }
}

/**
 * 基于模板生成人设
 */
export async function generatePersonaFromTemplate(
  templateId: string,
  projectInfo: ProjectInfo,
  differentiation: 'high' | 'medium' | 'low' = 'medium'
): Promise<GeneratedPersona> {
  const template = getPersonaTemplate(templateId);
  if (!template) {
    throw new Error(`模板 ${templateId} 不存在`);
  }
  
  // 基于模板生成具体人设
  const systemPrompt = `基于人设模板为特定产品生成具体的Reddit运营人设。保持模板的策略框架，但填充具体的个人背景和内容偏好。`;
  
  const userPrompt = `【人设模板】
名称: ${template.name}
描述: ${template.description}
角色类型: ${template.role_type}
发帖策略:
- 频率: ${template.content_strategy.post.frequency}
- 内容类型分布: ${JSON.stringify(template.content_strategy.post.content_types)}
- 风格: ${template.content_strategy.post.style_config.tone}

评论策略:
- 贡献类型: ${template.content_strategy.comment.content_style.contribution_type}
- 品牌提及: ${template.content_strategy.comment.brand_mention_rules.mention_style}

【项目信息】
产品: ${projectInfo.product_name}
品类: ${projectInfo.category}
目标用户: ${projectInfo.target_audience}
核心卖点: ${projectInfo.key_benefits.join(', ')}

【生成要求】
1. 基于模板框架，生成具体的人设细节
2. 差异化程度: ${differentiation}
3. 确保人设与产品相关性强

输出JSON格式的人设配置。`;

  const response = await generateContent(systemPrompt, userPrompt);
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }
  
  // 如果解析失败，返回模板基础数据
  return generatePersonaFromTemplateBase(template, projectInfo);
}

/**
 * 生成多个人设组合
 */
export async function generatePersonaCombo(
  prototypes: ProfileAnalysis[],
  projectInfo: ProjectInfo,
  targetRoles: Array<'expert' | 'enthusiast' | 'casual_user' | 'newcomer'> = ['expert', 'casual_user', 'newcomer']
): Promise<GeneratedPersona[]> {
  const personas: GeneratedPersona[] = [];
  
  // 为每种角色类型生成人设
  for (const role of targetRoles) {
    // 选择最适合该角色的标杆账号
    const bestPrototype = selectBestPrototypeForRole(prototypes, role);
    
    const persona = await generatePersonaFromPrototype(
      bestPrototype,
      projectInfo,
      { differentiation: 'medium', role_type: role, count: 1 }
    );
    
    personas.push(persona);
  }
  
  return personas;
}

/**
 * 使用预置模板快速生成推荐组合
 */
export async function generateRecommendedPersonaSet(
  projectInfo: ProjectInfo,
  prototype?: ProfileAnalysis
): Promise<GeneratedPersona[]> {
  const recommendedTemplates = ['tech_expert', 'casual_user', 'skeptical_buyer', 'newcomer'];
  const personas: GeneratedPersona[] = [];
  
  for (const templateId of recommendedTemplates) {
    try {
      if (prototype) {
        // 基于标杆账号+模板生成
        const persona = await generatePersonaFromPrototype(
          prototype,
          projectInfo,
          { differentiation: 'medium', template_id: templateId, count: 1 }
        );
        personas.push(persona);
      } else {
        // 纯模板生成
        const persona = await generatePersonaFromTemplate(templateId, projectInfo);
        personas.push(persona);
      }
    } catch (error) {
      console.error(`生成人设失败: ${templateId}`, error);
    }
  }
  
  return personas;
}

// Helper functions

function calculateSimilarityScore(prototype: ProfileAnalysis, generated: any): number {
  // 基于关键特征计算相似度
  let score = 0.5; // 基础分
  
  // 语言风格匹配
  if (generated.content_strategy?.post?.style_config?.tone) {
    const tones: Record<string, number> = {
      'casual': 3, 'enthusiastic': 8, 'analytical': 8, 
      'skeptical': 4, 'humorous': 6
    };
    const expectedFormality = prototype.language_style.formality;
    const actualFormality = tones[generated.content_strategy.post.style_config.tone] || 5;
    const formalityDiff = Math.abs(expectedFormality - actualFormality);
    score += (10 - formalityDiff) / 20; // 0-0.5分
  }
  
  // 内容长度匹配
  if (generated.content_strategy?.post?.style_config?.avg_length) {
    const lengths: Record<string, number> = { 'short': 150, 'medium': 400, 'long': 700 };
    const expectedLength = prototype.content_features.avg_post_length;
    const actualLength = lengths[generated.content_strategy.post.style_config.avg_length] || 400;
    const lengthDiff = Math.abs(expectedLength - actualLength) / 500;
    score += Math.max(0, 0.3 - lengthDiff);
  }
  
  return Math.min(1, Math.max(0, score));
}

function generateDifferentiationNotes(prototype: ProfileAnalysis, generated: any): string {
  const notes: string[] = [];
  
  // 对比语言风格差异
  if (generated.content_strategy?.post?.style_config?.tone) {
    const toneMap: Record<string, string> = {
      'casual': '更加口语化',
      'enthusiastic': '更热情积极',
      'analytical': '更理性分析',
      'skeptical': '更加谨慎质疑',
      'humorous': '更幽默风趣',
    };
    notes.push(toneMap[generated.content_strategy.post.style_config.tone] || '语气有所调整');
  }
  
  // 对比内容类型差异
  const contentTypes = generated.content_strategy?.post?.content_types;
  if (contentTypes) {
    const entries = Object.entries(contentTypes) as [string, number][];
    const maxType = entries.sort((a, b) => b[1] - a[1])[0];
    notes.push(`侧重${maxType[0] === 'story_share' ? '故事分享' : maxType[0] === 'question' ? '提问求助' : maxType[0] === 'review' ? '产品测评' : maxType[0]}内容`);
  }
  
  return notes.join('；');
}

function selectBestPrototypeForRole(
  prototypes: ProfileAnalysis[],
  role: string
): ProfileAnalysis {
  // 根据角色选择最适合的标杆
  const rolePreferences: Record<string, (p: ProfileAnalysis) => number> = {
    'expert': (p) => p.language_style.formality * 0.5 + (p.content_features.uses_data_or_facts ? 3 : 0),
    'enthusiast': (p) => p.language_style.enthusiasm * 0.8 + p.language_style.positivity * 0.2,
    'casual_user': (p) => (10 - p.language_style.formality) * 0.6 + (p.content_features.shares_personal_experience ? 3 : 0),
    'newcomer': (p) => (p.content_features.asks_questions ? 5 : 0) + (10 - p.account_stats.total_karma / 1000),
  };
  
  const scorer = rolePreferences[role] || (() => 0);
  return prototypes.sort((a, b) => scorer(b) - scorer(a))[0] || prototypes[0];
}

function generatePersonaFromTemplateBase(
  template: PersonaTemplate,
  projectInfo: ProjectInfo
): GeneratedPersona {
  // 基于模板生成基础人设数据
  return {
    name: `${template.name}_${Math.floor(Math.random() * 1000)}`,
    username: `u/${template.id}_${Math.floor(Math.random() * 10000)}`,
    avatar_emoji: '🎯',
    avatar_color: '#6366F1',
    description: `基于${template.name}模板生成的运营人设`,
    description_en: `Generated ${template.name} persona for ${projectInfo.product_name}`,
    background: `A ${template.role_type} interested in ${projectInfo.category}`,
    tone: template.content_strategy.post.style_config.tone,
    writing_style: template.description,
    focus: projectInfo.key_benefits,
    post_types: Object.keys(template.content_strategy.post.content_types).filter(k => 
      template.content_strategy.post.content_types[k as keyof typeof template.content_strategy.post.content_types] > 0.1
    ),
    platform: 'Reddit',
    role_type: template.role_type,
    brand_integration_level: 'subtle',
    content_strategy: {
      post: template.content_strategy.post,
      comment: template.content_strategy.comment,
    },
    generation_config: template.generation_config,
  };
}
