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
            高相关 ({subreddits.high.length})
          </button>
          <button
            onClick={() => setActiveTab('medium')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium ${
              activeTab === 'medium'
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            中相关 ({subreddits.medium.length})
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
          Filter Keywords (过滤关键词)
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
