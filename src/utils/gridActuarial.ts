/**
 * 数格子精算法 — 移植自 BidKing (EnableAsync) 的核心算法
 *
 * 通过任意组合的道具读数估算仓库价值范围。
 * 对每个品质 (紫/金), 可以提供以下任意组合 (全部可选):
 *   - 总格数 a   (扫描类道具: 优品扫描 / 极品扫描)
 *   - 物品数 b   (存量类道具: 优品存量 / 极品存量)
 *   - 平均格数 c (均格类道具: 优品均格 / 极品均格)
 *   - 物品数预估 b_est (主观判断)
 *
 * 输入越多, 反推的 (总格数, 物品数) 候选越少, 估值范围越窄。
 *
 * 核心约束: 总格数 T = 白绿格数 WG + 蓝格数 B + 紫格数 + 金格数 + 红格数
 */

// ==================== 候选查找 ====================

/**
 * 反推满足 c <= a/b <= c+0.01 的所有 (总格数a, 物品数b) 正整数对
 * 对应 BidKing 的 find_candidates
 */
export function findCandidates(c: number, maxItems: number = 80): Array<[number, number]> {
  if (c <= 0) return [];
  const results: Array<[number, number]> = [];
  const upper = c + 0.01;
  for (let b = 1; b <= maxItems; b++) {
    const minA = Math.floor(c * b);
    const maxA = Math.ceil(upper * b) + 2;
    for (let a = minA; a <= maxA; a++) {
      if (a <= 0) continue;
      const avg = a / b;
      if (c <= parseFloat(avg.toFixed(4)) && parseFloat(avg.toFixed(4)) <= upper) {
        results.push([a, b]);
      }
    }
  }
  return results;
}

// 旧名兼容
export const findPurpleCandidates = findCandidates;

// ==================== 候选精选 ====================

export interface CandidatePair {
  totalGrids: number;
  count: number;
}

/**
 * 选取 k 个离 b_est 最近的候选, 并确保 ensure_b 中的物品数有至少一个匹配
 * 对应 BidKing 的 pick_nearest_candidates
 */
export function pickNearestCandidates(
  candidates: Array<[number, number]>,
  bEst: number,
  k: number = 6,
  ensureB: number[] | null = null,
): CandidatePair[] {
  if (candidates.length === 0) return [];

  let remaining = [...candidates];

  if (!ensureB) {
    return remaining
      .sort((a, b) => Math.abs(a[1] - bEst) - Math.abs(b[1] - bEst) || a[1] - b[1])
      .slice(0, k)
      .map(([a, b]) => ({ totalGrids: a, count: b }));
  }

  const result: Array<[number, number]> = [];

  // 为每个锚点物品数选一个最佳匹配
  for (const anchor of ensureB) {
    if (result.length >= k) break;
    const matches = remaining.filter(([, b]) => b === anchor);
    if (matches.length > 0) {
      const best = matches.reduce((a, b) =>
        Math.abs(a[1] - bEst) <= Math.abs(b[1] - bEst) ? a : b
      );
      result.push(best);
      remaining = remaining.filter(([aa, bb]) => !(aa === best[0] && bb === best[1]));
    }
  }

  // 剩余用离 b_est 最近的填充
  const byEst = remaining
    .sort((a, b) => Math.abs(a[1] - bEst) - Math.abs(b[1] - bEst) || a[1] - b[1]);
  for (const c of byEst) {
    if (result.length >= k) break;
    result.push(c);
  }

  return result.map(([a, b]) => ({ totalGrids: a, count: b }));
}

// ==================== 品质候选推导 ====================

export interface QualityCandidates {
  type: 'purple' | 'gold';
  candidates: CandidatePair[];
}

/**
 * 根据某品质的多个可选输入, 返回该品质的 (总格数, 物品数) 候选列表
 * 对应 BidKing 的 _determine_candidates
 */
export function determineCandidates(
  a: number | null,   // 总格数
  b: number | null,   // 物品数
  c: number | null,   // 平均格数
  bEst: number | null, // 物品数预估
  maxItems: number = 80,
  k: number = 6,
  ensureB: number[] | null = null,
): CandidatePair[] {
  if (a !== null) {
    if (b !== null) {
      // 已知总格数和物品数 → 唯一确定
      return [{ totalGrids: a, count: b }];
    }
    if (c !== null && c > 0) {
      const bDerived = Math.max(1, Math.round(a / c));
      return [{ totalGrids: a, count: bDerived }];
    }
    return [{ totalGrids: a, count: bEst || 1 }];
  }

  if (c !== null && c > 0) {
    const allC = findCandidates(c, maxItems);
    if (b !== null) {
      const matching = allC.filter(([, bb]) => bb === b);
      return matching.map(([aa, bb]) => ({ totalGrids: aa, count: bb }));
    }
    return pickNearestCandidates(allC, bEst || 1, k, ensureB);
  }

  return [];
}

