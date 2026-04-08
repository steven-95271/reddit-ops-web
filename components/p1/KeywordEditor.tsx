'use client';

import React, { useState } from 'react';
import { KeywordCategories, KeywordItem } from '@/lib/types/p1';

interface KeywordEditorProps {
  keywords: KeywordCategories;
  onChange: (keywords: KeywordCategories) => void;
}

export default function KeywordEditor({ keywords, onChange }: KeywordEditorProps) {
  const [newKeyword, setNewKeyword] = useState('');
  const [newReason, setNewReason] = useState('');
  const [activeCategory, setActiveCategory] = useState<keyof Omit<KeywordCategories, 'reasoning'>>('brand');

  const categories: { key: keyof Omit<KeywordCategories, 'reasoning'>; label: string; color: string }[] = [
    { key: 'brand', label: '品牌关键词', color: 'blue' },
    { key: 'product', label: '型号关键词', color: 'cyan' },
    { key: 'category', label: '品类关键词', color: 'teal' },
    { key: 'comparison', label: '对比关键词', color: 'green' },
    { key: 'scenario', label: '场景关键词', color: 'purple' },
    { key: 'problem', label: '问题关键词', color: 'red' },
  ];

  const addKeyword = () => {
    if (!newKeyword.trim()) return;
    const newItem: KeywordItem = {
      keyword: newKeyword.trim(),
      reason: newReason.trim(),
      wordCount: newKeyword.trim().split(' ').length,
    };
    const updated = {
      ...keywords,
      [activeCategory]: [...(keywords[activeCategory] || []), newItem],
    };
    onChange(updated);
    setNewKeyword('');
    setNewReason('');
  };

  const removeKeyword = (category: keyof Omit<KeywordCategories, 'reasoning'>, index: number) => {
    const updated = {
      ...keywords,
      [category]: (keywords[category] || []).filter((_, i) => i !== index),
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

  const totalKeywords = Object.keys(categories).reduce((acc, key) => {
    return acc + (keywords[key as keyof Omit<KeywordCategories, 'reasoning'>]?.length || 0);
  }, 0);

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
            {cat.label} ({(keywords[cat.key] || []).length})
          </button>
        ))}
      </div>

      {/* 当前分类的关键词 */}
      <div className="p-4 bg-slate-50 rounded-lg min-h-[120px]">
        <div className="flex flex-wrap gap-2">
          {(keywords[activeCategory] || []).map((item, index) => (
            <div key={index} className="flex flex-col gap-1">
              <span
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm border ${
                  getColorClass(categories.find((c) => c.key === activeCategory)?.color || '')
                }`}
              >
                {item.keyword}
                <button
                  onClick={() => removeKeyword(activeCategory, index)}
                  className="ml-1 hover:text-red-500"
                >
                  ×
                </button>
              </span>
              {item.reason && (
                <span className="text-xs text-slate-500 ml-2">{item.reason}</span>
              )}
            </div>
          ))}
          {(keywords[activeCategory] || []).length === 0 && (
            <span className="text-slate-400 text-sm">暂无关键词</span>
          )}
        </div>
      </div>

      {/* 添加关键词 */}
      <div className="space-y-2">
        <input
          type="text"
          value={newKeyword}
          onChange={(e) => setNewKeyword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
          placeholder={`添加${categories.find((c) => c.key === activeCategory)?.label}...`}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <input
          type="text"
          value={newReason}
          onChange={(e) => setNewReason(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
          placeholder="生成理由（可选）..."
          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
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
        <span>总计: {totalKeywords} 个关键词</span>
      </div>
    </div>
  );
}
