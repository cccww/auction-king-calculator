// 数据采集记录管理模块
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ===== 状态常量 (移植自 BidKing 的 status 流) =====
export type RecordStatus = 'draft' | 'bid_placed' | 'completed';

// ===== 赛后实际数据 (移植自 BidKing 的 actual 字段) =====
export interface ActualResult {
  totalValue?: number;       // 仓库实际总价 (万)
  screenshotPath?: string;   // 结算截图路径
  won?: boolean;             // 是否获胜
}

// 采集记录数据结构 (扩展自 BidKing)
export interface CollectionRecord {
  id: string;
  timestamp: number;
  sessionId?: string;        // session 分组 (格式: YYYYMMDD-HHMMSS)
  status: RecordStatus;      // 状态流转: draft → bid_placed → completed
  mode: string;
  character: string;
  round: number;
  warehouseInfo: {
    totalItems?: number;
    totalSlots?: number;
  };
  qualities: {
    white?: { count?: number; slots?: number; avgSlots?: number };
    green?: { count?: number; slots?: number; avgSlots?: number };
    blue?: { count?: number; slots?: number; avgSlots?: number };
    purple?: { count?: number; slots?: number; avgSlots?: number };
    gold?: { count?: number; slots?: number; avgSlots?: number };
    red?: { count?: number; slots?: number; avgSlots?: number };
  };
  valuationResult?: {
    countStreamValue: number;
    avgSlotStreamValue: number;
    conservativeBid: number;
    stableBid: number;
    aggressiveBid: number;
    maxBid: number;
  };
  // 用户出价
  bid?: number;
  // 赛后实际数据 (BidKing 风格)
  actual?: ActualResult;
  // 真实价格相关字段 (向后兼容)
  actualValue?: number;
  estimatedValue?: number;
  profit?: number;
  deviation?: number;
  notes?: string;
}

// ===== 工具函数 =====

/** 生成新 sessionId (BidKing 风格: YYYYMMDD-HHMMSS) */
export function newSessionId(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

/** 创建空白记录 */
export function emptyRecord(): Omit<CollectionRecord, 'id' | 'timestamp'> {
  return {
    sessionId: newSessionId(),
    status: 'draft',
    mode: '',
    character: '',
    round: 1,
    warehouseInfo: {},
    qualities: {},
  };
}

// 数据采集状态管理
interface CollectionStore {
  // 采集记录列表
  records: CollectionRecord[];

  // 当前采集状态
  currentCollection: Partial<CollectionRecord> | null;

  // 添加新记录
  addRecord: (record: Omit<CollectionRecord, 'id' | 'timestamp'>) => string;

  // 更新记录 (用于状态流转)
  updateRecord: (id: string, data: Partial<CollectionRecord>) => void;

  // 更新当前采集
  updateCurrentCollection: (data: Partial<CollectionRecord>) => void;

  // 清空当前采集
  clearCurrentCollection: () => void;

  // 删除记录
  deleteRecord: (id: string) => void;

  // 清空所有记录
  clearAllRecords: () => void;

  // 按 session 获取记录
  getRecordsBySession: (sessionId: string) => CollectionRecord[];

  // 获取最新 draft 记录
  latestDraft: () => CollectionRecord | undefined;

  // 获取记录统计
  getStatistics: () => {
    totalRecords: number;
    totalPurpleItems: number;
    totalGoldItems: number;
    totalRedItems: number;
    averageBid: number;
  };

  // 导出记录为JSON
  exportRecords: () => string;

  // 从JSON导入记录
  importRecords: (json: string) => boolean;
}

export const useCollectionStore = create<CollectionStore>()(
  persist(
    (set, get) => ({
      records: [],
      currentCollection: null,

      // 添加新记录
      addRecord: (record) => {
        const id = `record_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newRecord: CollectionRecord = {
          ...record,
          id,
          timestamp: Date.now(),
          status: record.status || 'draft',
        };

        set((state) => ({
          records: [...state.records, newRecord],
        }));

        return id;
      },

      // 更新记录 (状态流转/赛后数据)
      updateRecord: (id, data) => {
        set((state) => ({
          records: state.records.map((r) =>
            r.id === id ? { ...r, ...data, timestamp: Date.now() } : r
          ),
        }));
      },

      // 更新当前采集
      updateCurrentCollection: (data) => {
        set((state) => ({
          currentCollection: {
            ...state.currentCollection,
            ...data,
          },
        }));
      },

      // 清空当前采集
      clearCurrentCollection: () => {
        set({ currentCollection: null });
      },

      // 删除记录
      deleteRecord: (id) => {
        set((state) => ({
          records: state.records.filter((r) => r.id !== id),
        }));
      },

      // 清空所有记录
      clearAllRecords: () => {
        set({ records: [] });
      },

      // 按 session 获取记录
      getRecordsBySession: (sessionId) => {
        return get().records.filter((r) => r.sessionId === sessionId);
      },

      // 获取最新 draft 记录
      latestDraft: () => {
        const drafts = get().records.filter((r) => r.status === 'draft');
        if (drafts.length === 0) return undefined;
        return drafts.reduce((a, b) => (a.timestamp > b.timestamp ? a : b));
      },

      // 获取统计信息
      getStatistics: () => {
        const records = get().records;

        const totalPurpleItems = records.reduce(
          (sum, r) => sum + (r.qualities.purple?.count || 0),
          0
        );
        const totalGoldItems = records.reduce(
          (sum, r) => sum + (r.qualities.gold?.count || 0),
          0
        );
        const totalRedItems = records.reduce(
          (sum, r) => sum + (r.qualities.red?.count || 0),
          0
        );

        const bidsWithValue = records.filter(
          (r) => r.valuationResult?.stableBid
        );
        const averageBid =
          bidsWithValue.length > 0
            ? bidsWithValue.reduce((sum, r) => sum + (r.valuationResult?.stableBid || 0), 0) /
              bidsWithValue.length
            : 0;

        return {
          totalRecords: records.length,
          totalPurpleItems,
          totalGoldItems,
          totalRedItems,
          averageBid,
        };
      },

      // 导出记录为JSON
      exportRecords: () => {
        const records = get().records;
        return JSON.stringify(records, null, 2);
      },

      // 从JSON导入记录
      importRecords: (json) => {
        try {
          const importedRecords = JSON.parse(json);
          if (Array.isArray(importedRecords)) {
            set((state) => ({
              records: [...state.records, ...importedRecords],
            }));
            return true;
          }
          return false;
        } catch {
          return false;
        }
      },
    }),
    {
      name: 'collection-storage', // localStorage key
    }
  )
);

// 辅助函数：格式化时间
export const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// 辅助函数：获取模式名称
export const getModeName = (mode: string): string => {
  const modeNames: Record<string, string> = {
    express: '快递',
    container: '集装箱',
    villa: '别墅',
    shipwreck: '沉船',
    secret: '隐秘',
  };
  return modeNames[mode] || mode;
};

// 辅助函数：获取角色名称
export const getCharacterName = (character: string): string => {
  const characterNames: Record<string, string> = {
    victor: '老头',
    elsa: '艾莎',
    ethan: '伊森',
    oilman: '石油佬',
  };
  return characterNames[character] || character;
};
