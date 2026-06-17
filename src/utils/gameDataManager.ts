// 游戏数据管理模块
import { create } from 'zustand';

// 游戏对局数据结构
export interface GameRound {
  id: string;
  timestamp: number;
  character?: string;
  map?: string;
  currentRound: number;
  qualities: {
    white?: { count?: number; slots?: number };
    green?: { count?: number; slots?: number };
    blue?: { count?: number; slots?: number };
    purple?: { count?: number; slots?: number; avgSlots?: number };
    gold?: { count?: number; slots?: number; avgSlots?: number };
    red?: { count?: number; slots?: number };
  };
  warehouseInfo: {
    totalItems?: number;
    totalSlots?: number;
  };
  bids: {
    round: number;
    myBid: number;
    opponentBids?: { [playerId: string]: number };
    rank?: number;
  }[];
  outcome?: {
    won: boolean;
    finalPrice: number;
    actualValue: number;
    profitLoss: number;
  };
}

// 数据状态管理
interface GameDataStore {
  currentGame: GameRound | null;
  gameHistory: GameRound[];
  isRecording: boolean;
  
  // 创建新游戏
  startNewGame: (character?: string, map?: string) => void;
  
  // 更新游戏数据
  updateGameData: (data: Partial<GameRound>) => void;
  
  // 添加出价记录
  addBid: (round: number, myBid: number, opponentBids?: { [playerId: string]: number }) => void;
  
  // 设置游戏结果
  setGameOutcome: (outcome: GameRound['outcome']) => void;
  
  // 保存游戏到历史
  saveGame: () => void;
  
  // 加载游戏历史
  loadGameHistory: () => void;
  
  // 清除当前游戏
  clearCurrentGame: () => void;
  
  // 导出数据
  exportData: () => string;
  
  // 导入数据
  importData: (data: string) => void;
}

// 生成唯一ID
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// 创建初始游戏数据
const createInitialGame = (character?: string, map?: string): GameRound => {
  return {
    id: generateId(),
    timestamp: Date.now(),
    character,
    map,
    currentRound: 1,
    qualities: {},
    warehouseInfo: {},
    bids: [],
  };
};

// 本地存储键名
const STORAGE_KEY = 'bidking_game_history';

// 创建zustand store
export const useGameDataStore = create<GameDataStore>((set, get) => ({
  currentGame: null,
  gameHistory: [],
  isRecording: false,

  startNewGame: (character?: string, map?: string) => {
    const newGame = createInitialGame(character, map);
    set({ currentGame: newGame, isRecording: true });
  },

  updateGameData: (data: Partial<GameRound>) => {
    set(state => {
      if (!state.currentGame) return state;
      return {
        currentGame: {
          ...state.currentGame,
          ...data,
          qualities: {
            ...state.currentGame.qualities,
            ...data.qualities,
          },
          warehouseInfo: {
            ...state.currentGame.warehouseInfo,
            ...data.warehouseInfo,
          },
        },
      };
    });
  },

  addBid: (round: number, myBid: number, opponentBids?: { [playerId: string]: number }) => {
    set(state => {
      if (!state.currentGame) return state;
      return {
        currentGame: {
          ...state.currentGame,
          currentRound: round,
          bids: [
            ...state.currentGame.bids,
            { round, myBid, opponentBids },
          ],
        },
      };
    });
  },

  setGameOutcome: (outcome: GameRound['outcome']) => {
    set(state => {
      if (!state.currentGame) return state;
      return {
        currentGame: {
          ...state.currentGame,
          outcome,
        },
      };
    });
  },

  saveGame: () => {
    set(state => {
      if (!state.currentGame) return state;
      
      const updatedHistory = [state.currentGame, ...state.gameHistory];
      
      // 保存到本地存储
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory));
      } catch (e) {
        console.error('Failed to save game history:', e);
      }
      
      return {
        gameHistory: updatedHistory,
        isRecording: false,
      };
    });
  },

  loadGameHistory: () => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const history = JSON.parse(data) as GameRound[];
        set({ gameHistory: history });
      }
    } catch (e) {
      console.error('Failed to load game history:', e);
    }
  },

  clearCurrentGame: () => {
    set({ currentGame: null, isRecording: false });
  },

  exportData: () => {
    const { gameHistory, currentGame } = get();
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      gameHistory,
      currentGame,
    };
    return JSON.stringify(exportData, null, 2);
  },

  importData: (data: string) => {
    try {
      const importData = JSON.parse(data);
      if (importData.gameHistory) {
        set({ gameHistory: importData.gameHistory });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(importData.gameHistory));
      }
      if (importData.currentGame) {
        set({ currentGame: importData.currentGame, isRecording: true });
      }
    } catch (e) {
      console.error('Failed to import data:', e);
      throw new Error('数据格式错误，请检查导入文件');
    }
  },
}));

// 数据分析工具
export const analyzeGameHistory = (history: GameRound[]) => {
  if (history.length === 0) {
    return {
      totalGames: 0,
      winRate: 0,
      averageProfit: 0,
      characterStats: {},
      bestCharacter: null,
    };
  }

  const wins = history.filter(g => g.outcome?.won).length;
  const totalProfit = history.reduce((sum, g) => sum + (g.outcome?.profitLoss || 0), 0);
  
  const characterStats: Record<string, { games: number; wins: number; totalProfit: number }> = {};
  
  history.forEach(game => {
    const char = game.character || 'unknown';
    if (!characterStats[char]) {
      characterStats[char] = { games: 0, wins: 0, totalProfit: 0 };
    }
    characterStats[char].games++;
    if (game.outcome?.won) {
      characterStats[char].wins++;
    }
    characterStats[char].totalProfit += game.outcome?.profitLoss || 0;
  });

  const bestCharacter = Object.entries(characterStats).sort((a, b) => 
    b[1].totalProfit - a[1].totalProfit
  )[0];

  return {
    totalGames: history.length,
    winRate: (wins / history.length) * 100,
    averageProfit: totalProfit / history.length,
    characterStats,
    bestCharacter: bestCharacter ? { name: bestCharacter[0], ...bestCharacter[1] } : null,
  };
};
