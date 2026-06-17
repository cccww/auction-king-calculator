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

// 游戏数据解析器
export class GameDataParser {
  // 解析从OCR或剪贴板获取的文本
  static parseGameText(text: string): { [key: string]: any } {
    const result: { [key: string]: any } = {};
    
    // 移除多余空格和换行
    const cleanText = text.replace(/\s+/g, ' ').trim();
    
    // 查找数字模式
    const numberPatterns = {
      // 紫色相关
      purpleCount: /(?:紫色|优品)[^0-9]*(\d+)[^0-9]*(?:个|件)/,
      purpleSlots: /(?:紫色|优品)[^0-9]*(\d+)[^0-9]*(?:格|槽)/,
      purpleAvg: /(?:紫色|优品)[^0-9]*(\d+(?:\.\d+)?)[^\d]*平均/,
      
      // 金色相关
      goldCount: /(?:金色|极品)[^0-9]*(\d+)[^0-9]*(?:个|件)/,
      goldSlots: /(?:金色|极品)[^0-9]*(\d+)[^0-9]*(?:格|槽)/,
      goldAvg: /(?:金色|极品)[^0-9]*(\d+(?:\.\d+)?)[^\d]*平均/,
      
      // 红色相关
      redCount: /(?:红色|传说)[^0-9]*(\d+)[^0-9]*(?:个|件)/,
      redSlots: /(?:红色|传说)[^0-9]*(\d+)[^0-9]*(?:格|槽)/,
      
      // 仓库信息
      totalItems: /(?:总件数|总数)[^0-9]*(\d+)/,
      totalSlots: /(?:总格数|总格子)[^0-9]*(\d+)/,
      
      // 价格信息
      price: /(?:价格|出价|金额)[^0-9]*(\d+(?:\.\d+)?)/,
    };

    for (const [key, pattern] of Object.entries(numberPatterns)) {
      const match = cleanText.match(pattern);
      if (match) {
        const value = parseFloat(match[1]);
        if (!isNaN(value)) {
          result[key] = value;
        }
      }
    }

    return result;
  }

  // 转换为游戏数据格式
  static convertToGameData(
    parsedData: { [key: string]: any }
  ): { qualities?: any; warehouseInfo?: any } {
    const result: { qualities?: any; warehouseInfo?: any } = {};
    
    // 构建品质信息
    result.qualities = {
      purple: {
        count: parsedData.purpleCount,
        slots: parsedData.purpleSlots,
        avgSlots: parsedData.purpleAvg,
      },
      gold: {
        count: parsedData.goldCount,
        slots: parsedData.goldSlots,
        avgSlots: parsedData.goldAvg,
      },
      red: {
        count: parsedData.redCount,
        slots: parsedData.redSlots,
      },
    };

    // 构建仓库信息
    result.warehouseInfo = {
      totalItems: parsedData.totalItems,
      totalSlots: parsedData.totalSlots,
    };

    return result;
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
