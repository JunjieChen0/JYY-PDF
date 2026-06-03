import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import pkg from './package.json'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  base: './',
  define: {
    'import.meta.env.APP_VERSION': JSON.stringify(pkg.version),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('/react/') || id.includes('/react-dom/')) return 'react-vendor'
            if (id.includes('/pdfjs-dist/')) return 'pdfjs'
            if (id.includes('/pdf-lib/')) return 'pdf-lib'
            if (id.includes('/tesseract.js/')) return 'tesseract'
            if (id.includes('/mammoth/')) return 'mammoth'
            if (
              id.includes('/framer-motion/') ||
              id.includes('/lucide-react/') ||
              id.includes('/sonner/') ||
              id.includes('/clsx/') ||
              id.includes('/tailwind-merge/') ||
              id.includes('/class-variance-authority/')
            )
              return 'ui-vendor'
            if (id.includes('/@radix-ui/')) return 'radix-ui'
          }
        },
      },
    },
  },
})
