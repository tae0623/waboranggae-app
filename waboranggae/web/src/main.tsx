import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { configureWebRuntime } from './runtime'

configureWebRuntime({
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '',
  mapBaseUrl: import.meta.env.VITE_MAP_BASE_URL || (import.meta.env.DEV ? 'http://127.0.0.1:8788' : window.location.origin),
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
