import { NextRequest, NextResponse } from 'next/server';
import { analyzeProductWithAI } from '@/lib/ai/minimax';

export async function POST(request: NextRequest) {
  try {
    const { description, attachments } = await request.json();

    if (!description || typeof description !== 'string') {
      return NextResponse.json(
        { success: false, error: '请提供产品描述' },
        { status: 400 }
      );
    }

    // 调用 MiniMax AI 分析产品描述
    const extractedInfo = await analyzeProductWithAI(description);

    return NextResponse.json({
      success: true,
      data: extractedInfo,
    });
  } catch (error) {
    console.error('Analyze API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '分析失败',
      },
      { status: 500 }
    );
  }
}
