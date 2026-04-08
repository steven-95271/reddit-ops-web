// lib/types/p1.ts

// 输入数据
export interface P1Input {
  description: string;
  attachments: Attachment[];
  websiteUrl?: string;
}

export interface Attachment {
  id: string;
  name: string;
  type: 'pdf' | 'doc' | 'docx' | 'xls' | 'xlsx' | 'image';
  size: number;
  url: string;
}

// AI 提取的产品信息
export interface ExtractedProductInfo {
  productType: string;
  productName?: string;
  sellingPoints: string[];
  targetAudience: string[];
  competitors: string[];
  priceRange?: string;
  seedKeywords: string[];
}

// 关键词项
export interface KeywordItem {
  keyword: string;
  reason: string;
  wordCount: number;
}

// 关键词分类
export interface KeywordCategories {
  brand: KeywordItem[];
  product: KeywordItem[];
  category: KeywordItem[];
  comparison: KeywordItem[];
  scenario: KeywordItem[];
  problem: KeywordItem[];
  reasoning?: string;
}

// Subreddit 项
export interface SubredditItem {
  name: string;
  reason: string;
  estimatedPosts: 'daily' | 'weekly';
}

// Subreddit 分类
export interface SubredditCategories {
  high: SubredditItem[];
  medium: SubredditItem[];
}

// APIFY 搜索任务
export interface SearchTask {
  searchQuery: string;
  searchSubreddit: string;
  filterKeywords: string[];
  sortOrder: 'relevance' | 'hot' | 'top' | 'new';
  timeFilter: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
  maxPosts: number;
}

// APIFY Comments 配置
export interface CommentsConfig {
  includeComments: boolean;
  maxCommentsPerPost: number;
  commentDepth: number;
}

// APIFY 过滤配置
export interface FilteringConfig {
  deduplicatePosts: boolean;
  keywordMatchMode: 'title' | 'body' | 'title + body';
}

// 完整 APIFY 配置
export interface ApifySearchConfig {
  searches: SearchTask[];
  comments: CommentsConfig;
  filtering: FilteringConfig;
}

// 轮次状态
export interface RoundState {
  status: 'idle' | 'loading' | 'success' | 'error';
  data?: any;
  edited?: boolean;
}

// 完整配置卡
export interface DataCard {
  card_id: string;
  card_name: string;
  level: 'L1';
  status: 'draft' | 'active';
  created_at: string;
  original_input: P1Input;
  extracted_info: ExtractedProductInfo;
  keywords: KeywordCategories & { all: string[] };
  subreddits: SubredditCategories;
  filterKeywords: string[];
  apify_config: ApifySearchConfig;
}

// API 响应
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  card?: DataCard;
}
