import React, { useMemo } from 'react';
import { TrendingUp, Trophy, BarChart3, PieChart, User, AlertCircle } from 'lucide-react';
import { useGameDataStore, analyzeGameHistory, GameRound } from '../utils/gameDataManager';

interface AnalyticsPanelProps {
  className?: string;
}

export const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({ className = '' }) => {
  const { gameHistory } = useGameDataStore();
  
  const analytics = useMemo(() => {
    return analyzeGameHistory(gameHistory);
  }, [gameHistory]);

  // 计算趋势数据
  const trendData = useMemo(() => {
    const last10 = gameHistory.slice(0, 10).reverse();
    return last10.map((game, index) => ({
      index,
      profit: game.outcome?.profitLoss || 0,
      won: game.outcome?.won || false,
    }));
  }, [gameHistory]);

  // 计算品质平均价值
  const qualityValueStats = useMemo(() => {
    const stats = {
      purple: { total: 0, count: 0 },
      gold: { total: 0, count: 0 },
      red: { total: 0, count: 0 },
    };

    gameHistory.forEach((game) => {
      const profit = game.outcome?.profitLoss || 0;
      if (game.qualities.purple?.count) {
        stats.purple.total += profit;
        stats.purple.count++;
      }
      if (game.qualities.gold?.count) {
        stats.gold.total += profit;
        stats.gold.count++;
      }
      if (game.qualities.red?.count) {
        stats.red.total += profit;
        stats.red.count++;
      }
    });

    return {
      purple: stats.purple.count > 0 ? stats.purple.total / stats.purple.count : 0,
      gold: stats.gold.count > 0 ? stats.gold.total / stats.gold.count : 0,
      red: stats.red.count > 0 ? stats.red.total / stats.red.count : 0,
    };
  }, [gameHistory]);

  if (gameHistory.length === 0) {
    return (
      <div className={`bg-white/10 backdrop-blur-lg rounded-2xl p-6 ${className}`}>
        <div className="text-center py-12">
          <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-500" />
          <h3 className="text-xl font-semibold text-gray-400 mb-2">暂无数据分析</h3>
          <p className="text-gray-500">保存一些游戏记录后，这里会显示详细的分析报告</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white/10 backdrop-blur-lg rounded-2xl p-6 ${className}`}>
      <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
        <BarChart3 className="w-5 h-5" />
        数据分析面板
      </h2>

      {/* 核心统计数据 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/20 rounded-lg p-4 border border-blue-700/30">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-5 h-5 text-blue-400" />
            <span className="text-gray-300 text-sm">总游戏数</span>
          </div>
          <div className="text-3xl font-bold text-white">{analytics.totalGames}</div>
        </div>

        <div className="bg-gradient-to-br from-green-900/30 to-green-800/20 rounded-lg p-4 border border-green-700/30">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-green-400" />
            <span className="text-gray-300 text-sm">胜率</span>
          </div>
          <div className="text-3xl font-bold text-green-400">
            {analytics.winRate.toFixed(1)}%
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-900/30 to-amber-800/20 rounded-lg p-4 border border-amber-700/30">
          <div className="flex items-center gap-2 mb-2">
            <PieChart className="w-5 h-5 text-amber-400" />
            <span className="text-gray-300 text-sm">平均盈亏</span>
          </div>
          <div className={`text-3xl font-bold ${
            analytics.averageProfit >= 0 ? 'text-green-400' : 'text-red-400'
          }`}>
            {analytics.averageProfit >= 0 ? '+' : ''}{analytics.averageProfit.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 最近趋势 */}
      {trendData.length > 0 && (
        <div className="mb-6 lg:mb-0">
          <h3 className="text-lg font-medium text-white mb-3">最近盈亏趋势</h3>
          <div className="bg-black/30 rounded-lg p-4">
            <div className="flex gap-2 items-end h-32">
              {trendData.map((data, index) => {
                const height = Math.min(100, Math.max(10, Math.abs(data.profit) * 2));
                return (
                  <div key={index} className="flex-1 flex flex-col items-center">
                    <div
                      className={`w-full rounded-t ${
                        data.profit >= 0 ? 'bg-green-500' : 'bg-red-500'
                      }`}
                      style={{ height: `${height}%` }}
                    />
                    <div className="text-xs text-gray-400 mt-1">
                      #{trendData.length - index}
                    </div>
                    <div className={`text-xs ${
                      data.profit >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {data.profit >= 0 ? '+' : ''}{data.profit.toFixed(0)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div>
      {/* 最佳角色 */}
      {analytics.bestCharacter && (
        <div className="mb-6">
          <h3 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
            <User className="w-5 h-5" />
            最佳角色
          </h3>
          <div className="bg-gradient-to-br from-purple-900/30 to-purple-800/20 rounded-lg p-4 border border-purple-700/30">
            <div className="text-xl font-bold text-purple-300 mb-2">
              {analytics.bestCharacter.name}
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div>
                <div className="text-gray-400">游戏数</div>
                <div className="text-white font-semibold">{analytics.bestCharacter.games}</div>
              </div>
              <div>
                <div className="text-gray-400">获胜数</div>
                <div className="text-green-400 font-semibold">{analytics.bestCharacter.wins}</div>
              </div>
              <div>
                <div className="text-gray-400">总盈亏</div>
                <div className={`font-semibold ${
                  analytics.bestCharacter.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {analytics.bestCharacter.totalProfit >= 0 ? '+' : ''}
                  {analytics.bestCharacter.totalProfit.toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 品质收益分析 */}
      <div>
        <h3 className="text-lg font-medium text-white mb-3">品质平均收益</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-purple-900/30 rounded-lg p-3 border border-purple-700/30">
            <div className="text-purple-300 text-sm mb-1">紫色</div>
            <div className={`text-lg font-bold ${
              qualityValueStats.purple >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {qualityValueStats.purple >= 0 ? '+' : ''}{qualityValueStats.purple.toFixed(2)}
            </div>
          </div>
          <div className="bg-yellow-900/30 rounded-lg p-3 border border-yellow-700/30">
            <div className="text-yellow-300 text-sm mb-1">金色</div>
            <div className={`text-lg font-bold ${
              qualityValueStats.gold >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {qualityValueStats.gold >= 0 ? '+' : ''}{qualityValueStats.gold.toFixed(2)}
            </div>
          </div>
          <div className="bg-red-900/30 rounded-lg p-3 border border-red-700/30">
            <div className="text-red-300 text-sm mb-1">红色</div>
            <div className={`text-lg font-bold ${
              qualityValueStats.red >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {qualityValueStats.red >= 0 ? '+' : ''}{qualityValueStats.red.toFixed(2)}
            </div>
          </div>
        </div>
      </div>
      </div>
      </div>

      {/* 角色统计 */}
      {Object.keys(analytics.characterStats).length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-medium text-white mb-3">各角色表现</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.entries(analytics.characterStats).map(([name, stats]) => {
              const winRate = stats.games > 0 ? (stats.wins / stats.games) * 100 : 0;
              return (
                <div key={name} className="bg-black/30 rounded-lg p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-white font-medium">{name}</span>
                    <span className="text-gray-400 text-sm">{stats.games}局</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-gray-400">胜率</div>
                      <div className="text-white">{winRate.toFixed(1)}%</div>
                    </div>
                    <div>
                      <div className="text-gray-400">总盈亏</div>
                      <div className={
                        stats.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'
                      }>
                        {stats.totalProfit >= 0 ? '+' : ''}{stats.totalProfit.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 提示信息 */}
      <div className="mt-6 p-4 bg-blue-900/30 rounded-lg border border-blue-700/30">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-gray-300">
            <p>提示：继续保存更多游戏记录，数据会更准确。建议保存至少20局后再进行深度分析。</p>
          </div>
        </div>
      </div>
    </div>
  );
};
