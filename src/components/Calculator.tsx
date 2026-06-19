import React, { useState, useMemo, useEffect } from 'react';
import { Gavel, Calculator as CalculatorIcon, Database, BarChart3, Trash2, History, Settings, ToggleLeft, ToggleRight } from 'lucide-react';
import { CalculatorInput, formatCurrency, GameMode, GAME_MODE_CONFIGS } from '../utils/calculator';
import { smartCalculate, SmartCalculatorOutput, historicalDataManager } from '../utils/smartCalculator';
import { useGameDataStore } from '../utils/gameDataManager';
import { useCollectionStore } from '../utils/collectionManager';
import { ResultPanel } from './ResultPanel';
import { DataInputPanel } from './DataInputPanel';
import { AnalyticsPanel } from './AnalyticsPanel';
import { GridPrices, loadGridPrices, saveGridPrices, PRICE_LABELS, silverToWan } from '../utils/gridPrices';

type TabType = 'calculator' | 'data' | 'analytics';

export const Calculator: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('calculator');
  const [input, setInput] = useState<CalculatorInput>({
    round: 1,
    qualities: {
      white: {},
      green: {},
      blue: {},
      purple: {},
      gold: {},
      red: {},
    },
  });
  const [showValuation, setShowValuation] = useState(false);
  const [showActualPriceModal, setShowActualPriceModal] = useState(false);
  const [actualPrice, setActualPrice] = useState<string>('');
  const [pendingSaveData, setPendingSaveData] = useState<any>(null);
  const [premiumTotalCount, setPremiumTotalCount] = useState<number | undefined>(undefined);
  const [actuarialMode, setActuarialMode] = useState(() => localStorage.getItem('auction_king_actuarial_mode') === 'true');
  const [showPriceConfig, setShowPriceConfig] = useState(false);

  const { currentGame, updateGameData } = useGameDataStore();
  const { addRecord } = useCollectionStore();

  useEffect(() => {
    if (currentGame) {
      setInput(prev => {
        const mergedQualities = {
          white: { ...prev.qualities.white, ...currentGame.qualities.white },
          green: { ...prev.qualities.green, ...currentGame.qualities.green },
          blue: { ...prev.qualities.blue, ...currentGame.qualities.blue },
          purple: { ...prev.qualities.purple, ...currentGame.qualities.purple },
          gold: { ...prev.qualities.gold, ...currentGame.qualities.gold },
          red: { ...prev.qualities.red, ...currentGame.qualities.red },
        };

        // OCR检测的BidKing风格格子数据 → 映射到input
        const ga = currentGame.gridActuarial;
        let ocrGridData = prev.ocrGridData;
        if (ga && Object.keys(ga).length > 0) {
          ocrGridData = { ...prev.ocrGridData, ...ga };

          // 自动填充品质字段 (仅当手填为空时)
          if (ga.purpleAvg && !mergedQualities.purple.avgSlots) mergedQualities.purple.avgSlots = ga.purpleAvg;
          if (ga.purpleSlots && !mergedQualities.purple.slots) mergedQualities.purple.slots = ga.purpleSlots;
          if (ga.purpleCount && !mergedQualities.purple.count) mergedQualities.purple.count = ga.purpleCount;
          if (ga.goldSlots && !mergedQualities.gold.slots) mergedQualities.gold.slots = ga.goldSlots;
          if (ga.goldCount && !mergedQualities.gold.count) mergedQualities.gold.count = ga.goldCount;
          if (ga.goldAvg && !mergedQualities.gold.avgSlots) mergedQualities.gold.avgSlots = ga.goldAvg;
          if (ga.redSlots && !mergedQualities.red.slots) mergedQualities.red.slots = ga.redSlots;
          if (ga.redCount && !mergedQualities.red.count) mergedQualities.red.count = ga.redCount;
        }

        return {
          ...prev,
          round: currentGame.currentRound,
          character: currentGame.character as any,
          totalItems: currentGame.warehouseInfo?.totalItems,
          totalSlots: currentGame.warehouseInfo?.totalSlots ?? (ga?.T || undefined),
          qualities: mergedQualities,
          ocrGridData: ocrGridData,
        };
      });
    }
  }, [currentGame]);

  const result: SmartCalculatorOutput | null = useMemo(() => {
    const hasData = 
      input.totalItems || 
      input.totalSlots || 
      Object.values(input.qualities).some(q => q.count || q.slots);
    
    if (!hasData) return null;
    
    return smartCalculate(input);
  }, [input]);

  // 根据优品总数自动计算红色件数
  useEffect(() => {
    if (premiumTotalCount !== undefined) {
      const purpleCount = input.qualities.purple?.count || 0;
      const goldCount = input.qualities.gold?.count || 0;
      const redCount = Math.max(0, premiumTotalCount - purpleCount - goldCount);
      
      if (redCount !== input.qualities.red?.count) {
        updateQuality('red', { count: redCount });
      }
    }
  }, [premiumTotalCount, input.qualities.purple?.count, input.qualities.gold?.count]);

  // 计算最有可能的件数（avgSlots使count*avgSlots最接近整数）
  // 返回多个候选 count 值，按 diff 从小到大排序
  const getMostLikelyCounts = (
    avgSlots: number | undefined,
    maxCount: number = 50,
    tolerance: number = 0.05
  ): number[] => {
    if (!avgSlots || avgSlots <= 0) return [];
    const upperBound = maxCount || 50;
    const candidates: { count: number; diff: number }[] = [];

    for (let count = 1; count <= upperBound; count++) {
      const totalSlots = count * avgSlots;
      const diff = Math.abs(totalSlots - Math.round(totalSlots));
      if (diff <= tolerance) {
        candidates.push({ count, diff });
      }
    }

    // 按 diff 从小到大排序
    candidates.sort((a, b) => a.diff - b.diff);
    return candidates.map(c => c.count);
  };

  // 返回第一个（最接近整数的）count
  const getMostLikelyCount = (avgSlots: number | undefined, maxCount: number = 50): number => {
    const counts = getMostLikelyCounts(avgSlots, maxCount, 0.05);
    return counts.length > 0 ? counts[0] : 0;
  };

  // 通过均格计算件数和格数
  const calculateFromAvgSlot = (
    quality: keyof CalculatorInput['qualities'],
    avgSlots: number | undefined
  ) => {
    if (!avgSlots || avgSlots <= 0) {
      updateQuality(quality, { count: 0, slots: 0, avgSlots: undefined });
      return;
    }
    const bestCount = getMostLikelyCount(avgSlots, 50);
    const slots = Math.round(bestCount * avgSlots);
    updateQuality(quality, { count: bestCount, slots, avgSlots });
  };

  const openSaveModal = () => {
    if (!result) {
      alert('请先输入数据并计算估值后再保存');
      return;
    }
    const saveData = {
      mode: input.mode || 'express',
      character: input.character || 'victor',
      round: input.round,
      input: {
        totalItems: input.totalItems,
        totalSlots: input.totalSlots,
        qualities: {
          white: input.qualities.white,
          green: input.qualities.green,
          blue: input.qualities.blue,
          purple: input.qualities.purple,
          gold: input.qualities.gold,
          red: input.qualities.red,
        },
      },
      estimatedValue: result.finalRecommendation.value,
    };
    setPendingSaveData(saveData);
    setActualPrice('');
    setShowActualPriceModal(true);
  };

  const handleSaveWithActualPrice = () => {
    if (!pendingSaveData) return;
    
    const actual = parseFloat(actualPrice);
    if (isNaN(actual) || actual <= 0) {
      alert('请输入有效的真实价格');
      return;
    }

    historicalDataManager.addRecord({
      ...pendingSaveData,
      actualValue: actual,
      profit: actual - pendingSaveData.estimatedValue,
      deviation: ((actual - pendingSaveData.estimatedValue) / pendingSaveData.estimatedValue) * 100,
    });

    addRecord({
      status: 'completed',
      mode: pendingSaveData.mode,
      character: pendingSaveData.character,
      round: pendingSaveData.round,
      warehouseInfo: {
        totalItems: pendingSaveData.input.totalItems,
        totalSlots: pendingSaveData.input.totalSlots,
      },
      qualities: pendingSaveData.input.qualities,
      valuationResult: result ? {
        countStreamValue: result.itemBasedValue,
        avgSlotStreamValue: result.slotBasedValue,
        conservativeBid: result.conservativeBid,
        stableBid: result.balancedBid,
        aggressiveBid: result.aggressiveBid,
        maxBid: result.maxBid,
      } : undefined,
      actualValue: actual,
      estimatedValue: pendingSaveData.estimatedValue,
      profit: actual - pendingSaveData.estimatedValue,
      deviation: ((actual - pendingSaveData.estimatedValue) / pendingSaveData.estimatedValue) * 100,
    });

    setShowActualPriceModal(false);
    setPendingSaveData(null);
    setActualPrice('');
    alert(`历史数据已保存！
    
估价: ${formatCurrency(pendingSaveData.estimatedValue)}
实际: ${formatCurrency(actual)}
偏差: ${((actual - pendingSaveData.estimatedValue) / pendingSaveData.estimatedValue * 100).toFixed(1)}%`);
  };

  const handleValuation = () => {
    const recordData: any = {
      status: 'completed' as const,
      mode: input.mode || 'express',
      character: input.character || 'victor',
      round: input.round,
      warehouseInfo: {
        totalItems: input.totalItems,
        totalSlots: input.totalSlots,
      },
      qualities: {
        white: input.qualities.white,
        green: input.qualities.green,
        blue: input.qualities.blue,
        purple: input.qualities.purple,
        gold: input.qualities.gold,
        red: input.qualities.red,
      },
      valuationResult: result ? {
        countStreamValue: result.itemBasedValue,
        avgSlotStreamValue: result.slotBasedValue,
        conservativeBid: result.conservativeBid,
        stableBid: result.balancedBid,
        aggressiveBid: result.aggressiveBid,
        maxBid: result.maxBid,
      } : undefined,
    };
    addRecord(recordData);
    setShowValuation(true);
  };

  const updateInput = (updates: Partial<CalculatorInput>) => {
    setInput(prev => ({ ...prev, ...updates }));
    const gameDataUpdates: any = { ...updates };
    if ('totalItems' in updates || 'totalSlots' in updates) {
      gameDataUpdates.warehouseInfo = {
        ...currentGame?.warehouseInfo,
        ...('totalItems' in updates && { totalItems: updates.totalItems }),
        ...('totalSlots' in updates && { totalSlots: updates.totalSlots }),
      };
      delete gameDataUpdates.totalItems;
      delete gameDataUpdates.totalSlots;
    }
    updateGameData(gameDataUpdates);
  };

  // 自动关联计算已禁用 - 用户在品质信息中手动填写的件数不会被覆盖

  // 当品质件数或总件数变化时，自动计算优品总件数（总件数-白-绿-蓝）
  useEffect(() => {
    const totalItems = input.totalItems || 0;
    const whiteCount = input.qualities.white?.count || 0;
    const greenCount = input.qualities.green?.count || 0;
    const blueCount = input.qualities.blue?.count || 0;
    
    if (totalItems > 0) {
      const calculatedPremiumTotal = totalItems - whiteCount - greenCount - blueCount;
      if (calculatedPremiumTotal > 0 && calculatedPremiumTotal !== premiumTotalCount) {
        setPremiumTotalCount(calculatedPremiumTotal);
      }
    }
  }, [input.totalItems, input.qualities.white?.count, input.qualities.green?.count, input.qualities.blue?.count]);

  // 当均格或总件数变化时，自动更新紫/金件数，满足优品总数约束
  useEffect(() => {
    const totalItems = input.totalItems || 0;
    if (totalItems <= 0) return;

    const whiteCount = input.qualities.white?.count || 0;
    const greenCount = input.qualities.green?.count || 0;
    const blueCount = input.qualities.blue?.count || 0;
    const premiumTotal = totalItems - whiteCount - greenCount - blueCount;

    if (premiumTotal <= 0) return;

    const purpleAvg = input.qualities.purple?.avgSlots;
    const goldAvg = input.qualities.gold?.avgSlots;

    let purpleCount = input.qualities.purple?.count || 0;
    let goldCount = input.qualities.gold?.count || 0;

    // 如果紫/金有均格信息，自动计算最有可能的件数
    let shouldUpdate = false;

    if (purpleAvg && purpleAvg > 0) {
      const likelyCount = getMostLikelyCount(purpleAvg, premiumTotal);
      if (likelyCount !== purpleCount) {
        purpleCount = likelyCount;
        shouldUpdate = true;
      }
    }

    if (goldAvg && goldAvg > 0) {
      const remainingForGold = Math.max(0, premiumTotal - purpleCount);
      const likelyCount = getMostLikelyCount(goldAvg, remainingForGold);
      if (likelyCount !== goldCount) {
        goldCount = likelyCount;
        shouldUpdate = true;
      }
    }

    // 确保紫 + 金 <= 优品总数（红需要有值）
    if (purpleCount + goldCount > premiumTotal) {
      // 按比例缩小紫和金
      const ratio = premiumTotal / (purpleCount + goldCount);
      purpleCount = Math.floor(purpleCount * ratio);
      goldCount = Math.floor(goldCount * ratio);
      shouldUpdate = true;
    }

    if (shouldUpdate) {
      if (purpleAvg) {
        const slots = Math.round(purpleCount * purpleAvg);
        updateQuality('purple', { count: purpleCount, slots });
      }
      if (goldAvg) {
        const slots = Math.round(goldCount * goldAvg);
        updateQuality('gold', { count: goldCount, slots });
      }
    }
  }, [input.totalItems, input.qualities.white?.count, input.qualities.green?.count, input.qualities.blue?.count,
      input.qualities.purple?.avgSlots, input.qualities.gold?.avgSlots, premiumTotalCount]);

  // 当某个品质件数改变时，也触发自动关联计算
  const updateQuality = (
    quality: keyof CalculatorInput['qualities'], 
    data: Partial<CalculatorInput['qualities'][keyof CalculatorInput['qualities']]>
  ) => {
    const newQualities = {
      ...input.qualities,
      [quality]: {
        ...input.qualities[quality],
        ...data,
      },
    };
    const newInput = { ...input, qualities: newQualities };
    setInput(prev => ({ ...prev, qualities: newQualities }));
    updateGameData({ qualities: newQualities });
  };

  const characters = [
    { id: 'victor', name: '老头（维克托）', description: '件数流，开局给紫或金总件数' },
    { id: 'elsa', name: '艾莎', description: '均格流，测试服天王，发力期早' },
    { id: 'ethan', name: '伊森', description: '均格流，穷哥们首选，自带看仓深' },
    { id: 'oilman', name: '石油佬', description: '件数流，自带藏品数，每回合给金均格' },
  ];

  const qualityColors: Record<string, string> = {
    white: 'bg-gray-300',
    green: 'bg-green-500',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    gold: 'bg-yellow-500',
    red: 'bg-red-500',
  };

  const qualityLabels: Record<string, string> = {
    white: '白色',
    green: '绿色',
    blue: '蓝色',
    purple: '紫色',
    gold: '金色',
    red: '红色',
  };

  const tabs = [
    { id: 'calculator' as TabType, icon: CalculatorIcon, name: '计算器' },
    { id: 'data' as TabType, icon: Database, name: '数据采集' },
    { id: 'analytics' as TabType, icon: BarChart3, name: '数据分析' },
  ];

  return (
    <div className="min-h-screen relative">
      <header className="text-center mb-6 relative z-10">
        <div className="flex items-center justify-center gap-3 mb-2">
          <Gavel className="w-10 h-10 text-cyber-cyan animate-pulse-glow" />
          <h1 className="text-4xl font-bold text-gradient">竞拍之王计算器</h1>
        </div>
        <p className="text-gray-400 text-lg">基于精算流思想，精准估值，成为竞拍王者</p>
      </header>

      <div className="mb-6 relative z-10">
        <div className="flex justify-center gap-2 glass-card p-1 rounded-xl w-fit mx-auto">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`cyber-button flex items-center gap-2 px-6 py-3 transition-all duration-200 ${
                  isActive ? 'neon-glow' : 'bg-transparent hover:bg-white/10'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{tab.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 标签内容：隐藏而非卸载，保持OCR持续运行 */}
      <div style={{ display: activeTab === 'calculator' ? 'block' : 'none' }}>
        <div className="relative z-10">
          {/* 顶部：模式和角色选择 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            {/* 模式选择 */}
            <div className="glass-card p-4">
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <span className="w-1 h-5 bg-cyber-cyan rounded"></span>
                游戏模式
              </h3>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(GAME_MODE_CONFIGS) as GameMode[]).map(modeKey => {
                  const mode = GAME_MODE_CONFIGS[modeKey];
                  const isSelected = input.mode === modeKey;
                  return (
                    <button
                      key={modeKey}
                      onClick={() => updateInput({ mode: modeKey })}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        isSelected
                          ? 'bg-cyber-primary text-white neon-glow'
                          : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-gray-700'
                      }`}
                    >
                      {mode.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 角色选择 */}
            <div className="glass-card p-4">
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <span className="w-1 h-5 bg-cyber-magenta rounded"></span>
                选择角色
              </h3>
              <div className="flex flex-wrap gap-2">
                {characters.map(char => {
                  const isSelected = input.character === char.id;
                  return (
                    <button
                      key={char.id}
                      onClick={() => updateInput({ character: char.id as any })}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        isSelected
                          ? 'bg-cyber-accent text-white neon-glow-pink'
                          : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-gray-700'
                      }`}
                    >
                      {char.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 重置按钮 */}
            <div className="glass-card p-4 flex items-end">
              <button
                onClick={() => {
                  updateInput({ mode: undefined, character: undefined });
                }}
                className="w-full cyber-button bg-transparent border-2 border-cyber-cyan text-cyber-cyan px-6 py-3"
              >
                重置模式/角色
              </button>
            </div>
          </div>

          {/* 主内容区 */}
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
            {/* 仓深信息 - 左侧 */}
            <div className="xl:col-span-1">
              <div className="glass-card p-4 h-full">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="w-1 h-5 bg-cyber-primary rounded"></span>
                  仓深信息
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">总件数</label>
                    <input
                      type="number"
                      value={input.totalItems || ''}
                      onChange={(e) => updateInput({ totalItems: parseInt(e.target.value) || undefined })}
                      className="cyber-input w-full text-lg"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">总格数</label>
                    <input
                      type="number"
                      value={input.totalSlots || ''}
                      onChange={(e) => updateInput({ totalSlots: parseInt(e.target.value) || undefined })}
                      className="cyber-input w-full text-lg"
                      placeholder="0"
                    />
                  </div>
                  
                  {/* 优品总数输入 */}
                  <div className="pt-2 border-t border-gray-700">
                    <label className="block text-sm text-gray-400 mb-2">
                      优品总数（紫+金+红件数）
                    </label>
                    <input
                      type="number"
                      value={premiumTotalCount || ''}
                      onChange={(e) => setPremiumTotalCount(parseInt(e.target.value) || undefined)}
                      className="cyber-input w-full text-lg"
                      placeholder="填写后自动计算红色件数"
                    />
                  </div>

                  {/* 优品件数 */}
                  <div className="pt-2 border-t border-gray-700">
                    <div className="text-sm text-gray-400 mb-2">优品件数</div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-purple-400 text-xs w-6">紫:</span>
                        <input
                          type="number"
                          value={input.qualities.purple?.count || ''}
                          onChange={(e) => updateQuality('purple', { count: parseInt(e.target.value) || 0 })}
                          className="cyber-input w-full text-sm"
                          placeholder="0"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-yellow-400 text-xs w-6">金:</span>
                        <input
                          type="number"
                          value={input.qualities.gold?.count || ''}
                          onChange={(e) => updateQuality('gold', { count: parseInt(e.target.value) || 0 })}
                          className="cyber-input w-full text-sm"
                          placeholder="0"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-red-400 text-xs w-6">红:</span>
                        <input
                          type="number"
                          value={input.qualities.red?.count || ''}
                          onChange={(e) => updateQuality('red', { count: Math.max(0, parseInt(e.target.value) || 0) })}
                          className="cyber-input w-full text-sm"
                          placeholder="0"
                        />
                        {premiumTotalCount !== undefined && (
                          <span className="text-xs text-gray-500">
                            (总数-{input.qualities.purple?.count || 0}-{input.qualities.gold?.count || 0})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {input.totalItems && input.totalSlots && (
                    <div className="pt-2 border-t border-gray-700">
                      <div className="text-sm text-gray-400">总均格</div>
                      <div className="text-xl font-bold text-cyber-cyan">
                        {(input.totalSlots / input.totalItems).toFixed(2)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 品质信息 - 中间 */}
            <div className="xl:col-span-2">
              <div className="glass-card p-4">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="w-1 h-5 bg-cyber-accent rounded"></span>
                  品质信息
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {(['white', 'green', 'blue', 'purple', 'gold', 'red'] as const).map((quality) => {
                    const qualityData = input.qualities[quality];
                    const colorClass = qualityColors[quality];
                    const likelyCount = qualityData.avgSlots ? getMostLikelyCount(qualityData.avgSlots, 50) : 0;
                    const likelyCounts = qualityData.avgSlots ? getMostLikelyCounts(qualityData.avgSlots, 50, 0.05).slice(0, 4) : [];
                    return (
                      <div 
                        key={quality} 
                        className={`p-3 rounded-lg border ${colorClass}/20 border-${colorClass}/30`}
                      >
                        <div className={`font-semibold text-sm mb-2 ${
                          quality === 'white' ? 'text-gray-300' :
                          quality === 'green' ? 'text-green-400' :
                          quality === 'blue' ? 'text-blue-400' :
                          quality === 'purple' ? 'text-purple-400' :
                          quality === 'gold' ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {qualityLabels[quality]}
                        </div>
                        {/* 最有可能件数标签 */}
                        {likelyCounts.length > 0 && (
                          <div className="text-xs text-cyber-cyan mb-2 bg-cyber-cyan/10 px-2 py-1 rounded text-center">
                            候选: {likelyCounts.join('/')}件
                          </div>
                        )}
                        <div className="space-y-2">
                          {/* 均格输入 */}
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-500 w-5">均格</span>
                            <input
                              type="number"
                              step="0.1"
                              value={qualityData.avgSlots || ''}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || undefined;
                                if (val && val > 0) {
                                  calculateFromAvgSlot(quality, val);
                                } else {
                                  updateQuality(quality, { count: 0, slots: 0, avgSlots: undefined });
                                }
                              }}
                              className="cyber-input text-center text-sm w-14"
                              placeholder="0"
                            />
                          </div>
                          {/* 件数 */}
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-500 w-5">件</span>
                            <input
                              type="number"
                              value={qualityData.count || ''}
                              onChange={(e) => {
                                const count = parseInt(e.target.value) || 0;
                                const slots = qualityData.avgSlots ? Math.round(count * qualityData.avgSlots) : qualityData.slots || 0;
                                updateQuality(quality, { count, slots });
                              }}
                              className="cyber-input text-center text-sm w-14"
                              placeholder="0"
                            />
                          </div>
                          {/* 格数 */}
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-500 w-5">格</span>
                            <input
                              type="number"
                              value={qualityData.slots || ''}
                              onChange={(e) => {
                                const slots = parseInt(e.target.value) || 0;
                                const count = qualityData.avgSlots && qualityData.avgSlots > 0 
                                  ? Math.round(slots / qualityData.avgSlots) 
                                  : qualityData.count || 0;
                                updateQuality(quality, { slots, count });
                              }}
                              className="cyber-input text-center text-sm w-14"
                              placeholder="0"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-4 mt-4">
                <button
                  onClick={handleValuation}
                  className="cyber-button flex-1 text-lg py-4 flex items-center justify-center gap-2"
                >
                  <Gavel className="w-6 h-6" />
                  立即估价
                </button>
                <button
                  onClick={openSaveModal}
                  className="cyber-button bg-cyber-accent/20 border-2 border-cyber-accent text-cyber-accent px-6 py-4"
                >
                  <History className="w-5 h-5" />
                  保存历史
                </button>
                <button
                  onClick={() => {
                    setInput(prev => ({
                      ...prev,
                      totalItems: undefined,
                      totalSlots: undefined,
                      qualities: { white: {}, green: {}, blue: {}, purple: {}, gold: {}, red: {} },
                    }));
                    setPremiumTotalCount(undefined);
                    updateGameData({
                      warehouseInfo: { totalItems: undefined, totalSlots: undefined },
                      qualities: { white: {}, green: {}, blue: {}, purple: {}, gold: {}, red: {} },
                    });
                  }}
                  className="cyber-button bg-transparent border-2 border-cyber-primary text-cyber-primary px-6 py-4"
                >
                  <Trash2 className="w-5 h-5" />
                  清空数据
                </button>
              </div>
            </div>

            {/* 估价结果 - 右侧 */}
            <div className="xl:col-span-1 space-y-3">
              {/* 精算模式切换 + 价格配置 */}
              <div className="glass-card p-3">
                <div className="flex items-center justify-between mb-2">
                  <button
                    onClick={() => {
                      const newMode = !actuarialMode;
                      setActuarialMode(newMode);
                      localStorage.setItem('auction_king_actuarial_mode', String(newMode));
                    }}
                    className={`flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-lg transition-all ${
                      actuarialMode
                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        : 'bg-white/5 text-gray-400 border border-gray-700'
                    }`}
                  >
                    {actuarialMode ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                    {actuarialMode ? '精算模式' : '简单模式'}
                  </button>
                  <button
                    onClick={() => setShowPriceConfig(!showPriceConfig)}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    <Settings className="w-3 h-3" />
                    单格价
                  </button>
                </div>

                {/* 价格配置 */}
                {showPriceConfig && <PriceConfigPanel />}
              </div>

              <ResultPanel result={result} actuarialMode={actuarialMode} />
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: activeTab === 'data' ? 'block' : 'none' }}>
        <DataInputPanel />
      </div>
      <div style={{ display: activeTab === 'analytics' ? 'block' : 'none' }}>
        <AnalyticsPanel />
      </div>

      {/* 真实价格输入模态框 */}
      {showActualPriceModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="glass-card max-w-md w-full mx-4 p-6">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <History className="w-6 h-6 text-cyber-accent" />
              保存历史数据
            </h3>
            
            {pendingSaveData && (
              <div className="space-y-4">
                <div className="bg-white/5 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-2">系统估价</div>
                  <div className="text-2xl font-bold text-cyber-cyan">
                    {formatCurrency(pendingSaveData.estimatedValue)}
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    请输入实际成交价格（单位：万）
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={actualPrice}
                    onChange={(e) => setActualPrice(e.target.value)}
                    className="cyber-input w-full text-lg"
                    placeholder="例如：50.5"
                    autoFocus
                  />
                </div>

                {actualPrice && pendingSaveData && (
                  <div className="bg-white/5 rounded-lg p-4">
                    <div className="text-sm text-gray-400 mb-2">对比分析</div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-gray-500">实际价格</div>
                        <div className="text-lg font-semibold text-white">
                          {formatCurrency(parseFloat(actualPrice) || 0)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">偏差</div>
                        <div className={`text-lg font-semibold ${
                          parseFloat(actualPrice) > pendingSaveData.estimatedValue 
                            ? 'text-red-400' 
                            : 'text-green-400'
                        }`}>
                          {pendingSaveData.estimatedValue > 0 
                            ? `${((parseFloat(actualPrice) - pendingSaveData.estimatedValue) / pendingSaveData.estimatedValue * 100).toFixed(1)}%`
                            : '0%'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => {
                      setShowActualPriceModal(false);
                      setPendingSaveData(null);
                      setActualPrice('');
                    }}
                    className="flex-1 cyber-button bg-transparent border-2 border-gray-600 text-gray-400 px-4 py-3"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSaveWithActualPrice}
                    className="flex-1 cyber-button px-4 py-3"
                  >
                    确认保存
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-cyber-primary/10 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyber-secondary/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 right-1/3 w-48 h-48 bg-cyber-accent/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
      </div>
    </div>
  );
};

// ==================== 单格估价价格配置面板 ====================
const PriceConfigPanel: React.FC = () => {
  const [prices, setPrices] = useState<GridPrices>(loadGridPrices);

  const updatePrice = (key: keyof GridPrices, wanValue: number) => {
    // 用户输入的是"万"单位, 存储时转回"银"
    const silverValue = Math.round(wanValue * 10000);
    const newPrices = { ...prices, [key]: silverValue };
    setPrices(newPrices);
    saveGridPrices(newPrices);
  };

  const priceEntries: Array<{ key: keyof GridPrices; label: string }> = [
    { key: 'vWG', label: '白绿' },
    { key: 'vB', label: '蓝' },
    { key: 'vP', label: '紫' },
    { key: 'vJR', label: '金红混' },
    { key: 'vG', label: '金' },
    { key: 'vR', label: '红' },
  ];

  return (
    <div className="space-y-1.5 pt-1">
      {priceEntries.map(({ key, label }) => (
        <div key={key} className="flex items-center gap-2">
          <span className="text-xs text-gray-400 w-12">{label}</span>
          <input
            type="number"
            step="0.01"
            value={silverToWan(prices[key]).toFixed(2)}
            onChange={(e) => updatePrice(key, parseFloat(e.target.value) || 0)}
            className="cyber-input text-center text-xs w-20 h-6"
          />
          <span className="text-xs text-gray-500">万/格</span>
        </div>
      ))}
      <div className="text-[10px] text-gray-600 pt-1 border-t border-gray-700 mt-1">
        参考: BidKing 默认白绿100银/蓝800银/紫2000银/金红混20000银/金10000银/红30000银
      </div>
    </div>
  );
};
