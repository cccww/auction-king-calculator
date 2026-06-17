// 日志工具模块 - 用于记录所有操作和调试信息
const LOG_FILE = 'ocr_debug_log.txt';

interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'WARNING' | 'ERROR' | 'DEBUG';
  category: string;
  message: string;
  data?: any;
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000;

  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private createEntry(level: LogEntry['level'], category: string, message: string, data?: any): LogEntry {
    return {
      timestamp: this.formatTimestamp(),
      level,
      category,
      message,
      data
    };
  }

  // 记录普通信息
  info(category: string, message: string, data?: any) {
    const entry = this.createEntry('INFO', category, message, data);
    this.logs.push(entry);
    this.trim();
    console.log(`[INFO][${category}] ${message}`, data || '');
    this.persist();
  }

  // 记录警告
  warn(category: string, message: string, data?: any) {
    const entry = this.createEntry('WARNING', category, message, data);
    this.logs.push(entry);
    this.trim();
    console.warn(`[WARN][${category}] ${message}`, data || '');
    this.persist();
  }

  // 记录错误
  error(category: string, message: string, data?: any) {
    const entry = this.createEntry('ERROR', category, message, data);
    this.logs.push(entry);
    this.trim();
    console.error(`[ERROR][${category}] ${message}`, data || '');
    this.persist();
  }

  // 记录调试信息
  debug(category: string, message: string, data?: any) {
    const entry = this.createEntry('DEBUG', category, message, data);
    this.logs.push(entry);
    this.trim();
    console.log(`[DEBUG][${category}] ${message}`, data || '');
    this.persist();
  }

  // 颜色检测专用日志
  colorDetection(type: 'purple' | 'gold' | 'red', colorRatio: number, pixels: any) {
    this.info('COLOR_DETECTION', `检测到 ${type} 颜色`, {
      colorRatio,
      pixelData: pixels,
      timestamp: this.formatTimestamp()
    });
  }

  // OCR识别专用日志
  ocrRecognition(type: string, text: string, confidence: number, extractedData: any) {
    this.info('OCR_RECOGNITION', `OCR识别 ${type}`, {
      recognizedText: text,
      confidence,
      extractedData,
      timestamp: this.formatTimestamp()
    });
  }

  // 数据同步日志
  dataSync(source: string, data: any) {
    this.info('DATA_SYNC', `从 ${source} 同步数据`, {
      data,
      timestamp: this.formatTimestamp()
    });
  }

  // 限制日志数量
  private trim() {
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  // 保存到本地存储（用于调试）
  private persist() {
    try {
      localStorage.setItem('ocr_debug_logs', JSON.stringify(this.logs.slice(-100)));
    } catch (e) {
      console.error('Failed to persist logs:', e);
    }
  }

  // 导出所有日志
  exportLogs(): string {
    return this.logs
      .map(entry => `[${entry.timestamp}][${entry.level}][${entry.category}] ${entry.message}`)
      .join('\n');
  }

  // 下载日志文件
  downloadLogs() {
    const content = this.exportLogs();
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ocr_debug_${new Date().toISOString().replace(/[:.]/g, '-')}.log`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // 获取最近N条日志
  getRecentLogs(count: number = 50): LogEntry[] {
    return this.logs.slice(-count);
  }

  // 清空日志
  clear() {
    this.logs = [];
    localStorage.removeItem('ocr_debug_logs');
  }
}

// 创建全局日志实例
export const logger = new Logger();

// React Hook 用于组件中使用日志
export const useLogger = () => {
  return logger;
};
