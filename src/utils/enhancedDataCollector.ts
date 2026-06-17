import Tesseract from 'tesseract.js';
import { logger } from './logger';

interface AreaDetectionResult {
  text: string;
  confidence: number;
  data?: any;
}

// 颜色检测相关类
export class ColorDetector {
  static detectPurple(r: number, g: number, b: number): boolean {
    // 紫色：R高，B高，G低
    const isPurple = r > 120 && g < 100 && b > 120 && r - g > 30 && b - g > 30;
    if (isPurple) {
      logger.debug('COLOR', `检测到紫色像素: R=${r}, G=${g}, B=${b}`);
    }
    return isPurple;
  }

  static detectGold(r: number, g: number, b: number): boolean {
    // 金色：R高，G高，B低
    const isGold = r > 150 && g > 120 && b < 100 && r - b > 50 && g - b > 30;
    if (isGold) {
      logger.debug('COLOR', `检测到金色像素: R=${r}, G=${g}, B=${b}`);
    }
    return isGold;
  }

  static detectRed(r: number, g: number, b: number): boolean {
    // 红色：R高，G低，B低
    const isRed = r > 150 && g < 100 && b < 100 && r - g > 60 && r - b > 60;
    if (isRed) {
      logger.debug('COLOR', `检测到红色像素: R=${r}, G=${g}, B=${b}`);
    }
    return isRed;
  }

  static analyzeImageColors(canvas: HTMLCanvasElement): { purple: number; gold: number; red: number } {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      logger.error('COLOR', '无法获取Canvas上下文');
      return { purple: 0, gold: 0, red: 0 };
    }

    const width = Math.min(canvas.width, 100);
    const height = Math.min(canvas.height, 100);
    
    logger.info('COLOR', `开始分析图像颜色, 尺寸: ${width}x${height}`);
    
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    let purpleCount = 0;
    let goldCount = 0;
    let redCount = 0;
    let totalSampled = 0;

    // 采样像素（每隔几个像素采样一次）
    for (let i = 0; i < data.length; i += 16) {
      totalSampled++;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      if (this.detectPurple(r, g, b)) purpleCount++;
      if (this.detectGold(r, g, b)) goldCount++;
      if (this.detectRed(r, g, b)) redCount++;
    }

    const purpleRatio = purpleCount / totalSampled;
    const goldRatio = goldCount / totalSampled;
    const redRatio = redCount / totalSampled;

    logger.info('COLOR_DETECTION', '颜色分析结果', {
      canvasSize: { width, height },
      sampledPixels: totalSampled,
      purple: { count: purpleCount, ratio: purpleRatio },
      gold: { count: goldCount, ratio: goldRatio },
      red: { count: redCount, ratio: redRatio }
    });

    return {
      purple: purpleRatio,
      gold: goldRatio,
      red: redRatio
    };
  }
}

export class NumberExtractor {
  // 提取所有数字
  static extractAllNumbers(text: string): number[] {
    const matches = text.match(/\d+(?:\.\d+)?/g);
    return matches ? matches.map(m => parseFloat(m)) : [];
  }

