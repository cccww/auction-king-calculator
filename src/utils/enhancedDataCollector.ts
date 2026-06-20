import Tesseract from 'tesseract.js';
import { logger } from './logger';

interface AreaDetectionResult {
  text: string;
  confidence: number;
  data?: any;
}

// 颜色检测相关类
export class ColorDetector {

  // ========== 单像素颜色检测 ==========

  static detectWhite(r: number, g: number, b: number): boolean {
    return r > 200 && g > 200 && b > 200 && Math.abs(r - g) < 30 && Math.abs(g - b) < 30;
  }

  static detectGreen(r: number, g: number, b: number): boolean {
    return g > 150 && r < 120 && b < 120 && g - r > 40 && g - b > 40;
  }

  static detectBlue(r: number, g: number, b: number): boolean {
    return b > 150 && r < 120 && g < 150 && b - r > 40 && b - g > 30;
  }

  static detectPurple(r: number, g: number, b: number): boolean {
    return r > 120 && g < 100 && b > 120 && r - g > 30 && b - g > 30;
  }

  static detectGold(r: number, g: number, b: number): boolean {
    return r > 150 && g > 120 && b < 100 && r - b > 50 && g - b > 30;
  }

  static detectRed(r: number, g: number, b: number): boolean {
    return r > 150 && g < 100 && b < 100 && r - g > 60 && r - b > 60;
  }

  /** 对所有6种品质做检测 */
  static detectAll(r: number, g: number, b: number): string | null {
    if (this.detectWhite(r, g, b)) return 'white';
    if (this.detectGreen(r, g, b)) return 'green';
    if (this.detectBlue(r, g, b)) return 'blue';
    if (this.detectPurple(r, g, b)) return 'purple';
    if (this.detectGold(r, g, b)) return 'gold';
    if (this.detectRed(r, g, b)) return 'red';
    return null;
  }

  // ========== 图像颜色分析 ==========

  static analyzeImageColors(canvas: HTMLCanvasElement): Record<string, number> {
    const ctx = canvas.getContext('2d');
    if (!ctx) return { white: 0, green: 0, blue: 0, purple: 0, gold: 0, red: 0 };

    const width = Math.min(canvas.width, 100);
    const height = Math.min(canvas.height, 100);
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    const counts: Record<string, number> = { white: 0, green: 0, blue: 0, purple: 0, gold: 0, red: 0 };
    let total = 0;

    for (let i = 0; i < data.length; i += 16) {
      total++;
      const q = this.detectAll(data[i], data[i + 1], data[i + 2]);
      if (q) counts[q]++;
    }

    const ratios: Record<string, number> = {};
    for (const k of Object.keys(counts)) {
      ratios[k] = total > 0 ? counts[k] / total : 0;
    }
    return ratios;
  }

