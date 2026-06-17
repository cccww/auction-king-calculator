import { CalculatorInput, CalculatorOutput, GameMode, GAME_MODE_CONFIGS } from './calculator';

// ==================== 1. 完整的品质估值标准 ====================
export const QUALITY_VALUE_STANDARDS = {
  // 件数流估值（单位：万）
  itemBased: {
    white: 0.05,    // 白色每件 0.05万
    green: 0.15,    // 绿色每件 0.15万
    blue: 0.35,     // 蓝色每件 0.35万
    purple: 0.6,    // 紫色每件 0.6万
    gold: 2.5,      // 金色每件 2.5万
    red: 10,        // 红色每件 10万
  },
  // 均格流估值
  slotBased: {
    white: 0.02,    // 白色每格 0.02
    green: 0.06,    // 绿色每格 0.06
    blue: 0.14,     // 蓝色每格 0.14
    purple: 0.2,    // 紫色每格 0.2
    gold: 0.8,      // 金色每格 0.8
    red: 5,         // 红色每格 5
  },
};

// ==================== 2. 仓深修正因子 ====================
export interface WarehouseAdjustment {
  factor: number;           // 修正系数
  efficiency: number;       // 仓深效率
  densityBonus: number;     // 密度奖励
  description: string;      // 说明
}

// 计算仓深修正
export function calculateWarehouseAdjustment(
  totalItems?: number,
  totalSlots?: number
): WarehouseAdjustment {
  if (!totalItems || !totalSlots || totalItems === 0) {
    return {
      factor: 1.0,
      efficiency: 1.0,
      densityBonus: 0,
      description: '无仓深数据',
    };
  }

  const avgSlot = totalSlots / totalItems;
  
  // 仓深效率计算（理想均格约3-5）
  let efficiency = 1.0;
  if (avgSlot >= 3 && avgSlot <= 5) {
    efficiency = 1.1; // 理想仓深，+10%
  } else if (avgSlot > 5) {
    efficiency = 0.95; // 大件多，-5%
  } else if (avgSlot < 3) {
    efficiency = 0.9; // 小件多，-10%
  }

  // 件数密度奖励（件数越多，单位价值越高）
  let densityBonus = 0;
  if (totalItems >= 100) {
    densityBonus = 0.15; // 大仓 +15%
  } else if (totalItems >= 50) {
    densityBonus = 0.08; // 中仓 +8%
  } else if (totalItems >= 20) {
    densityBonus = 0.03; // 小仓 +3%
  }

  // 综合修正系数
  const factor = efficiency * (1 + densityBonus);

  return {
    factor,
    efficiency,
    densityBonus,
    description: `均格${avgSlot.toFixed(2)}, 效率${(efficiency * 100).toFixed(0)}%, 密度奖励+${(densityBonus * 100).toFixed(0)}%`,
  };
}

// ==================== 3. 风险系数动态调整 ====================
export interface RiskAdjustment {
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
  riskMultiplier: number;      // 风险乘数
  confidenceInterval: number;  // 置信区间
  suggestedRange: { min: number; max: number };
  factors: string[];           // 风险因素
}

