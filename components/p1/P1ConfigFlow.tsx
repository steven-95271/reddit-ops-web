'use client';

import React, { useState, useEffect } from 'react';
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
import { analyzeProject, generateRound, saveConfigCard, scrapeWebsite } from '@/lib/api/p1';

// 生成结果确认 Popup
interface GenerationResult {
  round: 1 | 2 | 3;
  success: boolean;
  model: string;
  logic: string;
  data: any;
  error?: string;
}

interface P1ConfigFlowProps {
  onComplete?: (card: DataCard) => void;
}

const STORAGE_KEY = 'p1-config-flow';

function loadFromStorage(): any {
  if (typeof window === 'undefined') return null;
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

function saveToStorage(data: any) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

function clearStorage() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export default function P1ConfigFlow({ onComplete }: P1ConfigFlowProps) {
  // 从 localStorage 恢复状态
  const savedState = loadFromStorage();

  const [step, setStep] = useState<'input' | 'rounds'>(savedState?.step || 'input');
  const [inputData, setInputData] = useState<P1Input | null>(savedState?.inputData || null);
  const [extractedInfo, setExtractedInfo] = useState<ExtractedProductInfo | undefined>(savedState?.extractedInfo);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const [roundStates, setRoundStates] = useState<{
    1: RoundState;
    2: RoundState;
    3: RoundState;
  }>(savedState?.roundStates || {
    1: { status: 'idle' },
    2: { status: 'idle' },
    3: { status: 'idle' },
  });
  
  const [expandedRounds, setExpandedRounds] = useState<{
    1: boolean;
    2: boolean;
    3: boolean;
  }>(savedState?.expandedRounds || {
    1: true,
    2: false,
    3: false,
  });

  const [keywords, setKeywords] = useState<KeywordCategories>(savedState?.keywords || {
    brand: [],
    product: [],
    category: [],
    comparison: [],
    scenario: [],
    problem: [],
  });

  const [subreddits, setSubreddits] = useState<SubredditCategories>(savedState?.subreddits || {
    high: [],
    medium: [],
  });
  const [filterKeywords, setFilterKeywords] = useState<string[]>(savedState?.filterKeywords || []);

  const [apifyConfig, setApifyConfig] = useState<ApifySearchConfig>(savedState?.apifyConfig || {
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

  const [isSaving, setIsSaving] = useState(false);
  const [showResultPopup, setShowResultPopup] = useState(false);
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null);
  const [userFeedback, setUserFeedback] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);

  // 自动保存到 localStorage
  useEffect(() => {
    saveToStorage({
      step,
      inputData,
      extractedInfo,
      roundStates,
      expandedRounds,
      keywords,
      subreddits,
      filterKeywords,
      apifyConfig,
    });
  }, [step, inputData, extractedInfo, roundStates, expandedRounds, keywords, subreddits, filterKeywords, apifyConfig]);

  const handleInputSubmit = async (data: P1Input) => {
    setInputData(data);
    setIsAnalyzing(true);

    try {
      // 如果是网站模式，先抓取网站内容
      let analysisData = data;
      if (data.websiteUrl) {
        console.log(`Scraping website: ${data.websiteUrl}`);
        const scrapeResult = await scrapeWebsite(data.websiteUrl);
        if (scrapeResult.success && scrapeResult.data) {
          // 将网站内容合并到描述中
          analysisData = {
            ...data,
            description: `${data.description}\n\n网站标题: ${scrapeResult.data.title}\n网站内容: ${scrapeResult.data.content}`,
          };
          console.log(`Website scraped successfully: ${scrapeResult.data.contentLength} characters`);
        } else {
          console.warn('Website scraping failed, continuing with user input only');
        }
      }

      const result = await analyzeProject(analysisData);
      if (result.success && result.data) {
        setExtractedInfo(result.data);
        setStep('rounds');
      } else {
        alert('分析失败：' + (result.error || '未知错误'));
      }
    } catch {
      alert('分析失败，请重试');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateRoundData = async (round: 1 | 2 | 3) => {
    if (!extractedInfo) return;

    setRoundStates((prev) => ({
      ...prev,
      [round]: { status: 'loading' },
    }));

    try {
      const result = await generateRound(extractedInfo, round);
      
      if (result.success && result.data) {
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

        // 显示结果 Popup
        const roundLogic = {
          1: '基于产品描述和种子关键词，AI 分析 Reddit 用户搜索习惯，生成 6 类关键词（品牌/型号/品类/对比/场景/问题），总计 18-31 个。品牌词=品牌名和产品名，型号词=具体型号，品类词=品类通用词，对比词=vs/alternative/review，场景词=使用场景词，问题词=痛点/问题词。如未提供竞品信息，AI 将基于产品类型自动推断。',
          2: '结合目标人群和关键词，AI 推荐高/中相关度 Subreddits，并提取用于过滤帖子内容的 Filter Keywords。',
          3: '整合所有信息，AI 生成 4-6 个差异化搜索任务，每个任务包含搜索词、板块、过滤词、时间范围和排序方式。',
        };

        const totalKeywords = round === 1 ? 
          (result.data.keywords?.brand?.length || 0) + 
          (result.data.keywords?.product?.length || 0) + 
          (result.data.keywords?.category?.length || 0) + 
          (result.data.keywords?.comparison?.length || 0) + 
          (result.data.keywords?.scenario?.length || 0) + 
          (result.data.keywords?.problem?.length || 0) : 0;

        setGenerationResult({
          round,
          success: true,
          model: 'Qwen3.6 Plus Free（主） / MiniMax-M2.7-Highspeed（备用）',
          logic: roundLogic[round],
          data: {
            keywords: round === 1 ? result.data.keywords : undefined,
            subreddits: round === 2 ? result.data.subreddits : undefined,
            filterKeywords: round === 2 ? result.data.filterKeywords : undefined,
            apifyConfig: round === 3 ? result.data.apifyConfig : undefined,
            totalKeywords,
          },
        });
        setShowResultPopup(true);

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

      setGenerationResult({
        round,
        success: false,
        model: 'Qwen3.6 Plus Free（主） / MiniMax-M2.7-Highspeed（备用）',
        logic: 'AI 调用失败，已使用本地 fallback 逻辑生成基础数据。',
        data: null,
        error: error instanceof Error ? error.message : '未知错误',
      });
      setShowResultPopup(true);
    }
  };

  const handleSave = async () => {
    if (!inputData || !extractedInfo) return;

    setIsSaving(true);

    const cardData: Partial<DataCard> = {
      card_name: `项目配置 - ${extractedInfo.productType || '未命名'}`,
      original_input: inputData,
      extracted_info: extractedInfo,
      keywords: {
        ...keywords,
        all: [...keywords.brand, ...keywords.product, ...keywords.category, ...keywords.comparison, ...keywords.scenario, ...keywords.problem],
      },
      subreddits,
      filterKeywords,
      apify_config: apifyConfig,
    };

    try {
      const result = await saveConfigCard(cardData);
      if (result.success && result.card) {
        onComplete?.(result.card);
        clearStorage();
        alert('配置卡已保存为草稿');
      } else {
        alert('保存失败：' + (result.error || '未知错误'));
      }
    } catch {
      alert('保存失败，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    clearStorage();
    setStep('input');
    setInputData(null);
    setExtractedInfo(undefined);
    setRoundStates({ 1: { status: 'idle' }, 2: { status: 'idle' }, 3: { status: 'idle' } });
    setExpandedRounds({ 1: true, 2: false, 3: false });
    setKeywords({ brand: [], product: [], category: [], comparison: [], scenario: [], problem: [] });
    setSubreddits({ high: [], medium: [] });
    setFilterKeywords([]);
    setApifyConfig({
      searches: [],
      comments: { includeComments: true, maxCommentsPerPost: 30, commentDepth: 3 },
      filtering: { deduplicatePosts: true, keywordMatchMode: 'title + body' },
    });
  };

  // 基于用户反馈重新生成
  const handleRegenerateWithFeedback = async () => {
    if (!generationResult || !userFeedback.trim()) return;
    
    setIsRegenerating(true);
    setGenerationResult(null);
    setUserFeedback('');

    try {
      // 调用 API 重新生成，带上用户反馈
      const result = await generateRound(extractedInfo!, generationResult.round, userFeedback);
      
      if (result.success && result.data) {
        const round = generationResult.round;
        
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

        // 显示新的结果 Popup
        const roundLogic = {
          1: '基于您的反馈，AI 重新调整了关键词策略，生成了更精准的关键词。',
          2: '基于您的反馈，AI 重新推荐了更相关的 Subreddits 和 Filter Keywords。',
          3: '基于您的反馈，AI 重新优化了搜索策略配置。',
        };

        const totalKeywords = round === 1 ? 
          (result.data.keywords?.brand?.length || 0) + 
          (result.data.keywords?.product?.length || 0) + 
          (result.data.keywords?.category?.length || 0) + 
          (result.data.keywords?.comparison?.length || 0) + 
          (result.data.keywords?.scenario?.length || 0) + 
          (result.data.keywords?.problem?.length || 0) : 0;

        setGenerationResult({
          round,
          success: true,
          model: 'Qwen3.6 Plus Free（主） / MiniMax-M2.7-Highspeed（备用）',
          logic: roundLogic[round],
          data: {
            keywords: round === 1 ? result.data.keywords : undefined,
            subreddits: round === 2 ? result.data.subreddits : undefined,
            filterKeywords: round === 2 ? result.data.filterKeywords : undefined,
            apifyConfig: round === 3 ? result.data.apifyConfig : undefined,
            totalKeywords,
          },
        });
        setShowResultPopup(true);

        if (round < 3) {
          setExpandedRounds((prev) => ({
            ...prev,
            [round]: false,
            [(round + 1) as 1 | 2 | 3]: true,
          }));
        }
      } else {
        throw new Error(result.error || '重新生成失败');
      }
    } catch (error) {
      setGenerationResult({
        round: generationResult.round,
        success: false,
        model: 'Qwen3.6 Plus Free（主） / MiniMax-M2.7-Highspeed（备用）',
        logic: '重新生成失败，请检查网络连接或稍后重试。',
        data: null,
        error: error instanceof Error ? error.message : '未知错误',
      });
      setShowResultPopup(true);
    } finally {
      setIsRegenerating(false);
    }
  };

  const allRoundsComplete =
    roundStates[1].status === 'success' &&
    roundStates[2].status === 'success' &&
    roundStates[3].status === 'success';

  const completedRounds = Object.values(roundStates).filter(
    (s) => s.status === 'success'
  ).length;

  if (step === 'input') {
    return (
      <div className="space-y-6">
        {/* 说明卡片 */}
        <div className="glass-card bg-blue-50/50 border-l-4 border-l-blue-500">
          <h3 className="text-md font-bold text-slate-900 mb-3">📖 P1 项目配置说明</h3>
          <div className="space-y-3 text-sm text-slate-700">
            <div>
              <span className="font-semibold">作用：</span>
              将模糊的产品信息转化为精准的 Reddit 搜索策略，为后续 P2 内容抓取提供配置。
            </div>
            <div>
              <span className="font-semibold">流程：</span>
              输入产品描述 → AI 分析提取信息 → 3轮AI对话生成配置 → 确认保存为草稿
            </div>
            <div>
              <span className="font-semibold">AI 模型：</span>
              主模型 Qwen3.6 Plus Free，备用模型 MiniMax-M2.7-Highspeed（自动降级）
            </div>
            <div>
              <span className="font-semibold">输出：</span>
              18-31个关键词 + 5-8个 Subreddit 推荐 + 4-6个 APIFY 搜索任务
            </div>
          </div>
        </div>

        <ProjectInputPanel
          onSubmit={handleInputSubmit}
          isAnalyzing={isAnalyzing}
          extractedInfo={extractedInfo}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 说明卡片 */}
      <div className="glass-card bg-blue-50/50 border-l-4 border-l-blue-500">
        <h3 className="text-md font-bold text-slate-900 mb-3">📖 P1 项目配置说明</h3>
        <div className="space-y-3 text-sm text-slate-700">
          <div>
            <span className="font-semibold">作用：</span>
            将模糊的产品信息转化为精准的 Reddit 搜索策略，为后续 P2 内容抓取提供配置。
          </div>
          <div>
            <span className="font-semibold">流程：</span>
            输入产品描述 → AI 分析提取信息 → 3轮AI对话生成配置 → 确认保存为草稿
          </div>
          <div>
            <span className="font-semibold">AI 模型：</span>
            主模型 Qwen3.6 Plus Free，备用模型 MiniMax-M2.7-Highspeed（自动降级）
          </div>
          <div>
            <span className="font-semibold">输出：</span>
            18-31个关键词 + 5-8个 Subreddit 推荐 + 4-6个 APIFY 搜索任务
          </div>
        </div>
      </div>

      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">项目配置</h2>
          <p className="text-sm text-slate-500">
            {extractedInfo?.productType && `产品类型: ${extractedInfo.productType}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-slate-500">
            进度 {completedRounds}/3
          </div>
          <button
            onClick={handleReset}
            className="text-sm text-slate-400 hover:text-slate-600"
          >
            重新开始
          </button>
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

      {/* 生成结果 Popup */}
      {showResultPopup && generationResult && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowResultPopup(false);
              setUserFeedback('');
            }
          }}
        >
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            {/* 头部 */}
            <div className={`p-6 border-b ${generationResult.success ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">
                  {generationResult.success ? '✅ 生成成功' : '❌ 生成失败'}
                </h3>
                <button
                  onClick={() => setShowResultPopup(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                第 {generationResult.round} 轮生成结果
              </p>
            </div>

            {/* 内容 */}
            <div className="p-6 space-y-4">
              {/* AI 模型 */}
              <div>
                <h4 className="text-sm font-semibold text-slate-900 mb-2">🤖 AI 模型</h4>
                <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">
                  {generationResult.model}
                </p>
              </div>

              {/* 生成逻辑 */}
              <div>
                <h4 className="text-sm font-semibold text-slate-900 mb-2">📋 生成逻辑</h4>
                <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">
                  {generationResult.logic}
                </p>
              </div>

              {/* 生成结果 */}
              {generationResult.success && generationResult.data && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 mb-2">📊 生成结果</h4>
                  <div className="bg-slate-50 p-4 rounded-lg space-y-3">
                    {generationResult.data.totalKeywords && (
                      <div>
                        <span className="text-sm text-slate-500">关键词总数：</span>
                        <span className="text-sm font-bold text-slate-900">
                          {generationResult.data.totalKeywords} 个
                        </span>
                      </div>
                    )}
                    {generationResult.data.keywords && (
                      <div className="space-y-2">
                        {/* 品牌关键词 */}
                        <details className="bg-blue-50 rounded-lg" open>
                          <summary className="px-3 py-2 text-sm font-medium text-blue-800 cursor-pointer">
                            品牌关键词 ({generationResult.data.keywords.brand?.length || 0}个)
                          </summary>
                          <div className="px-3 pb-3 flex flex-wrap gap-1">
                            {generationResult.data.keywords.brand?.map((kw: string, i: number) => (
                              <span key={i} className="px-2 py-1 bg-white text-blue-700 rounded text-xs border border-blue-200">
                                {kw}
                              </span>
                            ))}
                          </div>
                        </details>
                        {/* 型号关键词 */}
                        <details className="bg-cyan-50 rounded-lg">
                          <summary className="px-3 py-2 text-sm font-medium text-cyan-800 cursor-pointer">
                            型号关键词 ({generationResult.data.keywords.product?.length || 0}个)
                          </summary>
                          <div className="px-3 pb-3 flex flex-wrap gap-1">
                            {generationResult.data.keywords.product?.map((kw: string, i: number) => (
                              <span key={i} className="px-2 py-1 bg-white text-cyan-700 rounded text-xs border border-cyan-200">
                                {kw}
                              </span>
                            ))}
                          </div>
                        </details>
                        {/* 品类关键词 */}
                        <details className="bg-teal-50 rounded-lg">
                          <summary className="px-3 py-2 text-sm font-medium text-teal-800 cursor-pointer">
                            品类关键词 ({generationResult.data.keywords.category?.length || 0}个)
                          </summary>
                          <div className="px-3 pb-3 flex flex-wrap gap-1">
                            {generationResult.data.keywords.category?.map((kw: string, i: number) => (
                              <span key={i} className="px-2 py-1 bg-white text-teal-700 rounded text-xs border border-teal-200">
                                {kw}
                              </span>
                            ))}
                          </div>
                        </details>
                        {/* 对比关键词 */}
                        <details className="bg-green-50 rounded-lg">
                          <summary className="px-3 py-2 text-sm font-medium text-green-800 cursor-pointer">
                            对比关键词 ({generationResult.data.keywords.comparison?.length || 0}个)
                          </summary>
                          <div className="px-3 pb-3 flex flex-wrap gap-1">
                            {generationResult.data.keywords.comparison?.map((kw: string, i: number) => (
                              <span key={i} className="px-2 py-1 bg-white text-green-700 rounded text-xs border border-green-200">
                                {kw}
                              </span>
                            ))}
                          </div>
                        </details>
                        {/* 场景关键词 */}
                        <details className="bg-purple-50 rounded-lg">
                          <summary className="px-3 py-2 text-sm font-medium text-purple-800 cursor-pointer">
                            场景关键词 ({generationResult.data.keywords.scenario?.length || 0}个)
                          </summary>
                          <div className="px-3 pb-3 flex flex-wrap gap-1">
                            {generationResult.data.keywords.scenario?.map((kw: string, i: number) => (
                              <span key={i} className="px-2 py-1 bg-white text-purple-700 rounded text-xs border border-purple-200">
                                {kw}
                              </span>
                            ))}
                          </div>
                        </details>
                        {/* 问题关键词 */}
                        <details className="bg-red-50 rounded-lg">
                          <summary className="px-3 py-2 text-sm font-medium text-red-800 cursor-pointer">
                            问题关键词 ({generationResult.data.keywords.problem?.length || 0}个)
                          </summary>
                          <div className="px-3 pb-3 flex flex-wrap gap-1">
                            {generationResult.data.keywords.problem?.map((kw: string, i: number) => (
                              <span key={i} className="px-2 py-1 bg-white text-red-700 rounded text-xs border border-red-200">
                                {kw}
                              </span>
                            ))}
                          </div>
                        </details>
                        {/* 复制全部 */}
                        <button
                          onClick={() => {
                            const all = [
                              ...(generationResult.data.keywords.brand || []),
                              ...(generationResult.data.keywords.product || []),
                              ...(generationResult.data.keywords.category || []),
                              ...(generationResult.data.keywords.comparison || []),
                              ...(generationResult.data.keywords.scenario || []),
                              ...(generationResult.data.keywords.problem || []),
                            ].join(', ');
                            navigator.clipboard.writeText(all);
                          }}
                          className="w-full py-2 text-xs text-slate-500 hover:text-slate-700 border border-dashed border-slate-300 rounded hover:bg-slate-100 transition-colors"
                        >
                          📋 复制全部关键词
                        </button>
                      </div>
                    )}
                    {generationResult.data.subreddits && (
                      <div className="space-y-2">
                        <details className="bg-green-50 rounded-lg" open>
                          <summary className="px-3 py-2 text-sm font-medium text-green-800 cursor-pointer">
                            高相关 Subreddit ({generationResult.data.subreddits.high?.length || 0}个)
                          </summary>
                          <div className="px-3 pb-3 space-y-1">
                            {generationResult.data.subreddits.high?.map((s: any, i: number) => (
                              <div key={i} className="text-xs text-green-700">
                                <span className="font-medium">r/{s.name}</span> - {s.reason}
                              </div>
                            ))}
                          </div>
                        </details>
                        <details className="bg-yellow-50 rounded-lg">
                          <summary className="px-3 py-2 text-sm font-medium text-yellow-800 cursor-pointer">
                            中相关 Subreddit ({generationResult.data.subreddits.medium?.length || 0}个)
                          </summary>
                          <div className="px-3 pb-3 space-y-1">
                            {generationResult.data.subreddits.medium?.map((s: any, i: number) => (
                              <div key={i} className="text-xs text-yellow-700">
                                <span className="font-medium">r/{s.name}</span> - {s.reason}
                              </div>
                            ))}
                          </div>
                        </details>
                      </div>
                    )}
                    {generationResult.data.filterKeywords && (
                      <div>
                        <span className="text-sm text-slate-500">Filter Keywords：</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {generationResult.data.filterKeywords.map((kw: string, i: number) => (
                            <span key={i} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {generationResult.data.apifyConfig && (
                      <div className="space-y-2">
                        <details className="bg-slate-100 rounded-lg" open>
                          <summary className="px-3 py-2 text-sm font-medium text-slate-800 cursor-pointer">
                            搜索任务 ({generationResult.data.apifyConfig.searches?.length || 0}个)
                          </summary>
                          <div className="px-3 pb-3 space-y-2">
                            {generationResult.data.apifyConfig.searches?.map((task: any, i: number) => (
                              <div key={i} className="text-xs bg-white p-2 rounded border">
                                <div className="font-medium text-slate-900">任务 {i + 1}</div>
                                <div className="text-slate-600 mt-1">
                                  搜索词: {task.searchQuery} | 板块: r/{task.searchSubreddit}
                                </div>
                                <div className="text-slate-500 mt-0.5">
                                  过滤词: {task.filterKeywords?.join(', ')} | 时间: {task.timeFilter} | 数量: {task.maxPosts}
                                </div>
                              </div>
                            ))}
                          </div>
                        </details>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 错误信息 */}
              {generationResult.error && (
                <div>
                  <h4 className="text-sm font-semibold text-red-600 mb-2">⚠️ 错误信息</h4>
                  <p className="text-sm text-red-500 bg-red-50 p-3 rounded-lg">
                    {generationResult.error}
                  </p>
                </div>
              )}
            </div>

            {/* 底部按钮 */}
            <div className="p-6 border-t space-y-4">
              {/* 用户反馈区域 */}
              {generationResult.success && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 mb-2">💬 需要调整？</h4>
                  <p className="text-xs text-slate-500 mb-2">
                    AI 将基于您的反馈重新生成第 {generationResult.round} 轮结果，原有结果将被完全替换。
                  </p>
                  <textarea
                    value={userFeedback}
                    onChange={(e) => setUserFeedback(e.target.value)}
                    placeholder="例如：需要更多运动相关关键词、竞品词不够、Subreddit 太泛了..."
                    className="w-full h-20 p-3 border border-slate-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}

              <div className="flex justify-end gap-3">
                {!generationResult.success && (
                  <button
                    onClick={() => {
                      setShowResultPopup(false);
                      generateRoundData(generationResult.round);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    重新生成
                  </button>
                )}
                {generationResult.success && userFeedback.trim() && (
                  <button
                    onClick={handleRegenerateWithFeedback}
                    disabled={isRegenerating}
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                  >
                    {isRegenerating ? '重新生成中...' : '基于反馈重新生成'}
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowResultPopup(false);
                    setUserFeedback('');
                  }}
                  className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800"
                >
                  确认并继续
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
