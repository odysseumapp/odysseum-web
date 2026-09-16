export default defineNuxtConfig({
  compatibilityDate: '2026-09-15',
  // Documents live in the browser mirror; there is no server-rendered workspace state.
  ssr: false,
  devtools: { enabled: true },
  modules: ['@nuxt/ui', '@vite-pwa/nuxt'],
  css: ['~/assets/css/main.css'],
  ui: { fonts: false },
  // Folder icons are chosen at runtime (see services/FolderStructure.ts), so the scan cannot find them.
  icon: { clientBundle: { scan: true, icons: ['lucide:book-open', 'lucide:book-text', 'lucide:users', 'lucide:user-round', 'lucide:map', 'lucide:map-pin', 'lucide:git-branch', 'lucide:route', 'lucide:notebook-pen', 'lucide:sticky-note', 'lucide:folder', 'lucide:circle', 'lucide:circle-check', 'lucide:arrow-left-right', 'lucide:x', 'lucide:grid-3x3', 'lucide:file-text', 'lucide:chevron-right', 'lucide:chevron-down'] } },
  app: { baseURL: '/webui/', head: { title: 'Odysseum', htmlAttrs: { lang: 'en' } } },
  experimental: { appManifest: false },
  // Only the development server proxies API requests. Release output is plain static files.
  nitro: { devProxy: { '/api': { target: `${process.env.ODYSSEUM_API_ORIGIN || 'http://127.0.0.1:5080'}/api`, changeOrigin: true } } },
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
      cleanupOutdatedCaches: true,
    },
  },
})
