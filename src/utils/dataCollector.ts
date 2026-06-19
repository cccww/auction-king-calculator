// 数据采集模块
import Tesseract from 'tesseract.js';

// 剪贴板监听器
export class ClipboardMonitor {
  private isMonitoring: boolean = false;
  private onDataCallback: ((data: string) => void) | null = null;
  private lastData: string = '';
  private interval: number | null = null;

  constructor(callback?: (data: string) => void) {
    if (callback) {
      this.onDataCallback = callback;
    }
  }

  // 开始监听剪贴板
  startMonitoring(callback?: (data: string) => void): void {
    if (callback) {
      this.onDataCallback = callback;
    }
    this.isMonitoring = true;
    this.interval = window.setInterval(() => {
      this.checkClipboard();
    }, 500); // 每500ms检查一次
  }

  // 停止监听
  stopMonitoring(): void {
    this.isMonitoring = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private async checkClipboard(): Promise<void> {
    try {
      const clipboardData = await navigator.clipboard.readText();
      if (clipboardData && clipboardData !== this.lastData) {
        this.lastData = clipboardData;
        if (this.onDataCallback) {
          this.onDataCallback(clipboardData);
        }
      }
    } catch (e) {
      console.error('Clipboard read error:', e);
    }
  }

  // 设置回调函数
  setCallback(callback: (data: string) => void): void {
    this.onDataCallback = callback;
  }
}

// OCR 识别器
export class OCRProcessor {
  private worker: Tesseract.Worker | null = null;
  private isInitialized: boolean = false;

  // 初始化OCR引擎
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      this.worker = await Tesseract.createWorker('chi_sim+eng', 1, {
        logger: (m) => console.log(m),
      });
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize OCR:', error);
      throw new Error('OCR初始化失败');
    }
  }

  // 识别图像中的文本
  async recognizeText(image: File | string): Promise<string> {
    if (!this.worker || !this.isInitialized) {
      await this.initialize();
    }

    try {
      const result = await this.worker.recognize(image);
      return result.data.text;
    } catch (error) {
      console.error('OCR recognition error:', error);
      throw new Error('文本识别失败');
    }
  }

  // 处理截图
  async processScreenshot(imageData: string): Promise<string> {
    return this.recognizeText(imageData);
  }

  // 清理资源
  async cleanup(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
    }
  }
}

// ==================== OCR 字符纠错 (移植自 BidKing) ====================
/** OCR 误识字符纠正 (全角→半角, 字母→数字, 符号纠正) */
function normalizeOCRText(text: string): string {
  const replacements: [string, string][] = [
    ["Ｏ", "0"],   // 全角 O
    ["ｏ", "0"],   // 全角 o
    ["０", "0"],   // 全角数字 0
    ["１", "1"],
    ["２", "2"],
    ["３", "3"],
    ["４", "4"],
    ["５", "5"],
    ["６", "6"],
    ["７", "7"],
    ["８", "8"],
    ["９", "9"],
    ["．", "."],   // 全角点
    ["。", "."],   // 中文句号 → 小数点
    ["，", ","],
    [" ", ""],
    ["　", ""],
    ["·", "."],
    ["•", "."],
  ];
  for (const [k, v] of replacements) {
    text = text.split(k).join(v);
  }
  return text;
}

