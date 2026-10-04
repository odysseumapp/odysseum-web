export default defineNuxtConfig({
  compatibilityDate: '2026-09-15',
  ssr: false,
  devtools: { enabled: true },
  modules: ['@nuxt/ui', '@vite-pwa/nuxt'],
  css: ['~/assets/css/main.css'],
  ui: { fonts: false },
  icon: { clientBundle: { scan: true, icons: ['lucide:book-open', 'lucide:users', 'lucide:user-round', 'lucide:map', 'lucide:map-pin', 'lucide:git-branch', 'lucide:route', 'lucide:notebook-pen', 'lucide:sticky-note', 'lucide:folder', 'lucide:circle', 'lucide:circle-check', 'lucide:arrow-left-right', 'lucide:x', 'lucide:file-text', 'lucide:chevron-right', 'lucide:chevron-down', 'lucide:list-checks', 'lucide:highlighter', 'lucide:table', 'lucide:strikethrough', 'lucide:code', 'lucide:paintbrush', 'lucide:swatch-book'] } },
  app: { baseURL: '/webui/', head: { title: 'Odysseum', htmlAttrs: { lang: 'en' } } },
  experimental: { appManifest: false },
  nitro: { devProxy: {
    '/api/hub': { target: `${process.env.ODYSSEUM_API_ORIGIN || 'http://127.0.0.1:5080'}/api/hub`, changeOrigin: true, ws: true },
    '/api': { target: `${process.env.ODYSSEUM_API_ORIGIN || 'http://127.0.0.1:5080'}/api`, changeOrigin: true },
    '/plugins': { target: `${process.env.ODYSSEUM_API_ORIGIN || 'http://127.0.0.1:5080'}/plugins`, changeOrigin: true },
  } },
  typescript: { tsConfig: { compilerOptions: { noUncheckedIndexedAccess: false } } },
  pwa: {
    registerType: 'prompt',
    manifest: {
      name: 'Odysseum', short_name: 'Odysseum', description: 'Projects and documents',
      start_url: '/webui/', scope: '/webui/', display: 'standalone', background_color: '#ffffff', theme_color: '#ffffff',
      icons: [
        { src: '/webui/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/webui/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/webui/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      navigateFallback: '/webui/',
      navigateFallbackDenylist: [/^\/api(?:\/|$)/],
      globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      clientsClaim: true,
      // Plugin client files live outside the app's scope at /plugins/{id}/. The network comes first, so an update shows
      // on the next load; the cached copy keeps the plugin views working when the app starts offline.
      runtimeCaching: [{
        urlPattern: /^https?:\/\/[^/]+\/plugins\//,
        handler: 'NetworkFirst',
        options: { cacheName: 'odysseum-plugins', networkTimeoutSeconds: 3, cacheableResponse: { statuses: [200] } },
      }],
      cleanupOutdatedCaches: true,
    },
  },
})
