import React, { Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { ensureElectronAPI } from './lib/electron-api'
import './i18n'
import App from './App.tsx'
import './index.css'

ensureElectronAPI()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Suspense fallback={<div />}>
      <App />
    </Suspense>
  </React.StrictMode>,
)
