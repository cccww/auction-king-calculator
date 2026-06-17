import React from 'react';
import { DollarSign, Percent } from 'lucide-react';

interface PriceInputProps {
  basePrice: number;
  markupRate: number;
  taxRate: number;
  onBasePriceChange: (value: number) => void;
  onMarkupRateChange: (value: number) => void;
  onTaxRateChange: (value: number) => void;
}

export const PriceInput: React.FC<PriceInputProps> = ({
  basePrice,
  markupRate,
  taxRate,
  onBasePriceChange,
  onMarkupRateChange,
  onTaxRateChange,
}) => {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-2xl p-6 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-red-100 rounded-xl">
            <DollarSign className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-800">商品基础价格</h3>
            <p className="text-sm text-gray-500">输入商品的初始价格</p>
          </div>
        </div>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl">¥</span>
          <input
            type="number"
            value={basePrice}
            onChange={(e) => onBasePriceChange(Number(e.target.value) || 0)}
            className="w-full pl-12 pr-4 py-4 text-2xl font-bold text-gray-800 bg-white rounded-xl border-2 border-red-200 focus:border-red-400 focus:ring-4 focus:ring-red-100 outline-none transition-all duration-300"
            placeholder="0.00"
            min="0"
            step="0.01"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-2xl p-6 shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-teal-100 rounded-xl">
              <Percent className="w-6 h-6 text-teal-500" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800">加价比例</h3>
              <p className="text-sm text-gray-500">预期利润率</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="0"
              max="100"
              value={markupRate}
              onChange={(e) => onMarkupRateChange(Number(e.target.value))}
              className="flex-1 h-3 bg-teal-200 rounded-full appearance-none cursor-pointer accent-teal-500"
            />
            <span className="w-16 text-center text-xl font-bold text-teal-600">{markupRate}%</span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-2xl p-6 shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-100 rounded-xl">
              <Percent className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800">税费比例</h3>
              <p className="text-sm text-gray-500">包含各种税费</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="0"
              max="50"
              value={taxRate}
              onChange={(e) => onTaxRateChange(Number(e.target.value))}
              className="flex-1 h-3 bg-amber-200 rounded-full appearance-none cursor-pointer accent-amber-500"
            />
            <span className="w-16 text-center text-xl font-bold text-amber-600">{taxRate}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};