  /**
   * 估算区域内各品质物品数量
   * @param canvas 区域截图
   * @param totalItemsHint 总件数提示(可选)
   */
  static countQualityItems(
    canvas: HTMLCanvasElement,
    totalItemsHint?: number,
  ): Record<string, { ratio: number; estimatedCount?: number }> {
    const ratios = this.analyzeImageColors(canvas);
    const result: Record<string, { ratio: number; estimatedCount?: number }> = {};

    for (const [quality, ratio] of Object.entries(ratios)) {
      result[quality] = {
        ratio,
        estimatedCount: totalItemsHint ? Math.round(totalItemsHint * ratio) : undefined,
      };
    }

    return result;
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
      let colorAnalysis: Record<string, number> = {};

      if (typeof canvasOrDataUrl !== 'string') {
        colorAnalysis = ColorDetector.analyzeImageColors(canvasOrDataUrl);
        logger.info('OCR_COLOR', `区域 ${areaType} 颜色分析:`, colorAnalysis);
        dataUrl = canvasOrDataUrl.toDataURL();
      } else {
        dataUrl = canvasOrDataUrl;
      }

      // 图像预处理 (灰度+对比度增强)
      if (typeof canvasOrDataUrl !== 'string') {
        try {
          const grayCanvas = ImagePreprocessor.preprocessImage(canvasOrDataUrl);
          const enhancedCanvas = ImagePreprocessor.enhanceContrast(grayCanvas);
          dataUrl = enhancedCanvas.toDataURL();
          logger.info('OCR', '图像预处理完成 (灰度+对比度增强)');
        } catch (e) {
          logger.warn('OCR', '图像预处理失败, 使用原图', e);
        }
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
      .trim();
    // 不改小写: 中文字符需要原样匹配OCR文本
  }

  // BidKing风格正则: 从OCR文本提取T/B/WG/purpleAvg
  private static BIDKING_PATTERNS: Record<string, RegExp[]> = {
    T: [
      /所有藏品[^0-9色]{0,25}?(\d{1,4})\s*格/,
      /总仓储[^0-9]{0,20}?(\d{1,4})\s*格/,
    ],
    B: [
      /所有蓝色品质藏品[^0-9]{0,25}?(\d{1,4})\s*格/,
      /蓝色[^0-9]{0,25}?(\d{1,4})\s*格/,
    ],
    WG: [
      /所有白色[和与及]?绿色品质藏品[^0-9]{0,25}?(\d{1,4})\s*格/,
      /白色[和与及\s]*绿色[^0-9]{0,25}?(\d{1,4})\s*格/,
    ],
    purpleAvg: [
      /所有紫色品质藏品平均[^0-9]{0,10}?(\d+\.?\d*)\s*格/,
      /紫色[^0-9]{0,20}?平均[^0-9]{0,10}?(\d+\.?\d*)\s*格/,
    ],
  };

  private matchBidKingPatterns(text: string): { T?: number; B?: number; WG?: number; purpleAvg?: number } {
    const result: any = {};
    for (const [key, patterns] of Object.entries(EnhancedOCRProcessor.BIDKING_PATTERNS)) {
      for (const p of patterns) {
        const m = p.exec(text);
        if (m) {
          result[key] = key === 'purpleAvg' ? parseFloat(m[1]) : parseInt(m[1], 10);
          break;
        }
      }
    }
    return result;
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

    // 用BidKing正则提取T、B、WG、purpleAvg
    const bidking = this.matchBidKingPatterns(text);
    if (bidking.T !== undefined) result.totalSlots = bidking.T;
    if (bidking.B !== undefined) result.blueSlots = bidking.B;
    if (bidking.WG !== undefined) result.whiteGreenSlots = bidking.WG;
    if (bidking.purpleAvg !== undefined) result.purpleAvg = bidking.purpleAvg;

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
    const gameData: any = { gridActuarial: {} };

    switch (areaType) {
      case 'purple':
        gameData.qualities = { purple: data };
        if (data.avgSlots) gameData.gridActuarial.purpleAvg = data.avgSlots;
        if (data.slots) gameData.gridActuarial.purpleSlots = data.slots;
        if (data.count) gameData.gridActuarial.purpleCount = data.count;
        break;
      case 'gold':
        gameData.qualities = { gold: data };
        if (data.avgSlots) gameData.gridActuarial.goldAvg = data.avgSlots;
        if (data.slots) gameData.gridActuarial.goldSlots = data.slots;
        if (data.count) gameData.gridActuarial.goldCount = data.count;
        break;
      case 'red':
        gameData.qualities = { red: data };
        if (data.slots) gameData.gridActuarial.redSlots = data.slots;
        if (data.count) gameData.gridActuarial.redCount = data.count;
        break;
      case 'warehouse':
        gameData.warehouseInfo = { totalItems: data.totalItems, totalSlots: data.totalSlots };
        if (data.totalSlots) gameData.gridActuarial.T = data.totalSlots;
        if (data.blueSlots) gameData.gridActuarial.B = data.blueSlots;
        if (data.whiteGreenSlots) gameData.gridActuarial.WG = data.whiteGreenSlots;
        if (data.purpleAvg) gameData.gridActuarial.purpleAvg = data.purpleAvg;
        break;
      case 'price':
        gameData.currentBid = data.price;
        if (data.price) gameData.gridActuarial.price = data.price;
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
