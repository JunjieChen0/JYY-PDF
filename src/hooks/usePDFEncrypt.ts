import { useCallback, useRef } from 'react'
import type { PDFFile, ProgressCallback, EncryptRestrictions } from './types'
import type { CancellationToken } from '@/lib/cancellation'
import { checkResult, validatePdfHeader, getRequiredPdfData } from '@/lib/pdf-helpers'
import { t, ErrorCode } from '@/lib/i18n'
import * as pdfDataStore from '@/lib/pdf-data-store'

export function usePDFEncrypt(files: PDFFile[]) {
  const filesRef = useRef(files)
  filesRef.current = files

  const encryptFile = useCallback(
    async (
      fileId: string,
      options: {
        userPassword: string
        ownerPassword?: string
        keyLength?: 128 | 256
        restrictions?: EncryptRestrictions
      },
      onProgress?: ProgressCallback,
      token?: CancellationToken,
    ) => {
      const file = filesRef.current.find((f) => f.id === fileId)
      if (!file) return null
      const fileData = getRequiredPdfData(file.id, pdfDataStore)
      validatePdfHeader(fileData)

      if (!options.userPassword && !options.ownerPassword) {
        throw new Error(t(ErrorCode.NEED_AT_LEAST_ONE_PASSWORD))
      }

      onProgress?.(10)
      token?.throwIfCancelled()
      onProgress?.(30)

      const result = await window.electronAPI.encryptPdf({
        data: new Uint8Array(fileData),
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

      if (!result.data) throw new Error(t(ErrorCode.ENCRYPT_RESULT_EMPTY))
      const writeResult = await window.electronAPI.writeFile(saveResult.filePath, result.data)
      checkResult(writeResult, t(ErrorCode.WRITE_FILE_FAILED))

      onProgress?.(100)
      return saveResult.filePath
    },
    [],
  )

  const decryptFile = useCallback(
    async (
      fileId: string,
      password: string,
      onProgress?: ProgressCallback,
      token?: CancellationToken,
    ) => {
      const file = filesRef.current.find((f) => f.id === fileId)
      if (!file) return null
      const fileData = getRequiredPdfData(file.id, pdfDataStore)
      validatePdfHeader(fileData)

      onProgress?.(10)

      if (!password) {
        throw new Error(t(ErrorCode.NEED_PASSWORD))
      }

      token?.throwIfCancelled()
      onProgress?.(30)

      const result = await window.electronAPI.decryptPdf({
        data: new Uint8Array(fileData),
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

      if (!result.data) throw new Error(t(ErrorCode.DECRYPT_RESULT_EMPTY))
      const writeResult = await window.electronAPI.writeFile(saveResult.filePath, result.data)
      checkResult(writeResult, t(ErrorCode.WRITE_FILE_FAILED))

      onProgress?.(100)
      return saveResult.filePath
    },
    [],
  )

  return { encryptFile, decryptFile }
}
