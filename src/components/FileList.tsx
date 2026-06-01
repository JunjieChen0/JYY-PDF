import { X, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { PageThumbnail } from '@/components/PageThumbnail'
import { formatFileSize } from '@/lib/utils'
import type { PDFFile } from '@/hooks/usePDF'

interface FileListProps {
  files: PDFFile[]
  onRemove: (id: string) => void
  onReorder: (fromIndex: number, toIndex: number) => void
  getThumbnail?: (fileId: string, pageIndex: number, maxWidth?: number) => Promise<string | null>
}

export function FileList({ files, onRemove, onReorder, getThumbnail }: FileListProps) {
  const handleDragStart = (index: number) => {
    return (e: React.DragEvent<HTMLDivElement>) => {
      e.dataTransfer.setData('text/plain', index.toString())
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  }

  const handleDrop = (toIndex: number) => {
    return (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      const fromIndex = parseInt(e.dataTransfer.getData('text/plain'))
      if (fromIndex !== toIndex) {
        onReorder(fromIndex, toIndex)
      }
    }
  }

  if (files.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <p>暂无文件，请添加 PDF 文件</p>
      </div>
    )
  }

  return (
    <ScrollArea className="flex-1">
      <div>
        {files.map((file, index) => (
          <div
            key={file.id}
            draggable
            onDragStart={handleDragStart(index)}
            onDragOver={handleDragOver}
            onDrop={handleDrop(index)}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 group cursor-move transition-colors"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            {getThumbnail ? (
              <PageThumbnail
                fileId={file.id}
                pageIndex={0}
                maxWidth={36}
                getThumbnail={getThumbnail}
                className="shrink-0"
              />
            ) : null}
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{file.name}</p>
              <p className="text-sm text-muted-foreground">
                {formatFileSize(file.size)} · {file.pageCount} 页
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => onRemove(file.id)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}