  // 尝试多种方式解析数字
  static parseNumber(text: string): number | null {
    // 清理文本
    const cleanText = text
      .replace(/[^\d\.\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const numbers = this.extractAllNumbers(cleanText);
    return numbers.length > 0 ? numbers[0] : null;
  }
}

export class EnhancedOCRProcessor {
  private worker: Tesseract.Worker | null = null;
  private isInitialized: boolean = false;

  async initialize(): Promise<void> {
    if (this.isInitialized && this.worker) return;

    try {
      // 使用更适合数字识别的配置
      this.worker = await Tesseract.createWorker('chi_sim+eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            console.log('OCR进度:', m.progress);
          }
        },
      });
      
      this.isInitialized = true;
      console.log('OCR引擎初始化成功');
    } catch (error) {
      console.error('OCR初始化失败:', error);
      throw new Error('OCR初始化失败');
    }
  }

  async detectArea(
    canvasOrDataUrl: HTMLCanvasElement | string, 
    areaType: string
  ): Promise<AreaDetectionResult> {
    logger.info('OCR', `开始检测区域: ${areaType}`, {
      canvasOrDataUrl: typeof canvasOrDataUrl === 'string' ? 'dataUrl' : 'canvas'
    });

    if (!this.worker || !this.isInitialized) {
      logger.info('OCR', 'OCR未初始化，开始初始化');
      await this.initialize();
    }

    try {
      let dataUrl: string;
      let colorAnalysis = { purple: 0, gold: 0, red: 0 };
      
      // 如果是 canvas，先转换为 dataUrl，同时进行颜色分析
      if (typeof canvasOrDataUrl !== 'string') {
        logger.info('OCR', `分析Canvas颜色`);
        colorAnalysis = ColorDetector.analyzeImageColors(canvasOrDataUrl);
        logger.info('OCR_COLOR', `区域 ${areaType} 颜色分析:`, colorAnalysis);
        dataUrl = canvasOrDataUrl.toDataURL();
      } else {
        dataUrl = canvasOrDataUrl;
      }

      logger.info('OCR', `开始OCR识别`);
      const result = await this.worker.recognize(dataUrl);
      const text = result.data.text;
      const confidence = result.data.confidence;

      logger.info('OCR_RESULT', `识别到的文本 (${areaType}): "${text}"`, {
        confidence: confidence / 100
      });

      const parsedData = this.parseTextByType(text, areaType);
      logger.info('OCR_PARSED', `解析后的数据:`, parsedData);

      // 如果颜色检测到目标颜色且有识别到文本，则合并数据
      if (colorAnalysis[areaType as keyof typeof colorAnalysis] > 0.05 && parsedData.count) {
        logger.info('OCR', `颜色检测匹配且识别到数据，合并结果`);
        parsedData.colorMatch = true;
      }

      return {
        text: text.trim(),
        confidence: confidence / 100,
        data: parsedData
      };
    } catch (error) {
      logger.error('OCR', `OCR识别错误:`, error);
      return {
        text: '',
        confidence: 0
      };
    }
  }

  private parseTextByType(text: string, areaType: string): any {
    const cleanText = this.preprocessText(text);
    
    switch (areaType) {
      case 'purple':
      case 'gold':
      case 'red':
        return this.parseQualityData(cleanText, areaType);
      case 'warehouse':
        return this.parseWarehouseData(cleanText);
      case 'price':
        return this.parsePriceData(cleanText);
      default:
        return this.parseGenericData(cleanText);
    }
  }

  private preprocessText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s\u4e00-\u9fa5\.]/g, '')
      .trim()
      .toLowerCase();
  }

  private parseQualityData(text: string, quality: string): any {
    const result: any = { quality };
    
    // 尝试多种模式提取数字
    const patterns = [
      // 模式1: "数字" 或 "数字 个" 或 "数字 件"
      /(\d+)\s*(?:个|件|个|口)?/,
      // 模式2: "数字/数字" (如 "3/5")
      /(\d+)\s*[\/\.\\]\s*(\d+)/,
      // 模式3: 连续数字 "数字数字"
      /\d{1,3}/g,
    ];

    // 清理文本，移除空格和特殊字符
    const cleanText = text.replace(/\s+/g, ' ').trim();
    
    // 提取所有数字
    const numbers = cleanText.match(/\d+(?:\.\d+)?/g);
    console.log(`品质 ${quality} 提取到的数字:`, numbers, '原始文本:', text);

    // 优先使用连续的大数字（通常是件数）
    if (numbers && numbers.length > 0) {
      // 第一个数字通常是最重要的（件数或格数）
      const firstNum = parseInt(numbers[0]);
      if (firstNum > 0 && firstNum < 100) {
        result.count = firstNum;
      } else if (firstNum >= 100) {
        // 如果第一个数字很大，可能是格数
        result.slots = firstNum;
      }
      
      // 第二个数字
      if (numbers.length >= 2) {
        const secondNum = parseInt(numbers[1]);
        if (!result.count) {
          result.count = secondNum;
        } else {
          result.slots = secondNum;
        }
      }
      
      // 第三个数字（可能是均格）
      if (numbers.length >= 3) {
        result.avgSlots = parseFloat(numbers[2]);
      }
    }

    // 尝试从 "X/Y" 格式中提取
    const ratioMatch = cleanText.match(/(\d+)\s*[\/\.\\]\s*(\d+)/);
    if (ratioMatch) {
      result.count = parseInt(ratioMatch[1]);
      result.slots = parseInt(ratioMatch[2]);
    }

    return result;
  }

  private parseWarehouseData(text: string): any {
    const result: any = {};
    const numbers = NumberExtractor.extractAllNumbers(text);

    if (numbers.length >= 2) {
      result.totalItems = numbers[0];
      result.totalSlots = numbers[1];
    }

    return result;
  }

  private parsePriceData(text: string): any {
    const result: any = {};
    const numbers = NumberExtractor.extractAllNumbers(text);

    if (numbers.length > 0) {
      result.price = numbers[0];
    }

    return result;
  }

  private parseGenericData(text: string): any {
    const result: any = {};
    const numbers = NumberExtractor.extractAllNumbers(text);
    
    if (numbers) {
      result.numbers = numbers;
    }

    return result;
  }

  async cleanup(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
    }
  }
}

