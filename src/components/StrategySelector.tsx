import React from 'react';
import { Flame, Shield, Target } from 'lucide-react';

type Strategy = 'aggressive' | 'balanced' | 'conservative';

interface StrategySelectorProps {
  selectedStrategy: Strategy;
  onStrategyChange: (strategy: Strategy) => void;
}

const strategies = [
  {
    id: 'aggressive' as Strategy,
    name: '激进策略',
    description: '高风险高回报，适合经验丰富的竞拍者',
    icon: Flame,
    color: 'red',
    gradient: 'from-red-500 to-orange-500',
    bgGradient: 'from-red-50 to-orange-50',
    borderColor: 'border-red-300',
    hoverColor: 'hover:shadow-red-200',
  },
  {
    id: 'balanced' as Strategy,
    name: '稳健策略',
    description: '平衡风险与回报，适合大多数竞拍者',
    icon: Target,
    color: 'teal',
    gradient: 'from-teal-500 to-cyan-500',
    bgGradient: 'from-teal-50 to-cyan-50',
    borderColor: 'border-teal-300',
    hoverColor: 'hover:shadow-teal-200',
  },
  {
    id: 'conservative' as Strategy,
    name: '保守策略',
    description: '低风险稳收益，适合新手竞拍者',
    icon: Shield,
    color: 'green',
    gradient: 'from-green-500 to-emerald-500',
    bgGradient: 'from-green-50 to-emerald-50',
    borderColor: 'border-green-300',
    hoverColor: 'hover:shadow-green-200',
  },
];

export const StrategySelector: React.FC<StrategySelectorProps> = ({
  selectedStrategy,
  onStrategyChange,
}) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800">选择竞拍策略</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {strategies.map((strategy) => {
          const Icon = strategy.icon;
          const isSelected = selectedStrategy === strategy.id;
          
          return (
            <button
              key={strategy.id}
              onClick={() => onStrategyChange(strategy.id)}
              className={`relative p-6 rounded-2xl border-2 transition-all duration-300 transform ${
                isSelected
                  ? `${strategy.borderColor} bg-gradient-to-br ${strategy.bgGradient} shadow-lg scale-105`
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
              }`}
            >
              {isSelected && (
                <div className={`absolute -top-3 -right-3 w-8 h-8 bg-gradient-to-br ${strategy.gradient} rounded-full flex items-center justify-center shadow-lg`}>
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
              <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${strategy.gradient} flex items-center justify-center mb-4`}>
                <Icon className="w-7 h-7 text-white" />
              </div>
              <h4 className="text-lg font-bold text-gray-800 mb-1">{strategy.name}</h4>
              <p className="text-sm text-gray-500">{strategy.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
};