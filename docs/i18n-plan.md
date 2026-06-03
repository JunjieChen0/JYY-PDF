# i18n 国际化实施方案

> 创建日期：2026-06-03
> 状态：**已完成** ✅
> 技术栈：i18next + react-i18next + i18next-browser-languagedetector

---

## 目标

- 支持中文/英文双语切换
- 顶栏添加语言切换下拉菜单
- 所有用户可见文字通过翻译 key 管理
- 语言偏好持久化（localStorage）

---

## 架构设计

```
src/
├── i18n/
│   ├── index.ts              # i18next 初始化 + 语言检测
│   ├── zh.json               # 中文翻译
│   └── en.json               # 英文翻译
├── lib/
│   └── i18n.ts               # 保留 ErrorCode 枚举（兼容已有引用），t() 改为 re-export
├── components/
│   └── LanguageSwitcher.tsx   # 语言切换下拉菜单（新组件）
└── App.tsx                    # 顶栏添加 LanguageSwitcher
```

### 翻译 key 命名规范

采用**扁平 key + 点分隔命名空间**：

```json
{
  "common.fileNotFound": "文件不存在",
  "encrypt.needPassword": "请输入密码",
  "panel.compress.title": "压缩 PDF",
  "app.title": "PDF 工具箱"
}
```

命名空间划分：
- `common.*` — 通用错误/状态消息（对应现有 ErrorCode）
- `encrypt.*` / `signature.*` / `convert.*` 等 — 按功能模块分组
- `panel.*.title` / `panel.*.description` — 面板标题/描述
- `panel.*.btn.*` — 按钮文字
- `panel.*.label.*` — 表单标签
- `panel.*.option.*` — 选项文字
- `app.*` — 全局 UI（标题、Tab 名、拖拽提示等）
- `errorPrefix.*` — toast 错误前缀

---

## 翻译 key 清单（约 350+ 个）

### common.* — 通用错误消息（~50 个）

从现有 `i18n.ts` 的 `ErrorCode` 枚举迁移：

| key | 中文 | 英文 |
|-----|------|------|
| `common.fileNotFound` | 文件不存在 | File not found |
| `common.fileDataMissing` | 文件数据已丢失，请重新添加该文件 | File data is missing, please re-add the file |
| `common.invalidPdf` | 不是有效的PDF文档 | Not a valid PDF document |
| `common.invalidFileFormat` | 不支持的文件格式 | Unsupported file format |
| `common.cancelled` | 操作已取消 | Operation cancelled |
| `common.operationFailed` | 操作失败 | Operation failed |
| `common.invalidPdfHeader` | 无法读取文件数据，请重新添加该文件 | Unable to read file data, please re-add the file |
| ... | ... | ... |

### encrypt.* — 加密模块（~8 个）

| key | 中文 |
|-----|------|
| `encrypt.needPassword` | 请输入密码 |
| `encrypt.wrongPassword` | 密码错误，无法解密 |
| `encrypt.needAtLeastOnePassword` | 请至少设置用户密码或所有者密码 |
| `encrypt.invalidPath` | 加密路径不合法 |
| `encrypt.resultEmpty` | 加密结果数据为空 |
| `encrypt.decryptResultEmpty` | 解密结果数据为空 |

### signature.* — 签名模块（~12 个）

| key | 中文 |
|-----|------|
| `signature.outOfPage` | 签名超出页面范围，请调整位置或缩小签名尺寸 |
| `signature.pdfHasJavaScript` | 该PDF包含嵌入式JavaScript代码，可能存在安全风险。请使用专业PDF工具检查后再签名 |
| `signature.invalidPath` | 文件路径不合法，请选择有效的保存路径 |
| `signature.invalidImage` | 签名图片格式错误，请重新选择或绘制签名 |
| `signature.unsupportedImage` | 不支持的签名图片格式，请使用 PNG 或 JPG 格式 |
| `signature.pageIndexOutOfRange` | 页码超出范围，请选择有效的页码 |
| `signature.canvasNotReady` | 签名画布未就绪 |
| `signature.contextUnavailable` | 签名画布上下文不可用 |
| `signature.notDrawn` | 请先绘制签名 |
| `signature.formatPngJpg` | 仅支持PNG/JPG格式的签名图片 |
| `signature.imageTooLarge` | 签名图片大小不能超过5MB |
| `signature.completed` | 签名完成！ |

