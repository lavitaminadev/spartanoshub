// Primero de todo: en modo visual instala el adaptador de axios antes de que `App` arrastre
// a `core/api` y construya su instancia. Sin `VITE_VISUAL=1` este import no hace nada.
import './dev/visual-mode'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

/*
 * PWA pausada por defecto en deploy. Para reactivarla:
 *   VITE_PWA_ENABLED=1  (en .env, o en el build: VITE_PWA_ENABLED=1 npm run build)
 *
 * Mientras está pausada se des-registra cualquier service worker que los navegadores
 * de los usuarios ya tengan activo, así deja de cachear de inmediato.
 */
const PWA_ENABLED = import.meta.env.VITE_PWA_ENABLED === '1'

if (PWA_ENABLED) {
  /*
   * El service worker usa `registerType: 'prompt'` (vite.config.ts): cuando hay una versión
   * nueva, NO recarga la página. Muestra un banner con botón "Actualizar" para que el usuario
   * decida cuándo recargar, sin perder el estado de un formulario a medio completar.
   */
  registerSW({
  immediate: false,
  onNeedRefresh: () => {
    const banner = document.createElement('div')
    banner.style.cssText = [
      'position:fixed', 'bottom:18px', 'left:50%', 'transform:translateX(-50%)',
      'z-index:99999', 'display:flex', 'align-items:center', 'gap:12px',
      'padding:12px 18px', 'border-radius:14px', 'background:#151317', 'color:#fff',
      'font-size:13px', 'font-family:inherit', 'box-shadow:0 18px 50px rgba(0,0,0,.28)',
      'max-width:min(480px,92vw)',
    ].join(';')
    banner.innerHTML = '<span>Nueva versión disponible.</span>'
    const button = document.createElement('button')
    button.textContent = 'Actualizar'
    button.style.cssText = 'padding:6px 14px;border:0;border-radius:8px;background:#0fb9b1;color:#fff;font-weight:600;cursor:pointer;font-size:13px'
    button.onclick = () => { window.location.reload() }
    const dismiss = document.createElement('button')
    dismiss.textContent = 'Después'
    dismiss.style.cssText = 'padding:6px 10px;border:0;border-radius:8px;background:transparent;color:#b8b2b8;cursor:pointer;font-size:12px'
    dismiss.onclick = () => banner.remove()
    banner.append(button, dismiss)
    document.body.appendChild(banner)
    window.setTimeout(() => banner.remove(), 60_000)
  },
})
} else if ('serviceWorker' in navigator) {
  // PWA pausada: des-registra cualquier SW que los usuarios ya tengan instalado.
  navigator.serviceWorker.getRegistrations()
    .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
    .catch(() => { /* sin SW, sin problema */ })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
