// Primero de todo: en modo visual instala el adaptador de axios antes de que `App` arrastre
// a `core/api` y construya su instancia. Sin `VITE_VISUAL=1` este import no hace nada.
import './dev/visual-mode'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import { mantenerAlDia } from './core/actualizacion-app'

/*
 * Que una recarga traiga de verdad la versión nueva.
 *
 * `registerSW` solo instala el service worker. Quien pregunta si hay una versión nueva —y quien
 * recarga cuando entra— es `mantenerAlDia`: sin eso, una pestaña abierta desde hace horas
 * seguía sirviendo la copia guardada contra un servidor ya actualizado.
 */
registerSW({
  immediate: true,
  onRegisteredSW: (_url, registro) => mantenerAlDia(registro),
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
