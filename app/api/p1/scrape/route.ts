import { NextRequest, NextResponse } from 'next/server';

/**
 * 抓取网站内容
 * 使用 Jina Reader API 获取干净的 Markdown 内容
 * https://jina.ai/reader
 */
export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url || !url.startsWith('http')) {
      return NextResponse.json(
        { success: false, error: '请输入有效的网址' },
        { status: 400 }
      );
    }

    console.log(`Scraping website with Jina Reader: ${url}`);

    // 使用 Jina Reader API 获取干净的 Markdown 内容
    const response = await fetch(`https://r.jina.ai/${url}`, {
      headers: {
        'Accept': 'application/json',
        'X-With-Generated-Alt': 'true', // 为图片生成 alt 文本
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      return NextResponse.json(
        { 
          success: false, 
          error: `无法抓取网站: ${response.status} ${response.statusText}${errorText ? ` - ${errorText.slice(0, 200)}` : ''}` 
        },
        { status: 400 }
      );
    }

    const data = await response.json();

    // Jina 返回的格式: { code: 200, status: 200, data: { title, content, url, ... } }
    const content = data?.data?.content || '';
    const title = data?.data?.title || '';

    if (!content) {
      return NextResponse.json(
        { success: false, error: '网站内容为空，可能无法访问或需要登录' },
        { status: 400 }
      );
    }

    // 限制内容长度（避免 token 过多）
    const maxContentLength = 15000;
    const truncatedContent = content.length > maxContentLength
      ? content.slice(0, maxContentLength) + '\n\n[内容已截断，仅显示前 15000 字符]'
      : content;

    console.log(`Jina Reader extracted ${truncatedContent.length} characters from ${url}`);

    return NextResponse.json({
      success: true,
      data: {
        url,
        title,
        content: truncatedContent,
        contentLength: truncatedContent.length,
        source: 'Jina Reader API',
      },
    });
  } catch (error) {
    console.error('Scrape API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '抓取失败',
      },
      { status: 500 }
    );
  }
}
