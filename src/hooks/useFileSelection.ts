import { useState, useCallback, useEffect } from 'react'
import type { PDFFile } from '@/hooks/usePDF'

export function useFileSelection(files: PDFFile[], multiple: boolean = true) {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())

  useEffect(() => {
    setSelectedFiles(prev => {
      const validIds = new Set(files.map(f => f.id))
      const next = new Set([...prev].filter(id => validIds.has(id)))
      if (next.size === prev.size) return prev
      return next
    })
  }, [files])

  const toggleFile = useCallback((fileId: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev)
      if (next.has(fileId)) {
        next.delete(fileId)
      } else {
        if (!multiple) {
          next.clear()
        }
        next.add(fileId)
      }
      return next
    })
  }, [multiple])

  const toggleAll = useCallback(() => {
    setSelectedFiles(prev => {
      if (prev.size === files.length) {
        return new Set()
      }
      return new Set(files.map(f => f.id))
    })
  }, [files])

  const clearSelection = useCallback(() => {
    setSelectedFiles(new Set())
  }, [])

  const isSelected = useCallback((fileId: string) => {
    return selectedFiles.has(fileId)
  }, [selectedFiles])

  return {
    selectedFiles,
    selectedCount: selectedFiles.size,
    isAllSelected: files.length > 0 && selectedFiles.size === files.length,
    toggleFile,
    toggleAll,
    clearSelection,
    isSelected,
  }
}
