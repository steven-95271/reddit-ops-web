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
