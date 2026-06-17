# OCR 调试日志使用指南

## 📋 日志文件位置

日志文件已创建：`src/utils/logger.ts`

所有日志操作都会记录，包括：
- 颜色检测结果
- OCR 识别过程
- 数据提取结果
- 错误信息

## 🔍 如何查看日志

### 方法1：浏览器控制台（F12）

打开浏览器开发者工具（F12），切换到 Console 标签，可以看到所有日志输出：

```
[INFO][COLOR] 开始分析图像颜色, 尺寸: 200x100
[DEBUG][COLOR] 检测到紫色像素: R=180, G=50, B=200
[INFO][COLOR_DETECTION] 颜色分析结果 {
  canvasSize: { width: 200, height: 100 },
  sampledPixels: 1250,
  purple: { count: 45, ratio: 0.036 },
  gold: { count: 12, ratio: 0.0096 },
  red: { count: 8, ratio: 0.0064 }
}
[INFO][OCR] 识别到的文本 (purple): "5 10 2"
[INFO][OCR_PARSED] 解析后的数据: { count: 5, slots: 10, avgSlots: 2 }
```

### 方法2：下载完整日志文件

在浏览器控制台中输入：

```javascript
// 获取日志实例
const { logger } = await import('/src/utils/logger.ts');

// 下载日志文件
logger.downloadLogs();
```

### 方法3：查看本地存储

日志也会保存到 localStorage，键名为 `ocr_debug_logs`

```javascript
// 在控制台查看
console.log(JSON.parse(localStorage.getItem('ocr_debug_logs')));
```

## 🎨 颜色检测说明

### 检测逻辑

系统会检测以下三种颜色：

1. **紫色（Purple）**
   - R > 120
   - G < 100
   - B > 120
   - R - G > 30
   - B - G > 30

2. **金色（Gold）**
   - R > 150
   - G > 120
   - B < 100
   - R - B > 50
   - G - B > 30

3. **红色（Red）**
   - R > 150
   - G < 100
   - B < 100
   - R - G > 60
   - R - B > 60

### 匹配阈值

当某颜色的检测比例 > 5% 时，系统认为该区域匹配该颜色

```javascript
if (colorRatio > 0.05) {
  console.log('颜色匹配成功');
}
```

## 🔧 常见问题排查

### 问题1：没有检测到颜色

**可能原因**：
1. 区域选取太小或太大
2. 游戏界面颜色与预期不同
3. 截图质量不佳

**解决方法**：
- 检查控制台的颜色检测日志
- 调整检测区域大小
- 尝试不同的屏幕区域

### 问题2：OCR 识别不到文字

**可能原因**：
1. 字体太小
2. 截图模糊
3. 背景干扰

**解决方法**：
- 增大检测区域
- 调整区域位置确保只框住数字
- 检查区域背景是否过于复杂

### 问题3：数字提取错误

**可能原因**：
1. 识别精度不够
2. 数字格式不标准
3. 干扰文字过多

**解决方法**：
- 查看日志中的识别文本
- 调整识别区域
- 尝试重新框选

## 📊 日志级别说明

- `[INFO]` - 一般信息
- `[DEBUG]` - 调试详细信息
- `[WARNING]` - 警告信息
- `[ERROR]` - 错误信息

## 💡 调试技巧

1. **过滤日志**：在控制台中使用过滤器只查看特定标签
   ```
   filter: "COLOR"      // 只看颜色相关
   filter: "OCR"         // 只看OCR相关
   filter: "ERROR"       // 只看错误
   ```

2. **清空日志**：在控制台运行
   ```javascript
   logger.clear();
   ```

3. **获取最近日志**：
   ```javascript
   logger.getRecentLogs(50);
   ```

## 📝 示例日志流程

```
[INFO][OCR] 开始检测区域: purple
[INFO][COLOR] 开始分析图像颜色, 尺寸: 200x100
[DEBUG][COLOR] 检测到紫色像素: R=180, G=50, B=200
[DEBUG][COLOR] 检测到紫色像素: R=175, G=45, B=195
[INFO][COLOR_DETECTION] 颜色分析结果 {...}
[INFO][OCR] 开始OCR识别
[INFO][OCR_RESULT] 识别到的文本 (purple): "5 10 2"
[INFO][OCR_PARSED] 解析后的数据: { count: 5, slots: 10, avgSlots: 2 }
[INFO][DATA_SYNC] 从 OCR 同步数据
```

## 🎯 快速诊断步骤

1. 打开浏览器控制台（F12）
2. 切换到 Console 标签
3. 启动OCR检测
4. 观察日志输出
5. 对照本文档排查问题

## 📞 获取帮助

如果遇到问题，请提供以下信息：
1. 完整的控制台日志
2. 截图的检测区域
3. 游戏界面描述
4. 预期的识别结果
