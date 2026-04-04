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
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const hasInput = description.trim() || websiteUrl.trim() || attachments.length > 0;

  const handleSubmit = () => {
    if (!hasInput) {
      alert('请至少填写一项：产品描述、网站网址或上传文件');
      return;
    }

    // 合并所有输入信息
    let finalDescription = description;
    if (websiteUrl) {
      finalDescription += `\n\n网站网址: ${websiteUrl}`;
    }
    if (attachments.length > 0) {
      finalDescription += `\n\n附件: ${attachments.map(a => a.name).join(', ')}`;
    }

    onSubmit({ 
      description: finalDescription.trim(), 
      attachments,
      websiteUrl: websiteUrl || undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* 输入区域 */}
      <div className="glass-card">
        <h2 className="text-lg font-bold text-slate-900 mb-4">
          描述您的产品/项目
        </h2>
        <p className="text-sm text-slate-500 mb-6">
          请至少填写以下一项，AI 将自动分析并提取产品信息
        </p>
        
        <div className="space-y-6">
          {/* 1. 文字描述 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              ✍️ 产品描述 <span className="text-slate-400 font-normal">（可选）</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="例如：Oladance 开放式耳机，主打全天佩戴舒适，续航16小时，售价$99。目标人群是运动爱好者和通勤上班族..."
              className="w-full h-24 p-4 border border-slate-200 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>

          {/* 2. 网站分析 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              🌐 网站网址 <span className="text-slate-400 font-normal">（可选）</span>
            </label>
            <input
              type="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://www.example.com"
              className="w-full p-4 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
            <p className="text-xs text-slate-400 mt-1">
              AI 将通过 Jina Reader 自动抓取网站内容，分析产品信息、核心卖点、目标人群和竞品
            </p>
          </div>

          {/* 3. 文件上传 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              📎 文件上传 <span className="text-slate-400 font-normal">（可选）</span>
            </label>
            <FileUpload files={attachments} onChange={setAttachments} />
            <p className="text-xs text-slate-400 mt-1">
              支持 PDF, Word, Excel, 图片（最大 10MB）
            </p>
          </div>

          {/* 提交按钮 */}
          <button
            onClick={handleSubmit}
            disabled={isAnalyzing || !hasInput}
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
            AI 识别到的信息
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
