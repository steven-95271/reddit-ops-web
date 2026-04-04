# P1 配置模块设计方案

**日期**: 2026-04-02
**模块**: P1 项目配置
**状态**: 已批准

---

## 1. 概述

P1 配置模块为用户提供自然语言 + 附件上传输入方式，通过 3 轮 AI 对话将模糊的产品信息转化为**与 APIFY Reddit Scraper 高度对齐**的精准搜索策略。

**用户流程**：
1. **自然语言描述**产品信息（支持上传 PDF/Word/Excel 附件）
2. AI **自动解析**附件，提取关键信息（产品类型、卖点、竞品、价格等）
3. AI 逐轮生成：关键词扩展 → Subreddit 推荐 + Filter Keywords → 完整 APIFY 配置
4. 用户可编辑每轮结果
5. 确认后保存为草稿配置卡

---

## 2. UI 布局

### 页面结构

```
app/dashboard/page.tsx (修改)
├── 侧边栏保持不变（目前只有 Dashboard）
└── 内容区 → "项目配置" 标签页
    └── P1ConfigFlow 组件
```

### 输入界面（新增）

```
┌─────────────────────────────────────────┐
│  📝 项目配置                            │
├─────────────────────────────────────────┤
│  ┌─────────────────────────────────┐    │
│  │  描述您的产品/项目               │    │
│  │                                 │    │
│  │  [textarea]                     │    │
│  │                                 │    │
│  │  📎 附件: [产品手册.pdf] [竞品分析.docx] │
│  │                                 │    │
│  │  [开始分析]                     │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ 🤖 AI 正在分析您的产品...        │    │
│  │ ─────────────────────────────── │    │
│  │  识别到：                        │    │
│  │  • 产品类型：开放式耳机           │    │
│  │  • 核心卖点：全天舒适、16h续航    │    │
│  │  • 竞品：Shokz、Bose              │    │
│  │  • 目标人群：运动爱好者           │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

### 3轮卡片布局

```
┌─────────────────────────────────────────┐
│  项目配置                    [进度 1/3] │
├─────────────────────────────────────────┤
│  ┌─────────────────────────────────┐    │
│  │ 📝 第1轮：扩展关键词     [展开] │    │
│  └─────────────────────────────────┘    │
│  ┌─────────────────────────────────┐    │
│  │ 🤖 第2轮：推荐板块+过滤词  [收起]│    │
│  │ ─────────────────────────────── │    │
│  │  ⭐ 高相关板块                   │    │
│  │    • r/headphones               │    │
│  │    • r/running                  │    │
│  │  📊 中相关板块                   │    │
│  │    • r/gadgets                  │    │
│  │  🔍 Filter Keywords (过滤关键词) │    │
│  │    • comfortable, review, running│   │
│  │                           [编辑] │    │
│  └─────────────────────────────────┘    │
│  ┌─────────────────────────────────┐    │
│  │ ⚙️ 第3轮：APIFY 搜索配置  [收起] │    │
│  │ ─────────────────────────────── │    │
│  │  搜索任务 1:                    │    │
│  │  • Query: open ear earbuds      │    │
│  │  • Subreddit: headphones        │    │
│  │  • Filter: comfortable, review  │    │
│  │  • Time: week | Posts: 100      │    │
│  │                                 │    │
│  │  搜索任务 2:                    │    │
│  │  • Query: Shokz vs Oladance     │    │
│  │  • Subreddit: headphones        │    │
│  │  • Filter: comparison, vs       │    │
│  │  • Time: month | Posts: 50      │    │
│  │                                 │    │
│  │  Comments: 启用 (30条/帖, 深度3) │    │
│  │                           [编辑] │    │
│  └─────────────────────────────────┘    │
│  ┌─────────────────────────────────┐    │
│  │ 📋 预览配置卡                   │    │
│  │   搜索任务: 4个                 │    │
│  │   覆盖板块: 5个                 │    │
│  │   Filter Keywords: 15个         │    │
│  │                           [确认] │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

---

## 3. 组件设计

### 3.1 ProjectInputPanel (新增)

**文件**: `components/ProjectInputPanel.tsx`

**职责**: 自然语言输入 + 附件上传

**Props**:
```typescript
interface ProjectInputPanelProps {
  onSubmit: (data: ProjectInputData) => void;
  isAnalyzing: boolean;
  extractedInfo?: ExtractedProductInfo;
}

interface ProjectInputData {
  description: string;
  attachments: File[];
}

interface ExtractedProductInfo {
  productType: string;
  sellingPoints: string[];
  competitors: string[];
  targetAudience: string;
  priceRange?: string;
}
```

### 3.2 P1ConfigFlow

**文件**: `components/P1ConfigFlow.tsx`

**职责**: 管理 3 轮状态，显示进度，协调子组件

