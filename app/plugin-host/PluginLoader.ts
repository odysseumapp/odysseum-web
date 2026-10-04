import type { IOdysseumApi } from '../api/IOdysseumApi'
import type { PluginInfo } from '../models'
import type { IMirrorRepository } from '../storage'
import type { OdysseumPluginApi, PluginRegister, ViewRegistration } from './contract'
import type { IViewRegistry } from './ViewRegistry'

declare global {
  // The plugin builds resolve `vue` from here, so the global must exist before the first plugin import.
  var __odysseum: OdysseumPluginApi | undefined
}

export interface IPluginLoader {
  /** Reads the plugin list (the saved one when offline) and imports each enabled plugin once. Failures are logged and skipped. */
  load(): Promise<void>
}

export class PluginLoader implements IPluginLoader {
  private loaded = new Set<string>()
  private running: Promise<void> | undefined

  constructor(
    private readonly api: IOdysseumApi,
    private readonly mirror: () => Promise<IMirrorRepository>,
    private readonly views: IViewRegistry,
    private readonly host: Omit<OdysseumPluginApi, 'registerView'>,
  ) {}

  load() { return this.running ??= this.run().finally(() => { this.running = undefined }) }

  private async list(): Promise<PluginInfo[]> {
    const mirror = await this.mirror()
    try {
      const plugins = await this.api.listPlugins()
      await mirror.putPlugins(plugins)
      return plugins
    } catch (ex) {
      const saved = await mirror.getPlugins()
      if (saved) return saved
      console.error('Odysseum could not read the plugin list.', ex)
      return []
    }
  }

  private async run() {
    for (const plugin of await this.list()) {
      if (plugin.status !== 'enabled' || !plugin.clientEntry || this.loaded.has(plugin.id)) continue
      this.loaded.add(plugin.id)
      try { await this.import(plugin, plugin.clientEntry) }
      catch (ex) { console.error(`Odysseum could not load the plugin "${plugin.id}"; the app goes on without it.`, ex) }
    }
  }

  private async import(plugin: PluginInfo, entry: string) {
    const api: OdysseumPluginApi = {
      ...this.host,
      registerView: (view: ViewRegistration) => this.views.add(view, plugin.id),
    }
    globalThis.__odysseum = api
    await addStylesheet(entry.replace(/\.m?js(\?.*)?$/, '.css'))
    const module = await import(/* @vite-ignore */ entry) as { default?: PluginRegister }
    if (typeof module.default !== 'function') throw new Error('The module has no default export register(odysseum).')
    await module.default(api)
    cacheForOffline(entry)
  }
}

/** On the first visit the plugin loads before the service worker controls the page, so the worker has not cached it.
 *  Reads the files again through the worker once it takes over, so that the next start works offline. */
function cacheForOffline(entry: string) {
  const worker = navigator.serviceWorker
  if (!worker) return
  const urls = [entry, entry.replace(/\.m?js(\?.*)?$/, '.css')]
  const read = () => { for (const url of urls) void fetch(url, { credentials: 'same-origin' }).catch(() => undefined) }
  if (worker.controller) return
  worker.addEventListener('controllerchange', read, { once: true })
}

/** The plugin's own CSS, next to its entry, if it has one. A GET (not HEAD) so that the service worker caches it for offline starts. */
async function addStylesheet(href: string) {
  if (document.querySelector(`link[data-odysseum-plugin="${CSS.escape(href)}"]`)) return
  try { if (!(await fetch(href, { credentials: 'same-origin' })).ok) return } catch { return }
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = href
  link.dataset.odysseumPlugin = href
  link.onerror = () => link.remove()
  document.head.appendChild(link)
}
