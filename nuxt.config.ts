export default defineNuxtConfig({
  compatibilityDate: '2026-09-15',
  // Documents live in the browser mirror; there is no server-rendered workspace state.
  ssr: false,
  devtools: { enabled: true },
  modules: ['@nuxt/ui', '@vite-pwa/nuxt'],
  css: ['~/assets/css/main.css'],
  ui: { fonts: false },
  icon: { clientBundle: { scan: true } },
  runtimeConfig: { apiOrigin: 'http://127.0.0.1:5080' },
  app: { head: { title: 'Odysseum', htmlAttrs: { lang: 'en' } } },
  experimental: { appManifest: false },
  nitro: { prerender: { routes: ['/'] } },
  typescript: { tsConfig: { compilerOptions: { noUncheckedIndexedAccess: false } } },
  pwa: {
    registerType: 'prompt',
    manifest: {
      name: 'Odysseum', short_name: 'Odysseum', description: 'Projects and documents',
      start_url: '/', display: 'standalone', background_color: '#ffffff', theme_color: '#ffffff',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      navigateFallback: '/',
      navigateFallbackDenylist: [/^\/api(?:\/|$)/],
      globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      clientsClaim: true,
      cleanupOutdatedCaches: true,
    },
  },
})
