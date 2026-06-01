import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion } from 'framer-motion'
import { Upload, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileDropZoneProps {
  onFiles: (files: File[]) => void
  className?: string
}

export function FileDropZone({ onFiles, className }: FileDropZoneProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    onFiles(acceptedFiles)
  }, [onFiles])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf']
    },
    onDrop,
  })

  return (
    <div
      {...getRootProps()}
      className={cn(
        'dropzone',
        isDragActive && 'active',
        className
      )}
    >
      <input {...getInputProps()} />
      <motion.div
        initial={false}
        animate={{ scale: isDragActive ? 1.1 : 1 }}
        transition={{ duration: 0.2 }}
      >
        {isDragActive ? (
          <FileText className="mx-auto h-12 w-12 text-primary mb-4" />
        ) : (
          <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        )}
      </motion.div>
      {isDragActive ? (
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