// 计算风险调整
export function calculateRiskAdjustment(
  input: CalculatorInput,
  baseValue: number
): RiskAdjustment {
  const factors: string[] = [];
  let riskScore = 0;

  // 1. 信息完整度风险
  let infoScore = 0;
  let maxInfoScore = 0;
  
  // 仓深信息
  if (input.totalItems) infoScore += 10;
  if (input.totalSlots) infoScore += 10;
  maxInfoScore += 20;
  
  // 品质信息（6种品质）
  const qualities = ['white', 'green', 'blue', 'purple', 'gold', 'red'] as const;
  qualities.forEach(q => {
    if (input.qualities[q]?.count) infoScore += 5;
    if (input.qualities[q]?.slots) infoScore += 5;
    maxInfoScore += 10;
  });
  
  const infoCompleteness = infoScore / maxInfoScore;
  if (infoCompleteness < 0.3) {
    riskScore += 30;
    factors.push('信息极度不完整');
  } else if (infoCompleteness < 0.6) {
    riskScore += 15;
    factors.push('信息部分缺失');
  }

  // 2. 高价值品质占比风险
  const highValueItems = 
    (input.qualities.gold?.count || 0) + 
    (input.qualities.red?.count || 0);
  const totalItems = input.totalItems || highValueItems || 1;
  const highValueRatio = highValueItems / totalItems;
  
  if (highValueRatio > 0.3) {
    riskScore += 10;
    factors.push('高价值装备占比过高，竞争激烈');
  }

  // 3. 模式风险
  if (input.mode === 'secret') {
    riskScore += 15;
    factors.push('隐秘模式风险较高');
  } else if (input.mode === 'shipwreck') {
    riskScore += 10;
    factors.push('沉船模式存在不确定性');
  }

  // 4. 均格异常风险
  if (input.totalItems && input.totalSlots) {
    const avgSlot = input.totalSlots / input.totalItems;
    if (avgSlot > 8 || avgSlot < 1.5) {
      riskScore += 10;
      factors.push('仓深均格异常，需警惕');
    }
  }

  // 确定风险等级
  let riskLevel: 'low' | 'medium' | 'high' | 'extreme';
  let riskMultiplier: number;
  let confidenceInterval: number;

  if (riskScore < 15) {
    riskLevel = 'low';
    riskMultiplier = 1.0;
    confidenceInterval = 0.15; // ±15%
  } else if (riskScore < 30) {
    riskLevel = 'medium';
    riskMultiplier = 0.95;
    confidenceInterval = 0.25; // ±25%
  } else if (riskScore < 50) {
    riskLevel = 'high';
    riskMultiplier = 0.85;
    confidenceInterval = 0.35; // ±35%
  } else {
    riskLevel = 'extreme';
    riskMultiplier = 0.7;
    confidenceInterval = 0.5; // ±50%
  }

  // 计算建议范围
  const adjustedValue = baseValue * riskMultiplier;
  const minValue = adjustedValue * (1 - confidenceInterval);
  const maxValue = adjustedValue * (1 + confidenceInterval);

  return {
    riskLevel,
    riskMultiplier,
    confidenceInterval,
    suggestedRange: { min: minValue, max: maxValue },
    factors: factors.length > 0 ? factors : ['风险因素正常'],
  };
}

// ==================== 4. 历史数据学习系统 ====================
export interface HistoricalRecord {
  id: string;
  timestamp: number;
  mode: GameMode;
  character: string;
  round: number;
  
  // 输入数据
  input: {
    totalItems?: number;
    totalSlots?: number;
    qualities: Record<string, { count?: number; slots?: number }>;
  };
  
  // 估价结果
  estimatedValue: number;
  
  // 实际结果（用户填写）
  actualValue?: number;
  profit?: number; // 实际收益 = 实际价格 - 估价
  deviation?: number; // 偏差百分比
  
  // 学习反馈
  accuracy?: number; // 准确度 0-1
  notes?: string;
}

// 历史数据管理器
export class HistoricalDataManager {
  private records: HistoricalRecord[] = [];
  private readonly STORAGE_KEY = 'auction_king_historical_data';

  constructor() {
    this.loadFromStorage();
  }