// 正则模式 (移植自 BidKing 的宽松风格)
const OCR_PATTERNS: Record<string, RegExp[]> = {
  // 总格数 T: 总仓储空间 / 所有藏品
  totalSlots: [
    /所有藏品[^0-9色]{0,25}?(\d{1,4})\s*格/,
    /总仓储[^0-9]{0,20}?(\d{1,4})\s*格/,
    /总格数[^0-9]{0,15}?(\d{1,4})/,
    /总格子[^0-9]{0,15}?(\d{1,4})/,
  ],
  // 蓝色格数 B: 良品扫描
  blueSlots: [
    /所有蓝色品质藏品[^0-9]{0,25}?(\d{1,4})\s*格/,
    /蓝色[^0-9]{0,25}?(\d{1,4})\s*格/,
  ],
  // 白绿格数 WG: 普品扫描 (游戏文案: "所有白色和绿色品质藏品总占位数为XX格")
  whiteGreenSlots: [
    /所有白色[和与及]?绿色品质藏品[^0-9]{0,25}?(\d{1,4})\s*格/,
    /所有白绿品质藏品[^0-9]{0,25}?(\d{1,4})\s*格/,
    /白色[和与及\s]*绿色[^0-9]{0,25}?(\d{1,4})\s*格/,
    /白绿[^0-9]{0,20}?(\d{1,4})\s*格/,
  ],
  // 紫色平均格数 c_p: 优品均格 ("平均"必须出现, 避免撞"紫色总占X格")
  purpleAvg: [
    /所有紫色品质藏品平均[^0-9]{0,10}?(\d+\.?\d*)\s*格/,
    /紫色[^0-9]{0,20}?平均[^0-9]{0,10}?(\d+\.?\d*)\s*格/,
    /紫色平均[^0-9]{0,10}?(\d+\.?\d*)/,
  ],
  // 紫色总格数 / 件数
  purpleSlots: [
    /所有紫色品质藏品[^0-9]{0,20}?(\d{1,4})\s*格/,
    /紫色总[^0-9]{0,15}?(\d{1,4})\s*格/,
  ],
  purpleCount: [
    /紫色[^0-9]{0,15}?(\d{1,4})\s*(?:个|件)/,
    /优品[^0-9]{0,10}?(\d{1,4})\s*(?:个|件)/,
  ],
  // 金色
  goldSlots: [
    /所有金色品质藏品[^0-9]{0,20}?(\d{1,4})\s*格/,
    /金色总[^0-9]{0,15}?(\d{1,4})\s*格/,
    /极品[^0-9]{0,10}?(\d{1,4})\s*格/,
  ],
  goldCount: [
    /金色[^0-9]{0,15}?(\d{1,4})\s*(?:个|件)/,
    /极品[^0-9]{0,10}?(\d{1,4})\s*(?:个|件)/,
  ],
  goldAvg: [
    /所有金色品质藏品平均[^0-9]{0,10}?(\d+\.?\d*)\s*格/,
    /金色[^0-9]{0,20}?平均[^0-9]{0,10}?(\d+\.?\d*)\s*格/,
    /金色平均[^0-9]{0,10}?(\d+\.?\d*)/,
  ],
  // 红色
  redSlots: [
    /所有红色品质藏品[^0-9]{0,20}?(\d{1,4})\s*格/,
    /红色总[^0-9]{0,15}?(\d{1,4})\s*格/,
    /传说[^0-9]{0,10}?(\d{1,4})\s*格/,
  ],
  redCount: [
    /红色[^0-9]{0,15}?(\d{1,4})\s*(?:个|件)/,
    /传说[^0-9]{0,10}?(\d{1,4})\s*(?:个|件)/,
  ],
  // 总件数
  totalItems: [
    /总件数[^0-9]{0,15}?(\d{1,4})/,
    /总数[^0-9]{0,10}?(\d{1,4})/,
  ],
  // 价格
  price: [
    /价格[^0-9]{0,15}?(\d+(?:\.\d+)?)/,
    /出价[^0-9]{0,15}?(\d+(?:\.\d+)?)/,
    /金额[^0-9]{0,15}?(\d+(?:\.\d+)?)/,
  ],
};

/** 从正则列表取第一个匹配 */
function _firstMatch(patterns: RegExp[], text: string): string | null {
  for (const p of patterns) {
    const m = p.exec(text);
    if (m) return m[1];
  }
  return null;
}

// 游戏数据解析器
export class GameDataParser {
  /**
   * 解析从OCR或剪贴板获取的文本 (使用 BidKing 改进的宽松正则)
   * 增量填充: 识别到的字段才覆盖, 未识别到的保留原值
   */
  static parseGameText(text: string): { [key: string]: any } {
    const result: { [key: string]: any } = {};

    // 字符归一化 (移植 BidKing)
    const norm = normalizeOCRText(text);

    // 用新模式匹配
    for (const [key, patterns] of Object.entries(OCR_PATTERNS)) {
      const matched = _firstMatch(patterns, norm);
      if (matched !== null) {
        const value = key.includes('Avg') ? parseFloat(matched) : parseInt(matched, 10);
        if (!isNaN(value)) {
          result[key] = value;
        }
      }
    }

    // 兼容旧字段名 (保持向后兼容)
    if (result.totalItems !== undefined && result.purpleCount === undefined) {
      // 尝试从总件数和白绿蓝推算紫色件数逻辑在调用方处理
    }

    return result;
  }