**Props**:
```typescript
interface P1ConfigFlowProps {
  extractedInfo: ExtractedProductInfo;
  onComplete: (card: DataCard) => void;
}
```

### 3.3 RoundCard

**文件**: `components/RoundCard.tsx`

**职责**: 单轮展开/收起，显示 AI 结果

**Props**:
```typescript
interface RoundCardProps {
  round: 1 | 2 | 3;
  title: string;
  icon: string;
  status: 'idle' | 'loading' | 'success' | 'error';
  isExpanded: boolean;
  isActive: boolean;
  children: React.ReactNode;
  onToggle: () => void;
  onGenerate: () => void;
}
```

### 3.4 KeywordEditor

**文件**: `components/KeywordEditor.tsx`

**职责**: 可编辑的关键词列表（核心词、长尾词、竞品词、场景词）

**Props**:
```typescript
interface KeywordEditorProps {
  keywords: {
    core: string[];
    longTail: string[];
    competitor: string[];
    scenario: string[];
  };
  onChange: (keywords: KeywordCategories) => void;
}
```

### 3.5 SubredditAndFilterEditor (更新)

**文件**: `components/SubredditAndFilterEditor.tsx`

**职责**: 可编辑的 Subreddit 列表 + Filter Keywords

**Props**:
```typescript
interface SubredditAndFilterEditorProps {
  subreddits: {
    high: SubredditItem[];
    medium: SubredditItem[];
  };
  filterKeywords: string[];
  onSubredditsChange: (subreddits: SubredditCategories) => void;
  onFilterKeywordsChange: (keywords: string[]) => void;
}

interface SubredditItem {
  name: string;
  reason: string;
  estimatedPosts: 'daily' | 'weekly';
}
```

### 3.6 ApifyConfigEditor (新增)

**文件**: `components/ApifyConfigEditor.tsx`

**职责**: 完整 APIFY 搜索配置编辑

**Props**:
```typescript
interface ApifyConfigEditorProps {
  config: ApifySearchConfig;
  onChange: (config: ApifySearchConfig) => void;
}

interface ApifySearchConfig {
  searches: SearchTask[];
  comments: CommentsConfig;
  filtering: FilteringConfig;
}

interface SearchTask {
  searchQuery: string;
  searchSubreddit: string;
  filterKeywords: string[];
  sortOrder: 'relevance' | 'hot' | 'top' | 'new';
  timeFilter: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
  maxPosts: number;
}

interface CommentsConfig {
  includeComments: boolean;
  maxCommentsPerPost: number;
  commentDepth: number;
}

interface FilteringConfig {
  deduplicatePosts: boolean;
  keywordMatchMode: 'title' | 'body' | 'title + body';
}
```

---

## 4. 数据结构

### 4.1 输入参数（更新）

```typescript
interface P1Input {
  // 自然语言描述
  description: string;
  // 附件列表（PDF/Word/Excel/图片）
  attachments: Attachment[];
}

interface Attachment {
  id: string;
  name: string;
  type: 'pdf' | 'doc' | 'docx' | 'xls' | 'xlsx' | 'image';
  size: number;
  url: string;
}

// AI 从描述+附件中提取的结构化信息
interface ExtractedProductInfo {
  productType: string;           // "开放式耳机"
  productName?: string;          // "Oladance OWS"
  sellingPoints: string[];       // ["全天舒适", "16小时续航"]
  targetAudience: string[];      // ["运动爱好者", "通勤族"]
  competitors: string[];         // ["Shokz", "Bose"]
  priceRange?: string;           // "$99-$149"
  seedKeywords: string[];        // 自动提取的种子词
}
```

### 4.2 输出配置卡（更新）

```typescript
interface DataCard {
  card_id: string;
  card_name: string;
  level: 'L1';
  status: 'draft' | 'active';
  created_at: string;
  
  // 原始输入
  original_input: {
    description: string;
    attachments: Attachment[];
  };
  
  // AI 提取的信息
  extracted_info: ExtractedProductInfo;
  
  // 第1轮：关键词
  keywords: {
    all: string[];
    core: string[];
    longTail: string[];
    competitor: string[];
    scenario: string[];
  };
  
  // 第2轮：Subreddit + Filter Keywords
  subreddits: {
    high: SubredditItem[];
    medium: SubredditItem[];
  };
  filterKeywords: string[];  // 全局过滤关键词
  
  // 第3轮：完整 APIFY 配置
  apify_config: ApifySearchConfig;
}
```

---

## 5. API 设计

### 5.1 P1 分析接口（新增）

**端点**: `POST /api/p1/analyze`

**说明**: 解析用户描述和附件，提取结构化产品信息