  // 从本地存储加载
  private loadFromStorage() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (data) {
        this.records = JSON.parse(data);
      }
    } catch (e) {
      console.error('加载历史数据失败:', e);
    }
  }

  // 保存到本地存储
  private saveToStorage() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.records));
    } catch (e) {
      console.error('保存历史数据失败:', e);
    }
  }

  // 添加记录
  addRecord(record: Omit<HistoricalRecord, 'id' | 'timestamp'>): HistoricalRecord {
    const newRecord: HistoricalRecord = {
      ...record,
      id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      timestamp: Date.now(),
    };
    
    // 如果有实际价格，计算收益和偏差
    if (newRecord.actualValue !== undefined && newRecord.estimatedValue > 0) {
      newRecord.profit = newRecord.actualValue - newRecord.estimatedValue;
      newRecord.deviation = ((newRecord.actualValue - newRecord.estimatedValue) / newRecord.estimatedValue) * 100;
      newRecord.accuracy = Math.max(0, 1 - Math.abs(newRecord.deviation) / 100);
    }
    
    this.records.push(newRecord);
    this.saveToStorage();
    return newRecord;
  }

  // 更新实际结果
  updateActualResult(id: string, actualValue: number, notes?: string) {
    const record = this.records.find(r => r.id === id);
    if (record) {
      record.actualValue = actualValue;
      
      // 计算收益和偏差
      if (record.estimatedValue > 0) {
        record.profit = actualValue - record.estimatedValue;
        record.deviation = ((actualValue - record.estimatedValue) / record.estimatedValue) * 100;
        record.accuracy = Math.max(0, 1 - Math.abs(record.deviation) / 100);
      }
      
      if (notes) {
        record.notes = notes;
      }
      
      this.saveToStorage();
    }
  }

  // 获取所有记录
  getAllRecords(): HistoricalRecord[] {
    return [...this.records].sort((a, b) => b.timestamp - a.timestamp);
  }

  // 获取特定模式的记录
  getRecordsByMode(mode: GameMode): HistoricalRecord[] {
    return this.records.filter(r => r.mode === mode);
  }

  // 计算模式准确度
  getModeAccuracy(mode: GameMode): number {
    const modeRecords = this.getRecordsByMode(mode).filter(r => r.accuracy !== undefined);
    if (modeRecords.length === 0) return 0;
    
    const totalAccuracy = modeRecords.reduce((sum, r) => sum + (r.accuracy || 0), 0);
    return totalAccuracy / modeRecords.length;
  }

  // 获取学习建议
  getLearningInsights(): {
    overallAccuracy: number;
    modePerformance: Record<GameMode, number>;
    avgProfit: number;
    totalRecords: number;
    recordsWithActual: number;
    avgDeviation: number;
    suggestions: string[];
  } {
    const recordsWithAccuracy = this.records.filter(r => r.accuracy !== undefined);
    const recordsWithActual = this.records.filter(r => r.actualValue !== undefined);
    
    // 整体准确度
    const overallAccuracy = recordsWithAccuracy.length > 0
      ? recordsWithAccuracy.reduce((sum, r) => sum + (r.accuracy || 0), 0) / recordsWithAccuracy.length
      : 0;

    // 各模式表现
    const modes: GameMode[] = ['express', 'container', 'villa', 'shipwreck', 'secret'];
    const modePerformance: Record<GameMode, number> = {} as any;
    modes.forEach(mode => {
      modePerformance[mode] = this.getModeAccuracy(mode);
    });

    // 平均利润
    const recordsWithProfit = this.records.filter(r => r.profit !== undefined);
    const avgProfit = recordsWithProfit.length > 0
      ? recordsWithProfit.reduce((sum, r) => sum + (r.profit || 0), 0) / recordsWithProfit.length
      : 0;

    // 平均偏差
    const avgDeviation = recordsWithAccuracy.length > 0
      ? recordsWithAccuracy.reduce((sum, r) => sum + (r.deviation || 0), 0) / recordsWithAccuracy.length
      : 0;

    // 生成建议
    const suggestions: string[] = [];
    
    if (overallAccuracy < 0.7) {
      suggestions.push('整体估价准确度偏低，建议更仔细地收集仓深信息');
    }
    
    if (avgDeviation > 10) {
      suggestions.push('系统普遍低估了物品价值，建议适当提高出价范围');
    } else if (avgDeviation < -10) {
      suggestions.push('系统普遍高估了物品价值，建议保守出价');
    }
    
    const bestMode = modes.reduce((best, mode) => 
      modePerformance[mode] > modePerformance[best] ? mode : best
    );
    const worstMode = modes.reduce((worst, mode) => 
      modePerformance[mode] < modePerformance[worst] ? mode : worst
    );
    
    if (modePerformance[bestMode] > modePerformance[worstMode] + 0.2) {
      suggestions.push(`您在${GAME_MODE_CONFIGS[bestMode].name}模式表现最好，在${GAME_MODE_CONFIGS[worstMode].name}模式需要更多练习`);
    }

    if (avgProfit < 0) {
      suggestions.push('近期平均利润为负，建议降低出价或更谨慎选择竞拍目标');
    } else if (avgProfit > 10) {
      suggestions.push('您的出价策略比较保守，有更大的利润空间');
    }

    return {
      overallAccuracy,
      modePerformance,
      avgProfit,
      totalRecords: this.records.length,
      recordsWithActual: recordsWithActual.length,
      avgDeviation,
      suggestions: suggestions.length > 0 ? suggestions : ['继续保持良好的竞拍策略！'],
    };
  }

  // 基于历史数据调整估值
  adjustValueByHistory(mode: GameMode, baseValue: number): {
    adjustedValue: number;
    adjustmentFactor: number;
    confidence: number;
  } {
    const modeRecords = this.getRecordsByMode(mode).filter(r => r.accuracy !== undefined);
    
    if (modeRecords.length < 5) {
      return {
        adjustedValue: baseValue,
        adjustmentFactor: 1.0,
        confidence: 0,
      };
    }

    // 计算历史平均偏差
    const avgDeviation = modeRecords.reduce((sum, r) => {
      if (r.actualValue && r.estimatedValue) {
        return sum + (r.actualValue - r.estimatedValue) / r.estimatedValue;
      }
      return sum;
    }, 0) / modeRecords.length;

    // 调整因子（限制在0.8-1.2范围内）
    const adjustmentFactor = Math.max(0.8, Math.min(1.2, 1 + avgDeviation));
    
    // 置信度基于数据量
    const confidence = Math.min(0.9, modeRecords.length / 50);

    return {
      adjustedValue: baseValue * adjustmentFactor,
      adjustmentFactor,
      confidence,
    };
  }

  // 清空数据
  clearAll() {
    this.records = [];
    this.saveToStorage();
  }
}

