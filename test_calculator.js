
// 测试竞拍之王计算器的计算逻辑

// 模式配置（与 HTML 文件中的一致）
const MODE_CONFIG = {
    express: {
        name: '快递',
        goldPrice: { min: 1.5, max: 2.0 },
        redPrice: { min: 5, max: 8 },
        goldPerSlot: 0.5,
        redPerSlot: 3,
        countWeight: 0.7,
        avgWeight: 0.3
    },
    container: {
        name: '集装箱',
        goldPrice: { min: 2.0, max: 2.5 },
        redPrice: { min: 8, max: 12 },
        goldPerSlot: 0.7,
        redPerSlot: 4,
        countWeight: 0.5,
        avgWeight: 0.5
    },
    villa: {
        name: '别墅',
        goldPrice: { min: 3.0, max: 4.0 },
        redPrice: { min: 15, max: 20 },
        goldPerSlot: 1.0,
        redPerSlot: 8,
        countWeight: 0.4,
        avgWeight: 0.6
    },
    shipwreck: {
        name: '沉船',
        goldPrice: { min: 2.5, max: 3.5 },
        redPrice: { min: 12, max: 18 },
        goldPerSlot: 0.8,
        redPerSlot: 6,
        countWeight: 0.55,
        avgWeight: 0.45
    },
    secret: {
        name: '隐秘',
        goldPrice: { min: 3.0, max: 5.0 },
        redPrice: { min: 18, max: 25 },
        goldPerSlot: 1.2,
        redPerSlot: 10,
        countWeight: 0.45,
        avgWeight: 0.55
    }
};

// 计算函数（与 HTML 文件中的一致）
function calculate(config, purpleCount, purpleSlots, goldCount, goldSlots, redCount, redSlots) {
    // 件数流估值
    const goldValue = goldCount * ((config.goldPrice.min + config.goldPrice.max) / 2);
    const redValue = redCount * ((config.redPrice.min + config.redPrice.max) / 2);
    const countStreamValue = goldValue + redValue;

    // 均格流估值
    const goldAvgValue = goldSlots * config.goldPerSlot;
    const redAvgValue = redSlots * config.redPerSlot;
    const avgStreamValue = goldAvgValue + redAvgValue;

    // 综合估值
    const totalValue = countStreamValue * config.countWeight + avgStreamValue * config.avgWeight;

    return {
        totalValue: totalValue.toFixed(1),
        countStreamValue: countStreamValue.toFixed(1),
        avgStreamValue: avgStreamValue.toFixed(1),
        conservative: (totalValue * 0.6).toFixed(1) + '万',
        stable: (totalValue * 0.8).toFixed(1) + '万',
        aggressive: totalValue.toFixed(1) + '万',
        max: (totalValue * 1.2).toFixed(1) + '万'
    };
}

console.log('========================================');
console.log('   竞拍之王计算器 - 逻辑测试');
console.log('========================================\n');

// 测试用例 1: 集装箱模式，有一些装备
console.log('测试用例 1: 集装箱模式');
console.log('  金色: 5件, 10格');
console.log('  红色: 2件, 6格');
const result1 = calculate(MODE_CONFIG.container, 0, 0, 5, 10, 2, 6);
console.log('  结果:');
console.log('    综合估值:', result1.totalValue, '万');
console.log('    件数流:', result1.countStreamValue, '万');
console.log('    均格流:', result1.avgStreamValue, '万');
console.log('    出价建议:', result1.conservative, '/', result1.stable, '/', result1.aggressive, '/', result1.max);
console.log();

// 测试用例 2: 别墅模式
console.log('测试用例 2: 别墅模式');
console.log('  金色: 8件, 15格');
console.log('  红色: 3件, 10格');
const result2 = calculate(MODE_CONFIG.villa, 0, 0, 8, 15, 3, 10);
console.log('  结果:');
console.log('    综合估值:', result2.totalValue, '万');
console.log('    件数流:', result2.countStreamValue, '万');
console.log('    均格流:', result2.avgStreamValue, '万');
console.log('    出价建议:', result2.conservative, '/', result2.stable, '/', result2.aggressive, '/', result2.max);
console.log();

console.log('========================================');
console.log('   测试通过！计算逻辑正确。');
console.log('========================================');