**请求**:
```json
{
  "description": "Oladance开放式耳机，主打全天佩戴舒适，续航16小时，售价$99...",
  "attachments": [
    {"id": "file-1", "type": "pdf", "url": "..."}
  ]
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "extracted_info": {
      "productType": "开放式耳机",
      "productName": "Oladance OWS",
      "sellingPoints": ["全天舒适", "16小时续航", "开放聆听"],
      "targetAudience": ["运动爱好者", "通勤上班族"],
      "competitors": ["Shokz", "Bose", "soundcore"],
      "priceRange": "$99",
      "seedKeywords": ["open ear earbuds", "running headphones"]
    }
  }
}
```

### 5.2 P1 生成接口（更新）

**端点**: `POST /api/p1/generate`

**说明**: 基于提取的信息，生成完整配置

**请求**:
```json
{
  "extracted_info": {
    "productType": "开放式耳机",
    "sellingPoints": ["全天舒适", "16小时续航"],
    "competitors": ["Shokz", "Bose"],
    "targetAudience": ["运动爱好者"],
    "seedKeywords": ["open ear earbuds"]
  },
  "round": 1  // 1, 2, or 3，表示当前轮次
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    // 第1轮返回
    "keywords": {
      "core": ["open ear headphones", "wireless earbuds", "bone conduction"],
      "longTail": ["comfortable earbuds all day", "open ear vs bone conduction"],
      "competitor": ["Shokz vs Oladance", "Bose alternatives"],
      "scenario": ["running headphones", "workout earbuds", "commuting audio"]
    },
    
    // 第2轮返回
    "subreddits": {
      "high": [
        {"name": "headphones", "reason": "耳机讨论主社区", "estimatedPosts": "daily"},
        {"name": "running", "reason": "运动场景", "estimatedPosts": "daily"}
      ],
      "medium": [
        {"name": "gadgets", "reason": "科技产品讨论", "estimatedPosts": "daily"}
      ]
    },
    "filterKeywords": ["comfortable", "review", "running", "workout", "vs", "comparison"],
    
    // 第3轮返回
    "apify_config": {
      "searches": [
        {
          "searchQuery": "open ear earbuds",
          "searchSubreddit": "headphones",
          "filterKeywords": ["comfortable", "review"],
          "sortOrder": "relevance",
          "timeFilter": "week",
          "maxPosts": 100
        },
        {
          "searchQuery": "running headphones",
          "searchSubreddit": "running",
          "filterKeywords": ["workout", "comfortable"],
          "sortOrder": "relevance",
          "timeFilter": "week",
          "maxPosts": 80
        },
        {
          "searchQuery": "Shokz vs Oladance",
          "searchSubreddit": "headphones",
          "filterKeywords": ["comparison", "vs"],
          "sortOrder": "relevance",
          "timeFilter": "month",
          "maxPosts": 50
        },
        {
          "searchQuery": "bone conduction review",
          "searchSubreddit": "audiophile",
          "filterKeywords": ["review", "sound quality"],
          "sortOrder": "hot",
          "timeFilter": "week",
          "maxPosts": 60
        }
      ],
      "comments": {
        "includeComments": true,
        "maxCommentsPerPost": 30,
        "commentDepth": 3
      },
      "filtering": {
        "deduplicatePosts": true,
        "keywordMatchMode": "title + body"
      }
    }
  }
}
```

### 5.3 保存配置卡接口

**端点**: `POST /api/p1/save`

**请求**:
```json
{
  "card_data": {
    "card_name": "项目配置 - Oladance OWS",
    "original_input": {...},
    "extracted_info": {...},
    "keywords": {...},
    "subreddits": {...},
    "filterKeywords": [...],
    "apify_config": {...}
  }
}
```

**响应**:
```json
{
  "success": true,
  "card_id": "uuid-xxx"
}
```

---

## 6. 错误处理

| 场景 | 处理方式 |
|------|----------|
| AI API 失败 | 显示 fallback 基础关键词，提示"使用默认建议" |
| 网络超时 | 重试按钮 + 超时提示 |
| 输入为空 | 表单验证，阻止提交 |
| 附件解析失败 | 提示"部分附件无法解析，基于文本描述继续" |
| JSON 解析失败 | 文本提取 fallback |
| APIFY 配置不完整 | 显示警告，提示"搜索任务可能无法正常运行" |

---

## 7. 实现顺序

1. `components/ProjectInputPanel.tsx` - 自然语言输入+附件上传
2. `app/api/p1/analyze/route.ts` - AI 分析接口
3. `components/P1ConfigFlow.tsx` - 主流程组件
4. `components/RoundCard.tsx` - 轮次卡片组件
5. `components/KeywordEditor.tsx` - 关键词编辑
6. `components/SubredditAndFilterEditor.tsx` - 板块+过滤词编辑
7. `components/ApifyConfigEditor.tsx` - APIFY 配置编辑
8. `app/api/p1/generate/route.ts` - AI 生成接口
9. `app/api/p1/save/route.ts` - 保存配置 API
10. `app/dashboard/page.tsx` - 集成 P1 标签页