// ==================== 估值计算 ====================

export interface GridActuarialInput {
  // 基础格数 (必填)
  T: number;   // 总格数
  B: number;   // 蓝色格数
  WG: number;  // 白绿格数

  // 紫色 (全部可选)
  purpleTotalGrids?: number | null;
  purpleCount?: number | null;
  purpleAvg?: number | null;
  purpleCountEst?: number | null;
  purpleTotalValue?: number | null;

  // 金色 (全部可选)
  goldTotalGrids?: number | null;
  goldCount?: number | null;
  goldAvg?: number | null;
  goldCountEst?: number | null;
  goldTotalValue?: number | null;

  // 单格估价 (单位: 万)
  vWG?: number;   // 白绿单格
  vB?: number;    // 蓝单格
  vP?: number;    // 紫单格
  vJR?: number;   // 金红混单格
  vG?: number;    // 金单格
  vR?: number;    // 红单格
}

export interface SingleEstimate {
  purpleGrids: number;
  goldGrids: number;
  redGrids: number;
  goldRedGrids: number;
  estimatedValue: number | null;
  splitMode: boolean;
  error?: string;
}

export interface GridActuarialOutput {
  purpleCandidates: CandidatePair[];
  goldCandidates: CandidatePair[];
  goldEnabled: boolean;
  valueRange: { min: number; max: number; median: number } | null;
  errors: string[];
  warnings: string[];
}

// ==================== 主算法 ====================

const DEFAULT_PRICES = {
  vWG: 100,    // 白绿单格 (银)
  vB: 800,     // 蓝单格 (银)
  vP: 2000,    // 紫单格 (银)
  vJR: 20000,  // 金红混单格 (银)
  vG: 10000,   // 金单格 (银)
  vR: 30000,   // 红单格 (银)
};

/**
 * 银 → 万 转换系数
 * BidKing 以银为单位, 本项目以万为单位
 * 1万 = 10000银
 */
const SILVER_TO_WAN = 10000;

/**
 * 数格子精算法主函数
 * 对应 BidKing 的 GridActuarial.compute
 */
export function computeGridActuarial(input: GridActuarialInput): GridActuarialOutput {
  const errors: string[] = [];
  const warnings: string[] = [];

  const { T, B, WG } = input;

  if (!T || !B || !WG) {
    return { purpleCandidates: [], goldCandidates: [], goldEnabled: false, valueRange: null, errors: ["缺少总格数、蓝格数或白绿格数"], warnings };
  }

  if (B + WG > T) {
    errors.push(`蓝(${B}) + 白绿(${WG}) = ${B + WG} 已经超过总格数 ${T}`);
  }

  // 价格配置 (银单位, 后续转万)
  const vWG = input.vWG ?? DEFAULT_PRICES.vWG;
  const vB = input.vB ?? DEFAULT_PRICES.vB;
  const vP = input.vP ?? DEFAULT_PRICES.vP;
  const vJR = input.vJR ?? DEFAULT_PRICES.vJR;
  const vG = input.vG ?? DEFAULT_PRICES.vG;
  const vR = input.vR ?? DEFAULT_PRICES.vR;

  // 紫色总格数反推 (如果给了总价值)
  let aP = input.purpleTotalGrids ?? null;
  const pTotalValue = input.purpleTotalValue ?? null;
  if (aP === null && pTotalValue !== null && pTotalValue > 0 && vP > 0) {
    aP = Math.max(1, Math.round(pTotalValue / vP));
    warnings.push(`紫色总格数由总价值 ${pTotalValue} / 单格估价 ${vP} 反推 = ${aP}`);
  }

  // 紫色候选
  const purpleCandidates = determineCandidates(
    aP,
    input.purpleCount ?? null,
    input.purpleAvg ?? null,
    input.purpleCountEst ?? null,
    50,   // maxItems
    51,   // k (大量候选展示)
    Array.from({ length: 51 }, (_, i) => i), // ensureB 0..50
  );

  // 金色是否启用
  const goldEnabled = (
    input.goldTotalGrids !== null && input.goldTotalGrids !== undefined ||
    (input.goldAvg !== null && input.goldAvg !== undefined && input.goldAvg! > 0) ||
    input.goldCount !== null && input.goldCount !== undefined
  );

  let goldCandidates: CandidatePair[] = [];
  if (goldEnabled) {
    goldCandidates = determineCandidates(
      input.goldTotalGrids ?? null,
      input.goldCount ?? null,
      input.goldAvg ?? null,
      input.goldCountEst ?? null,
      80,   // maxItems
      5,    // k
      null, // ensureB
    );
  }

  if (purpleCandidates.length === 0) {
    if (input.purpleAvg !== null || aP !== null || input.purpleCount !== null) {
      errors.push("紫色输入不足以反推 (a, b)");
    }
  }

  // 按物品数排序
  purpleCandidates.sort((a, b) => a.count - b.count);
  goldCandidates.sort((a, b) => a.count - b.count);

  // 计算所有候选组合的估值
  const values: number[] = [];

  if (purpleCandidates.length > 0) {
    const gIter = goldCandidates.length > 0 ? goldCandidates : [null];

    for (const pc of purpleCandidates) {
      for (const gc of gIter) {
        const est = computeSingleEstimate(input, pc, gc, {
          vWG, vB, vP, vJR, vG, vR, T, B, WG,
        });
        if (est.estimatedValue !== null && !est.error) {
          values.push(est.estimatedValue);
        }
      }
    }
  }

  let valueRange: GridActuarialOutput['valueRange'] = null;
  if (values.length > 0) {
    values.sort((a, b) => a - b);
    valueRange = {
      min: values[0],
      max: values[values.length - 1],
      median: values[Math.floor(values.length / 2)],
    };
  }

  return {
    purpleCandidates,
    goldCandidates,
    goldEnabled,
    valueRange,
    errors,
    warnings,
  };
}

