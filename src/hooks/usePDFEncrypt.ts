import { useCallback } from 'react'
import type { PDFFile, ProgressCallback, EncryptRestrictions } from './types'
import type { CancellationToken } from '@/lib/cancellation'
import { checkResult, validatePdfHeader } from '@/lib/pdf-helpers'

export function usePDFEncrypt(files: PDFFile[]) {
  const encryptFile = useCallback(async (
    fileId: string,
    options: {
      userPassword: string
      ownerPassword?: string
      keyLength?: 40 | 128 | 256
      restrictions?: EncryptRestrictions
    },
    onProgress?: ProgressCallback,
    token?: CancellationToken
  ) => {
    const file = files.find(f => f.id === fileId)
    if (!file) return null
    validatePdfHeader(file.data)

    onProgress?.(10)

    if (!options.userPassword && !options.ownerPassword) {
      throw new Error('请至少设置用户密码或所有者密码')
    }

    token?.throwIfCancelled()
    onProgress?.(30)

    const result = await window.electronAPI.encryptPdf({
      data: new Uint8Array(file.data),
      userPassword: options.userPassword,
      ownerPassword: options.ownerPassword,
      keyLength: options.keyLength || 256,
      restrictions: options.restrictions,
    })

    if (result.error) {
      throw new Error(result.error)
    }

    onProgress?.(60)
    token?.throwIfCancelled()

    const saveResult = await window.electronAPI.saveFile({
      defaultPath: `${file.name.replace(/\.pdf$/i, '')}_encrypted.pdf`,
    })

    if (saveResult.canceled || !saveResult.filePath) return null

    onProgress?.(80)

    const writeResult = await window.electronAPI.writeFile(saveResult.filePath, result.data!)
    checkResult(writeResult, '写入文件失败：')

    onProgress?.(100)
    return saveResult.filePath
  }, [files])

  const decryptFile = useCallback(async (
    fileId: string,
    password: string,
    onProgress?: ProgressCallback,
    token?: CancellationToken
  ) => {
    const file = files.find(f => f.id === fileId)
    if (!file) return null
    validatePdfHeader(file.data)

    onProgress?.(10)

    if (!password) {
      throw new Error('请输入密码')
    }

    token?.throwIfCancelled()
    onProgress?.(30)

    const result = await window.electronAPI.decryptPdf({
      data: new Uint8Array(file.data),
      password,
    })

    if (result.error) {
      throw new Error(result.error)
    }

    onProgress?.(60)
    token?.throwIfCancelled()

    const saveResult = await window.electronAPI.saveFile({
      defaultPath: `${file.name.replace(/\.pdf$/i, '')}_decrypted.pdf`,
    })

    if (saveResult.canceled || !saveResult.filePath) return null

    onProgress?.(80)

    const writeResult = await window.electronAPI.writeFile(saveResult.filePath, result.data!)
    checkResult(writeResult, '写入文件失败：')

    onProgress?.(100)
    return saveResult.filePath
  }, [files])

  return { encryptFile, decryptFile }
}