### convert.* — 转换模块（~8 个）

| key | 中文 |
|-----|------|
| `convert.wordTooLarge` | Word 文档过大 |
| `convert.invalidWordData` | Invalid Word data |
| `convert.wordParseFailed` | Word 文档解析失败，请检查文件格式是否正确 |
| `convert.pdfGenerateFailed` | PDF 生成失败，请重试 |
| `convert.canvasContextFailed` | 无法创建 Canvas 上下文 |
| `convert.resultEmpty` | 转换结果为空 |
| `convert.allCompleted` | 全部转换完成！ |
| `convert.noPdfSelected` | 请先选择PDF文件 |

### watermark.* — 水印模块（~8 个）

| key | 中文 |
|-----|------|
| `watermark.imageReadFailed` | 读取图片失败 |
| `watermark.unsupportedImageFormat` | 不支持的图片格式，请使用 PNG 或 JPG 格式 |
| `watermark.fontReadFailed` | 读取字体失败 |
| `watermark.systemFontNotInstalled` | 读取系统字体失败，请确保系统已安装宋体字体 |
| `watermark.tileLimit` | 水印平铺数量已达上限（每页 500 个）... |
| `watermark.gapTooSmall` | 水印间距过小，平铺数量超过上限 |
| `watermark.selectImageFirst` | 请先选择水印图片 |
| `watermark.selectImageFormat` | 请选择 PNG 或 JPG 格式的图片文件 |

### page.* — 页面操作模块（~6 个）

| key | 中文 |
|-----|------|
| `page.cannotDeleteAll` | 不能删除文档的全部页面 |
| `page.noPagesToProcess` | 没有可处理的页面 |
| `page.emptyRange` | 页码范围为空 |
| `page.rangeInvalid` | 页码范围无效 |
| `page.annotationNotFound` | 批注不存在 |
| `page.annotationOutOfBounds` | 标注页码越界 |

### panel.* — 面板 UI 文字（~150 个）

每个面板约 10-15 个 key，包括标题、描述、按钮、标签、选项等。

示例（CompressPanel）：

| key | 中文 |
|-----|------|
| `panel.compress.title` | 压缩 PDF |
| `panel.compress.description` | 减小 PDF 文件大小，优化存储空间 |
| `panel.compress.speedPriority` | 速度优先 |
| `panel.compress.balanced` | 均衡 |
| `panel.compress.stabilityPriority` | 稳定优先 |
| `panel.compress.speedHint` | 响应速度 |
| `panel.compress.start` | 开始压缩 |
| `panel.compress.cancel` | 取消 |
| `panel.compress.completed` | 压缩完成 |
| `panel.compress.selectFiles` | 请选择要压缩的PDF文件 |

### app.* — 全局 UI（~20 个）

| key | 中文 |
|-----|------|
| `app.title` | PDF 工具箱 |
| `app.tab.merge` | 合并 |
| `app.tab.split` | 分割 |
| `app.tab.compress` | 压缩 |
| `app.tab.encrypt` | 加密解密 |
| `app.tab.watermark` | 水印 |
| `app.tab.pageNumbers` | 页码 |
| `app.tab.edit` | 编辑 |
| `app.tab.signature` | 签名 |
| `app.tab.convert` | 转换图片 |
| `app.tab.convertOffice` | Office 转换 |
| `app.tab.ocr` | OCR 识别 |
| `app.tab.pageOps` | 页面操作 |
| `app.dropzone.dragOrClick` | 拖拽或点击添加PDF文件 |
| `app.dropzone.processing` | 处理中，无法添加文件 |
| `app.dropzone.dragActive` | 松开鼠标添加文件 |
| `app.dropzone.hint` | 支持 .pdf 格式 |

### errorPrefix.* — toast 错误前缀（~10 个）

已有，直接迁移。

---

## 实施步骤

### Phase 1：基础设施（~2h）

