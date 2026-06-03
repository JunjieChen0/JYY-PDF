import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion } from 'framer-motion'
import { Upload, FileText, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileDropZoneProps {
  onFiles: (files: File[]) => void
  className?: string
  disabled?: boolean
}

export function FileDropZone({ onFiles, className, disabled = false }: FileDropZoneProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (disabled) return
      onFiles(acceptedFiles)
    },
    [onFiles, disabled],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
    },
    onDrop,
    disabled,
    noClick: disabled,
    noKeyboard: disabled,
    noDrag: disabled,
  })

  return (
    <div
      {...getRootProps()}
      role="button"
      aria-label="拖拽或点击添加PDF文件"
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      className={cn(
        'dropzone',
        isDragActive && 'active',
        disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
        className,
      )}
    >
      <input {...getInputProps()} aria-label="选择PDF文件" disabled={disabled} />
      <motion.div
        initial={false}
        animate={{ scale: isDragActive ? 1.1 : 1 }}
        transition={{ duration: 0.2 }}
      >
        {disabled ? (
          <Loader2 className="mx-auto h-12 w-12 text-muted-foreground mb-4 animate-spin" />
        ) : isDragActive ? (
          <FileText className="mx-auto h-12 w-12 text-primary mb-4" />
        ) : (
          <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        )}
      </motion.div>
      {disabled ? (
        <p className="text-lg font-medium mb-2 text-muted-foreground">处理中，无法添加文件</p>
      ) : isDragActive ? (
        <p className="text-lg font-medium text-primary">松开鼠标添加文件</p>
      ) : (
        <>
          <p className="text-lg font-medium mb-2">拖拽 PDF 文件到这里</p>
          <p className="text-sm text-muted-foreground">或点击选择文件</p>
        </>
      )}
    </div>
  )
}