// 创建全局实例
export const historicalDataManager = new HistoricalDataManager();

// ==================== 5. 智能估价主函数 ====================
export interface SmartCalculatorOutput extends CalculatorOutput {
  // 仓深修正
  warehouseAdjustment: WarehouseAdjustment;
  
  // 风险调整
  riskAdjustment: RiskAdjustment;
  
  // 历史学习调整
  historicalAdjustment?: {
    adjustedValue: number;
    adjustmentFactor: number;
    confidence: number;
  };
  
  // 最终建议
  finalRecommendation: {
    value: number;
    range: { min: number; max: number };
    confidence: number;
    suggestion: string;
  };
  
  // 详细分解
  valueBreakdown: {
    baseValue: number;
    warehouseBonus: number;
    riskDiscount: number;
    historyBonus: number;
  };
}

// 智能估价主函数
export function smartCalculate(input: CalculatorInput): SmartCalculatorOutput {
  // 1. 计算基础估值（包含白绿蓝品质）
  let itemBasedValue = 0;
  let slotBasedValue = 0;
  
  const qualities = ['white', 'green', 'blue', 'purple', 'gold', 'red'] as const;
  qualities.forEach(q => {
    const quality = input.qualities[q];
    if (quality?.count) {
      itemBasedValue += quality.count * QUALITY_VALUE_STANDARDS.itemBased[q];
    }
    if (quality?.slots) {
      slotBasedValue += quality.slots * QUALITY_VALUE_STANDARDS.slotBased[q];
    }
  });

  // 2. 获取权重
  let itemWeight = 0.5;
  let slotWeight = 0.5;
  
  if (input.mode && GAME_MODE_CONFIGS[input.mode]) {
    const config = GAME_MODE_CONFIGS[input.mode];
    itemWeight = config.recommendedWeight.itemWeight;
    slotWeight = config.recommendedWeight.slotWeight;
  }
  
  switch (input.character) {
    case 'victor':
    case 'oilman':
      itemWeight = Math.min(0.9, itemWeight + 0.2);
      slotWeight = 1 - itemWeight;
      break;
    case 'elsa':
    case 'ethan':
      slotWeight = Math.min(0.9, slotWeight + 0.2);
      itemWeight = 1 - slotWeight;
      break;
  }
  
  const baseValue = itemBasedValue * itemWeight + slotBasedValue * slotWeight;

  // 3. 仓深修正
  const warehouseAdjustment = calculateWarehouseAdjustment(
    input.totalItems,
    input.totalSlots
  );
  const warehouseAdjustedValue = baseValue * warehouseAdjustment.factor;

  // 4. 风险调整
  const riskAdjustment = calculateRiskAdjustment(input, warehouseAdjustedValue);
  
  // 5. 历史学习调整
  const historicalAdjustment = input.mode 
    ? historicalDataManager.adjustValueByHistory(input.mode, riskAdjustment.suggestedRange.min)
    : undefined;

  // 6. 计算最终建议
  const finalValue = historicalAdjustment 
    ? historicalAdjustment.adjustedValue 
    : riskAdjustment.suggestedRange.min;
  
  const confidence = historicalAdjustment 
    ? historicalAdjustment.confidence 
    : (1 - riskAdjustment.confidenceInterval);

  // 7. 生成详细分解
  const valueBreakdown = {
    baseValue,
    warehouseBonus: warehouseAdjustedValue - baseValue,
    riskDiscount: riskAdjustment.suggestedRange.min - warehouseAdjustedValue,
    historyBonus: historicalAdjustment 
      ? historicalAdjustment.adjustedValue - riskAdjustment.suggestedRange.min 
      : 0,
  };

  // 8. 生成基础输出
  const conservativeBid = finalValue * 0.6;
  const balancedBid = finalValue * 0.8;
  const aggressiveBid = finalValue * 1.0;
  const maxBid = finalValue * 1.2;

  // 品质占比分析
  const qualityBreakdown = qualities.map(q => {
    const quality = input.qualities[q];
    const count = quality?.count || 0;
    const slots = quality?.slots || 0;
    
    let percentage = 0;
    if (count && input.totalItems) {
      percentage = (count / input.totalItems) * 100;
    } else if (slots && input.totalSlots) {
      percentage = (slots / input.totalSlots) * 100;
    }
    
    const qualityNames: Record<string, string> = {
      white: '白色', green: '绿色', blue: '蓝色',
      purple: '紫色', gold: '金色', red: '红色',
    };
    
    return {
      quality: qualityNames[q],
      percentage,
      itemValue: count * QUALITY_VALUE_STANDARDS.itemBased[q],
      slotValue: slots * QUALITY_VALUE_STANDARDS.slotBased[q],
    };
  });

  // 生成建议
  let suggestion = '';
  if (riskAdjustment.riskLevel === 'low') {
    suggestion = '风险较低，可以按照稳健出价进行竞拍';
  } else if (riskAdjustment.riskLevel === 'medium') {
    suggestion = '风险中等，建议保守出价，留有余地';
  } else if (riskAdjustment.riskLevel === 'high') {
    suggestion = '风险较高，建议大幅降低出价或放弃竞拍';
  } else {
    suggestion = '风险极高，强烈建议放弃本次竞拍';
  }

  return {
    itemBasedValue,
    slotBasedValue,
    combinedValue: baseValue,
    conservativeBid,
    balancedBid,
    aggressiveBid,
    maxBid,
    riskLevel: riskAdjustment.riskLevel === 'extreme' ? 'high' : riskAdjustment.riskLevel,
    riskDescription: riskAdjustment.factors.join('; '),
    qualityBreakdown,
    infoCompleteness: Math.round(confidence * 100),
    
    // 新增字段
    warehouseAdjustment,
    riskAdjustment,
    historicalAdjustment,
    finalRecommendation: {
      value: finalValue,
      range: riskAdjustment.suggestedRange,
      confidence,
      suggestion,
    },
    valueBreakdown,
  };
}