- [x] 安装依赖：`npm install i18next react-i18next i18next-browser-languagedetector`
- [x] 创建 `src/i18n/index.ts` — i18next 初始化
- [x] 创建 `src/i18n/zh.json` — 从现有 `i18n.ts` messages 迁移
- [x] 创建 `src/i18n/en.json` — 英文翻译骨架
- [x] 在 `main.tsx` 导入 i18n 初始化
- [x] 改造 `src/lib/i18n.ts` — 删除 messages，re-export useTranslation

### Phase 2：翻译文件内容（~4h）

- [x] 编写 `zh.json` 完整内容（350+ key）
- [x] 编写 `en.json` 完整内容

### Phase 3：改造 hooks（~3h）

- [x] `usePDFFiles.ts` — 8 处 toast
- [x] `useOperation.ts` — 3 处 toast
- [x] `usePDFSignature.ts` — 2 处 throw
- [x] `usePDFEncrypt.ts` — 4 处 throw
- [x] `usePDFConvert.ts` — 3 处 throw
- [x] `usePDFOCR.ts` — 3 处 throw
- [x] `usePDFAnnotation.ts` — 2 处 throw
- [x] `usePDFWatermark.ts` — 3 处 throw
- [x] `usePDFPageNumbers.ts` — 1 处 throw
- [x] `usePDFPages.ts` — 2 处 throw

### Phase 4：改造 components（~3h）

- [x] `App.tsx` — Tab 名、标题
- [x] `FileDropZone.tsx` — 拖拽提示
- [x] `FileList.tsx` — 按钮文字
- [x] `ErrorBoundary.tsx` — 错误显示（class 组件，需用 withTranslation）
- [x] `CompressPanel.tsx` — 1 toast + 选项描述
- [x] `MergePanel.tsx` — 1 toast + UI 文字
- [x] `SplitPanel.tsx` — 1 toast + UI 文字
- [x] `EncryptPanel.tsx` — 4 toast + 表单标签
- [x] `WatermarkPanel.tsx` — 3 toast + 选项
- [x] `PageNumbersPanel.tsx` — 1 toast + 选项
- [x] `EditPanel.tsx` — 4 toast + UI 文字
- [x] `SignaturePanel.tsx` — 12 toast + UI 文字
- [x] `ConvertPanel.tsx` — 1 toast + UI 文字
- [x] `ConvertOfficePanel.tsx` — 5 toast + UI 文字
- [x] `ImagesToPdfPanel.tsx` — 2 toast + UI 文字
- [x] `OcrPanel.tsx` — 2 toast + UI 文字
- [x] `PageOperations.tsx` — 1 toast + UI 文字
- [x] `PageThumbnail.tsx` — 1 处

### Phase 5：语言切换 UI（~2h）

- [x] 创建 `src/components/LanguageSwitcher.tsx`
- [x] 在 `App.tsx` 顶栏添加 LanguageSwitcher（暗色模式按钮旁）
- [x] 验证语言切换 + 持久化

### Phase 6：验证 + 测试更新（~4h）

- [x] 更新 `src/lib/__tests__/i18n.test.ts`
- [x] 更新其他测试文件中的中文断言
- [x] `npm run lint` 通过
- [x] `npx tsc --noEmit` 通过
- [ ] 手动切换中英文，逐面板验证（需用户手动执行）
- [x] `npm run test` 通过

---

## 风险点

1. **ErrorBoundary 是 class 组件** — 需要用 `withTranslation` HOC 或在 render 中直接调用 `i18next.t()`
2. **测试中的中文断言** — 需要同步更新 `expect` 字符串
3. **electron/main.cjs 中的中文** — 主进程不在 i18next 范围，保持现有 `sanitizeError` 的中文回退
4. **插值参数** — 模板字符串如 `` `文件 ${name} 已存在` `` 需改为 `t('key', { name })`
5. **复数形式** — 英文需要处理复数（如 "1 file" vs "2 files"），中文无此问题

---

## 工期估算

| Phase | 内容 | 工时 |
|-------|------|------|
| 1 | 基础设施 | 2h |
| 2 | 翻译文件内容 | 4h |
| 3 | 改造 hooks | 3h |
| 4 | 改造 components | 3h |
| 5 | 语言切换 UI | 2h |
| 6 | 验证 + 测试更新 | 4h |
| **合计** | | **~18h** |
