import { usePDFFiles } from './usePDFFiles'
import { usePDFMerge } from './usePDFMerge'
import { usePDFPages } from './usePDFPages'
import { usePDFCompress } from './usePDFCompress'
import { usePDFWatermark } from './usePDFWatermark'
import { usePDFPageNumbers } from './usePDFPageNumbers'
import { usePDFConvert } from './usePDFConvert'
import { usePDFThumbnail } from './usePDFThumbnail'
import { usePDFSignature } from './usePDFSignature'
import { usePDFAnnotation } from './usePDFAnnotation'
import { usePDFOCR } from './usePDFOCR'
import { usePDFEncrypt } from './usePDFEncrypt'

export type { PDFFile, ProgressCallback, WatermarkPosition, PageNumberPosition, Annotation, EncryptRestrictions } from './types'
export type { CancellationToken } from '@/lib/cancellation'

export interface UsePDFReturn {
  files: ReturnType<typeof usePDFFiles>['files']
  addFiles: ReturnType<typeof usePDFFiles>['addFiles']
  removeFile: ReturnType<typeof usePDFFiles>['removeFile']
  reorderFiles: ReturnType<typeof usePDFFiles>['reorderFiles']
  mergeFiles: ReturnType<typeof usePDFMerge>['mergeFiles']
  splitFile: ReturnType<typeof usePDFPages>['splitFile']
  rotatePages: ReturnType<typeof usePDFPages>['rotatePages']
  deletePages: ReturnType<typeof usePDFPages>['deletePages']
  extractPages: ReturnType<typeof usePDFPages>['extractPages']
  compressFile: ReturnType<typeof usePDFCompress>['compressFile']
  addWatermark: ReturnType<typeof usePDFWatermark>['addWatermark']
  addPageNumbers: ReturnType<typeof usePDFPageNumbers>['addPageNumbers']
  convertToImages: ReturnType<typeof usePDFConvert>['convertToImages']
  convertToText: ReturnType<typeof usePDFConvert>['convertToText']
  imagesToPdf: ReturnType<typeof usePDFConvert>['imagesToPdf']
  getPageThumbnail: ReturnType<typeof usePDFThumbnail>['getPageThumbnail']
  addSignature: ReturnType<typeof usePDFSignature>['addSignature']
  addAnnotation: ReturnType<typeof usePDFAnnotation>['addAnnotation']
  ocrPDF: ReturnType<typeof usePDFOCR>['ocrPDF']
  pdfToWord: ReturnType<typeof usePDFConvert>['pdfToWord']
  wordToPdf: ReturnType<typeof usePDFConvert>['wordToPdf']
  encryptFile: ReturnType<typeof usePDFEncrypt>['encryptFile']
  decryptFile: ReturnType<typeof usePDFEncrypt>['decryptFile']
}

export function usePDF(): UsePDFReturn {
  const { files, addFiles, removeFile, reorderFiles } = usePDFFiles()
  const { mergeFiles } = usePDFMerge(files)
  const { splitFile, rotatePages, deletePages, extractPages } = usePDFPages(files)
  const { compressFile } = usePDFCompress(files)
  const { addWatermark } = usePDFWatermark(files)
  const { addPageNumbers } = usePDFPageNumbers(files)
  const { convertToImages, convertToText, imagesToPdf, pdfToWord, wordToPdf } = usePDFConvert(files)
  const { getPageThumbnail } = usePDFThumbnail(files)
  const { addSignature } = usePDFSignature(files)
  const { addAnnotation } = usePDFAnnotation(files)
  const { ocrPDF } = usePDFOCR(files)
  const { encryptFile, decryptFile } = usePDFEncrypt(files)

  return {
    files,
    addFiles,
    removeFile,
    reorderFiles,
    mergeFiles,
    splitFile,
    rotatePages,
    deletePages,
    extractPages,
    compressFile,
    addWatermark,
    addPageNumbers,
    convertToImages,
    convertToText,
    imagesToPdf,
    getPageThumbnail,
    addSignature,
    addAnnotation,
    ocrPDF,
    pdfToWord,
    wordToPdf,
    encryptFile,
    decryptFile,
  }
}