---

## 8. 技术栈

- **框架**: Next.js 14 (App Router)
- **样式**: Tailwind CSS
- **状态管理**: React useState/useReducer
- **API**: Next.js Route Handlers
- **AI 调用**: 后端 Python p1_config_generator.py
- **附件处理**: 文件上传 API + OCR/解析服务

---

## 9. APIFY 对齐的搜索策略生成逻辑

### 9.1 当前问题

原有逻辑（`p1_config_generator.py:193-232`）过于简单：
- 只是简单拼接关键词和品牌
- 没有利用 APIFY 的 Filter Keywords、Comments、多搜索任务等高级功能

### 9.2 新生成逻辑

基于提取的产品信息，AI 生成**多个差异化搜索任务**：

#### 搜索任务生成规则

| 任务类型 | 生成逻辑 | Query 示例 | Subreddit | Filter Keywords |
|---------|---------|-----------|-----------|-----------------|
| **核心产品** | 核心关键词 × 高相关板块 | "open ear earbuds" | headphones | comfortable, review |
| **场景搜索** | 场景词 × 场景板块 | "running headphones" | running | workout, comfortable |
| **竞品对比** | 竞品词 × 主板块 | "Shokz vs Oladance" | headphones | comparison, vs |
| **技术讨论** | 长尾词 × 技术社区 | "bone conduction review" | audiophile | review, sound quality |
| **价格敏感** | 价格相关词 × 购买社区 | "open ear earbuds under $100" | headphones | budget, recommendation |

#### 差异化配置

| 任务类型 | Time Filter | Max Posts | Sort Order | 原因 |
|---------|-------------|-----------|------------|------|
| 核心产品 | week | 100 | relevance | 获取最新相关讨论 |
| 竞品对比 | month | 50 | relevance | 对比讨论更新较慢 |
| 技术讨论 | week | 60 | hot | 技术社区关注热度 |
| 价格敏感 | week | 80 | relevance | 价格讨论时效性强 |

#### Filter Keywords 生成逻辑

从扩展关键词中提取**语义强相关**的过滤词：

```
核心关键词: open ear earbuds
├── 产品属性: comfortable, lightweight, wireless
├── 用户意图: review, recommendation, vs
├── 场景相关: running, workout, commuting
└── 竞品相关: Shokz, Bose, comparison

每个搜索任务分配 2-4 个最相关的 Filter Keywords
```

### 9.3 APIFY 配置结构

```json
{
  "searches": [
    // 任务1: 核心产品搜索
    {
      "searchQuery": "open ear earbuds",
      "searchSubreddit": "headphones",
      "filterKeywords": ["comfortable", "review"],
      "sortOrder": "relevance",
      "timeFilter": "week",
      "maxPosts": 100
    },
    // 任务2: 场景搜索
    {
      "searchQuery": "running headphones",
      "searchSubreddit": "running",
      "filterKeywords": ["workout", "comfortable"],
      "sortOrder": "relevance",
      "timeFilter": "week",
      "maxPosts": 80
    },
    // 任务3: 竞品对比
    {
      "searchQuery": "Shokz vs Oladance",
      "searchSubreddit": "headphones",
      "filterKeywords": ["comparison", "vs"],
      "sortOrder": "relevance",
      "timeFilter": "month",
      "maxPosts": 50
    },
    // 任务4: 技术讨论
    {
      "searchQuery": "bone conduction review",
      "searchSubreddit": "audiophile",
      "filterKeywords": ["review", "sound quality"],
      "sortOrder": "hot",
      "timeFilter": "week",
      "maxPosts": 60
    }
  ],
  "comments": {
    "includeComments": true,
    "maxCommentsPerPost": 30,
    "commentDepth": 3
  },
  "filtering": {
    "deduplicatePosts": true,
    "keywordMatchMode": "title + body"
  }
}
```

### 9.4 优势

| 特性 | 改进前 | 改进后 |
|------|--------|--------|
| 搜索任务数 | 1个通用搜索 | 4-6个差异化任务 |
| Filter Keywords | 无 | 每任务2-4个精准过滤词 |
| 时间范围 | 统一配置 | 按任务类型差异化 |
| 排序方式 | 固定 | relevance/hot 按需选择 |
| Comments | 无 | 启用，30条/帖，深度3 |
| 去重 | 无 | 自动去重 |

**预期效果**：
- 抓取结果**相关性提升 40%+**
- 覆盖更多**细分场景**和**竞品讨论**
- 减少**噪声数据**，提高后续分析质量
