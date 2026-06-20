import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Video, Scan, Eye, EyeOff, Zap, StopCircle, Activity, Target, Trash2, Plus } from 'lucide-react';
import { useGameDataStore } from '../utils/gameDataManager';
import { EnhancedOCRProcessor, ColorDetector, GameDataExtractor } from '../utils/enhancedDataCollector';

// ===== 检测区域定义 =====
export interface DetectionRegion {
  id: string;
  x: number; y: number; w: number; h: number;
  name: string;
  type: 'warehouse' | 'purple' | 'gold' | 'red' | 'blue' | 'whitegreen' | 'price' | 'custom';
  enabled: boolean;
  color: string;
}

const QUALITY_COLORS: Record<string, string> = {
  warehouse: '#60a5fa', purple: '#a855f7', gold: '#facc15',
  red: '#ef4444', blue: '#3b82f6', whitegreen: '#22c55e',
  price: '#f97316', custom: '#6b7280',
};

const QUALITY_LABELS: Record<string, string> = {
  warehouse: '仓库面板', purple: '紫色', gold: '金色', red: '红色',
  blue: '蓝色', whitegreen: '白绿', price: '价格', custom: '自定义',
};

const STORAGE_KEY = 'auction_king_detection_regions';

function defaultRegions(): DetectionRegion[] {
  return [
    { id: 'r1', x: 0.55, y: 0.05, w: 0.12, h: 0.85, name: '右侧仓库面板', type: 'warehouse', enabled: true, color: QUALITY_COLORS.warehouse },
    { id: 'r2', x: 0.35, y: 0.15, w: 0.18, h: 0.08, name: '总格数', type: 'price', enabled: true, color: QUALITY_COLORS.price },
  ];
}

function loadRegions(): DetectionRegion[] {
  try {
    const d = localStorage.getItem(STORAGE_KEY);
    return d ? JSON.parse(d) : defaultRegions();
  } catch { return defaultRegions(); }
}

function saveRegions(regions: DetectionRegion[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(regions));
}

// ===== 结果类型 =====
interface RegionResult {
  regionId: string;
  text: string;
  confidence: number;
  data?: any;
  colorAnalysis?: Record<string, number>;
  qualityCounts?: Record<string, { ratio: number; estimatedCount?: number }>;
}

let _idCounter = 10;
function newId() { return `r${_idCounter++}`; }

