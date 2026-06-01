import { useState, useCallback, useMemo } from 'react'
import type { PDFFile } from '@/hooks/usePDF'

export function useFileSelection(files: PDFFile[], multiple: boolean = true) {
  const [rawSelected, setRawSelected] = useState<Set<string>>(new Set())

  const validIds = useMemo(() => new Set(files.map(f => f.id)), [files])
  const selectedFiles = useMemo(() => {
    const next = new Set<string>()
    for (const id of rawSelected) {
      if (validIds.has(id)) next.add(id)
    }
    return next
  }, [rawSelected, validIds])

  const toggleFile = useCallback((fileId: string) => {
    setRawSelected(prev => {
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
    setRawSelected(prev => {
      if (prev.size === validIds.size) {
        return new Set()
      }
      return new Set(validIds)
    })
  }, [validIds])

  const clearSelection = useCallback(() => {
    setRawSelected(new Set())
  }, [])

  return {
    selectedFiles,
    selectedCount: selectedFiles.size,
    isAllSelected: files.length > 0 && selectedFiles.size === files.length,
    toggleFile,
    toggleAll,
    clearSelection,
    isSelected: (fileId: string) => selectedFiles.has(fileId),
  }
}
