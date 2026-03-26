import { NextRequest, NextResponse } from 'next/server';
import { analyzeRedditProfile } from '@/lib/persona-analyzer';
import { 
  generatePersonaFromPrototype, 
  generateRecommendedPersonaSet,
  ProjectInfo 
} from '@/lib/persona-generator';
import { PERSONA_TEMPLATES } from '@/lib/persona-templates';

// GET /api/personas/analyze-profile?url=xxx
export async function GET(request: NextRequest) {
  try {
    const profileUrl = request.nextUrl.searchParams.get('url');
    
    if (!profileUrl) {
      return NextResponse.json({ error: 'url parameter required' }, { status: 400 });
    }
    
    // 验证URL格式
    if (!profileUrl.match(/reddit\.com\/(user|u)\//i)) {
      return NextResponse.json({ error: 'Invalid Reddit profile URL' }, { status: 400 });
    }
    
    // 分析Profile
    const analysis = await analyzeRedditProfile(profileUrl);
    
    return NextResponse.json({
      success: true,
      analysis,
      summary: {
        username: analysis.username,
        language_style: analysis.language_style,
        content_features: {
          avg_post_length: analysis.content_features.avg_post_length,
          emoji_usage: analysis.content_features.emoji_usage_frequency,
        },
        engagement_style: analysis.engagement_pattern.primary_interaction_style,
        brand_behavior: analysis.brand_behavior,
      }
    });
  } catch (error) {
    console.error('Error analyzing profile:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to analyze profile' 
    }, { status: 500 });
  }
}

// POST /api/personas/analyze-profile
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      profile_url, 
      project_info,
      differentiation = 'medium',
      role_type,
      count = 1 
    } = body;
    
    if (!profile_url) {
      return NextResponse.json({ error: 'profile_url required' }, { status: 400 });
    }
    
    // 1. 分析标杆账号
    const analysis = await analyzeRedditProfile(profile_url);
    
    // 2. 生成人设
    const personas = [];
    for (let i = 0; i < count; i++) {
      const persona = await generatePersonaFromPrototype(
        analysis,
        project_info as ProjectInfo,
        { differentiation, role_type, count: 1 }
      );
      personas.push(persona);
    }
    
    return NextResponse.json({
      success: true,
      prototype_analysis: {
        username: analysis.username,
        language_style: analysis.language_style,
        engagement_pattern: analysis.engagement_pattern,
      },
      generated_personas: personas,
    });
  } catch (error) {
    console.error('Error generating personas:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to generate personas' 
    }, { status: 500 });
  }
}
