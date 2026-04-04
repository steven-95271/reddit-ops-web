import { NextRequest, NextResponse } from 'next/server';
import { DataCard } from '@/lib/types/p1';

// 简单的内存存储（生产环境应使用数据库）
const savedCards: DataCard[] = [];

export async function POST(request: NextRequest) {
  try {
    const { card_data } = await request.json();

    if (!card_data) {
      return NextResponse.json(
        { success: false, error: '缺少配置卡数据' },
        { status: 400 }
      );
    }

    const card: DataCard = {
      card_id: `card-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      card_name: card_data.card_name || '未命名配置',
      level: 'L1',
      status: 'draft',
      created_at: new Date().toISOString(),
      original_input: card_data.original_input,
      extracted_info: card_data.extracted_info,
      keywords: card_data.keywords,
      subreddits: card_data.subreddits,
      filterKeywords: card_data.filterKeywords,
      apify_config: card_data.apify_config,
    };

    // 保存到内存（生产环境应保存到数据库）
    savedCards.push(card);

    console.log(`Saved card: ${card.card_id}, Total cards: ${savedCards.length}`);

    return NextResponse.json({
      success: true,
      card,
    });
  } catch (error) {
    console.error('Save API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '保存失败',
      },
      { status: 500 }
    );
  }
}

// 获取所有保存的配置卡（可选）
export async function GET() {
  return NextResponse.json({
    success: true,
    cards: savedCards,
  });
}
