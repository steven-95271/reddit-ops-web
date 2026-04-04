import {
  P1Input,
  ExtractedProductInfo,
  KeywordCategories,
  SubredditCategories,
  ApifySearchConfig,
  DataCard,
  ApiResponse,
} from '@/lib/types/p1';

export async function analyzeProject(
  input: P1Input
): Promise<ApiResponse<ExtractedProductInfo>> {
  const response = await fetch('/api/p1/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  return response.json();
}

export async function generateRound(
  extractedInfo: ExtractedProductInfo,
  round: 1 | 2 | 3,
  feedback?: string
): Promise<
  ApiResponse<{
    keywords?: KeywordCategories;
    subreddits?: SubredditCategories;
    filterKeywords?: string[];
    apifyConfig?: ApifySearchConfig;
  }>
> {
  const response = await fetch('/api/p1/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      extracted_info: extractedInfo, 
      round,
      feedback: feedback || undefined,
    }),
  });

  return response.json();
}

export async function saveConfigCard(
  cardData: Partial<DataCard>
): Promise<ApiResponse<{ card: DataCard }>> {
  const response = await fetch('/api/p1/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ card_data: cardData }),
  });

  return response.json();
}

export async function scrapeWebsite(
  url: string
): Promise<ApiResponse<{ url: string; title: string; content: string; contentLength: number }>> {
  const response = await fetch('/api/p1/scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  return response.json();
}
