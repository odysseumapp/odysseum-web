import { defineAsyncComponent, h, markRaw, type Component } from 'vue'
import type { IOdysseumApi } from '../api/IOdysseumApi'
import type { PluginInfo, PluginViewInfo } from '../models'
import type { IMirrorRepository } from '../storage'
import type { OdysseumPluginApi, ViewModule } from './contract'
import type { IViewRegistry } from './ViewRegistry'

declare global {
  // The plugin builds resolve `vue` from here, so the global must exist before the first plugin import.
  var __odysseum: OdysseumPluginApi | undefined
}

export interface IPluginLoader {
  /** Reads the plugin list (the saved one when offline) and adds the views of each enabled plugin once. A view's client
   *  entry loads when the view first renders; the files of every view are also read once, so that they work offline. */
  load(): Promise<void>
}

/** Shown in place of a view whose client entry did not load. */
const LoadFailed = markRaw({ render: () => h('p', { class: 'text-error py-12' }, 'This view could not be loaded.') })

export class PluginLoader implements IPluginLoader {
  private loaded = new Set<string>()
  private running: Promise<void> | undefined

  constructor(
    private readonly api: IOdysseumApi,
    private readonly mirror: () => Promise<IMirrorRepository>,
    private readonly views: IViewRegistry,
    private readonly host: OdysseumPluginApi,
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
      if (plugin.status !== 'enabled' || this.loaded.has(plugin.id)) continue
      this.loaded.add(plugin.id)
      for (const view of plugin.views ?? []) {
        try { this.views.add({ name: view.name, label: view.label, icon: view.icon, component: this.component(plugin.id, view) }, plugin.id) }
        catch (ex) { console.error(`Odysseum could not add a view of the plugin "${plugin.id}"; the app goes on without it.`, ex) }
        cacheForOffline(clientFiles(view))
      }
    }
  }

  private component(pluginId: string, view: PluginViewInfo): Component {
    return defineAsyncComponent({
      loader: () => this.import(view.clientEntry).catch((ex: unknown) => {
        console.error(`Odysseum could not load the view "${view.name}" of the plugin "${pluginId}".`, ex)
        throw ex
      }),
      errorComponent: LoadFailed,
    })
  }

  private async import(entry: string): Promise<Component> {
    globalThis.__odysseum = this.host
    await addStylesheet(stylesheetOf(entry))
    const module = await import(/* @vite-ignore */ entry) as Partial<ViewModule>
    if (!module.default || !['object', 'function'].includes(typeof module.default)) throw new Error('The module has no default export with the view component.')
    return module.default
  }
}

/** The view's CSS sits next to its entry, with the same name. */
const stylesheetOf = (entry: string) => entry.replace(/\.m?js(\?.*)?$/, '.css')

const clientFiles = (view: PluginViewInfo) => [view.clientEntry, stylesheetOf(view.clientEntry), ...view.icon ? [view.icon] : []]

/** Reads the files through the service worker, which caches them, so that a view never selected online still opens
 *  offline. On the first visit the worker does not control the page yet; then the files are read once it takes over. */
function cacheForOffline(urls: string[]) {
  const worker = navigator.serviceWorker
  if (!worker) return
  const read = () => { for (const url of urls) void fetch(url, { credentials: 'same-origin' }).catch(() => undefined) }
  if (worker.controller) read()
  else worker.addEventListener('controllerchange', read, { once: true })
}

/** The view's own CSS, if it has one. A GET (not HEAD) so that the service worker caches it for offline starts. */
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
