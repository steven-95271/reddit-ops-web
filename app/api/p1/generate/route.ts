import { NextRequest, NextResponse } from 'next/server';
import {
  ExtractedProductInfo,
  KeywordCategories,
  SubredditCategories,
  ApifySearchConfig,
} from '@/lib/types/p1';
import {
  generateKeywordsWithAI,
  generateSubredditsWithAI,
  generateSearchStrategyWithAI,
} from '@/lib/ai/minimax';

export async function POST(request: NextRequest) {
  try {
    const { extracted_info, round, feedback } = await request.json();

    if (!extracted_info || !round) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      );
    }

    const productInfo: ExtractedProductInfo = extracted_info;

    // Round 1: 生成关键词
    if (round === 1) {
      const keywords = await generateKeywordsWithAI(productInfo, feedback);
      
      // 验证关键词数量
      const totalKeywords = 
        keywords.brand.length + 
        keywords.product.length + 
        keywords.category.length + 
        keywords.comparison.length + 
        keywords.scenario.length + 
        keywords.problem.length;
      
      console.log(`Generated ${totalKeywords} keywords for round 1${feedback ? ' (with feedback)' : ''}`);

      return NextResponse.json({
        success: true,
        data: { keywords },
      });
    }

    // Round 2: 推荐 Subreddits 和 Filter Keywords
    if (round === 2) {
      // 从请求中获取第一轮生成的关键词
      const keywords: KeywordCategories = extracted_info.keywords || {
        core: [],
        longTail: [],
        competitor: [],
        scenario: [],
      };

      const { subreddits, filterKeywords } = await generateSubredditsWithAI(
        productInfo,
        keywords,
        feedback
      );

      console.log(
        `Generated ${subreddits.high.length} high relevance and ${subreddits.medium.length} medium relevance subreddits${feedback ? ' (with feedback)' : ''}`
      );
      console.log(`Generated ${filterKeywords.length} filter keywords`);

      return NextResponse.json({
        success: true,
        data: {
          subreddits,
          filterKeywords,
        },
      });
    }

    // Round 3: 生成 APIFY 搜索策略
    if (round === 3) {
      const keywords: KeywordCategories = extracted_info.keywords || {
        core: [],
        longTail: [],
        competitor: [],
        scenario: [],
      };

      const subreddits: SubredditCategories = extracted_info.subreddits || {
        high: [],
        medium: [],
      };

      const filterKeywords: string[] = extracted_info.filterKeywords || [];

      const apifyConfig = await generateSearchStrategyWithAI(
        productInfo,
        keywords,
        subreddits,
        filterKeywords,
        feedback
      );

      console.log(`Generated ${apifyConfig.searches.length} search tasks${feedback ? ' (with feedback)' : ''}`);

      return NextResponse.json({
        success: true,
        data: { apifyConfig },
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid round parameter' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Generate API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '生成失败',
      },
      { status: 500 }
    );
  }
}