  /**
   * 转换为游戏数据格式 (增量填充)
   * 新字段名优先兼容旧字段名
   */
  static convertToGameData(
    parsedData: { [key: string]: any }
  ): { qualities?: any; warehouseInfo?: any; gridActuarial?: any } {
    const result: { qualities?: any; warehouseInfo?: any; gridActuarial?: any } = {};

    // 构建品质信息 (增量: 只设置识别到的字段)
    result.qualities = {
      white: {},
      green: {},
      blue: {},
      purple: {
        count: parsedData.purpleCount ?? parsedData.purpleCount,
        slots: parsedData.purpleSlots ?? parsedData.purpleSlots,
        avgSlots: parsedData.purpleAvg ?? parsedData.purpleAvg,
      },
      gold: {
        count: parsedData.goldCount ?? parsedData.goldCount,
        slots: parsedData.goldSlots ?? parsedData.goldSlots,
        avgSlots: parsedData.goldAvg ?? parsedData.goldAvg,
      },
      red: {
        count: parsedData.redCount ?? parsedData.redCount,
        slots: parsedData.redSlots ?? parsedData.redSlots,
      },
    };

    // 构建仓库信息
    result.warehouseInfo = {
      totalItems: parsedData.totalItems ?? parsedData.totalItems,
      totalSlots: parsedData.totalSlots ?? parsedData.totalSlots,
    };

    // 数格子精算字段 (如果有蓝格数、白绿格数的识别结果)
    if (parsedData.blueSlots !== undefined || parsedData.whiteGreenSlots !== undefined) {
      result.gridActuarial = {};
      if (parsedData.blueSlots !== undefined) {
        result.gridActuarial.B = parsedData.blueSlots;
      }
      if (parsedData.whiteGreenSlots !== undefined) {
        result.gridActuarial.WG = parsedData.whiteGreenSlots;
      }
    }

    return result;
  }

  /**
   * 增量合并: 将新识别到的数据合并到现有数据, 不覆盖未识别字段
   */
  static mergeIncremental(
    existing: { qualities?: any; warehouseInfo?: any },
    newData: { qualities?: any; warehouseInfo?: any }
  ): { qualities?: any; warehouseInfo?: any } {
    const merged: any = {};

    // 仓库信息: 只覆盖新数据中已定义的
    merged.warehouseInfo = { ...(existing.warehouseInfo || {}) };
    if (newData.warehouseInfo) {
      for (const [k, v] of Object.entries(newData.warehouseInfo)) {
        if (v !== undefined && v !== null) {
          merged.warehouseInfo[k] = v;
        }
      }
    }

    // 品质信息: 逐品质逐字段增量合并
    merged.qualities = {};
    const allQualities = ['white', 'green', 'blue', 'purple', 'gold', 'red'];
    for (const q of allQualities) {
      merged.qualities[q] = { ...(existing.qualities?.[q] || {}) };
      if (newData.qualities?.[q]) {
        for (const [k, v] of Object.entries(newData.qualities[q])) {
          if (v !== undefined && v !== null && v !== '') {
            merged.qualities[q][k] = v;
          }
        }
      }
    }

    return merged;
  }
}

// 屏幕截图工具
export class ScreenCapture {
  // 请求屏幕捕获权限
  static async captureScreen(): Promise<HTMLCanvasElement> {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      const video = document.createElement('video');
      video.srcObject = stream;
      
      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => {
          video.play();
          resolve();
        };
      });

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        ctx.drawImage(video, 0, 0);
      }

      // 停止流
      stream.getTracks().forEach(track => track.stop());
      
      return canvas;
    } catch (error) {
      console.error('Screen capture error:', error);
      throw new Error('屏幕截图失败');
    }
  }

  // 捕获并转换为数据URL
  static async captureToDataURL(): Promise<string> {
    const canvas = await this.captureScreen();
    return canvas.toDataURL('image/png');
  }
}
