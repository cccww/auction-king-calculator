// 品质信息接口
export interface QualityInfo {
  count?: number;          // 件数
  slots?: number;          // 格数
  avgSlots?: number;       // 均格
}

// 计算器输入数据
export interface CalculatorInput {
  // 仓深信息
  totalItems?: number;     // 总件数
  totalSlots?: number;     // 总格数
  
  // 各品质信息
  qualities: {
    white?: QualityInfo;    // 白色
    green?: QualityInfo;    // 绿色
    blue?: QualityInfo;     // 蓝色
    purple?: QualityInfo;   // 紫色
    gold?: QualityInfo;     // 金色
    red?: QualityInfo;      // 红色
  };
  
  // 游戏信息
  round: number;           // 回合数
  currentBid?: number;     // 当前出价
  character?: 'victor' | 'elsa' | 'ethan' | 'oilman'; // 角色选择
  mode?: GameMode;         // 游戏模式
}

// 游戏模式类型
export type GameMode = 'express' | 'container' | 'villa' | 'shipwreck' | 'secret';

// 游戏模式配置
export interface GameModeConfig {
  name: string;
  description: string;
  icon: string;
  itemValueRange: {
    gold: { min: number; max: number };
    red: { min: number; max: number };
  };
  slotValueRange: {
    gold: { min: number; max: number };
    red: { min: number; max: number };
  };
  recommendedWeight: {
    itemWeight: number;
    slotWeight: number;
  };
}

// 游戏模式配置（单位：万）
export const GAME_MODE_CONFIGS: Record<GameMode, GameModeConfig> = {
  express: {
    name: '快递',
    description: '小型快速模式，节奏紧凑，适合新手练习',
    icon: '📦',
    itemValueRange: {
      gold: { min: 1.5, max: 2.0 },
      red: { min: 5, max: 8 },
    },
    slotValueRange: {
      gold: { min: 0.5, max: 0.7 },
      red: { min: 3, max: 4 },
    },
    recommendedWeight: {
      itemWeight: 0.6,
      slotWeight: 0.4,
    },
  },
  container: {
    name: '集装箱',
    description: '中等规模模式，平衡风险与收益，最为常见',
    icon: '🚢',
    itemValueRange: {
      gold: { min: 2.0, max: 2.5 },
      red: { min: 8, max: 12 },
    },
    slotValueRange: {
      gold: { min: 0.7, max: 0.9 },
      red: { min: 4, max: 6 },
    },
    recommendedWeight: {
      itemWeight: 0.5,
      slotWeight: 0.5,
    },
  },
  villa: {
    name: '别墅',
    description: '大型豪华模式，奖励丰厚但竞争激烈',
    icon: '🏠',
    itemValueRange: {
      gold: { min: 3.0, max: 4.0 },
      red: { min: 15, max: 20 },
    },
    slotValueRange: {
      gold: { min: 1.0, max: 1.3 },
      red: { min: 8, max: 12 },
    },
    recommendedWeight: {
      itemWeight: 0.4,
      slotWeight: 0.6,
    },
  },
  shipwreck: {
    name: '沉船',
    description: '特殊探险模式，风险与机遇并存，可能有额外掉落',
    icon: '⚓',
    itemValueRange: {
      gold: { min: 2.5, max: 3.5 },
      red: { min: 12, max: 18 },
    },
    slotValueRange: {
      gold: { min: 0.8, max: 1.1 },
      red: { min: 6, max: 9 },
    },
    recommendedWeight: {
      itemWeight: 0.55,
      slotWeight: 0.45,
    },
  },
  secret: {
    name: '隐秘',
    description: '隐藏关卡模式，高风险高回报，稀有奖励',
    icon: '🔒',
    itemValueRange: {
      gold: { min: 3.0, max: 5.0 },
      red: { min: 18, max: 25 },
    },
    slotValueRange: {
      gold: { min: 1.2, max: 1.8 },
      red: { min: 10, max: 15 },
    },
    recommendedWeight: {
      itemWeight: 0.45,
      slotWeight: 0.55,
    },
  },
};

// 品质估值标准（单位：万）
const ITEM_VALUE_STANDARD = {
  purple: 0.6,    // 紫色每件 0.6万
  gold: 2.5,      // 金色每件 2.5万（基础值）
  red: 10,        // 红色每件 10万（基础值，可调整）
};

