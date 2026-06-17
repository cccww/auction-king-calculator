import React, { useState, useEffect, useRef } from 'react';
import { Upload, Clipboard, Camera, Save, Play, Square, Trash2, FileJson, Download, History, Scan, X, Eye, TrendingUp } from 'lucide-react';
import { ClipboardMonitor, OCRProcessor, GameDataParser, ScreenCapture } from '../utils/dataCollector';
import { useGameDataStore } from '../utils/gameDataManager';
import { useCollectionStore, formatTimestamp, getModeName, getCharacterName, CollectionRecord } from '../utils/collectionManager';
import { RealtimeOCRDetector } from './RealtimeOCRDetector';

interface DataInputPanelProps {
  className?: string;
}

export const DataInputPanel: React.FC<DataInputPanelProps> = ({ className = '' }) => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isOCRProcessing, setIsOCRProcessing] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [activeTab, setActiveTab] = useState<'tools' | 'realtime'>('tools');
  
  const clipboardMonitor = useRef<ClipboardMonitor | null>(null);
  const ocrProcessor = useRef<OCRProcessor | null>(null);
  
  const {
    currentGame,
    startNewGame,
    updateGameData,
    saveGame,
    clearCurrentGame,
    gameHistory,
    loadGameHistory,
    exportData,
    importData,
  } = useGameDataStore();

  const {
    records,
    getStatistics,
    deleteRecord,
    clearAllRecords,
    exportRecords,
  } = useCollectionStore();

  const [selectedRecord, setSelectedRecord] = useState<CollectionRecord | null>(null);

  // 初始化历史记录
  useEffect(() => {
    loadGameHistory();
  }, [loadGameHistory]);

  // 清理资源
  useEffect(() => {
    return () => {
      if (clipboardMonitor.current) {
        clipboardMonitor.current.stopMonitoring();
      }
      if (ocrProcessor.current) {
        ocrProcessor.current.cleanup();
      }
    };
  }, []);

  // 显示通知
  const showNotification = (message: string, type: 'success' | 'error' | 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // 开始剪贴板监听
  const startClipboardMonitor = () => {
    try {
      if (!clipboardMonitor.current) {
        clipboardMonitor.current = new ClipboardMonitor((text) => {
          handleInputText(text);
        });
      }
      clipboardMonitor.current.startMonitoring();
      setIsMonitoring(true);
      showNotification('剪贴板监听已启动', 'success');
    } catch (error) {
      showNotification('启动剪贴板监听失败', 'error');
    }
  };

  // 停止剪贴板监听
  const stopClipboardMonitor = () => {
    if (clipboardMonitor.current) {
      clipboardMonitor.current.stopMonitoring();
    }
    setIsMonitoring(false);
    showNotification('剪贴板监听已停止', 'info');
  };

  // 处理输入文本
  const handleInputText = (text: string) => {
    const parsed = GameDataParser.parseGameText(text);
    const gameData = GameDataParser.convertToGameData(parsed);
    updateGameData(gameData);
    showNotification('数据已自动填充', 'success');
  };

  // 手动输入剪贴板内容
  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      handleInputText(text);
    } catch (error) {
      showNotification('无法读取剪贴板', 'error');
    }
  };

  // 截图并OCR识别
  const captureAndOCR = async () => {
    try {
      setIsOCRProcessing(true);
      showNotification('正在获取屏幕截图...', 'info');
      
      const imageData = await ScreenCapture.captureToDataURL();
      
      if (!ocrProcessor.current) {
        ocrProcessor.current = new OCRProcessor();
      }
      
      showNotification('正在识别文本...', 'info');
      const text = await ocrProcessor.current.processScreenshot(imageData);
      
      handleInputText(text);
    } catch (error) {
      showNotification('OCR识别失败: ' + (error as Error).message, 'error');
    } finally {
      setIsOCRProcessing(false);
    }
  };

  // 文件导入
  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          importData(content);
          showNotification('数据导入成功', 'success');
        } catch (error) {
          showNotification('文件解析失败', 'error');
        }
      };
      reader.readAsText(file);
    }
  };

  // 导出数据
  const handleExport = () => {
    const data = exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bidking_export_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('数据导出成功', 'success');
  };

  // 开始新游戏
  const handleStartGame = () => {
    const character = prompt('请选择角色（可选）：');
    const map = prompt('请输入地图（可选）：');
    startNewGame(character || undefined, map || undefined);
    showNotification('新游戏已开始', 'success');
  };

  // 保存当前游戏
  const handleSaveGame = () => {
    if (currentGame) {
      const finalPrice = prompt('请输入最终成交价格：');
      const actualValue = prompt('请输入实际价值：');
      const won = confirm('是否赢得了这局？');
      
      if (finalPrice && actualValue) {
        const profitLoss = parseFloat(actualValue) - parseFloat(finalPrice);
        updateGameData({
          outcome: {
            won,
            finalPrice: parseFloat(finalPrice),
            actualValue: parseFloat(actualValue),
            profitLoss,
          },
        });
        saveGame();
        showNotification('游戏结果已保存', 'success');
      }
    }
  };

  return (
    <div className={`bg-white/10 backdrop-blur-lg rounded-2xl p-6 ${className}`}>
      {/* 通知 */}
      {notification && (
        <div className={`mb-4 p-3 rounded-lg ${
          notification.type === 'success' ? 'bg-green-500/30 text-green-200' :
          notification.type === 'error' ? 'bg-red-500/30 text-red-200' :
          'bg-blue-500/30 text-blue-200'
        }`}>
          {notification.message}
        </div>
      )}

      <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
        <FileJson className="w-5 h-5" />
        数据采集面板
      </h2>

      {/* 标签页切换 */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('tools')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
            activeTab === 'tools' 
              ? 'bg-amber-500 text-white' 
              : 'bg-white/10 text-gray-400 hover:bg-white/20'
          }`}
        >
          <FileJson className="w-4 h-4" />
          工具
        </button>
        <button
          onClick={() => setActiveTab('realtime')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
            activeTab === 'realtime' 
              ? 'bg-amber-500 text-white' 
              : 'bg-white/10 text-gray-400 hover:bg-white/20'
          }`}
        >
          <Scan className="w-4 h-4" />
          实时OCR检测
        </button>
      </div>

      {/* 标签页内容 */}
      {activeTab === 'tools' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
          {/* 当前游戏状态 */}
          <div className="mb-6 p-4 bg-white/5 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-300">当前游戏状态:</span>
              <span className={`font-semibold ${currentGame ? 'text-green-400' : 'text-gray-500'}`}>
                {currentGame ? '进行中' : '未开始'}
              </span>
            </div>
            {currentGame && (
              <div className="text-sm text-gray-400">
                <div>开始时间: {new Date(currentGame.timestamp).toLocaleString()}</div>
                {currentGame.character && <div>角色: {currentGame.character}</div>}
                <div>当前回合: {currentGame.currentRound}</div>
              </div>
            )}
          </div>

          {/* 游戏控制按钮 */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              onClick={handleStartGame}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              <Play className="w-4 h-4" />
              开始新游戏
            </button>
            <button
              onClick={handleSaveGame}
              disabled={!currentGame}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              <Save className="w-4 h-4" />
              保存游戏结果
            </button>
            <button
              onClick={() => clearCurrentGame()}
              disabled={!currentGame}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              清除当前游戏
            </button>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              <History className="w-4 h-4" />
              历史记录 ({gameHistory.length})
            </button>
          </div>

          {/* 数据采集工具 */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-white mb-3">数据采集工具</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                onClick={isMonitoring ? stopClipboardMonitor : startClipboardMonitor}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors ${
                  isMonitoring
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-cyan-600 hover:bg-cyan-700 text-white'
                }`}
              >
                {isMonitoring ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {isMonitoring ? '停止监听剪贴板' : '监听剪贴板'}
              </button>
              <button
                onClick={pasteFromClipboard}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
              >
                <Clipboard className="w-4 h-4" />
                从剪贴板读取
              </button>
              <button
                onClick={captureAndOCR}
                disabled={isOCRProcessing}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                <Camera className="w-4 h-4" />
                {isOCRProcessing ? '识别中...' : '截图OCR识别'}
              </button>
              <label className="flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg cursor-pointer transition-colors">
                <Upload className="w-4 h-4" />
                导入文件
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileImport}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* 数据导出 */}
          <div className="pt-4 border-t border-gray-700">
            <button
              onClick={handleExport}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              导出所有数据
            </button>
          </div>

          {/* 历史记录面板 */}
          {showHistory && (
            <div className="mt-6 p-4 bg-black/30 rounded-lg col-span-full">
              <h3 className="text-lg font-medium text-white mb-3">游戏历史记录</h3>
              {gameHistory.length === 0 ? (
                <p className="text-gray-500 text-center py-4">暂无历史记录</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {gameHistory.map((game) => (
                    <div
                      key={game.id}
                      className="p-3 bg-white/10 rounded-lg text-sm"
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-gray-300">
                          {new Date(game.timestamp).toLocaleString()}
                        </span>
                        <span className={game.outcome?.won ? 'text-green-400' : 'text-red-400'}>
                          {game.outcome?.won ? '胜利' : '失败'}
                        </span>
                      </div>
                      {game.character && (
                        <div className="text-gray-400">角色: {game.character}</div>
                      )}
                      {game.outcome && (
                        <div className="text-gray-400">
                          盈亏: {game.outcome.profitLoss > 0 ? '+' : ''}{game.outcome.profitLoss}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          </div>
        </div>
      ) : (
        /* 实时OCR检测 */
        <div className="p-0 m-0 -mx-6 -my-6">
          <RealtimeOCRDetector />
        </div>
      )}

      {/* 采集记录面板 - 始终显示在右侧 */}
      {activeTab === 'tools' && records.length > 0 && (
        <div className="space-y-4">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-amber-400" />
                采集记录历史
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const data = exportRecords();
                    const blob = new Blob([data], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `collection_records_${new Date().toISOString().split('T')[0]}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                    showNotification('采集记录导出成功', 'success');
                  }}
                  className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm"
                >
                  <Download className="w-4 h-4" />
                  导出
                </button>
                <button
                  onClick={() => {
                    if (confirm('确定要清空所有采集记录吗？')) {
                      clearAllRecords();
                      showNotification('已清空所有采集记录', 'success');
                    }
                  }}
                  className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm"
                >
                  <Trash2 className="w-4 h-4" />
                  清空
                </button>
              </div>
            </div>

            {/* 统计信息 */}
            <div className="mb-4 p-3 bg-white/5 rounded-lg">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div className="text-center">
                  <div className="text-gray-400">总记录数</div>
                  <div className="text-2xl font-bold text-white">{records.length}</div>
                </div>
                <div className="text-center">
                  <div className="text-gray-400">紫色物品</div>
                  <div className="text-2xl font-bold text-purple-400">
                    {getStatistics().totalPurpleItems}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-gray-400">金色物品</div>
                  <div className="text-2xl font-bold text-yellow-400">
                    {getStatistics().totalGoldItems}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-gray-400">红色物品</div>
                  <div className="text-2xl font-bold text-red-400">
                    {getStatistics().totalRedItems}
                  </div>
                </div>
              </div>
            </div>

            {/* 记录列表 */}
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {records.map((record) => (
                <div
                  key={record.id}
                  className="p-4 bg-white/5 rounded-lg border border-gray-700 hover:border-amber-500 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-gray-300 text-sm">
                          {formatTimestamp(record.timestamp)}
                        </span>
                        <span className="px-2 py-0.5 bg-blue-600/30 text-blue-300 rounded text-xs">
                          {getModeName(record.mode)}
                        </span>
                        <span className="px-2 py-0.5 bg-green-600/30 text-green-300 rounded text-xs">
                          {getCharacterName(record.character)}
                        </span>
                        <span className="px-2 py-0.5 bg-gray-600/30 text-gray-300 rounded text-xs">
                          第{record.round}回合
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        {record.qualities.white?.count > 0 && (
                          <span className="text-gray-300">
                            白: {record.qualities.white.count}件
                          </span>
                        )}
                        {record.qualities.green?.count > 0 && (
                          <span className="text-green-400">
                            绿: {record.qualities.green.count}件
                          </span>
                        )}
                        {record.qualities.blue?.count > 0 && (
                          <span className="text-blue-400">
                            蓝: {record.qualities.blue.count}件
                          </span>
                        )}
                        {record.qualities.purple?.count > 0 && (
                          <span className="text-purple-400">
                            紫: {record.qualities.purple.count}件
                          </span>
                        )}
                        {record.qualities.gold?.count > 0 && (
                          <span className="text-yellow-400">
                            金: {record.qualities.gold.count}件
                          </span>
                        )}
                        {record.qualities.red?.count > 0 && (
                          <span className="text-red-400">
                            红: {record.qualities.red.count}件
                          </span>
                        )}
                      </div>
                      {/* 真实价格对比信息 */}
                      {record.actualValue !== undefined && record.estimatedValue !== undefined && (
                        <div className="mt-2 flex items-center gap-4 text-xs">
                          <span className="text-gray-400">估价:</span>
                          <span className="text-cyan-400">{record.estimatedValue?.toFixed(0)}万</span>
                          <span className="text-gray-400">实际:</span>
                          <span className="text-green-400">{record.actualValue?.toFixed(0)}万</span>
                          <span className={record.deviation && record.deviation > 0 ? 'text-red-400' : 'text-green-400'}>
                            {record.deviation ? (record.deviation > 0 ? '+' : '') + record.deviation.toFixed(1) + '%' : ''}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 ml-2">
                      <button
                        onClick={() => setSelectedRecord(record)}
                        className="p-2 bg-blue-600/30 hover:bg-blue-600/50 text-blue-400 rounded-lg transition-colors"
                        title="查看详情"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('确定要删除这条记录吗？')) {
                            deleteRecord(record.id);
                            showNotification('记录已删除', 'success');
                          }
                        }}
                        className="p-2 bg-red-600/30 hover:bg-red-600/50 text-red-400 rounded-lg transition-colors"
                        title="删除记录"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {record.valuationResult && (
                    <div className="mt-2 pt-2 border-t border-gray-700">
                      <div className="grid grid-cols-4 gap-2 text-xs">
                        <div className="text-center">
                          <div className="text-gray-500">保守</div>
                          <div className="text-gray-300 font-medium">
                            {record.valuationResult.conservativeBid?.toFixed(0) || '-'}万
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-gray-500">稳定</div>
                          <div className="text-amber-400 font-semibold">
                            {record.valuationResult.stableBid?.toFixed(0) || '-'}万
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-gray-500">激进</div>
                          <div className="text-orange-400 font-medium">
                            {record.valuationResult.aggressiveBid?.toFixed(0) || '-'}万
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-gray-500">最高</div>
                          <div className="text-red-400 font-medium">
                            {record.valuationResult.maxBid?.toFixed(0) || '-'}万
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 记录详情弹窗 */}
      {selectedRecord && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                <Eye className="w-6 h-6 text-amber-400" />
                记录详情
              </h3>
              <button
                onClick={() => setSelectedRecord(null)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              {/* 基本信息 */}
              <div className="bg-white/5 rounded-lg p-4">
                <h4 className="text-lg font-medium text-amber-400 mb-3">基本信息</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">时间:</span>
                    <span className="text-white">{formatTimestamp(selectedRecord.timestamp)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">模式:</span>
                    <span className="text-white">{getModeName(selectedRecord.mode)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">角色:</span>
                    <span className="text-white">{getCharacterName(selectedRecord.character)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">回合:</span>
                    <span className="text-white">第{selectedRecord.round}回合</span>
                  </div>
                </div>
              </div>

              {/* 仓深信息 */}
              <div className="bg-white/5 rounded-lg p-4">
                <h4 className="text-lg font-medium text-amber-400 mb-3">仓深信息</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">总件数:</span>
                    <span className="text-white">{selectedRecord.warehouseInfo?.totalItems || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">总格数:</span>
                    <span className="text-white">{selectedRecord.warehouseInfo?.totalSlots || '-'}</span>
                  </div>
                </div>
              </div>

              {/* 品质信息 */}
              <div className="bg-white/5 rounded-lg p-4">
                <h4 className="text-lg font-medium text-amber-400 mb-3">品质信息</h4>
                <div className="space-y-3">
                  {[
                    { key: 'white', name: '白色', color: 'gray', data: selectedRecord.qualities.white },
                    { key: 'green', name: '绿色', color: 'green', data: selectedRecord.qualities.green },
                    { key: 'blue', name: '蓝色', color: 'blue', data: selectedRecord.qualities.blue },
                    { key: 'purple', name: '紫色', color: 'purple', data: selectedRecord.qualities.purple },
                    { key: 'gold', name: '金色', color: 'yellow', data: selectedRecord.qualities.gold },
                    { key: 'red', name: '红色', color: 'red', data: selectedRecord.qualities.red },
                  ].map(({ key, name, color, data }) => (
                    <div key={key} className="flex items-center gap-4">
                      <div className={`w-4 h-4 rounded-full bg-${color}-500`} />
                      <span className="text-white font-medium w-12">{name}</span>
                      <div className="flex items-center gap-4 text-sm">
                        <div>
                          <span className="text-gray-400">件数:</span>
                          <span className="text-white ml-1">{data?.count || 0}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">格数:</span>
                          <span className="text-white ml-1">{data?.slots || 0}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">均格:</span>
                          <span className="text-white ml-1">{data?.avgSlots?.toFixed(2) || '-'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 估价结果 */}
              {selectedRecord.valuationResult && (
                <div className="bg-white/5 rounded-lg p-4">
                  <h4 className="text-lg font-medium text-amber-400 mb-3">估价结果</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="bg-black/20 rounded-lg p-3">
                      <div className="text-gray-400 mb-1">件数流价值</div>
                      <div className="text-white text-lg font-semibold">
                        {selectedRecord.valuationResult.countStreamValue?.toFixed(2) || '-'}万
                      </div>
                    </div>
                    <div className="bg-black/20 rounded-lg p-3">
                      <div className="text-gray-400 mb-1">均格流价值</div>
                      <div className="text-white text-lg font-semibold">
                        {selectedRecord.valuationResult.avgSlotStreamValue?.toFixed(2) || '-'}万
                      </div>
                    </div>
                    <div className="bg-black/20 rounded-lg p-3">
                      <div className="text-gray-400 mb-1">保守出价</div>
                      <div className="text-gray-300 text-lg font-semibold">
                        {selectedRecord.valuationResult.conservativeBid?.toFixed(0) || '-'}万
                      </div>
                    </div>
                    <div className="bg-black/20 rounded-lg p-3">
                      <div className="text-gray-400 mb-1">稳定出价</div>
                      <div className="text-amber-400 text-lg font-semibold">
                        {selectedRecord.valuationResult.stableBid?.toFixed(0) || '-'}万
                      </div>
                    </div>
                    <div className="bg-black/20 rounded-lg p-3">
                      <div className="text-gray-400 mb-1">激进出价</div>
                      <div className="text-orange-400 text-lg font-semibold">
                        {selectedRecord.valuationResult.aggressiveBid?.toFixed(0) || '-'}万
                      </div>
                    </div>
                    <div className="bg-black/20 rounded-lg p-3">
                      <div className="text-gray-400 mb-1">最高出价</div>
                      <div className="text-red-400 text-lg font-semibold">
                        {selectedRecord.valuationResult.maxBid?.toFixed(0) || '-'}万
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 真实价格对比 */}
              {selectedRecord.actualValue !== undefined && selectedRecord.estimatedValue !== undefined && (
                <div className="bg-white/5 rounded-lg p-4">
                  <h4 className="text-lg font-medium text-amber-400 mb-3">真实价格对比</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="bg-black/20 rounded-lg p-3">
                      <div className="text-gray-400 mb-1">系统估价</div>
                      <div className="text-cyan-400 text-lg font-semibold">
                        {selectedRecord.estimatedValue.toFixed(2)}万
                      </div>
                    </div>
                    <div className="bg-black/20 rounded-lg p-3">
                      <div className="text-gray-400 mb-1">实际成交</div>
                      <div className="text-green-400 text-lg font-semibold">
                        {selectedRecord.actualValue.toFixed(2)}万
                      </div>
                    </div>
                    <div className="bg-black/20 rounded-lg p-3">
                      <div className="text-gray-400 mb-1">偏差百分比</div>
                      <div className={`text-lg font-semibold ${
                        selectedRecord.deviation && selectedRecord.deviation > 0
                          ? 'text-red-400'
                          : 'text-green-400'
                      }`}>
                        {selectedRecord.deviation ? (
                          (selectedRecord.deviation > 0 ? '+' : '') + selectedRecord.deviation.toFixed(2) + '%'
                        ) : '-'}
                      </div>
                    </div>
                    <div className="bg-black/20 rounded-lg p-3">
                      <div className="text-gray-400 mb-1">差额</div>
                      <div className={`text-lg font-semibold ${
                        selectedRecord.profit && selectedRecord.profit > 0
                          ? 'text-green-400'
                          : 'text-red-400'
                      }`}>
                        {selectedRecord.profit ? (
                          (selectedRecord.profit > 0 ? '+' : '') + selectedRecord.profit.toFixed(2) + '万'
                        ) : '-'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 备注 */}
              {selectedRecord.notes && (
                <div className="bg-white/5 rounded-lg p-4">
                  <h4 className="text-lg font-medium text-amber-400 mb-3">备注</h4>
                  <p className="text-gray-300 text-sm">{selectedRecord.notes}</p>
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  if (confirm('确定要删除这条记录吗？')) {
                    deleteRecord(selectedRecord.id);
                    setSelectedRecord(null);
                    showNotification('记录已删除', 'success');
                  }
                }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                <Trash2 className="w-5 h-5" />
                删除记录
              </button>
              <button
                onClick={() => setSelectedRecord(null)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataInputPanel;