export const RealtimeOCRDetector: React.FC = () => {
  const [isDetecting, setIsDetecting] = useState(false);
  const [preview, setPreview] = useState(true);
  const [regions, setRegions] = useState<DetectionRegion[]>(loadRegions);
  const [results, setResults] = useState<RegionResult[]>([]);
  const [ocrStatus, setOcrStatus] = useState<'idle'|'initializing'|'ready'|'error'>('idle');
  const [captureLoading, setCaptureLoading] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [interval, setInterval] = useState(3000);
  const [drag, setDrag] = useState<{ idx: number; type: 'move'|'resize'; ox: number; oy: number; orig: DetectionRegion } | null>(null);
  const [selIdx, setSelIdx] = useState<number>(-1);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ocrRef = useRef<EnhancedOCRProcessor | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isDetectingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { updateGameData, startNewGame, currentGame } = useGameDataStore();
  useEffect(() => { if (!currentGame) startNewGame(); }, []);

  // Initialize OCR
  useEffect(() => {
    setOcrStatus('initializing');
    const p = new EnhancedOCRProcessor();
    ocrRef.current = p;
    p.initialize().then(() => setOcrStatus('ready')).catch(() => setOcrStatus('error'));
    return () => { stopDetect(); if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; } ocrRef.current?.cleanup(); };
  }, []);

  // ====== 区域持久化 ======
  useEffect(() => { saveRegions(regions); }, [regions]);

  // ====== 鼠标拖拽 ======
  const handleMouseDown = (idx: number, type: 'move'|'resize', e: React.MouseEvent) => {
    if (!containerRef.current) return;
    e.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    setDrag({ idx, type, ox: e.clientX, oy: e.clientY, orig: { ...regions[idx] } });
  };

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: MouseEvent) => {
      if (!containerRef.current || !drag) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dx = (e.clientX - drag.ox) / rect.width;
      const dy = (e.clientY - drag.oy) / rect.height;
      setRegions(prev => {
        const r = [...prev];
        const o = drag.orig;
        if (drag.type === 'move') {
          r[drag.idx] = { ...o, x: Math.max(0, Math.min(1, o.x + dx)), y: Math.max(0, Math.min(1, o.y + dy)) };
        } else {
          r[drag.idx] = { ...o, w: Math.max(0.02, o.w + dx), h: Math.max(0.02, o.h + dy) };
        }
        return r;
      });
    };
    const onUp = () => setDrag(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [drag]);

  // ====== 区域管理 ======
  const addRegion = (type: DetectionRegion['type']) => {
    const color = QUALITY_COLORS[type] || '#6b7280';
    setRegions(prev => [...prev, { id: newId(), x: 0.3, y: 0.3, w: 0.15, h: 0.1, name: QUALITY_LABELS[type], type, enabled: true, color }]);
  };

  const delRegion = (idx: number) => setRegions(prev => prev.filter((_, i) => i !== idx));

  // ====== 屏幕捕获 ======
  const startCapture = async () => {
    if (captureLoading) return false;
    setCaptureLoading(true);
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'monitor' } as any, audio: false });
      streamRef.current = s;
      s.getVideoTracks()[0].onended = () => { stopDetect(); };
      if (videoRef.current) { videoRef.current.srcObject = s; await videoRef.current.play(); }
      setCaptureLoading(false);
      return true;
    } catch (e) {
      setCaptureLoading(false);
      return false;
    }
  };

  const startDetect = async () => {
    if (!streamRef.current && !await startCapture()) return;
    if (ocrStatus !== 'ready') return;
    isDetectingRef.current = true;
    setIsDetecting(true);
    runLoop();
  };

  const stopDetect = () => {
    isDetectingRef.current = false;
    setIsDetecting(false);
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  };

  // ====== 检测循环 ======
  const runLoop = useCallback(async () => {
    if (!isDetectingRef.current) return;
    if (!videoRef.current || !canvasRef.current || !ocrRef.current) {
      if (isDetectingRef.current) timerRef.current = setTimeout(runLoop, 500);
      return;
    }

    try {
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;
      const vw = videoRef.current.videoWidth || 1920;
      const vh = videoRef.current.videoHeight || 1080;
      canvasRef.current.width = vw;
      canvasRef.current.height = vh;
      ctx.drawImage(videoRef.current, 0, 0);

      const newResults: RegionResult[] = [];

      for (let i = 0; i < regions.length; i++) {
        const reg = regions[i];
        if (!reg.enabled || !isDetectingRef.current) continue;

        const rx = Math.round(reg.x * vw);
        const ry = Math.round(reg.y * vh);
        const rw = Math.round(reg.w * vw);
        const rh = Math.round(reg.h * vh);

        // 裁剪区域
        const sub = document.createElement('canvas');
        sub.width = rw; sub.height = rh;
        const sctx = sub.getContext('2d');
        if (!sctx) continue;
        sctx.drawImage(canvasRef.current, rx, ry, rw, rh, 0, 0, rw, rh);

        const result: RegionResult = { regionId: reg.id, text: '', confidence: 0 };
        newResults.push(result);

        // 颜色分析（所有类型都做）
        result.colorAnalysis = ColorDetector.analyzeImageColors(sub);
        result.qualityCounts = ColorDetector.countQualityItems(sub);

        // OCR识别
        try {
          const ocrResult = await ocrRef.current.detectArea(sub, reg.type === 'whitegreen' ? 'custom' : reg.type);
          result.text = ocrResult.text;
          result.confidence = ocrResult.confidence;
          result.data = ocrResult.data;

          // 将OCR+颜色分析结果写入游戏数据
          if (ocrResult.data || result.qualityCounts) {
            const gameData: any = { gridActuarial: {} };
            const ga = gameData.gridActuarial;

            // OCR提取的数据
            if (ocrResult.data) {
              const d = ocrResult.data;
              if (d.totalSlots) { ga.T = d.totalSlots; gameData.warehouseInfo = { ...gameData.warehouseInfo, totalSlots: d.totalSlots }; }
              if (d.blueSlots) ga.B = d.blueSlots;
              if (d.whiteGreenSlots) ga.WG = d.whiteGreenSlots;
              if (d.purpleAvg) ga.purpleAvg = d.purpleAvg;
              if (d.price) ga.price = d.price;
              // 品质数据
              const qualities: any = {};
              if (d.purpleSlots || d.purpleCount || d.purpleAvg) {
                qualities.purple = {};
                if (d.purpleSlots && !isNaN(d.purpleSlots)) qualities.purple.slots = d.purpleSlots;
                if (d.purpleCount && !isNaN(d.purpleCount)) qualities.purple.count = d.purpleCount;
                if (d.purpleAvg && !isNaN(d.purpleAvg)) qualities.purple.avgSlots = d.purpleAvg;
              }
              if (d.goldSlots || d.goldCount || d.goldAvg) {
                qualities.gold = {};
                if (d.goldSlots && !isNaN(d.goldSlots)) qualities.gold.slots = d.goldSlots;
                if (d.goldCount && !isNaN(d.goldCount)) qualities.gold.count = d.goldCount;
                if (d.goldAvg && !isNaN(d.goldAvg)) qualities.gold.avgSlots = d.goldAvg;
              }
              if (d.redSlots || d.redCount) {
                qualities.red = {};
                if (d.redSlots && !isNaN(d.redSlots)) qualities.red.slots = d.redSlots;
                if (d.redCount && !isNaN(d.redCount)) qualities.red.count = d.redCount;
              }
              if (Object.keys(qualities).length > 0) gameData.qualities = qualities;
            }

            // 颜色分析辅助：估算各品质件数（当OCR没识别到时）
            if (result.qualityCounts && !gameData.qualities) {
              const qc = result.qualityCounts;
              const totalHint = currentGame?.warehouseInfo?.totalItems;
              const minCount = 3; // 最小占比才计为有该品质
              const qualities: any = {};
              const qualityMap: Record<string, string> = {
                white: 'white', green: 'green', blue: 'blue',
                purple: 'purple', gold: 'gold', red: 'red',
              };
              for (const [q, info] of Object.entries(qc)) {
                if (info.ratio > 0.03 && qualityMap[q]) {
                  const est = totalHint ? Math.round(totalHint * info.ratio) : Math.round(info.ratio * 100);
                  if (est >= minCount) qualities[qualityMap[q]] = { count: est };
                }
              }
              if (Object.keys(qualities).length > 0) gameData.qualities = qualities;
            }

            if (Object.keys(ga).length > 0 || gameData.qualities) {
              updateGameData(gameData);
            }
          }
        } catch { /* OCR failed for this region */ }
      }

      setResults(newResults);
    } catch (e) { console.error('检测循环错误:', e); }

    if (isDetectingRef.current) timerRef.current = setTimeout(runLoop, interval);
  }, [regions, interval, updateGameData, currentGame]);

  // ====== 渲染 ======
  const scaleX = (v: number) => `${(v * 100).toFixed(1)}%`;

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
      {/* 标题+状态 */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2"><Scan className="w-5 h-5" /> 区域OCR检测</h2>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span>OCR: {ocrStatus === 'ready' ? '✅' : ocrStatus === 'initializing' ? '⏳' : '❌'}</span>
          <span>间隔:{Math.round(interval/1000)}s</span>
          {results.length > 0 && <span>区域:{results.filter(r=>r.text).length}/{regions.filter(r=>r.enabled).length}</span>}
        </div>
      </div>

      {/* 操作栏 */}
      <div className="flex flex-wrap gap-2 mb-4">
        {captureLoading ? (
          <button disabled className="px-4 py-2 bg-gray-500 text-white rounded-lg cursor-wait"><Video className="w-4 h-4 inline mr-1" />请选择窗口...</button>
        ) : !streamRef.current ? (
          <button onClick={startCapture} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-lg"><Video className="w-4 h-4 inline mr-1" />📺 启动屏幕捕获</button>
        ) : !isDetecting ? (
          <button onClick={startDetect} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-lg"><Zap className="w-4 h-4 inline mr-1" />▶ 开始检测</button>
        ) : (
          <button onClick={stopDetect} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"><StopCircle className="w-4 h-4 inline mr-1" />⏹ 停止</button>
        )}
        <button onClick={() => setPreview(!preview)} className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg">
          {preview ? <EyeOff className="w-4 h-4 inline mr-1" /> : <Eye className="w-4 h-4 inline mr-1" />}{preview ? '隐藏' : '显示'}预览
        </button>
        <button onClick={() => setShowDebug(!showDebug)} className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs">调试</button>

        {/* 快速添加区域 */}
        <div className="flex gap-1 ml-2">
          {(['warehouse', 'purple', 'gold', 'red', 'blue', 'whitegreen', 'price'] as const).map(t => (
            <button key={t} onClick={() => addRegion(t)}
              className="px-2 py-1 rounded text-xs text-white hover:opacity-80" style={{ backgroundColor: QUALITY_COLORS[t] }}>
              +{QUALITY_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 左：视频预览+区域叠加 */}
        <div className="lg:col-span-2">
          {preview && (
            <div ref={containerRef} className="relative bg-black/50 rounded-lg overflow-hidden select-none" style={{ aspectRatio: '16/9' }}>
              <video ref={videoRef} className="w-full h-full" style={{ objectFit: 'contain' }} />
              <canvas ref={canvasRef} className="hidden" />

              {/* 区域叠加层 */}
              {regions.map((reg, i) => (
                <div key={reg.id}
                  onMouseDown={(e) => handleMouseDown(i, 'move', e)}
                  className={`absolute border-2 cursor-move ${selIdx === i ? 'z-10 ring-2 ring-white' : ''}`}
                  style={{
                    left: scaleX(reg.x), top: scaleX(reg.y), width: scaleX(reg.w), height: scaleX(reg.h),
                    borderColor: reg.enabled ? reg.color : '#555',
                    backgroundColor: reg.enabled ? `${reg.color}22` : 'transparent',
                  }}
                  onClick={() => setSelIdx(i)}>
                  <div className="absolute -top-5 left-0 text-[10px] text-white px-1 rounded whitespace-nowrap" style={{ backgroundColor: reg.color }}>
                    {reg.name}
                    {drag?.idx === i && ' 📍'}
                  </div>
                  {/* 缩放把手 */}
                  <div onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(i, 'resize', e); }}
                    className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
                    style={{ backgroundColor: reg.color }} />
                  <button onClick={(e) => { e.stopPropagation(); delRegion(i); }}
                    className="absolute -top-5 right-0 text-red-400 text-xs px-1 bg-black/50 rounded">✕</button>
                </div>
              ))}
            </div>
          )}

          {/* 结果概览 */}
          {results.length > 0 && (
            <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
              {results.filter(r => r.text || r.colorAnalysis).slice(0, 10).map((r, i) => {
                const reg = regions.find(x => x.id === r.regionId);
                return (
                  <div key={i} className="p-2 bg-white/5 rounded border border-gray-700 text-xs">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: reg?.color }} />
                      <span className="text-gray-300 font-medium">{reg?.name || r.regionId}</span>
                      {r.text && <span className="text-gray-500">{(r.confidence * 100).toFixed(0)}%</span>}
                    </div>
                    {r.text && <div className="text-gray-400 mb-1">{r.text.slice(0, 120)}</div>}
                    {r.data && <pre className="text-green-400/70 text-[10px]">{JSON.stringify(r.data, null, 1)}</pre>}
                    {showDebug && r.colorAnalysis && (
                      <div className="text-gray-500 text-[10px] flex gap-2 flex-wrap">
                        {Object.entries(r.colorAnalysis).filter(([,v]) => v > 0.01).map(([k,v]) => (
                          <span key={k}>{k}:{(v * 100).toFixed(0)}%</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 右：区域列表 */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-white flex items-center gap-2"><Target className="w-4 h-4" />检测区域</h3>
          {regions.map((reg, i) => (
            <div key={reg.id}
              className={`p-2 rounded cursor-pointer text-xs ${selIdx === i ? 'bg-white/10 ring-1 ring-white' : 'bg-white/5 hover:bg-white/10'}`}
              onClick={() => setSelIdx(i)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: reg.color }} />
                  <span className="text-gray-200">{reg.name}</span>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setRegions(prev => { const r = [...prev]; r[i].enabled = !r[i].enabled; return r; })}
                    className={`px-1.5 py-0.5 rounded text-[10px] ${reg.enabled ? 'bg-green-600' : 'bg-gray-600'}`}>
                    {reg.enabled ? '开' : '关'}
                  </button>
                </div>
              </div>
              <div className="text-gray-500 mt-0.5">
                {Math.round(reg.x*1920)},{Math.round(reg.y*1080)} {Math.round(reg.w*1920)}×{Math.round(reg.h*1080)}
              </div>
              {/* 该区域的最新结果 */}
              {results.filter(r => r.regionId === reg.id).slice(0, 1).map(r => (
                <div key="r" className="mt-1 text-green-300/70">
                  {r.text ? `📝 ${r.text.slice(0, 60)}` : r.colorAnalysis ? '🎨 颜色分析完成' : '⏳'}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