// 格数估值标准
const SLOT_VALUE_STANDARD = {
  purple: 0.2,    // 紫色每格 0.2
  gold: 0.8,      // 金色每格 0.8（基础值）
  red: 5,         // 红色每格 5（基础值）
  mixed: 2.5,     // 红金混格 2.5
};

// 品质信息
export interface QualityBreakdown {
  quality: string;
  percentage: number;
  itemValue: number;
  slotValue: number;
}

// 计算器输出数据
export interface CalculatorOutput {
  // 估值结果
  itemBasedValue: number;          // 件数流估值
  slotBasedValue: number;          // 均格流估值
  combinedValue: number;           // 综合估值
  
  // 出价建议
  conservativeBid: number;         // 保守出价
  balancedBid: number;             // 稳健出价
  aggressiveBid: number;           // 激进出价
  maxBid: number;                  // 最高限价
  
  // 风险评估
  riskLevel: 'low' | 'medium' | 'high';
  riskDescription: string;
  
  // 详细分析
  qualityBreakdown: QualityBreakdown[];
  infoCompleteness: number;        // 信息完整度 0-100
  
  // 优品均格推算结果
  purpleCountEstimate?: number;
  estimateConfidence?: number;
}

// 计算件数流估值
function calculateItemBasedValue(input: CalculatorInput): number {
  let totalValue = 0;
  
  // 紫色估值
  if (input.qualities.purple.count) {
    totalValue += input.qualities.purple.count * ITEM_VALUE_STANDARD.purple;
  }
  
  // 金色估值
  if (input.qualities.gold.count) {
    totalValue += input.qualities.gold.count * ITEM_VALUE_STANDARD.gold;
  }
  
  // 红色估值
  if (input.qualities.red.count) {
    totalValue += input.qualities.red.count * ITEM_VALUE_STANDARD.red;
  }
  
  return totalValue;
}

// 计算均格流估值
function calculateSlotBasedValue(input: CalculatorInput): number {
  let totalValue = 0;
  
  // 紫色估值
  if (input.qualities.purple.slots) {
    totalValue += input.qualities.purple.slots * SLOT_VALUE_STANDARD.purple;
  }
  
  // 金色估值
  if (input.qualities.gold.slots) {
    totalValue += input.qualities.gold.slots * SLOT_VALUE_STANDARD.gold;
  }
  
  // 红色估值
  if (input.qualities.red.slots) {
    totalValue += input.qualities.red.slots * SLOT_VALUE_STANDARD.red;
  }
  
  return totalValue;
}

// 优品均格推算紫色件数
function estimatePurpleCount(avgSlots: number): { count: number; confidence: number } {
  // 穷举法，尝试 n = 1 到 20
  for (let n = 1; n <= 20; n++) {
    const product = avgSlots * n;
    const decimal = product - Math.floor(product);
    
    // 检查是否在 0.9-1.09 区间附近
    if (decimal >= 0.9 && decimal <= 1.09) {
      return { count: n, confidence: 0.9 };
    }
  }
  
  // 检查是否为 3 的倍数或 4 的倍数特征
  const decimalPart = avgSlots - Math.floor(avgSlots);
  if (Math.abs(decimalPart - 0.33) < 0.01 || Math.abs(decimalPart - 0.66) < 0.01) {
    // 可能是 3 的倍数
    for (let n = 3; n <= 18; n += 3) {
      const product = avgSlots * n;
      if (Math.abs(product - Math.round(product)) < 0.1) {
        return { count: n, confidence: 0.7 };
      }
    }
  }
  
  if (Math.abs(decimalPart - 0.25) < 0.01 || Math.abs(decimalPart - 0.75) < 0.01) {
    // 可能是 4 的倍数
    for (let n = 4; n <= 20; n += 4) {
      const product = avgSlots * n;
      if (Math.abs(product - Math.round(product)) < 0.1) {
        return { count: n, confidence: 0.7 };
      }
    }
  }
  
  return { count: 0, confidence: 0 };
}

// 计算信息完整度
function calculateInfoCompleteness(input: CalculatorInput): number {
  let completeness = 0;
  let maxPoints = 0;
  
  // 仓深信息
  if (input.totalItems) { completeness += 15; }
  if (input.totalSlots) { completeness += 15; }
  maxPoints += 30;
  
  // 各品质信息
  const qualities = ['purple', 'gold', 'red'] as const;
  qualities.forEach(q => {
    if (input.qualities[q].count) { completeness += 10; }
    if (input.qualities[q].slots) { completeness += 10; }
    maxPoints += 20;
  });
  
  return Math.round((completeness / maxPoints) * 100);
}

