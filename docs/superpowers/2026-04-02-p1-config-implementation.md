# P1 配置模块实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 P1 项目配置模块，支持自然语言+附件输入、3轮AI对话、与APIFY Reddit Scraper高度对齐的搜索策略生成

**Architecture:** 基于 Next.js + Tailwind CSS 前端，配合后端 API 路由调用 AI 服务。组件采用分步卡片设计，每轮可独立编辑。搜索策略直接输出 APIFY 兼容配置。

**Tech Stack:** Next.js 14, React, TypeScript, Tailwind CSS, Python Flask (backend AI)

---

## 文件结构

```
app/
├── dashboard/
│   └── page.tsx                    # 修改：添加项目配置标签页
├── api/
│   └── p1/
│       ├── analyze/
│       │   └── route.ts            # 新增：解析产品描述和附件
│       ├── generate/
│       │   └── route.ts            # 新增：生成关键词/板块/搜索策略
│       └── save/
│           └── route.ts            # 新增：保存配置卡
components/
├── p1/
│   ├── ProjectInputPanel.tsx       # 新增：自然语言输入+附件上传
│   ├── P1ConfigFlow.tsx            # 新增：主流程组件
│   ├── RoundCard.tsx               # 新增：轮次展开卡片
│   ├── KeywordEditor.tsx           # 新增：关键词编辑组件
│   ├── SubredditAndFilterEditor.tsx # 新增：板块+过滤词编辑
│   └── ApifyConfigEditor.tsx       # 新增：APIFY配置编辑
├── ui/
│   └── FileUpload.tsx              # 新增：文件上传组件
lib/
├── types/
│   └── p1.ts                       # 新增：P1 类型定义
└── api/
    └── p1.ts                       # 新增：P1 API 客户端
```

---

## 前置检查

- [ ] **确认后端服务可用**
  - 检查: `python app.py` 是否能正常启动
  - 确认 `p1_config_generator.py` 存在且功能完整

---

## Task 1: 类型定义

**Files:**
- Create: `lib/types/p1.ts`

- [ ] **Step 1: 创建 P1 类型定义文件**

```typescript
// lib/types/p1.ts

// 输入数据
export interface P1Input {
  description: string;
  attachments: Attachment[];
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

// 关键词分类
export interface KeywordCategories {
  core: string[];
  longTail: string[];
  competitor: string[];
  scenario: string[];
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
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/types/p1.ts
git commit -m "feat: add P1 configuration type definitions"
```

---

## Task 2: FileUpload 组件

**Files:**
- Create: `components/ui/FileUpload.tsx`

- [ ] **Step 1: 创建文件上传组件**

```typescript
// components/ui/FileUpload.tsx
'use client';

import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Attachment } from '@/lib/types/p1';

interface FileUploadProps {
  files: Attachment[];
  onChange: (files: Attachment[]) => void;
  maxFiles?: number;
  maxSize?: number; // bytes
}

export default function FileUpload({
  files,
  onChange,
  maxFiles = 5,
  maxSize = 10 * 1024 * 1024, // 10MB
}: FileUploadProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const newAttachments: Attachment[] = acceptedFiles.map((file, index) => ({
        id: `file-${Date.now()}-${index}`,
        name: file.name,
        type: getFileType(file.name),
        size: file.size,
        url: URL.createObjectURL(file),
      }));

      onChange([...files, ...newAttachments].slice(0, maxFiles));
    },
    [files, onChange, maxFiles]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: maxFiles - files.length,
    maxSize,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'image/*': ['.png', '.jpg', '.jpeg'],
    },
  });

  const removeFile = (id: string) => {
    onChange(files.filter((f) => f.id !== id));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'pdf':
        return '📄';
      case 'doc':
      case 'docx':
        return '📝';
      case 'xls':
      case 'xlsx':
        return '📊';
      case 'image':
        return '🖼️';
      default:
        return '📎';
    }
  };

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-slate-300 hover:border-slate-400'
        }`}
      >
        <input {...getInputProps()} />
        <div className="text-3xl mb-2">📎</div>
        <p className="text-sm text-slate-600">
          {isDragActive
            ? '松开以上传文件'
            : '拖拽文件到此处，或点击选择'}
        </p>
        <p className="text-xs text-slate-400 mt-1">
          支持 PDF, Word, Excel, 图片 (最大 {formatFileSize(maxSize)})
        </p>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{getFileIcon(file.type)}</span>
                <div>
                  <p className="text-sm font-medium text-slate-700 truncate max-w-[200px]">
                    {file.name}
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatFileSize(file.size)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => removeFile(file.id)}
                className="text-slate-400 hover:text-red-500 transition-colors"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getFileType(filename: string): Attachment['type'] {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf':
      return 'pdf';
    case 'doc':
    case 'docx':
      return 'docx';
    case 'xls':
    case 'xlsx':
      return 'xlsx';
    case 'png':
    case 'jpg':
    case 'jpeg':
      return 'image';
    default:
      return 'pdf';
  }
}
```

- [ ] **Step 2: 安装依赖 react-dropzone**

```bash
npm install react-dropzone
```

- [ ] **Step 3: Commit**

```bash
git add components/ui/FileUpload.tsx package.json package-lock.json
git commit -m "feat: add FileUpload component with drag-and-drop"
```

---

## Task 3: ProjectInputPanel 组件

**Files:**
- Create: `components/p1/ProjectInputPanel.tsx`

- [ ] **Step 1: 创建项目输入面板组件**

```typescript
// components/p1/ProjectInputPanel.tsx
'use client';

