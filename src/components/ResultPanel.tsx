import React from 'react';
import { Trophy, TrendingUp, AlertTriangle, TrendingDown, Target, AlertCircle, Info, BarChart3, Layers, Database, Brain, History } from 'lucide-react';
import { SmartCalculatorOutput } from '../utils/smartCalculator';
import { formatCurrency } from '../utils/calculator';

interface ResultPanelProps {
  result: SmartCalculatorOutput | null;
  actuarialMode?: boolean;
}

export const ResultPanel: React.FC<ResultPanelProps> = ({ result, actuarialMode = false }) => {
  if (!result) {
    return (
      <div className="text-center py-12">
        <div className="w-20 h-20 mx-auto mb-4 bg-gray-700 rounded-full flex items-center justify-center">
          <Trophy className="w-10 h-10 text-gray-500" />
        </div>
        <h3 className="text-xl font-semibold text-gray-400 mb-2">等待数据输入</h3>
        <p className="text-gray-500">请输入仓深信息和品质信息开始估值</p>
      </div>
    );
  }

  // 数格子精算结果
  const ga = result.gridActuarial;

  const riskColors = {
    low: {
      text: 'text-green-400',
      bg: 'bg-green-900/30',
      border: 'border-green-600',
      icon: TrendingUp,
    },
    medium: {
      text: 'text-yellow-400',
      bg: 'bg-yellow-900/30',
      border: 'border-yellow-600',
      icon: AlertCircle,
    },
    high: {
      text: 'text-red-400',
      bg: 'bg-red-900/30',
      border: 'border-red-600',
      icon: AlertTriangle,
    },
  };

  const RiskIcon = riskColors[result.riskLevel].icon;

  return (
    <div className="space-y-4">
      {/* 最终建议估值 */}
      <div className="glass-card p-4 border-l-4 border-cyber-cyan">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-cyber-cyan/20 rounded-lg">
            <Brain className="w-6 h-6 text-cyber-cyan" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">AI智能估值</h3>
            <p className="text-sm text-gray-400">综合仓深、风险、历史学习</p>
          </div>
        </div>
        <div className="text-3xl font-bold text-cyber-cyan mb-2">
          {formatCurrency(result.finalRecommendation.value)}
        </div>
        <div className="text-sm text-gray-400 mb-3">
          建议范围: {formatCurrency(result.finalRecommendation.range.min)} - {formatCurrency(result.finalRecommendation.range.max)}
        </div>
        <div className="text-sm text-cyber-accent bg-cyber-accent/10 p-2 rounded">
          💡 {result.finalRecommendation.suggestion}
        </div>
      </div>

      {/* 数格子精算估值范围 (精算模式下显示) */}
      {actuarialMode && ga && ga.output.valueRange && (
        <div className="glass-card p-4 border-l-4 border-purple-500">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Layers className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">数格子精算估值</h3>
              <p className="text-sm text-gray-400">基于所有候选组合的范围估值</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-purple-900/20 rounded p-2 text-center">
              <div className="text-xs text-gray-400">最低</div>
              <div className="text-lg font-bold text-purple-300">{formatCurrency(ga.output.valueRange.min)}</div>
            </div>
            <div className="bg-purple-900/20 rounded p-2 text-center">
              <div className="text-xs text-gray-400">中位</div>
              <div className="text-lg font-bold text-purple-400">{formatCurrency(ga.output.valueRange.median)}</div>
            </div>
            <div className="bg-purple-900/20 rounded p-2 text-center">
              <div className="text-xs text-gray-400">最高</div>
              <div className="text-lg font-bold text-purple-300">{formatCurrency(ga.output.valueRange.max)}</div>
            </div>
          </div>
          <div className="text-xs text-gray-500 space-y-1">
            <div>紫色候选 {ga.output.purpleCandidates.length} 组</div>
            {ga.output.goldEnabled && <div>金色候选 {ga.output.goldCandidates.length} 组</div>}
            <div>紫 {ga.purpleTotalGrids}格 / 金 {ga.goldTotalGrids}格 / 红 {ga.redTotalGrids}格</div>
          </div>
        </div>
      )}

      {/* 估值分解 */}
      <div className="glass-card p-4">
        <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
          <Layers className="w-4 h-4" /> 估值分解
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">基础估值</span>
            <span className="text-white">{formatCurrency(result.valueBreakdown.baseValue)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">仓深修正</span>
            <span className={result.valueBreakdown.warehouseBonus >= 0 ? 'text-green-400' : 'text-red-400'}>
              {result.valueBreakdown.warehouseBonus >= 0 ? '+' : ''}{formatCurrency(result.valueBreakdown.warehouseBonus)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">风险折扣</span>
            <span className="text-red-400">{formatCurrency(result.valueBreakdown.riskDiscount)}</span>
          </div>
          {result.valueBreakdown.historyBonus !== 0 && (
            <div className="flex justify-between">
              <span className="text-gray-400">历史学习</span>
              <span className={result.valueBreakdown.historyBonus >= 0 ? 'text-green-400' : 'text-red-400'}>
                {result.valueBreakdown.historyBonus >= 0 ? '+' : ''}{formatCurrency(result.valueBreakdown.historyBonus)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 出价建议 */}
      <div className="glass-card p-4">
        <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
          <Target className="w-4 h-4" /> 出价建议
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-green-900/30 rounded-lg p-3 border border-green-700/50">
            <div className="text-xs text-gray-400 mb-1">保守出价</div>
            <div className="text-lg font-bold text-green-400">{formatCurrency(result.conservativeBid)}</div>
          </div>
          <div className="bg-blue-900/30 rounded-lg p-3 border border-blue-700/50">
            <div className="text-xs text-gray-400 mb-1">稳健出价</div>
            <div className="text-lg font-bold text-blue-400">{formatCurrency(result.balancedBid)}</div>
          </div>
          <div className="bg-orange-900/30 rounded-lg p-3 border border-orange-700/50">
            <div className="text-xs text-gray-400 mb-1">激进出价</div>
            <div className="text-lg font-bold text-orange-400">{formatCurrency(result.aggressiveBid)}</div>
          </div>
          <div className="bg-red-900/30 rounded-lg p-3 border border-red-700/50">
            <div className="text-xs text-gray-400 mb-1">最高限价</div>
            <div className="text-lg font-bold text-red-400">{formatCurrency(result.maxBid)}</div>
          </div>
        </div>
      </div>

      {/* 仓深修正详情 */}
      <div className="glass-card p-4">
        <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
          <Database className="w-4 h-4" /> 仓深分析
        </h3>
        <div className="text-sm text-gray-400 mb-2">{result.warehouseAdjustment.description}</div>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-500">修正系数</span>
            <span className="text-cyber-cyan">×{result.warehouseAdjustment.factor.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">效率</span>
            <span className="text-cyber-cyan">{(result.warehouseAdjustment.efficiency * 100).toFixed(0)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">密度奖励</span>
            <span className="text-cyber-cyan">+{(result.warehouseAdjustment.densityBonus * 100).toFixed(0)}%</span>
          </div>
        </div>
      </div>

      {/* 风险评估 */}
      <div className={`${riskColors[result.riskLevel].bg} rounded-lg p-4 border ${riskColors[result.riskLevel].border}`}>
        <div className="flex items-center gap-3 mb-2">
          <RiskIcon className={`w-5 h-5 ${riskColors[result.riskLevel].text}`} />
          <h3 className={`font-semibold ${riskColors[result.riskLevel].text}`}>
            {result.riskLevel === 'low' ? '低风险' : result.riskLevel === 'medium' ? '中风险' : '高风险'}
          </h3>
        </div>
        <div className="space-y-1 mb-3">
          {result.riskAdjustment.factors.map((factor, idx) => (
            <div key={idx} className="text-xs text-gray-300">• {factor}</div>
          ))}
        </div>
        <div className="text-xs text-gray-400">
          置信区间: ±{(result.riskAdjustment.confidenceInterval * 100).toFixed(0)}%
        </div>
      </div>

      {/* 历史学习 */}
      {result.historicalAdjustment && result.historicalAdjustment.confidence > 0 && (
        <div className="glass-card p-4 border-l-4 border-cyber-accent">
          <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            <History className="w-4 h-4" /> 历史学习调整
          </h3>
          <div className="text-sm text-gray-400 mb-2">
            基于历史数据自动调整估值
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">调整系数</span>
              <span className="text-cyber-accent">×{result.historicalAdjustment.adjustmentFactor.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">置信度</span>
              <span className="text-cyber-accent">{(result.historicalAdjustment.confidence * 100).toFixed(0)}%</span>
            </div>
          </div>
        </div>
      )}

      {/* 品质分析 */}
      <div className="glass-card p-4">
        <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4" /> 品质分析
        </h3>
        <div className="space-y-2">
          {result.qualityBreakdown.filter(item => item.percentage > 0 || item.itemValue > 0 || item.slotValue > 0).map((item, index) => (
            <div key={index} className="bg-white/5 rounded-lg p-2">
              <div className="flex justify-between items-center mb-1">
                <span className="text-white text-sm">{item.quality}</span>
                <span className="text-gray-400 text-xs">{item.percentage.toFixed(1)}%</span>
              </div>
              {item.percentage > 0 && (
                <div className="w-full bg-gray-700 rounded-full h-1.5 mb-1">
                  <div
                    className="h-1.5 rounded-full bg-gradient-to-r from-cyber-primary to-cyber-accent"
                    style={{ width: `${Math.min(100, item.percentage)}%` }}
                  />
                </div>
              )}
              <div className="flex gap-3 text-xs text-gray-400">
                {item.itemValue > 0 && <span>件: {formatCurrency(item.itemValue)}</span>}
                {item.slotValue > 0 && <span>格: {formatCurrency(item.slotValue)}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
