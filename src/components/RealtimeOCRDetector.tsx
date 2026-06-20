import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Video, Scan, Eye, EyeOff, Zap, StopCircle, Activity } from 'lucide-react';
import { useGameDataStore } from '../utils/gameDataManager';
import { EnhancedOCRProcessor, GameDataExtractor } from '../utils/enhancedDataCollector';

// 全屏OCR解析结果 (BidKing风格字段)
interface OCRParseResult {
  T?: number;       // 总格数
  B?: number;       // 蓝格数
  WG?: number;      // 白绿格数
  purpleAvg?: number;
  purpleSlots?: number;
  purpleCount?: number;
  goldSlots?: number;
  goldCount?: number;
  goldAvg?: number;
  redSlots?: number;
  redCount?: number;
  totalItems?: number;
  price?: number;
  rawText: string;
  confidence: number;
  timestamp: number;
}

export const RealtimeOCRDetector: React.FC = () => {
  const [isDetecting, setIsDetecting] = useState(false);
  const [isPreviewVisible, setIsPreviewVisible] = useState(true);
  const [parsedResults, setParsedResults] = useState<OCRParseResult | null>(null);
  const [lastRawText, setLastRawText] = useState('');
  const [detectionInterval, setDetectionInterval] = useState(3000);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [ocrStatus, setOcrStatus] = useState<'idle' | 'initializing' | 'ready' | 'error'>('idle');
  const [captureLoading, setCaptureLoading] = useState(false);
  const [ocrHistory, setOcrHistory] = useState<{ text: string; time: string }[]>([]);
  const [showDebug, setShowDebug] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ocrProcessorRef = useRef<EnhancedOCRProcessor | null>(null);
  const detectionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isDetectingRef = useRef(false);

  const { updateGameData, startNewGame, currentGame } = useGameDataStore();

  useEffect(() => {
    if (!currentGame) startNewGame();
  }, []);

  // 初始化OCR
  useEffect(() => {
    setOcrStatus('initializing');
    const processor = new EnhancedOCRProcessor();
    ocrProcessorRef.current = processor;
    processor.initialize()
      .then(() => { setOcrStatus('ready'); })
      .catch((err) => {
        setOcrStatus('error');
        showNotification('OCR初始化失败: ' + (err.message || '未知错误'), 'error');
      });
    return () => cleanup();
  }, []);

  const showNotification = (message: string, type: 'success' | 'error' | 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // 启动屏幕捕获
  const startCapture = async (): Promise<boolean> => {
    if (captureLoading) return false;
    setCaptureLoading(true);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'monitor' } as any,
        audio: false,
      });

      streamRef.current = stream;
      stream.getVideoTracks()[0].onended = () => {
        stopDetection();
        showNotification('屏幕分享已停止', 'info');
      };

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      showNotification('屏幕捕获已启动 ✅ 点击"开始检测"', 'success');
      setCaptureLoading(false);
      return true;
    } catch (error) {
      setCaptureLoading(false);
      const err = error as Error;
      if (err.name === 'NotAllowedError') {
        showNotification('请在弹出窗口中选择要捕获的窗口，然后点击"分享"', 'error');
      } else {
        showNotification('屏幕捕获失败: ' + err.message, 'error');
      }
      return false;
    }
  };

  // 开始全屏检测
  const startDetection = async () => {
    if (!streamRef.current) {
      const ok = await startCapture();
      if (!ok) return;
    }
    if (ocrStatus !== 'ready') {
      showNotification(ocrStatus === 'error' ? 'OCR引擎初始化失败' : 'OCR引擎加载中，请稍候...', 'info');
      return;
    }
    isDetectingRef.current = true;
    setIsDetecting(true);
    showNotification('全屏OCR检测已启动（每' + detectionInterval / 1000 + '秒一次）', 'success');
    runDetectionLoopRef();
  };

  const stopDetection = () => {
    isDetectingRef.current = false;
    setIsDetecting(false);
    if (detectionTimerRef.current) {
      clearTimeout(detectionTimerRef.current);
      detectionTimerRef.current = null;
    }
    showNotification('检测已停止', 'info');
  };

  const cleanup = () => {
    stopDetection();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    ocrProcessorRef.current?.cleanup();
  };

  // 全屏OCR检测循环 (BidKing风格: 截图→OCR→正则提取全部字段)
  const runDetectionLoopRef = useCallback(async () => {
    if (!isDetectingRef.current) return;
    if (!videoRef.current || !canvasRef.current || !ocrProcessorRef.current) {
      if (isDetectingRef.current)
        detectionTimerRef.current = setTimeout(runDetectionLoopRef, 500);
      return;
    }

    try {
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      ctx.drawImage(videoRef.current, 0, 0);

      // 全屏OCR (类型warehouse = 使用BidKing正则)
      const result = await ocrProcessorRef.current.detectArea(canvasRef.current, 'warehouse');

      if (result.text.trim()) {
        const fullText = result.text.trim();
        const now = new Date().toLocaleTimeString();
        setLastRawText(fullText);
        setOcrHistory(prev => [{ text: fullText.slice(0, 200), time: now }, ...prev].slice(0, 20));

        const parsed: OCRParseResult = {
          rawText: fullText, confidence: result.confidence, timestamp: Date.now(),
        };

        if (result.data) {
          if (result.data.totalSlots) parsed.T = result.data.totalSlots;
          if (result.data.blueSlots) parsed.B = result.data.blueSlots;
          if (result.data.whiteGreenSlots) parsed.WG = result.data.whiteGreenSlots;
          if (result.data.purpleAvg) parsed.purpleAvg = result.data.purpleAvg;
          if (result.data.totalItems) parsed.totalItems = result.data.totalItems;
          if (result.data.purpleSlots) parsed.purpleSlots = result.data.purpleSlots;
          if (result.data.purpleCount) parsed.purpleCount = result.data.purpleCount;
          if (result.data.goldSlots) parsed.goldSlots = result.data.goldSlots;
          if (result.data.goldCount) parsed.goldCount = result.data.goldCount;
          if (result.data.goldAvg) parsed.goldAvg = result.data.goldAvg;
          if (result.data.redSlots) parsed.redSlots = result.data.redSlots;
          if (result.data.redCount) parsed.redCount = result.data.redCount;
          if (result.data.price) parsed.price = result.data.price;
          setParsedResults(parsed);

          // 存入游戏数据
          const gameData: any = { gridActuarial: {} };
          const ga = gameData.gridActuarial;
          if (parsed.T) { ga.T = parsed.T; gameData.warehouseInfo = { ...gameData.warehouseInfo, totalSlots: parsed.T }; }
          if (parsed.B) ga.B = parsed.B;
          if (parsed.WG) ga.WG = parsed.WG;
          if (parsed.purpleAvg) ga.purpleAvg = parsed.purpleAvg;
          if (parsed.purpleSlots) ga.purpleSlots = parsed.purpleSlots;
          if (parsed.purpleCount) ga.purpleCount = parsed.purpleCount;
          if (parsed.goldSlots) ga.goldSlots = parsed.goldSlots;
          if (parsed.goldCount) ga.goldCount = parsed.goldCount;
          if (parsed.goldAvg) ga.goldAvg = parsed.goldAvg;
          if (parsed.redSlots) ga.redSlots = parsed.redSlots;
          if (parsed.redCount) ga.redCount = parsed.redCount;
          if (parsed.totalItems) gameData.warehouseInfo = { ...gameData.warehouseInfo, totalItems: parsed.totalItems };

          if (Object.keys(ga).length > 0) updateGameData(gameData);
        }
      }
    } catch (error) {
      console.error('OCR检测错误:', error);
    }

    if (isDetectingRef.current)
      detectionTimerRef.current = setTimeout(runDetectionLoopRef, detectionInterval);
  }, [detectionInterval, updateGameData]);

  // 格式化数值
  const fmt = (v: number | undefined | null, unit = '') => v ? v + unit : '—';

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
      {notification && (
        <div className={`mb-4 p-3 rounded-lg ${
          notification.type === 'success' ? 'bg-green-500/30 text-green-200' :
          notification.type === 'error' ? 'bg-red-500/30 text-red-200' : 'bg-blue-500/30 text-blue-200'
        }`}>{notification.message}</div>
      )}

      {/* 标题 */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <Scan className="w-5 h-5" />
          全屏OCR检测 (BidKing风格)
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">
            OCR: {ocrStatus === 'ready' ? '✅ 就绪' : ocrStatus === 'initializing' ? '⏳ 加载中...' : '❌ 错误'}
          </span>
          <span className="text-xs text-gray-400">
            间隔: {detectionInterval / 1000}s
          </span>
        </div>
      </div>

      {/* 使用说明 */}
      <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-sm text-blue-200 space-y-1">
        <div className="font-medium text-blue-100">📖 使用步骤：</div>
        <div>1️⃣ 点击 <strong className="text-yellow-200">「📺 启动屏幕捕获」</strong> → 选择游戏窗口</div>
        <div>2️⃣ 点击 <strong className="text-yellow-200">「▶ 开始检测」</strong> → 自动全屏OCR</div>
        <div>3️⃣ 切换 <strong className="text-yellow-200">「计算器」</strong> 标签 → 开启 <strong className="text-yellow-200">精算模式</strong> 查看估值</div>
      </div>

      {/* 控制按钮 */}
      <div className="flex gap-3 mb-6">
        {captureLoading ? (
          <button disabled className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg cursor-wait">
            <Video className="w-4 h-4 animate-pulse" /> 请选择窗口...
          </button>
        ) : !streamRef.current ? (
          <button onClick={startCapture}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-lg shadow-blue-600/30">
            <Video className="w-4 h-4" /> 📺 启动屏幕捕获
          </button>
        ) : !isDetecting ? (
          <button onClick={startDetection}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-lg shadow-green-600/30">
            <Zap className="w-4 h-4" /> ▶ 开始检测
          </button>
        ) : (
          <button onClick={stopDetection}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg">
            <StopCircle className="w-4 h-4" /> ⏹ 停止检测
          </button>
        )}
        <button onClick={() => setIsPreviewVisible(!isPreviewVisible)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg">
          {isPreviewVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {isPreviewVisible ? '隐藏预览' : '显示预览'}
        </button>
        <button onClick={() => setShowDebug(!showDebug)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs">
          {showDebug ? '隐藏调试' : '调试'}
        </button>
      </div>

      {/* 主内容 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 视频预览 */}
        <div className="lg:col-span-2">
          {isPreviewVisible && (
            <div className="bg-black/50 rounded-lg overflow-hidden">
              <video ref={videoRef} className="w-full" style={{ aspectRatio: '16/9' }} />
              <canvas ref={canvasRef} className="hidden" />
            </div>
          )}

          {/* OCR历史记录 */}
          {ocrHistory.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <Activity className="w-4 h-4" /> OCR识别记录
              </h3>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {ocrHistory.slice(0, 10).map((h, i) => (
                  <div key={i} className="text-xs text-gray-400 bg-white/5 p-2 rounded">
                    <span className="text-gray-500">[{h.time}]</span> {h.text}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 解析结果 */}
        <div className="space-y-3">
          <h3 className="text-lg font-medium text-white flex items-center gap-2">
            <Activity className="w-4 h-4" />
            OCR解析结果
          </h3>

          {parsedResults ? (
            <>
              {/* BidKing关键字段 */}
              <div className="bg-purple-900/20 rounded-lg p-3 border border-purple-500/30">
                <h4 className="text-sm font-medium text-purple-300 mb-2">📐 数格子精算字段</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-gray-400">总格数T:</span> <span className="text-white font-bold">{fmt(parsedResults.T)}</span></div>
                  <div><span className="text-gray-400">蓝格数B:</span> <span className="text-white">{fmt(parsedResults.B)}</span></div>
                  <div><span className="text-gray-400">白绿格数WG:</span> <span className="text-white">{fmt(parsedResults.WG)}</span></div>
                  <div><span className="text-gray-400">紫均格:</span> <span className="text-white">{fmt(parsedResults.purpleAvg)}</span></div>
                  <div><span className="text-gray-400">紫格/件:</span> <span className="text-white">{fmt(parsedResults.purpleSlots)}/{fmt(parsedResults.purpleCount)}</span></div>
                  <div><span className="text-gray-400">金格/件:</span> <span className="text-white">{fmt(parsedResults.goldSlots)}/{fmt(parsedResults.goldCount)}</span></div>
                  {parsedResults.goldAvg && <div><span className="text-gray-400">金均格:</span> <span className="text-white">{fmt(parsedResults.goldAvg)}</span></div>}
                  <div><span className="text-gray-400">红格/件:</span> <span className="text-white">{fmt(parsedResults.redSlots)}/{fmt(parsedResults.redCount)}</span></div>
                </div>
              </div>

              {/* 仓库信息 */}
              {(parsedResults.totalItems || parsedResults.T) && (
                <div className="bg-blue-900/20 rounded-lg p-3 border border-blue-500/30">
                  <h4 className="text-sm font-medium text-blue-300 mb-2">📦 仓库信息</h4>
                  <div className="text-xs space-y-1">
                    {parsedResults.totalItems && <div><span className="text-gray-400">总件数:</span> <span className="text-white">{parsedResults.totalItems}</span></div>}
                    {parsedResults.T && <div><span className="text-gray-400">总格数:</span> <span className="text-white">{parsedResults.T}</span></div>}
                    {parsedResults.confidence > 0 && <div><span className="text-gray-400">置信度:</span> <span className="text-white">{(parsedResults.confidence * 100).toFixed(1)}%</span></div>}
                    <div className="text-gray-500">{new Date(parsedResults.timestamp).toLocaleTimeString()}</div>
                  </div>
                </div>
              )}

              {/* 操作提示 */}
              <div className="bg-green-900/20 rounded-lg p-3 border border-green-500/30 text-sm text-green-200">
                ✅ 数据已自动同步到计算器
                <div className="text-xs text-green-300 mt-1">
                  切换到「计算器」标签，开启「精算模式」查看估值
                </div>
              </div>
            {showDebug && lastRawText && (
              <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-600">
                <h4 className="text-xs font-medium text-gray-400 mb-2">🔍 调试：原始OCR文本</h4>
                <pre className="text-xs text-gray-300 whitespace-pre-wrap break-all max-h-48 overflow-y-auto">{lastRawText}</pre>
                {parsedResults && (
                  <>
                    <h4 className="text-xs font-medium text-gray-400 mt-3 mb-2">📊 解析字段</h4>
                    <div className="text-xs text-gray-300 space-y-1">
                      {['T', 'B', 'WG', 'purpleAvg', 'purpleSlots', 'purpleCount', 'goldSlots', 'goldCount', 'goldAvg', 'redSlots', 'redCount', 'totalItems', 'price'].map(k => {
                        const v = (parsedResults as any)[k];
                        return v !== undefined ? <div key={k}><span className="text-gray-500">{k}:</span> {v}</div> : null;
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
            </>
          ) : (
            <div className="text-center text-gray-500 py-12">
              <Scan className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>等待OCR检测...</p>
              <p className="text-xs mt-2">启动屏幕捕获后点击"开始检测"</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