// 主计算函数
export function calculateBid(input: CalculatorInput): CalculatorOutput {
  // 计算估值
  const itemBasedValue = calculateItemBasedValue(input);
  const slotBasedValue = calculateSlotBasedValue(input);
  
  // 根据角色选择综合估值权重
  let itemWeight = 0.5;
  let slotWeight = 0.5;
  
  // 优先使用游戏模式的推荐权重
  if (input.mode && GAME_MODE_CONFIGS[input.mode]) {
    const modeConfig = GAME_MODE_CONFIGS[input.mode];
    itemWeight = modeConfig.recommendedWeight.itemWeight;
    slotWeight = modeConfig.recommendedWeight.slotWeight;
  }
  
  // 如果选择了角色，可以进一步调整权重
  switch (input.character) {
    case 'victor':
    case 'oilman':
      // 件数流角色：在模式权重基础上偏向件数
      itemWeight = Math.min(0.9, itemWeight + 0.2);
      slotWeight = 1 - itemWeight;
      break;
    case 'elsa':
    case 'ethan':
      // 均格流角色：在模式权重基础上偏向均格
      slotWeight = Math.min(0.9, slotWeight + 0.2);
      itemWeight = 1 - slotWeight;
      break;
  }
  
  const combinedValue = itemBasedValue * itemWeight + slotBasedValue * slotWeight;
  
  // 计算出价范围
  const conservativeBid = combinedValue * 0.6;
  const balancedBid = combinedValue * 0.8;
  const aggressiveBid = combinedValue * 1.0;
  const maxBid = combinedValue * 1.2;
  
  // 评估风险
  const infoCompleteness = calculateInfoCompleteness(input);
  let riskLevel: 'low' | 'medium' | 'high';
  let riskDescription: string;
  
  if (infoCompleteness >= 70) {
    riskLevel = 'low';
    riskDescription = '信息完整度高，估值相对准确，风险较低';
  } else if (infoCompleteness >= 40) {
    riskLevel = 'medium';
    riskDescription = '信息部分完整，估值有一定不确定性，风险中等';
  } else {
    riskLevel = 'high';
    riskDescription = '信息不完整，估值误差较大，风险较高';
  }
  
  // 生成品质占比分析
  const qualityBreakdown: QualityBreakdown[] = [];
  const qualityNames = {
    purple: '紫色',
    gold: '金色',
    red: '红色',
  };
  
  (['purple', 'gold', 'red'] as const).forEach(q => {
    const count = input.qualities[q].count;
    const slots = input.qualities[q].slots;
    
    let percentage = 0;
    if (count && input.totalItems) {
      percentage = (count / input.totalItems) * 100;
    } else if (slots && input.totalSlots) {
      percentage = (slots / input.totalSlots) * 100;
    }
    
    qualityBreakdown.push({
      quality: qualityNames[q],
      percentage,
      itemValue: count ? count * ITEM_VALUE_STANDARD[q] : 0,
      slotValue: slots ? slots * SLOT_VALUE_STANDARD[q] : 0,
    });
  });
  
  // 优品均格推算
  let purpleCountEstimate: number | undefined;
  let estimateConfidence: number | undefined;
  
  if (input.qualities.purple.avgSlots && !input.qualities.purple.count) {
    const estimate = estimatePurpleCount(input.qualities.purple.avgSlots);
    if (estimate.count > 0) {
      purpleCountEstimate = estimate.count;
      estimateConfidence = estimate.confidence;
    }
  }
  
  return {
    itemBasedValue,
    slotBasedValue,
    combinedValue,
    conservativeBid,
    balancedBid,
    aggressiveBid,
    maxBid,
    riskLevel,
    riskDescription,
    qualityBreakdown,
    infoCompleteness,
    purpleCountEstimate,
    estimateConfidence,
  };
}

// 格式化货币（单位：万）
export function formatCurrency(value: number): string {
  if (value >= 10000) {
    return (value / 10000).toFixed(2) + '亿';
  } else if (value >= 1) {
    return value.toFixed(2) + '万';
  } else {
    return (value * 10000).toFixed(0) + '';
  }
}