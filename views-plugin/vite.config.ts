import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import icons from 'unplugin-icons/vite'
import * as vueExports from 'vue'

/**
 * Plugins share the web UI's Vue. The host puts its API object, with `vue`, on `globalThis.__odysseum` before it imports
 * the plugin, so every `import ... from 'vue'` (also in compiled templates and icons) resolves to that copy.
 */
function hostVue(): Plugin {
  const id = '\0odysseum-host-vue'
  const names = Object.keys(vueExports).filter(name => name !== 'default' && /^[A-Za-z_$][\w$]*$/.test(name))
  return {
    name: 'odysseum-host-vue',
    enforce: 'pre',
    resolveId: source => source === 'vue' ? id : null,
    load: loaded => loaded === id
      ? `const vue = globalThis.__odysseum.vue;\nexport const { ${names.join(', ')} } = vue;\nexport default vue;\n`
      : null,
  }
}

/** The built files go into the views plugin's wwwroot in the server checkout, which commits them; the server's .NET build
 *  only copies them. The checkout is ODYSSEUM_SERVER_ROOT, or ../odysseum-server next to this one. */
const here = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(here, process.env.ODYSSEUM_SERVER_ROOT ?? '../../odysseum-server')
const outDir = path.join(serverRoot, 'plugins/Odysseum.Plugins.Views/wwwroot')
if (!existsSync(path.join(serverRoot, 'plugins/Odysseum.Plugins.Views/plugin.json')))
  throw new Error(`No server checkout at ${serverRoot}. Set ODYSSEUM_SERVER_ROOT to the odysseum-server folder.`)

export default defineConfig({
  plugins: [hostVue(), vue(), tailwindcss(), icons({ compiler: 'vue3' })],
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  // build.mjs builds each view's entry on its own, so that each JS file has all its code and the host can cache it for
  // offline use by its URL.
  build: { outDir },
})