import React, { useState } from 'react';
import FileUpload from '@/components/ui/FileUpload';
import { P1Input, ExtractedProductInfo, Attachment } from '@/lib/types/p1';

interface ProjectInputPanelProps {
  onSubmit: (data: P1Input) => void;
  isAnalyzing: boolean;
  extractedInfo?: ExtractedProductInfo;
}

export default function ProjectInputPanel({
  onSubmit,
  isAnalyzing,
  extractedInfo,
}: ProjectInputPanelProps) {
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const handleSubmit = () => {
    if (!description.trim()) {
      alert('请输入产品描述');
      return;
    }
    onSubmit({ description, attachments });
  };

  return (
    <div className="space-y-6">
      {/* 输入区域 */}
      <div className="glass-card">
        <h2 className="text-lg font-bold text-slate-900 mb-4">
          📝 描述您的产品/项目
        </h2>
        
        <div className="space-y-4">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="例如：Oladance 开放式耳机，主打全天佩戴舒适，续航16小时，售价$99。目标人群是运动爱好者和通勤上班族..."
            className="w-full h-32 p-4 border border-slate-200 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          
          <FileUpload files={attachments} onChange={setAttachments} />
          
          <button
            onClick={handleSubmit}
            disabled={isAnalyzing || !description.trim()}
            className="w-full py-3 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isAnalyzing ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">⏳</span>
                AI 正在分析...
              </span>
            ) : (
              '开始分析 →'
            )}
          </button>
        </div>
      </div>

      {/* AI 提取结果展示 */}
      {extractedInfo && (
        <div className="glass-card border-l-4 border-l-green-500">
          <h3 className="text-md font-bold text-slate-900 mb-3">
            🤖 AI 识别到的信息
          </h3>
          
          <div className="space-y-3 text-sm">
            <div className="flex gap-2">
              <span className="text-slate-500 w-20 shrink-0">产品类型</span>
              <span className="font-medium text-slate-900">
                {extractedInfo.productType}
              </span>
            </div>
            
            {extractedInfo.productName && (
              <div className="flex gap-2">
                <span className="text-slate-500 w-20 shrink-0">产品名称</span>
                <span className="font-medium text-slate-900">
                  {extractedInfo.productName}
                </span>
              </div>
            )}
            
            <div className="flex gap-2">
              <span className="text-slate-500 w-20 shrink-0">核心卖点</span>
              <div className="flex flex-wrap gap-2">
                {extractedInfo.sellingPoints.map((point, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs"
                  >
                    {point}
                  </span>
                ))}
              </div>
            </div>
            
            <div className="flex gap-2">
              <span className="text-slate-500 w-20 shrink-0">目标人群</span>
              <div className="flex flex-wrap gap-2">
                {extractedInfo.targetAudience.map((audience, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs"
                  >
                    {audience}
                  </span>
                ))}
              </div>
            </div>
            
            <div className="flex gap-2">
              <span className="text-slate-500 w-20 shrink-0">竞品</span>
              <div className="flex flex-wrap gap-2">
                {extractedInfo.competitors.map((competitor, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs"
                  >
                    {competitor}
                  </span>
                ))}
              </div>
            </div>
            
            {extractedInfo.priceRange && (
              <div className="flex gap-2">
                <span className="text-slate-500 w-20 shrink-0">价格区间</span>
                <span className="font-medium text-slate-900">
                  {extractedInfo.priceRange}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/p1/ProjectInputPanel.tsx
git commit -m "feat: add ProjectInputPanel component with AI info display"
```

---

## Task 4: RoundCard 组件

**Files:**
- Create: `components/p1/RoundCard.tsx`

- [ ] **Step 1: 创建轮次卡片组件**

```typescript
// components/p1/RoundCard.tsx
'use client';

import React from 'react';

interface RoundCardProps {
  round: 1 | 2 | 3;
  title: string;
  icon: string;
  status: 'idle' | 'loading' | 'success' | 'error';
  isExpanded: boolean;
  isActive: boolean;
  children?: React.ReactNode;
  onToggle: () => void;
  onGenerate?: () => void;
}

export default function RoundCard({
  round,
  title,
  icon,
  status,
  isExpanded,
  isActive,
  children,
  onToggle,
  onGenerate,
}: RoundCardProps) {
  const getStatusIcon = () => {
    switch (status) {
      case 'loading':
        return <span className="animate-spin text-blue-500">⏳</span>;
      case 'success':
        return <span className="text-green-500">✓</span>;
      case 'error':
        return <span className="text-red-500">✗</span>;
      default:
        return <span className="text-slate-300">○</span>;
    }
  };

  const getBorderColor = () => {
    if (!isActive) return 'border-slate-200';
    switch (status) {
      case 'success':
        return 'border-green-300';
      case 'error':
        return 'border-red-300';
      default:
        return 'border-blue-300';
    }
  };

  return (
    <div
      className={`border-2 rounded-lg overflow-hidden transition-all ${getBorderColor()}`}
    >
      {/* 头部 */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{icon}</span>
          <div className="text-left">
            <h3 className="font-bold text-slate-900">{title}</h3>
            <p className="text-xs text-slate-500">
              {status === 'idle' && '等待开始'}
              {status === 'loading' && 'AI 生成中...'}
              {status === 'success' && '生成完成'}
              {status === 'error' && '生成失败'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="text-slate-400">
            {isExpanded ? '▼' : '▶'}
          </span>
        </div>
      </button>

      {/* 内容区 */}
      {isExpanded && (
        <div className="p-4 bg-white">
          {status === 'idle' && isActive && onGenerate && (
            <div className="text-center py-8">
              <button
                onClick={onGenerate}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                开始生成
              </button>
            </div>
          )}

          {status === 'loading' && (
            <div className="text-center py-8 text-slate-400">
              <span className="text-4xl block mb-4">🤖</span>
              <p>AI 正在分析生成...</p>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center py-8 text-red-500">
              <span className="text-4xl block mb-4">⚠️</span>
              <p>生成失败，请重试</p>
              {onGenerate && (
                <button
                  onClick={onGenerate}
                  className="mt-4 px-4 py-2 border border-red-300 text-red-600 rounded hover:bg-red-50"
                >
                  重新生成
                </button>
              )}
            </div>
          )}

          {status === 'success' && children}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/p1/RoundCard.tsx
git commit -m "feat: add RoundCard component for 3-round flow"
```

---

## Task 5: KeywordEditor 组件

**Files:**
- Create: `components/p1/KeywordEditor.tsx`

- [ ] **Step 1: 创建关键词编辑器组件**

```typescript
// components/p1/KeywordEditor.tsx
'use client';

import React, { useState } from 'react';
import { KeywordCategories } from '@/lib/types/p1';

interface KeywordEditorProps {
  keywords: KeywordCategories;
  onChange: (keywords: KeywordCategories) => void;
}

export default function KeywordEditor({ keywords, onChange }: KeywordEditorProps) {
  const [newKeyword, setNewKeyword] = useState('');
  const [activeCategory, setActiveCategory] = useState<keyof KeywordCategories>('core');

  const categories: { key: keyof KeywordCategories; label: string; color: string }[] = [
    { key: 'core', label: '核心关键词', color: 'blue' },
    { key: 'longTail', label: '长尾关键词', color: 'green' },
    { key: 'competitor', label: '竞品关键词', color: 'orange' },
    { key: 'scenario', label: '场景关键词', color: 'purple' },
  ];

  const addKeyword = () => {
    if (!newKeyword.trim()) return;
    const updated = {
      ...keywords,
      [activeCategory]: [...keywords[activeCategory], newKeyword.trim()],
    };
    onChange(updated);
    setNewKeyword('');
  };

  const removeKeyword = (category: keyof KeywordCategories, index: number) => {
    const updated = {
      ...keywords,
      [category]: keywords[category].filter((_, i) => i !== index),
    };
    onChange(updated);
  };

  const getColorClass = (color: string) => {
    const map: Record<string, string> = {
      blue: 'bg-blue-100 text-blue-700 border-blue-200',
      green: 'bg-green-100 text-green-700 border-green-200',
      orange: 'bg-orange-100 text-orange-700 border-orange-200',
      purple: 'bg-purple-100 text-purple-700 border-purple-200',
    };
    return map[color] || 'bg-slate-100 text-slate-700';
  };

  return (
    <div className="space-y-4">
      {/* 分类标签 */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeCategory === cat.key
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {cat.label} ({keywords[cat.key].length})
          </button>
        ))}
      </div>

      {/* 当前分类的关键词 */}
      <div className="p-4 bg-slate-50 rounded-lg min-h-[120px]">
        <div className="flex flex-wrap gap-2">
          {keywords[activeCategory].map((keyword, index) => (
            <span
              key={index}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm border ${
                getColorClass(categories.find((c) => c.key === activeCategory)?.color || '')
              }`}
            >
              {keyword}
              <button
                onClick={() => removeKeyword(activeCategory, index)}
                className="ml-1 hover:text-red-500"
              >
                ×
              </button>
            </span>
          ))}
          {keywords[activeCategory].length === 0 && (
            <span className="text-slate-400 text-sm">暂无关键词</span>
          )}
        </div>
      </div>

      {/* 添加关键词 */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newKeyword}
          onChange={(e) => setNewKeyword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
          placeholder={`添加${categories.find((c) => c.key === activeCategory)?.label}...`}
          className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          onClick={addKeyword}
          disabled={!newKeyword.trim()}
          className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50"
        >
          添加
        </button>
      </div>

      {/* 统计 */}
      <div className="flex gap-4 text-xs text-slate-500">
        <span>总计: {Object.values(keywords).flat().length} 个关键词</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/p1/KeywordEditor.tsx
git commit -m "feat: add KeywordEditor component with category tabs"
```

---

## Task 6: SubredditAndFilterEditor 组件

**Files:**
- Create: `components/p1/SubredditAndFilterEditor.tsx`

- [ ] **Step 1: 创建板块和过滤词编辑器组件**

```typescript
// components/p1/SubredditAndFilterEditor.tsx
'use client';

import React, { useState } from 'react';
import { SubredditCategories, SubredditItem } from '@/lib/types/p1';

interface SubredditAndFilterEditorProps {
  subreddits: SubredditCategories;
  filterKeywords: string[];
  onSubredditsChange: (subreddits: SubredditCategories) => void;
  onFilterKeywordsChange: (keywords: string[]) => void;
}

export default function SubredditAndFilterEditor({
  subreddits,
  filterKeywords,
  onSubredditsChange,
  onFilterKeywordsChange,
}: SubredditAndFilterEditorProps) {
  const [newSubreddit, setNewSubreddit] = useState({ name: '', reason: '' });
  const [newFilter, setNewFilter] = useState('');
  const [activeTab, setActiveTab] = useState<'high' | 'medium'>('high');

  const addSubreddit = () => {
    if (!newSubreddit.name.trim()) return;
    const item: SubredditItem = {
      name: newSubreddit.name.trim(),
      reason: newSubreddit.reason.trim() || 'AI推荐',
      estimatedPosts: 'daily',
    };
    const updated = {
      ...subreddits,
      [activeTab]: [...subreddits[activeTab], item],
    };
    onSubredditsChange(updated);
    setNewSubreddit({ name: '', reason: '' });
  };

  const removeSubreddit = (tab: 'high' | 'medium', index: number) => {
    const updated = {
      ...subreddits,
      [tab]: subreddits[tab].filter((_, i) => i !== index),
    };
    onSubredditsChange(updated);
  };

  const addFilterKeyword = () => {
    if (!newFilter.trim()) return;
    onFilterKeywordsChange([...filterKeywords, newFilter.trim()]);
    setNewFilter('');
  };

  const removeFilterKeyword = (index: number) => {
    onFilterKeywordsChange(filterKeywords.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      {/* Subreddit 列表 */}
      <div>
        <h4 className="text-sm font-semibold text-slate-900 mb-3">Reddit 板块</h4>
        
        {/* Tab */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setActiveTab('high')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium ${
              activeTab === 'high'
                ? 'bg-green-100 text-green-700'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            ⭐ 高相关 ({subreddits.high.length})
          </button>
          <button
            onClick={() => setActiveTab('medium')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium ${
              activeTab === 'medium'
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            📊 中相关 ({subreddits.medium.length})
          </button>
        </div>

        {/* 列表 */}
        <div className="space-y-2 mb-3">
          {subreddits[activeTab].map((item, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
            >
              <div>
                <span className="font-medium text-slate-900">r/{item.name}</span>
                <p className="text-xs text-slate-500">{item.reason}</p>
              </div>
              <button
                onClick={() => removeSubreddit(activeTab, index)}
                className="text-slate-400 hover:text-red-500"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        {/* 添加 Subreddit */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newSubreddit.name}
            onChange={(e) => setNewSubreddit({ ...newSubreddit, name: e.target.value })}
            placeholder="板块名称 (如: headphones)"
            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
          />
          <input
            type="text"
            value={newSubreddit.reason}
            onChange={(e) => setNewSubreddit({ ...newSubreddit, reason: e.target.value })}
            placeholder="推荐理由"
            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
          />
          <button
            onClick={addSubreddit}
            disabled={!newSubreddit.name.trim()}
            className="px-3 py-2 bg-slate-900 text-white rounded-lg text-sm disabled:opacity-50"
          >
            添加
          </button>
        </div>
      </div>

      {/* Filter Keywords */}
      <div>
        <h4 className="text-sm font-semibold text-slate-900 mb-3">
          🔍 Filter Keywords (过滤关键词)
        </h4>
        <p className="text-xs text-slate-500 mb-3">
          用于 APIFY 抓取时过滤帖子内容，提高相关性
        </p>

        <div className="flex flex-wrap gap-2 mb-3">
          {filterKeywords.map((keyword, index) => (
            <span
              key={index}
              className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm"
            >
              {keyword}
              <button
                onClick={() => removeFilterKeyword(index)}
                className="hover:text-red-500"
              >
                ×
              </button>
            </span>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={newFilter}
            onChange={(e) => setNewFilter(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addFilterKeyword()}
            placeholder="添加过滤关键词..."
            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
          />
          <button
            onClick={addFilterKeyword}
            disabled={!newFilter.trim()}
            className="px-3 py-2 bg-slate-900 text-white rounded-lg text-sm disabled:opacity-50"
          >
            添加
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/p1/SubredditAndFilterEditor.tsx
git commit -m "feat: add SubredditAndFilterEditor component"
```

---

## Task 7: ApifyConfigEditor 组件

**Files:**
- Create: `components/p1/ApifyConfigEditor.tsx`

- [ ] **Step 1: 创建 APIFY 配置编辑器组件**

```typescript
// components/p1/ApifyConfigEditor.tsx
'use client';

import React from 'react';
import { ApifySearchConfig, SearchTask, CommentsConfig, FilteringConfig } from '@/lib/types/p1';

interface ApifyConfigEditorProps {
  config: ApifySearchConfig;
  onChange: (config: ApifySearchConfig) => void;
}

export default function ApifyConfigEditor({ config, onChange }: ApifyConfigEditorProps) {
  const updateSearchTask = (index: number, updates: Partial<SearchTask>) => {
    const newSearches = [...config.searches];
    newSearches[index] = { ...newSearches[index], ...updates };
    onChange({ ...config, searches: newSearches });
  };

  const removeSearchTask = (index: number) => {
    const newSearches = config.searches.filter((_, i) => i !== index);
    onChange({ ...config, searches: newSearches });
  };

  const addSearchTask = () => {
    const newTask: SearchTask = {
      searchQuery: '',
      searchSubreddit: '',
      filterKeywords: [],
      sortOrder: 'relevance',
      timeFilter: 'week',
      maxPosts: 100,
    };
    onChange({ ...config, searches: [...config.searches, newTask] });
  };

  const updateComments = (updates: Partial<CommentsConfig>) => {
    onChange({ ...config, comments: { ...config.comments, ...updates } });
  };

  const updateFiltering = (updates: Partial<FilteringConfig>) => {
    onChange({ ...config, filtering: { ...config.filtering, ...updates } });
  };

  return (
    <div className="space-y-6">
      {/* 搜索任务列表 */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-slate-900">
            搜索任务 ({config.searches.length}个)
          </h4>
          <button
            onClick={addSearchTask}
            className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
          >
            + 添加任务
          </button>
        </div>

        <div className="space-y-4">
          {config.searches.map((task, index) => (
            <div key={index} className="p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-slate-500">
                  任务 {index + 1}
                </span>
                <button
                  onClick={() => removeSearchTask(index)}
                  className="text-slate-400 hover:text-red-500 text-sm"
                >
                  删除
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">搜索词</label>
                  <input
                    type="text"
                    value={task.searchQuery}
                    onChange={(e) => updateSearchTask(index, { searchQuery: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">板块</label>
                  <input
                    type="text"
                    value={task.searchSubreddit}
                    onChange={(e) => updateSearchTask(index, { searchSubreddit: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded text-sm"
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className="block text-xs text-slate-500 mb-1">
                  Filter Keywords (逗号分隔)
                </label>
                <input
                  type="text"
                  value={task.filterKeywords.join(', ')}
                  onChange={(e) =>
                    updateSearchTask(index, {
                      filterKeywords: e.target.value.split(',').map((k) => k.trim()).filter(Boolean),
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded text-sm"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">排序</label>
                  <select
                    value={task.sortOrder}
                    onChange={(e) =>
                      updateSearchTask(index, { sortOrder: e.target.value as SearchTask['sortOrder'] })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded text-sm"
                  >
                    <option value="relevance">相关性</option>
                    <option value="hot">热度</option>
                    <option value="top">最高赞</option>
                    <option value="new">最新</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">时间</label>
                  <select
                    value={task.timeFilter}
                    onChange={(e) =>
                      updateSearchTask(index, { timeFilter: e.target.value as SearchTask['timeFilter'] })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded text-sm"
                  >
                    <option value="hour">1小时</option>
                    <option value="day">1天</option>
                    <option value="week">1周</option>
                    <option value="month">1月</option>
                    <option value="year">1年</option>
                    <option value="all">全部</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">最大帖数</label>
                  <input
                    type="number"
                    value={task.maxPosts}
                    onChange={(e) =>
                      updateSearchTask(index, { maxPosts: parseInt(e.target.value) || 100 })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded text-sm"
                    min={1}
                    max={1000}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Comments 配置 */}
      <div className="p-4 bg-slate-50 rounded-lg">
        <h4 className="text-sm font-semibold text-slate-900 mb-3">评论抓取配置</h4>
        
        <div className="flex items-center gap-3 mb-3">
          <input
            type="checkbox"
            id="includeComments"
            checked={config.comments.includeComments}
            onChange={(e) => updateComments({ includeComments: e.target.checked })}
            className="w-4 h-4"
          />
          <label htmlFor="includeComments" className="text-sm text-slate-700">
            抓取评论
          </label>
        </div>

        {config.comments.includeComments && (
          <div className="grid grid-cols-2 gap-3 pl-7">
            <div>
              <label className="block text-xs text-slate-500 mb-1">每帖最大评论数</label>
              <input
                type="number"
                value={config.comments.maxCommentsPerPost}
                onChange={(e) =>
                  updateComments({ maxCommentsPerPost: parseInt(e.target.value) || 30 })
                }
                className="w-full px-3 py-2 border border-slate-200 rounded text-sm"
                min={1}
                max={100}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">评论深度</label>
              <input
                type="number"
                value={config.comments.commentDepth}
                onChange={(e) =>
                  updateComments({ commentDepth: parseInt(e.target.value) || 3 })
                }
                className="w-full px-3 py-2 border border-slate-200 rounded text-sm"
                min={1}
                max={10}
              />
            </div>
          </div>
        )}
      </div>

      {/* 过滤配置 */}
      <div className="p-4 bg-slate-50 rounded-lg">
        <h4 className="text-sm font-semibold text-slate-900 mb-3">过滤配置</h4>
        
        <div className="flex items-center gap-3 mb-3">
          <input
            type="checkbox"
            id="deduplicate"
            checked={config.filtering.deduplicatePosts}
            onChange={(e) => updateFiltering({ deduplicatePosts: e.target.checked })}
            className="w-4 h-4"
          />
          <label htmlFor="deduplicate" className="text-sm text-slate-700">
            自动去重
          </label>
        </div>

        <div>
          <label className="block text-xs text-slate-500 mb-1">关键词匹配范围</label>
          <select
            value={config.filtering.keywordMatchMode}
            onChange={(e) =>
              updateFiltering({ keywordMatchMode: e.target.value as FilteringConfig['keywordMatchMode'] })
            }
            className="w-full px-3 py-2 border border-slate-200 rounded text-sm"
          >
            <option value="title">仅标题</option>
            <option value="body">仅正文</option>
            <option value="title + body">标题 + 正文</option>
          </select>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/p1/ApifyConfigEditor.tsx
git commit -m "feat: add ApifyConfigEditor component for search task configuration"
```

---

## Task 8: P1ConfigFlow 主组件

**Files:**
- Create: `components/p1/P1ConfigFlow.tsx`

- [ ] **Step 1: 创建主流程组件**

```typescript
// components/p1/P1ConfigFlow.tsx
'use client';

import React, { useState } from 'react';
import ProjectInputPanel from './ProjectInputPanel';
import RoundCard from './RoundCard';
import KeywordEditor from './KeywordEditor';
import SubredditAndFilterEditor from './SubredditAndFilterEditor';
import ApifyConfigEditor from './ApifyConfigEditor';
import {
  P1Input,
  ExtractedProductInfo,
  KeywordCategories,
  SubredditCategories,
  ApifySearchConfig,
  DataCard,
  RoundState,
} from '@/lib/types/p1';
import { analyzeProject, generateRound, saveConfigCard } from '@/lib/api/p1';

interface P1ConfigFlowProps {
  onComplete?: (card: DataCard) => void;
}

export default function P1ConfigFlow({ onComplete }: P1ConfigFlowProps) {
  // 步骤状态
  const [step, setStep] = useState<'input' | 'rounds'>('input');
  
  // 输入数据
  const [inputData, setInputData] = useState<P1Input | null>(null);
  
  // AI 提取的信息
  const [extractedInfo, setExtractedInfo] = useState<ExtractedProductInfo | undefined>();
  
  // 分析状态
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // 3轮状态
  const [roundStates, setRoundStates] = useState<{
    1: RoundState;
    2: RoundState;
    3: RoundState;
  }>({
    1: { status: 'idle' },
    2: { status: 'idle' },
    3: { status: 'idle' },
  });
  
  // 3轮展开状态
  const [expandedRounds, setExpandedRounds] = useState<{
    1: boolean;
    2: boolean;
    3: boolean;
  }>({
    1: true,
    2: false,
    3: false,
  });

  // 第1轮数据：关键词
  const [keywords, setKeywords] = useState<KeywordCategories>({
    core: [],
    longTail: [],
    competitor: [],
    scenario: [],
  });

  // 第2轮数据：Subreddit + Filter Keywords
  const [subreddits, setSubreddits] = useState<SubredditCategories>({
    high: [],
    medium: [],
  });
  const [filterKeywords, setFilterKeywords] = useState<string[]>([]);

  // 第3轮数据：APIFY 配置
  const [apifyConfig, setApifyConfig] = useState<ApifySearchConfig>({
    searches: [],
    comments: {
      includeComments: true,
      maxCommentsPerPost: 30,
      commentDepth: 3,
    },
    filtering: {
      deduplicatePosts: true,
      keywordMatchMode: 'title + body',
    },
  });

  // 保存状态
  const [isSaving, setIsSaving] = useState(false);

  // 处理输入提交
  const handleInputSubmit = async (data: P1Input) => {
    setInputData(data);
    setIsAnalyzing(true);

    try {
      const result = await analyzeProject(data);
      if (result.success && result.data) {
        setExtractedInfo(result.data);
        setStep('rounds');
      } else {
        alert('分析失败：' + (result.error || '未知错误'));
      }
    } catch (error) {
      alert('分析失败，请重试');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 生成某一轮
  const generateRoundData = async (round: 1 | 2 | 3) => {
    if (!extractedInfo) return;

    setRoundStates((prev) => ({
      ...prev,
      [round]: { status: 'loading' },
    }));

    try {
      const result = await generateRound(extractedInfo, round);
      
      if (result.success && result.data) {
        // 更新对应轮次的数据
        if (round === 1 && result.data.keywords) {
          setKeywords(result.data.keywords);
        } else if (round === 2 && result.data.subreddits) {
          setSubreddits(result.data.subreddits);
          setFilterKeywords(result.data.filterKeywords || []);
        } else if (round === 3 && result.data.apifyConfig) {
          setApifyConfig(result.data.apifyConfig);
        }

        setRoundStates((prev) => ({
          ...prev,
          [round]: { status: 'success', data: result.data },
        }));

        // 自动展开下一轮
        if (round < 3) {
          setExpandedRounds((prev) => ({
            ...prev,
            [round]: false,
            [(round + 1) as 1 | 2 | 3]: true,
          }));
        }
      } else {
        throw new Error(result.error || '生成失败');
      }
    } catch (error) {
      setRoundStates((prev) => ({
        ...prev,
        [round]: { status: 'error' },
      }));
    }
  };

  // 保存配置卡
  const handleSave = async () => {
    if (!inputData || !extractedInfo) return;

    setIsSaving(true);

    const cardData: Partial<DataCard> = {
      card_name: `项目配置 - ${extractedInfo.productType || '未命名'}`,
      original_input: inputData,
      extracted_info: extractedInfo,
      keywords: {
        ...keywords,
        all: [...keywords.core, ...keywords.longTail, ...keywords.competitor, ...keywords.scenario],
      },
      subreddits,
      filterKeywords,
      apify_config: apifyConfig,
    };

    try {
      const result = await saveConfigCard(cardData);
      if (result.success && result.card) {
        onComplete?.(result.card);
        alert('配置卡已保存为草稿');
      } else {
        alert('保存失败：' + (result.error || '未知错误'));
      }
    } catch (error) {
      alert('保存失败，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  // 所有轮次是否完成
  const allRoundsComplete =
    roundStates[1].status === 'success' &&
    roundStates[2].status === 'success' &&
    roundStates[3].status === 'success';

  // 计算进度
  const completedRounds = Object.values(roundStates).filter(
    (s) => s.status === 'success'
  ).length;

  if (step === 'input') {
    return (
      <ProjectInputPanel
        onSubmit={handleInputSubmit}
        isAnalyzing={isAnalyzing}
        extractedInfo={extractedInfo}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* 进度条 */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-slate-900">项目配置</h2>
        <div className="text-sm text-slate-500">
          进度 {completedRounds}/3
        </div>
      </div>

      {/* 第1轮：关键词 */}
      <RoundCard
        round={1}
        title="第1轮：扩展关键词"
        icon="📝"
        status={roundStates[1].status}
        isExpanded={expandedRounds[1]}
        isActive={true}
        onToggle={() =>
          setExpandedRounds((prev) => ({ ...prev, 1: !prev[1] }))
        }
        onGenerate={() => generateRoundData(1)}
      >
        <KeywordEditor keywords={keywords} onChange={setKeywords} />
      </RoundCard>

      {/* 第2轮：Subreddit + Filter */}
      <RoundCard
        round={2}
        title="第2轮：推荐板块+过滤词"
        icon="🤖"
        status={roundStates[2].status}
        isExpanded={expandedRounds[2]}
        isActive={roundStates[1].status === 'success'}
        onToggle={() =>
          setExpandedRounds((prev) => ({ ...prev, 2: !prev[2] }))
        }
        onGenerate={() => generateRoundData(2)}
      >
        <SubredditAndFilterEditor
          subreddits={subreddits}
          filterKeywords={filterKeywords}
          onSubredditsChange={setSubreddits}
          onFilterKeywordsChange={setFilterKeywords}
        />
      </RoundCard>

      {/* 第3轮：APIFY 配置 */}
      <RoundCard
        round={3}
        title="第3轮：APIFY 搜索配置"
        icon="⚙️"
        status={roundStates[3].status}
        isExpanded={expandedRounds[3]}
        isActive={roundStates[2].status === 'success'}
        onToggle={() =>
          setExpandedRounds((prev) => ({ ...prev, 3: !prev[3] }))
        }
        onGenerate={() => generateRoundData(3)}
      >
        <ApifyConfigEditor config={apifyConfig} onChange={setApifyConfig} />
      </RoundCard>

      {/* 预览和保存 */}
      {allRoundsComplete && (
        <div className="glass-card mt-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900">📋 预览配置卡</h3>
              <p className="text-sm text-slate-500 mt-1">
                搜索任务: {apifyConfig.searches.length}个 | 
                覆盖板块: {subreddits.high.length + subreddits.medium.length}个 | 
                Filter Keywords: {filterKeywords.length}个
              </p>
            </div>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50"
            >
              {isSaving ? '保存中...' : '确认保存'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/p1/P1ConfigFlow.tsx
git commit -m "feat: add P1ConfigFlow main component with 3-round workflow"
```

---

## Task 9: API 客户端

**Files:**
- Create: `lib/api/p1.ts`

- [ ] **Step 1: 创建 P1 API 客户端**

```typescript
// lib/api/p1.ts

import {
  P1Input,
  ExtractedProductInfo,
  KeywordCategories,
  SubredditCategories,
  ApifySearchConfig,
  DataCard,
  ApiResponse,
} from '@/lib/types/p1';

// 分析项目
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

// 生成某一轮
export async function generateRound(
  extractedInfo: ExtractedProductInfo,
  round: 1 | 2 | 3
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
    body: JSON.stringify({ extracted_info: extractedInfo, round }),
  });

  return response.json();
}

// 保存配置卡
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
```

- [ ] **Step 2: Commit**

```bash
git add lib/api/p1.ts
git commit -m "feat: add P1 API client functions"
```

---

## Task 10: API 路由 - analyze

**Files:**
- Create: `app/api/p1/analyze/route.ts`

- [ ] **Step 1: 创建分析 API 路由**

```typescript
// app/api/p1/analyze/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { P1Input, ExtractedProductInfo } from '@/lib/types/p1';

export async function POST(request: NextRequest) {
  try {
    const input: P1Input = await request.json();

    // TODO: 调用后端 Python 服务进行分析
    // 这里先返回 mock 数据用于前端开发
    const mockExtractedInfo: ExtractedProductInfo = {
      productType: '开放式耳机',
      productName: 'Oladance OWS',
      sellingPoints: ['全天舒适', '16小时续航', '开放聆听'],
      targetAudience: ['运动爱好者', '通勤上班族'],
      competitors: ['Shokz', 'Bose', 'soundcore'],
      priceRange: '$99',
      seedKeywords: ['open ear earbuds', 'running headphones'],
    };

    return NextResponse.json({
      success: true,
      data: mockExtractedInfo,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '分析失败',
      },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/p1/analyze/route.ts
git commit -m "feat: add P1 analyze API route (mock)"
```

---

## Task 11: API 路由 - generate

**Files:**
- Create: `app/api/p1/generate/route.ts`

- [ ] **Step 1: 创建生成 API 路由**

```typescript
// app/api/p1/generate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { ExtractedProductInfo, KeywordCategories, SubredditCategories, ApifySearchConfig } from '@/lib/types/p1';

export async function POST(request: NextRequest) {
  try {
    const { extracted_info, round } = await request.json();

    // TODO: 调用后端 Python 服务进行生成
    // 这里先返回 mock 数据用于前端开发
    
    if (round === 1) {
      const mockKeywords: KeywordCategories = {
        core: ['open ear headphones', 'wireless earbuds', 'bone conduction'],
        longTail: ['comfortable earbuds all day', 'open ear vs bone conduction'],
        competitor: ['Shokz vs Oladance', 'Bose alternatives'],
        scenario: ['running headphones', 'workout earbuds', 'commuting audio'],
      };
      return NextResponse.json({ success: true, data: { keywords: mockKeywords } });
    }

    if (round === 2) {
      const mockSubreddits: SubredditCategories = {
        high: [
          { name: 'headphones', reason: '耳机讨论主社区', estimatedPosts: 'daily' },
          { name: 'running', reason: '运动场景', estimatedPosts: 'daily' },
        ],
        medium: [
          { name: 'gadgets', reason: '科技产品讨论', estimatedPosts: 'daily' },
        ],
      };
      return NextResponse.json({
        success: true,
        data: {
          subreddits: mockSubreddits,
          filterKeywords: ['comfortable', 'review', 'running', 'workout'],
        },
      });
    }

    if (round === 3) {
      const mockApifyConfig: ApifySearchConfig = {
        searches: [
          {
            searchQuery: 'open ear earbuds',
            searchSubreddit: 'headphones',
            filterKeywords: ['comfortable', 'review'],
            sortOrder: 'relevance',
            timeFilter: 'week',
            maxPosts: 100,
          },
          {
            searchQuery: 'running headphones',
            searchSubreddit: 'running',
            filterKeywords: ['workout', 'comfortable'],
            sortOrder: 'relevance',
            timeFilter: 'week',
            maxPosts: 80,
          },
        ],
        comments: {
          includeComments: true,
          maxCommentsPerPost: 30,
          commentDepth: 3,
        },
        filtering: {
          deduplicatePosts: true,
          keywordMatchMode: 'title + body',
        },
      };
      return NextResponse.json({ success: true, data: { apifyConfig: mockApifyConfig } });
    }

    return NextResponse.json({ success: false, error: 'Invalid round' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '生成失败',
      },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/p1/generate/route.ts
git commit -m "feat: add P1 generate API route (mock)"
```

---

## Task 12: API 路由 - save

**Files:**
- Create: `app/api/p1/save/route.ts`

- [ ] **Step 1: 创建保存 API 路由**

```typescript
// app/api/p1/save/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { DataCard } from '@/lib/types/p1';

export async function POST(request: NextRequest) {
  try {
    const { card_data } = await request.json();

    // TODO: 调用后端 Python 服务保存到数据库
    // 这里先返回 mock 数据用于前端开发
    const mockCard: DataCard = {
      card_id: `card-${Date.now()}`,
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

    return NextResponse.json({
      success: true,
      card: mockCard,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '保存失败',
      },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/p1/save/route.ts
git commit -m "feat: add P1 save API route (mock)"
```

---

## Task 13: Dashboard 集成

**Files:**
- Modify: `app/dashboard/page.tsx`

- [ ] **Step 1: 备份原文件**

```bash
cp app/dashboard/page.tsx app/dashboard/page.tsx.bak
```

- [ ] **Step 2: 读取当前 dashboard 内容**

```bash
cat app/dashboard/page.tsx
```

- [ ] **Step 3: 修改 Dashboard 添加 P1 配置标签页**

根据当前 dashboard 的结构进行修改，添加"项目配置"标签页。

```typescript
// app/dashboard/page.tsx
'use client';

import React, { useState } from 'react';
import BaseLayout from '@/components/BaseLayout';
import P1ConfigFlow from '@/components/p1/P1ConfigFlow';
import { DataCard } from '@/lib/types/p1';

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<'config' | 'other'>('config');
  const [savedCards, setSavedCards] = useState<DataCard[]>([]);

  const handleP1Complete = (card: DataCard) => {
    setSavedCards([...savedCards, card]);
    // 可以在这里添加切换到其他标签页的逻辑
  };

  return (
    <BaseLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">Dashboard</h1>
      </div>

      {/* 标签页 */}
      <div className="flex gap-2 mb-6 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('config')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'config'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          项目配置
        </button>
        <button
          onClick={() => setActiveTab('other')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'other'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          其他功能
        </button>
      </div>

      {/* 内容区 */}
      {activeTab === 'config' && <P1ConfigFlow onComplete={handleP1Complete} />}
      
      {activeTab === 'other' && (
        <div className="glass-card">
          <p className="text-slate-500">其他功能待开发...</p>
        </div>
      )}
    </BaseLayout>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "feat: integrate P1 config into dashboard with tabs"
```

---

## Task 14: 测试运行

- [ ] **Step 1: 安装所有依赖**

```bash
npm install
```

- [ ] **Step 2: 运行开发服务器**

```bash
npm run dev
```

- [ ] **Step 3: 测试 P1 流程**

访问 `http://localhost:3000/dashboard`，测试：
1. 项目配置标签页是否显示
2. 输入产品描述，点击"开始分析"
3. 检查 AI 信息是否正确显示
4. 依次完成 3 轮生成
5. 编辑关键词/板块/搜索任务
6. 点击"确认保存"

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "chore: test and verify P1 config flow"
```

---

## 后续工作（可选）

### 连接真实后端

将 API 路由中的 mock 数据替换为真实调用：

```typescript
// app/api/p1/analyze/route.ts
// 替换 mock 为真实调用:
const response = await fetch('http://localhost:5000/api/p1/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(input),
});
return response.json();
```

### 添加附件上传支持

实现文件上传 API，支持 PDF/Word/Excel 解析：

```typescript
// app/api/upload/route.ts
// 处理文件上传并返回 URL
```

### 错误处理增强

添加更详细的错误提示和重试机制。

---

**计划完成。**
