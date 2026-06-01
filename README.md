# JYY PDF

一款基于 Electron + React + TypeScript 构建的本地PDF处理工具，支持 Windows 桌面应用。

## 功能特性

### 📄 PDF 操作
- **PDF 合并** - 多个 PDF 文件合并为一个
- **PDF 拆分** - 按页数或指定范围拆分 PDF
- **PDF 压缩** - 减小 PDF 文件大小
- **PDF 加密** - 设置密码保护 PDF
- **添加页码** - 自动为 PDF 页面添加页码
- **添加水印** - 文本或图片水印
- **电子签名** - 手绘签名或上传签名图片嵌入 PDF
- **PDF 编辑** - 添加文本、矩形、圆形、高亮等标注

### 🔄 格式转换
- **图片转 PDF** - 将多张图片合并为单个 PDF
- **Word/Excel/PPT 转 PDF** - Office 文档转换为 PDF
- **PDF 转图片** - 将 PDF 页面导出为图片
- **OCR 识别** - 从扫描 PDF/图片中提取文本

### 💻 技术栈
- **Electron** - 跨平台桌面应用框架
- **React 18** - UI 框架
- **TypeScript** - 类型安全
- **Vite** - 快速构建工具
- **Tailwind CSS** - 样式框架
- **pdf-lib** - PDF 处理
- **pdfjs-dist** - PDF 渲染
- **Tesseract.js** - OCR 文字识别

## 开发环境

### 环境要求
- Node.js >= 18.x
- npm >= 9.x
- Windows 10/11

### 安装依赖
```bash
npm install
```

### 开发模式
```bash
# 启动 Vite 开发服务器
npm run dev

# 或启动 Electron 开发模式（同时运行前端和Electron）
npm run electron:dev
```

### 构建应用
```bash
# 构建生产版本
npm run build

# 构建 Electron 安装包
npm run electron:build
```

构建完成后，安装包位于 `dist-electron` 目录。

## 项目结构

```
PDF/
├── electron/              # Electron 主进程代码
│   ├── main.cjs          # 主进程入口
│   └── preload.cjs       # 预加载脚本
├── src/                   # React 前端代码
│   ├── components/       # React 组件
│   │   ├── ui/           # UI 基础组件
│   │   └── *.tsx         # 功能面板组件
│   ├── hooks/            # React Hooks
│   ├── lib/              # 工具函数库
│   ├── App.tsx           # 应用入口
│   └── main.tsx          # React 入口
├── public/               # 静态资源
├── dist-electron/        # 构建输出目录
└── package.json         # 项目配置
```

## 主要功能模块

| 组件 | 功能说明 |
|------|---------|
| `SignaturePanel` | 电子签名功能 |
| `MergePanel` | PDF 合并 |
| `SplitPanel` | PDF 拆分 |
| `CompressPanel` | PDF 压缩 |
| `EncryptPanel` | PDF 加密 |
| `WatermarkPanel` | 添加水印 |
| `PageNumbersPanel` | 添加页码 |
| `ImagesToPdfPanel` | 图片转 PDF |
| `ConvertOfficePanel` | Office 转 PDF |
| `ConvertPanel` | PDF 转图片 |
| `OcrPanel` | OCR 识别 |
| `EditPanel` | PDF 编辑标注 |

## 安全特性

- ✅ 电子签名图片格式校验（魔数+解码验证）
- ✅ PDF 路径安全校验（防止路径遍历攻击）
- ✅ base64 解码异常处理
- ✅ 签名位置边界校验
- ✅ 页码范围校验
- ✅ PDF JavaScript 内容检测

## License

MIT License