export class GameDataExtractor {
  static extractGameData(data: any, areaType: string): any {
    const gameData: any = {};

    switch (areaType) {
      case 'purple':
      case 'gold':
      case 'red':
        gameData.qualities = {
          [areaType]: data
        };
        break;
      case 'warehouse':
        gameData.warehouseInfo = data;
        break;
      case 'price':
        gameData.currentBid = data.price;
        break;
    }

    return gameData;
  }

  static mergeData(existing: any, newData: any): any {
    const merged = { ...existing };

    if (newData.qualities) {
      merged.qualities = merged.qualities || {};
      
      Object.keys(newData.qualities).forEach(key => {
        merged.qualities[key] = {
          ...merged.qualities[key],
          ...newData.qualities[key]
        };
      });
    }

    if (newData.warehouseInfo) {
      merged.warehouseInfo = {
        ...merged.warehouseInfo,
        ...newData.warehouseInfo
      };
    }

    if (newData.currentBid !== undefined) {
      merged.currentBid = newData.currentBid;
    }

    return merged;
  }
}

export class ImagePreprocessor {
  static preprocessImage(canvas: HTMLCanvasElement): HTMLCanvasElement {
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // 转换为灰度图
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
    }

    ctx.putImageData(imageData, 0, 0);

    return canvas;
  }

  static enhanceContrast(canvas: HTMLCanvasElement): HTMLCanvasElement {
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const contrast = 1.2;
    const offset = (1 - contrast) * 128;

    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.max(0, Math.min(255, data[i] * contrast + offset));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] * contrast + offset));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] * contrast + offset));
    }

    ctx.putImageData(imageData, 0, 0);

    return canvas;
  }
}

export class DataValidator {
  static validateCount(count: number): boolean {
    return count >= 0 && count <= 1000;
  }

  static validateSlots(slots: number): boolean {
    return slots >= 0 && slots <= 5000;
  }

  static validateAvgSlots(avgSlots: number): boolean {
    return avgSlots >= 0 && avgSlots <= 100;
  }

  static validatePrice(price: number): boolean {
    return price >= 0 && price <= 999999;
  }

  static sanitizeData(data: any): any {
    const sanitized: any = {};

    if (data.count !== undefined && this.validateCount(data.count)) {
      sanitized.count = data.count;
    }

    if (data.slots !== undefined && this.validateSlots(data.slots)) {
      sanitized.slots = data.slots;
    }

    if (data.avgSlots !== undefined && this.validateAvgSlots(data.avgSlots)) {
      sanitized.avgSlots = data.avgSlots;
    }

    if (data.totalItems !== undefined && this.validateCount(data.totalItems)) {
      sanitized.totalItems = data.totalItems;
    }

    if (data.totalSlots !== undefined && this.validateSlots(data.totalSlots)) {
      sanitized.totalSlots = data.totalSlots;
    }

    if (data.price !== undefined && this.validatePrice(data.price)) {
      sanitized.price = data.price;
    }

    return sanitized;
  }
}
