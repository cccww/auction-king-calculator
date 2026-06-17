// 数据采集记录管理模块
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 采集记录数据结构
export interface CollectionRecord {
  id: string;
  timestamp: number;
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
  // 真实价格相关字段
  actualValue?: number;
  estimatedValue?: number;
  profit?: number;
  deviation?: number;
  notes?: string;
}

// 数据采集状态管理
interface CollectionStore {
  // 采集记录列表
  records: CollectionRecord[];
  
  // 当前采集状态
  currentCollection: Partial<CollectionRecord> | null;
  
  // 添加新记录
  addRecord: (record: Omit<CollectionRecord, 'id' | 'timestamp'>) => string;
  
  // 更新当前采集
  updateCurrentCollection: (data: Partial<CollectionRecord>) => void;
  
  // 清空当前采集
  clearCurrentCollection: () => void;
  
  // 删除记录
  deleteRecord: (id: string) => void;
  
  // 清空所有记录
  clearAllRecords: () => void;
  
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
        };
        
        set((state) => ({
          records: [...state.records, newRecord],
        }));
        
        return id;
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
