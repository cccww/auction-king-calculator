import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Video, 
  Scan, 
  Settings, 
  Eye, 
  EyeOff, 
  Zap, 
  StopCircle,
  Target,
  Palette,
  Download,
  Maximize2,
  Trash2,
  Activity
} from 'lucide-react';
import { useGameDataStore } from '../utils/gameDataManager';
import { EnhancedOCRProcessor, GameDataExtractor } from '../utils/enhancedDataCollector';

interface DetectionArea {
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  type: 'purple' | 'gold' | 'red' | 'warehouse' | 'price' | 'custom';
  enabled: boolean;
}

interface OCRResult {
  text: string;
  confidence: number;
  area: DetectionArea;
  timestamp: number;
  data?: any;
}

export const RealtimeOCRDetector: React.FC = () => {
  const [isDetecting, setIsDetecting] = useState(false);
  const [isPreviewVisible, setIsPreviewVisible] = useState(true);
  const [detectionAreas, setDetectionAreas] = useState<DetectionArea[]>([
    { x: 100, y: 100, width: 200, height: 100, name: '紫色区域', type: 'purple', enabled: true },
    { x: 100, y: 220, width: 200, height: 100, name: '金色区域', type: 'gold', enabled: true },
    { x: 100, y: 340, width: 200, height: 100, name: '红色区域', type: 'red', enabled: true },
  ]);
  const [detectionResults, setDetectionResults] = useState<OCRResult[]>([]);
  const [selectedAreaIndex, setSelectedAreaIndex] = useState<number>(-1);
  const [detectionInterval, setDetectionInterval] = useState(1000);
  const [showSettings, setShowSettings] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ocrProcessorRef = useRef<EnhancedOCRProcessor | null>(null);
  const detectionTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { updateGameData, startNewGame, currentGame } = useGameDataStore();

  // 确保有游戏在进行
  useEffect(() => {
    if (!currentGame) {
      startNewGame();
    }
  }, []);

  // 初始化OCR处理器
  useEffect(() => {
    ocrProcessorRef.current = new EnhancedOCRProcessor();
    ocrProcessorRef.current.initialize().catch(err => {
      console.error('OCR初始化失败:', err);
      showNotification('OCR初始化失败，请刷新重试', 'error');
    });

    return () => {
      cleanup();
    };
  }, []);

  const showNotification = (message: string, type: 'success' | 'error' | 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // 启动屏幕捕获
  const startCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      showNotification('屏幕捕获已启动', 'success');
    } catch (error) {
      showNotification('屏幕捕获失败: ' + (error as Error).message, 'error');
    }
  };

  // 开始实时检测
  const startDetection = async () => {
    if (!streamRef.current) {
      await startCapture();
    }

    if (!ocrProcessorRef.current) {
      ocrProcessorRef.current = new EnhancedOCRProcessor();
      await ocrProcessorRef.current.initialize();
    }

    setIsDetecting(true);
    showNotification('实时检测已启动', 'success');
    runDetectionLoop();
  };

  // 停止检测
  const stopDetection = () => {
    setIsDetecting(false);
    if (detectionTimerRef.current) {
      clearTimeout(detectionTimerRef.current);
      detectionTimerRef.current = null;
    }
    showNotification('检测已停止', 'info');
  };

  // 清理资源
  const cleanup = () => {
    stopDetection();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (ocrProcessorRef.current) {
      ocrProcessorRef.current.cleanup();
    }
  };

  // 检测循环
  const runDetectionLoop = async () => {
    if (!isDetecting || !videoRef.current || !canvasRef.current || !ocrProcessorRef.current) {
      return;
    }

    try {
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      
      ctx.drawImage(videoRef.current, 0, 0);

      for (let i = 0; i < detectionAreas.length; i++) {
        const area = detectionAreas[i];
        if (!area.enabled) continue;

        const areaCanvas = document.createElement('canvas');
        areaCanvas.width = area.width;
        areaCanvas.height = area.height;
        const areaCtx = areaCanvas.getContext('2d');
        
        if (areaCtx) {
          areaCtx.drawImage(
            canvasRef.current,
            area.x, area.y, area.width, area.height,
            0, 0, area.width, area.height
          );

          const result = await ocrProcessorRef.current.detectArea(
            areaCanvas,
            area.type
          );

          if (result.text.trim()) {
            const newResult: OCRResult = {
              text: result.text,
              confidence: result.confidence,
              area: area,
              timestamp: Date.now(),
              data: result.data
            };

            setDetectionResults(prev => {
              const updated = [...prev, newResult];
              return updated.slice(-50);
            });

            if (result.data) {
              const gameData = GameDataExtractor.extractGameData(result.data, area.type);
              console.log('提取的游戏数据:', gameData);
              updateGameData(gameData);
              showNotification(`识别到 ${getTypeLabel(area.type)} 数据: ${result.text}`, 'success');
            }
          }
        }
      }
    } catch (error) {
      console.error('检测错误:', error);
    }

    detectionTimerRef.current = setTimeout(runDetectionLoop, detectionInterval);
  };

  // 更新检测区域
  const updateArea = (index: number, updates: Partial<DetectionArea>) => {
    setDetectionAreas(prev => prev.map((area, i) => 
      i === index ? { ...area, ...updates } : area
    ));
  };

  // 添加新检测区域
  const addArea = (customArea?: Partial<DetectionArea>) => {
    const newArea: DetectionArea = {
      x: customArea?.x ?? 100,
      y: customArea?.y ?? (100 + detectionAreas.length * 120),
      width: customArea?.width ?? 200,
      height: customArea?.height ?? 100,
      name: customArea?.name ?? `区域 ${detectionAreas.length + 1}`,
      type: customArea?.type ?? 'custom',
      enabled: customArea?.enabled ?? true
    };
    setDetectionAreas(prev => [...prev, newArea]);
  };

  // 删除检测区域
  const removeArea = (index: number) => {
    setDetectionAreas(prev => prev.filter((_, i) => i !== index));
    if (selectedAreaIndex === index) {
      setSelectedAreaIndex(-1);
    }
  };

  // 导出检测结果
  const exportResults = () => {
    const data = JSON.stringify(detectionResults, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ocr_detection_results_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('检测结果已导出', 'success');
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      purple: 'bg-purple-500',
      gold: 'bg-yellow-500',
      red: 'bg-red-500',
      warehouse: 'bg-blue-500',
      price: 'bg-green-500',
      custom: 'bg-gray-500'
    };
    return colors[type] || colors.custom;
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      purple: '紫色',
      gold: '金色',
      red: '红色',
      warehouse: '仓库',
      price: '价格',
      custom: '自定义'
    };
    return labels[type] || type;
  };

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
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

      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <Scan className="w-5 h-5" />
          实时OCR检测工具
        </h2>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <Settings className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* 控制面板 */}
      <div className="flex gap-3 mb-6">
        {!streamRef.current ? (
          <button
            onClick={startCapture}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Video className="w-4 h-4" />
            启动屏幕捕获
          </button>
        ) : !isDetecting ? (
          <button
            onClick={startDetection}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
          >
            <Zap className="w-4 h-4" />
            开始检测
          </button>
        ) : (
          <button
            onClick={stopDetection}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            <StopCircle className="w-4 h-4" />
            停止检测
          </button>
        )}

        <button
          onClick={() => setIsPreviewVisible(!isPreviewVisible)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
        >
          {isPreviewVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {isPreviewVisible ? '隐藏预览' : '显示预览'}
        </button>

        <button
          onClick={exportResults}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors"
        >
          <Download className="w-4 h-4" />
          导出结果
        </button>
      </div>

      {/* 主内容区 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 视频预览区 */}
        <div className="lg:col-span-2">
          {isPreviewVisible && (
            <div className="relative bg-black/50 rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                className="w-full"
                style={{ aspectRatio: '16/9' }}
              />
              <canvas ref={canvasRef} className="hidden" />
              
              {/* 检测区域叠加层 */}
              <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                {detectionAreas.map((area, index) => (
                  <div
                    key={index}
                    className={`absolute border-2 ${
                      selectedAreaIndex === index ? 'border-white' : 'border-transparent'
                    } ${area.enabled ? 'opacity-80' : 'opacity-30'}`}
                    style={{
                      left: `${(area.x / (canvasRef.current?.width || 1920)) * 100}%`,
                      top: `${(area.y / (canvasRef.current?.height || 1080)) * 100}%`,
                      width: `${(area.width / (canvasRef.current?.width || 1920)) * 100}%`,
                      height: `${(area.height / (canvasRef.current?.height || 1080)) * 100}%`,
                      backgroundColor: area.enabled ? `${getTypeColor(area.type)}33` : 'transparent',
                    }}
                  >
                    <div className="absolute -top-6 left-0 text-xs text-white bg-black/50 px-2 py-1 rounded">
                      {area.name}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 检测结果 */}
          <div className="mt-4">
            <h3 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4" />
              检测结果 ({detectionResults.length})
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {detectionResults.slice().reverse().map((result, index) => (
                <div key={index} className="p-3 bg-white/5 rounded-lg border border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${getTypeColor(result.area.type)}`} />
                      <span className="text-sm text-gray-300">{result.area.name}</span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(result.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-white text-sm mb-1">{result.text}</div>
                  <div className="text-xs text-gray-400">
                    置信度: {(result.confidence * 100).toFixed(1)}%
                  </div>
                  {result.data && (
                    <div className="mt-2 text-xs text-green-400">
                      {JSON.stringify(result.data)}
                    </div>
                  )}
                </div>
              ))}
              {detectionResults.length === 0 && (
                <div className="text-center text-gray-500 py-8">
                  暂无检测结果
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 检测区域配置 */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-medium text-white flex items-center gap-2">
              <Target className="w-4 h-4" />
              检测区域
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  addArea({ type: 'purple', x: 0, y: 0, width: 300, height: 150, name: '紫色区域 (0,0,300,150)' });
                  showNotification('已添加默认紫色区域', 'success');
                }}
                className="p-1.5 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
                title="添加默认紫色区域"
              >
                <span className="text-white text-xs px-2">默认紫色</span>
              </button>
              <button
                onClick={() => {
                  addArea({ type: 'gold', x: 310, y: 0, width: 300, height: 150, name: '金色区域 (310,0,300,150)' });
                  showNotification('已添加默认金色区域', 'success');
                }}
                className="p-1.5 bg-yellow-600 hover:bg-yellow-700 rounded-lg transition-colors"
                title="添加默认金色区域"
              >
                <span className="text-white text-xs px-2">默认金色</span>
              </button>
              <button
                onClick={() => {
                  addArea({ type: 'red', x: 620, y: 0, width: 300, height: 150, name: '红色区域 (620,0,300,150)' });
                  showNotification('已添加默认红色区域', 'success');
                }}
                className="p-1.5 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                title="添加默认红色区域"
              >
                <span className="text-white text-xs px-2">默认红色</span>
              </button>
              <button
                onClick={() => addArea()}
                className="p-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                title="添加新区域"
              >
                <Maximize2 className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {detectionAreas.map((area, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg border transition-all ${
                  selectedAreaIndex === index 
                    ? 'bg-amber-500/20 border-amber-500' 
                    : 'bg-white/5 border-gray-700'
                }`}
                onClick={() => setSelectedAreaIndex(index)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${getTypeColor(area.type)}`} />
                    <span className="text-sm font-medium text-white">{area.name}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeArea(index);
                    }}
                    className="p-1 hover:bg-red-500/20 rounded transition-colors"
                  >
                    <Trash2 className="w-3 h-3 text-gray-400" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">X</label>
                    <input
                      type="number"
                      value={area.x}
                      onChange={(e) => updateArea(index, { x: parseInt(e.target.value) || 0 })}
                      className="w-full px-2 py-1 bg-white/10 border border-gray-600 rounded text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Y</label>
                    <input
                      type="number"
                      value={area.y}
                      onChange={(e) => updateArea(index, { y: parseInt(e.target.value) || 0 })}
                      className="w-full px-2 py-1 bg-white/10 border border-gray-600 rounded text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">宽度</label>
                    <input
                      type="number"
                      value={area.width}
                      onChange={(e) => updateArea(index, { width: parseInt(e.target.value) || 0 })}
                      className="w-full px-2 py-1 bg-white/10 border border-gray-600 rounded text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">高度</label>
                    <input
                      type="number"
                      value={area.height}
                      onChange={(e) => updateArea(index, { height: parseInt(e.target.value) || 0 })}
                      className="w-full px-2 py-1 bg-white/10 border border-gray-600 rounded text-white text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">类型</label>
                    <select
                      value={area.type}
                      onChange={(e) => updateArea(index, { type: e.target.value as any })}
                      className="w-full px-2 py-1 bg-white/10 border border-gray-600 rounded text-white text-sm"
                    >
                      <option value="purple">紫色</option>
                      <option value="gold">金色</option>
                      <option value="red">红色</option>
                      <option value="warehouse">仓库</option>
                      <option value="price">价格</option>
                      <option value="custom">自定义</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">启用</label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={area.enabled}
                        onChange={(e) => updateArea(index, { enabled: e.target.checked })}
                        className="w-4 h-4"
                      />
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">区域名称</label>
                  <input
                    type="text"
                    value={area.name}
                    onChange={(e) => updateArea(index, { name: e.target.value })}
                    className="w-full px-2 py-1 bg-white/10 border border-gray-600 rounded text-white text-sm"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* 设置面板 */}
          {showSettings && (
            <div className="mt-4 p-4 bg-white/5 rounded-lg border border-gray-700">
              <h4 className="text-md font-medium text-white mb-3 flex items-center gap-2">
                <Settings className="w-4 h-4" />
                检测设置
              </h4>
              
              <div className="mb-3">
                <label className="block text-sm text-gray-400 mb-1">
                  检测间隔 (ms)
                </label>
                <input
                  type="range"
                  min="500"
                  max="5000"
                  step="500"
                  value={detectionInterval}
                  onChange={(e) => setDetectionInterval(parseInt(e.target.value))}
                  className="w-full"
                />
                <div className="text-center text-gray-300 text-sm">{detectionInterval}ms</div>
              </div>

              <div className="p-3 bg-amber-500/20 rounded-lg text-sm text-amber-200">
                <p>💡 提示：</p>
                <p className="mt-1">1. 启动屏幕捕获后选择游戏窗口</p>
                <p>2. 调整检测区域位置和大小</p>
                <p>3. 开始检测后会自动识别数据</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