// ==================== 单点估值 ====================

interface PriceConfig {
  vWG: number;
  vB: number;
  vP: number;
  vJR: number;
  vG: number;
  vR: number;
  T: number;
  B: number;
  WG: number;
}

/**
 * 按选中的 (紫, 金) 候选计算单点估值
 * goldCand=null → 金红混合 (vJR); 否则 → 拆分 (vG + vR)
 * 对应 BidKing 的 compute_estimate
 */
export function computeSingleEstimate(
  input: GridActuarialInput,
  purpleCand: CandidatePair | null,
  goldCand: CandidatePair | null,
  prices: PriceConfig,
): SingleEstimate {
  const { vWG, vB, vP, vJR, vG, vR, T, B, WG } = prices;

  if (!purpleCand) {
    return {
      purpleGrids: 0, goldGrids: 0, redGrids: 0,
      goldRedGrids: 0, estimatedValue: null,
      splitMode: goldCand !== null,
      error: '未选紫色候选',
    };
  }

  const aP = purpleCand.totalGrids;
  const goldRed = T - B - WG - aP;

  const pTotalValue = input.purpleTotalValue ?? null;
  const gTotalValue = input.goldTotalValue ?? null;

  // 紫色价值
  const purpleValue = (pTotalValue !== null && pTotalValue > 0)
    ? pTotalValue
    : aP * vP;

  if (goldCand !== null) {
    const aG = goldCand.totalGrids;
    const aR = goldRed - aG;
    const err = aR < 0 ? `红色格数 = ${aR} < 0, 紫+金已超额` : undefined;

    const goldValue = (gTotalValue !== null && gTotalValue > 0)
      ? gTotalValue
      : aG * vG;

    // 银 → 万
    const value = (WG * vWG + B * vB + purpleValue + goldValue + Math.max(aR, 0) * vR) / SILVER_TO_WAN;

    return {
      purpleGrids: aP, goldGrids: aG, redGrids: aR,
      goldRedGrids: goldRed, estimatedValue: value,
      splitMode: true, error: err,
    };
  } else {
    const err = goldRed < 0 ? `金红剩余 = ${goldRed} < 0, 紫色已超额` : undefined;
    const value = (WG * vWG + B * vB + purpleValue + Math.max(goldRed, 0) * vJR) / SILVER_TO_WAN;
    return {
      purpleGrids: aP, goldGrids: 0, redGrids: 0,
      goldRedGrids: goldRed, estimatedValue: value,
      splitMode: false, error: err,
    };
  }
}

/**
 * 格式化银为万(显示用)
 */
export function formatSilverToWan(silver: number): string {
  return (silver / SILVER_TO_WAN).toFixed(2) + '万';
}
