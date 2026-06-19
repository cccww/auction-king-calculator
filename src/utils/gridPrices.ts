/**
 * 单格估价配置 — 持久化到 localStorage
 * 参考 BidKing 的 config.json 策略: v_wg/v_b/v_p/v_jr/v_g/v_r
 *
 * 单位: 银 (BidKing 的原始单位)
 * 显示时转换为 万 (本项目 UI 单位)
 */
const STORAGE_KEY = 'auction_king_grid_prices';

export interface GridPrices {
  vWG: number;   // 白绿单格 (银)
  vB: number;    // 蓝单格 (银)
  vP: number;    // 紫单格 (银)
  vJR: number;   // 金红混单格 (银)
  vG: number;    // 金单格 (银)
  vR: number;    // 红单格 (银)
}

const DEFAULT_PRICES: GridPrices = {
  vWG: 100,
  vB: 800,
  vP: 2000,
  vJR: 20000,
  vG: 10000,
  vR: 30000,
};

// 银 → 万
export const SILVER_TO_WAN = 10000;

/**
 * 银 转 万
 */
export function silverToWan(silver: number): number {
  return silver / SILVER_TO_WAN;
}

/**
 * 万 转 银
 */
export function wanToSilver(wan: number): number {
  return wan * SILVER_TO_WAN;
}

/**
 * 加载已保存的估价配置
 */
export function loadGridPrices(): GridPrices {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      return { ...DEFAULT_PRICES, ...JSON.parse(data) };
    }
  } catch {
    // 忽略解析错误
  }
  return { ...DEFAULT_PRICES };
}

/**
 * 保存估价配置
 */
export function saveGridPrices(prices: GridPrices): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prices));
  } catch {
    // 忽略存储错误
  }
}

/**
 * 单格价格标签
 */
export const PRICE_LABELS: Record<keyof GridPrices, string> = {
  vWG: '白绿单格',
  vB: '蓝单格',
  vP: '紫单格',
  vJR: '金红混单格',
  vG: '金单格',
  vR: '红单格',
};

export { DEFAULT_PRICES };
