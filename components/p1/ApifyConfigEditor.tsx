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
