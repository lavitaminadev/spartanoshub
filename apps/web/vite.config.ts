import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const PRODUCTION_API_URL = 'https://refugio.espartanos.cl/api'
const PRODUCTION_APP_URL = 'https://cuartel.espartanos.cl'
const PRODUCTION_OXC = {
  jsx: {
    runtime: 'automatic',
    importSource: 'react',
    development: false,
    refresh: false,
  },
} as any

export default defineConfig(({ command }) => {
  const isBuild = command === 'build'

  if (isBuild) {
    process.env.NODE_ENV = 'production'
    process.env.VITE_API_URL = process.env.VITE_API_URL || PRODUCTION_API_URL
    process.env.VITE_APP_PUBLIC_URL = process.env.VITE_APP_PUBLIC_URL || PRODUCTION_APP_URL
  }

  return {
    envDir: '../../',
    // `@espartanos/shared` se emite en CommonJS para que la API lo consuma. El pre-bundling es
    // necesario para que Vite resuelva sus exportaciones nombradas en tiempo de ejecucion.
    optimizeDeps: { include: ['@espartanos/shared'] },
    plugins: [react(), VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'icon-192x192.png',
        'icon-512x512.png',
        'icon-maskable-512x512.png',
        'brand/espartanos-helmet.png',
        'brand/plus-jakarta-sans.woff2',
        'screenshots/pwa-wide.png',
        'screenshots/pwa-mobile.png',
      ],
      manifest: {
        id: '/',
        name: 'Espartanos',
        short_name: 'Espartanos',
        description: 'Sistema operativo del Cuartel Espartano',
        lang: 'es',
        theme_color: '#173f35',
        background_color: '#f3f5ef',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone'],
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        screenshots: [
          {
            src: '/screenshots/pwa-wide.png',
            sizes: '1280x720',
            type: 'image/png',
            form_factor: 'wide',
            label: 'Panel operativo de Espartanos',
          },
          {
            src: '/screenshots/pwa-mobile.png',
            sizes: '390x844',
            type: 'image/png',
            label: 'Espartanos en movil',
          },
        ],
      },
    })],
    define: isBuild ? {
      'process.env.NODE_ENV': JSON.stringify('production'),
      'import.meta.env.DEV': 'false',
      'import.meta.env.PROD': 'true',
      'import.meta.env.VITE_API_URL': JSON.stringify(process.env.VITE_API_URL),
      'import.meta.env.VITE_APP_PUBLIC_URL': JSON.stringify(process.env.VITE_APP_PUBLIC_URL),
    } : undefined,
    oxc: isBuild ? PRODUCTION_OXC : undefined,
    build: {
      // The build script cleans `dist/assets` before Vite runs. Keep `emptyOutDir`
      // disabled so root deployment files such as `.htaccess` survive the build.
      emptyOutDir: false,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) return 'vendor-react'
            if (id.includes('node_modules/@tanstack/react-query')) return 'vendor-query'
            if (id.includes('node_modules/react-router')) return 'vendor-router'
            if (id.includes('node_modules/recharts') || id.includes('node_modules/d3')) return 'vendor-charts'
            if (id.includes('node_modules')) return 'vendor'
            if (id.includes('/src/core/api') || id.includes('/src/core/auth') || id.includes('/packages/shared')) return 'vendor'
          },
        },
      },
    },
    server: {
      port: 5173,
      proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true } },
    },
  }
})
