import React from 'react'
import ReactDOM from 'react-dom/client'
import { ensureElectronAPI } from './lib/electron-api'
import App from './App.tsx'
import './index.css'

ensureElectronAPI()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
