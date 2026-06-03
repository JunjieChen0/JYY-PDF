import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Upload, FileText, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileDropZoneProps {
  onFiles: (files: File[]) => void
  className?: string
  disabled?: boolean
}

export function FileDropZone({ onFiles, className, disabled = false }: FileDropZoneProps) {
  const { t } = useTranslation()
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
      aria-label={t('app.dropzone.ariaLabel')}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      className={cn(
        'dropzone',
        isDragActive && 'active',
        disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
        className,
      )}
    >
      <input {...getInputProps()} aria-label={t('app.dropzone.ariaLabel')} disabled={disabled} />
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
        <p className="text-lg font-medium mb-2 text-muted-foreground">{t('app.dropzone.processing')}</p>
      ) : isDragActive ? (
        <p className="text-lg font-medium text-primary">{t('app.dropzone.dragActive')}</p>
      ) : (
        <>
          <p className="text-lg font-medium mb-2">{t('app.dropzone.dragOrClick')}</p>
          <p className="text-sm text-muted-foreground">{t('app.dropzone.hint')}</p>
        </>
      )}
    </div>
  )
}
