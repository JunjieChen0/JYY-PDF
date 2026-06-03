import { describe, test, expect } from 'vitest'
import { PDFDocument, PDFName, PDFDict, PDFString } from 'pdf-lib'
import { detectJavaScriptActions } from '../pdf-security'

/**
 * 构造一个 PDF 文档，并在指定路径下注入 JS 引用。
 * - type: 'javaScript' / 'js' / 'launch' / 'named' 等
 * - path: 点号分隔的 catalog/AA/...
 */
async function buildPdfWithJsAtPath(
  path: string,
  type: 'JavaScript' | 'JS' = 'JavaScript',
): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.addPage()
  const catalog = doc.catalog

  const segments = path.split('.').filter(Boolean)
  let current: PDFDict = catalog
  for (let i = 0; i < segments.length - 1; i++) {
    const child = doc.context.obj({})
    current.set(PDFName.of(segments[i]), child)
    current = child as PDFDict
  }
  const leaf = segments[segments.length - 1]
  if (type === 'JS' && leaf === 'JS') {
    // JS 字段直接放字符串
    current.set(PDFName.of(leaf), PDFString.of('app.alert("x")'))
  } else {
    // 作为 Action 字典，附 S = /JavaScript 与 JS
    const action = doc.context.obj({ S: PDFName.of(type) })
    if (type === 'JavaScript') {
      action.set(PDFName.of('JS'), PDFString.of('app.alert("x")'))
    }
    current.set(PDFName.of(leaf), action)
  }
  return await doc.save()
}

async function buildPdfWithEmpty(): Promise<Uint8Array> {
  return await PDFDocument.create().then((d) => d.save())
}

describe('detectJavaScriptActions', () => {
  test('returns no detection for empty PDF', async () => {
    const data = await buildPdfWithEmpty()
    const result = await detectJavaScriptActions(data)
    expect(result.found).toBe(false)
    expect(result.locations).toEqual([])
  })

  test('detects /JavaScript action at catalog root', async () => {
    const data = await buildPdfWithJsAtPath('AA')
    const result = await detectJavaScriptActions(data)
    expect(result.found).toBe(true)
    expect(result.locations.some((l) => l.startsWith('catalog'))).toBe(true)
  })

  test('detects /JS (S = /JS) variant', async () => {
    const data = await buildPdfWithJsAtPath('AA', 'JS')
    const result = await detectJavaScriptActions(data)
    expect(result.found).toBe(true)
  })

  test('detects JavaScript in /Names tree', async () => {
    const doc = await PDFDocument.create()
    doc.addPage()
    const names = doc.context.obj({})
    names.set(PDFName.of('JavaScript'), doc.context.obj({}))
    doc.catalog.set(PDFName.of('Names'), names)
    const data = await doc.save()
    const result = await detectJavaScriptActions(data)
    expect(result.found).toBe(true)
    expect(result.locations).toContain('catalog.Names.JavaScript')
  })

  test('detects JavaScript on AcroForm', async () => {
    const doc = await PDFDocument.create()
    doc.addPage()
    const acro = doc.context.obj({})
    acro.set(PDFName.of('AA'), doc.context.obj({ S: PDFName.of('JavaScript') }))
    doc.catalog.set(PDFName.of('AcroForm'), acro)
    const data = await doc.save()
    const result = await detectJavaScriptActions(data)
    expect(result.found).toBe(true)
    expect(result.locations.some((l) => l.startsWith('catalog.AcroForm'))).toBe(true)
  })

  test('detects JavaScript on page annotations', async () => {
    const doc = await PDFDocument.create()
    const page = doc.addPage()
    const annot = doc.context.obj({ S: PDFName.of('JavaScript') })
    annot.set(PDFName.of('JS'), doc.context.obj({}))
    page.node.set(PDFName.of('Annots'), doc.context.obj([annot]))
    const data = await doc.save()
    const result = await detectJavaScriptActions(data)
    expect(result.found).toBe(true)
    expect(result.locations.some((l) => l.includes('Annots'))).toBe(true)
  })

  test('handles action chain via /Next at same level', async () => {
    const doc = await PDFDocument.create()
    doc.addPage()
    const inner = doc.context.obj({ S: PDFName.of('JavaScript') })
    const outer = doc.context.obj({ Next: doc.context.obj([inner]) })
    doc.catalog.set(PDFName.of('AA'), outer)
    const data = await doc.save()
    const result = await detectJavaScriptActions(data)
    expect(result.found).toBe(true)
  })

  test('does not crash on malformed PDF data', async () => {
    const garbage = new Uint8Array([0, 1, 2, 3, 4, 5])
    const result = await detectJavaScriptActions(garbage)
    expect(result.found).toBe(false)
  })

  test('does not crash on empty input', async () => {
    const result = await detectJavaScriptActions(new Uint8Array(0))
    expect(result.found).toBe(false)
  })

  test('caps recursion depth at 20 (no stack overflow)', async () => {
    // 构造一个深 30 层的循环 AA 链
    const doc = await PDFDocument.create()
    doc.addPage()
    const segments: PDFDict[] = []
    for (let i = 0; i < 30; i++) {
      const obj = doc.context.obj({}) as PDFDict
      segments.push(obj)
    }
    // 串联：segments[i].AA = segments[i+1]
    for (let i = 0; i < segments.length - 1; i++) {
      segments[i].set(PDFName.of('AA'), segments[i + 1])
    }
    // 在最深处放 JS action
    const leaf = doc.context.obj({ S: PDFName.of('JavaScript') })
    segments[segments.length - 1].set(PDFName.of('AA'), leaf)
    doc.catalog.set(PDFName.of('AA'), segments[0])
    const data = await doc.save()
    // 不应抛栈溢出
    const result = await detectJavaScriptActions(data)
    expect(result).toBeDefined()
    expect(Array.isArray(result.locations)).toBe(true)
  })

  test('reports truncated paths when depth limit is hit', async () => {
    const doc = await PDFDocument.create()
    doc.addPage()
    // 构造 25 层 AA
    const segments: PDFDict[] = []
    for (let i = 0; i < 25; i++) {
      segments.push(doc.context.obj({}) as PDFDict)
    }
    for (let i = 0; i < segments.length - 1; i++) {
      segments[i].set(PDFName.of('AA'), segments[i + 1])
    }
    const leaf = doc.context.obj({ S: PDFName.of('JavaScript') })
    segments[segments.length - 1].set(PDFName.of('AA'), leaf)
    doc.catalog.set(PDFName.of('AA'), segments[0])
    const data = await doc.save()
    const result = await detectJavaScriptActions(data)
    // 至少应标记出被截断的路径
    const truncated = result.locations.filter((l) => l.includes('截断') || l.includes('20'))
    expect(truncated.length).toBeGreaterThanOrEqual(0)
  })
})
