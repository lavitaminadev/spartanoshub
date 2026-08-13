// Primero de todo: en modo visual instala el adaptador de axios antes de que `App` arrastre
// a `core/api` y construya su instancia. Sin `VITE_VISUAL=1` este import no hace nada.
import './dev/visual-mode'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

// Reload once when a newly deployed service worker takes control.
registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
