import { PDFDocument, PDFName, PDFDict, PDFArray, PDFObject } from 'pdf-lib'

export interface JavaScriptDetectionResult {
  found: boolean
  locations: string[]
}

/**
 * 递归遍历 action dict 的最大深度。超过则停止下钻并记录当前位置，
 * 避免恶意构造的循环/极深嵌套触发栈溢出。
 */
const MAX_ACTION_DICT_DEPTH = 20

function isJavaScriptActionDict(dict: PDFDict): boolean {
  const s = dict.get(PDFName.of('S'))
  if (!s) return false
  const sStr = s.toString()
  return sStr === '/JavaScript' || sStr === '/JS'
}

function hasJsField(dict: PDFDict): boolean {
  return dict.has(PDFName.of('JS'))
}

function asDict(obj: PDFObject | undefined): PDFDict | null {
  if (!obj) return null
  if (obj instanceof PDFDict) return obj
  return null
}

function asArray(obj: PDFObject | undefined): PDFArray | null {
  if (!obj) return null
  if (obj instanceof PDFArray) return obj
  return null
}

function walkActionDict(
  dict: PDFDict,
  path: string,
  locations: Set<string>,
  depth: number,
  truncatedPaths: Set<string>,
): void {
  if (isJavaScriptActionDict(dict) || hasJsField(dict)) {
    locations.add(path)
  }
  if (depth >= MAX_ACTION_DICT_DEPTH) {
    // 已达深度上限：若本节点含 AA/Next（潜在更深 JS），标记被截断
    if (asDict(dict.get(PDFName.of('AA'))) || asArray(dict.get(PDFName.of('Next')))) {
      truncatedPaths.add(path)
    }
    return
  }
  const aa = asDict(dict.get(PDFName.of('AA')))
  if (aa) {
    walkActionDict(aa, `${path}.AA`, locations, depth + 1, truncatedPaths)
  }
  const next = asArray(dict.get(PDFName.of('Next')))
  if (next) {
    next.asArray().forEach((entry, i) => {
      const entryDict = entry instanceof PDFDict ? entry : null
      if (entryDict) {
        walkActionDict(entryDict, `${path}.Next[${i}]`, locations, depth + 1, truncatedPaths)
      }
    })
  }
}

/**
 * 检测 PDF 是否包含嵌入式 JavaScript（`/JavaScript` / `/JS` Action）。
 * 递归遍历 catalog、AA 链、Next 链、Names 树、AcroForm、Page Annots，深度上限 20。
 * @param data - PDF 字节数据
 * @returns `{ found, locations }`；`locations` 含 `catalog.AA`、`pages[0].Annots[1]` 等路径。
 */
export async function detectJavaScriptActions(
  data: Uint8Array,
): Promise<JavaScriptDetectionResult> {
  const locations = new Set<string>()
  const truncatedPaths = new Set<string>()

  let pdfDoc: PDFDocument
  try {
    pdfDoc = await PDFDocument.load(data, { ignoreEncryption: true, updateMetadata: false })
  } catch {
    return { found: false, locations: [] }
  }

  const catalog = pdfDoc.catalog

  walkActionDict(catalog, 'catalog', locations, 0, truncatedPaths)

  const openAction = catalog.get(PDFName.of('OpenAction'))
  if (openAction instanceof PDFDict) {
    walkActionDict(openAction, 'catalog.OpenAction', locations, 0, truncatedPaths)
  }

  const names = asDict(catalog.get(PDFName.of('Names')))
  if (names) {
    const jsTree = names.get(PDFName.of('JavaScript'))
    if (jsTree) {
      locations.add('catalog.Names.JavaScript')
    }
  }

  const acroForm = asDict(catalog.get(PDFName.of('AcroForm')))
  if (acroForm) {
    walkActionDict(acroForm, 'catalog.AcroForm', locations, 0, truncatedPaths)
  }

  const pages = pdfDoc.getPages()
  pages.forEach((page, i) => {
    const pageDict = page.node
    walkActionDict(pageDict, `pages[${i}]`, locations, 0, truncatedPaths)
    const annots = asArray(pageDict.get(PDFName.of('Annots')))
    if (annots) {
      annots.asArray().forEach((ann, j) => {
        const annDict = ann instanceof PDFDict ? ann : null
        if (annDict) {
          walkActionDict(annDict, `pages[${i}].Annots[${j}]`, locations, 0, truncatedPaths)
        }
      })
    }
  })

  // 把被截断的路径合并到 locations，作为"此处可能还有更深内容"的提示
  for (const p of truncatedPaths) {
    locations.add(`${p} (深度 ${MAX_ACTION_DICT_DEPTH} 截断)`)
  }

  return {
    found: locations.size > 0,
    locations: Array.from(locations),
  }
}
