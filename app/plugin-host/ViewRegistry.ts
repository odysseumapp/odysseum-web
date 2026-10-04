import { markRaw, shallowReactive, type Component } from 'vue'
import { WRITE_VIEW } from '../models'

const NAME = /^[a-z0-9][a-z0-9._-]{0,63}$/

/** A view that a plugin's C# code registered. `component` loads the plugin's client entry the first time it renders. */
export interface RegisteredView {
  /** Lowercase letters, digits, '.', '-' and '_', starting with a letter or digit, at most 64 characters. 'write' is the editor's. */
  name: string
  label: string
  /** The URL of an SVG file, or null. */
  icon: string | null
  component: Component
}

/** The views that plugins add. The editor ('write') is the core's and is never in here. */
export interface IViewRegistry {
  readonly views: readonly RegisteredView[]
  add(view: RegisteredView, pluginId: string): void
  find(name: string | null | undefined): RegisteredView | undefined
}

export class ViewRegistry implements IViewRegistry {
  readonly views = shallowReactive<RegisteredView[]>([])

  add(view: RegisteredView, pluginId: string) {
    if (!view || typeof view.name !== 'string' || !NAME.test(view.name)) throw new Error(`Plugin "${pluginId}" registered a view with a name that is not allowed: ${String(view?.name)}`)
    if (view.name === WRITE_VIEW || this.find(view.name)) throw new Error(`Plugin "${pluginId}" registered the view "${view.name}", which already exists.`)
    this.views.push(markRaw({ name: view.name, label: view.label || view.name, icon: view.icon, component: markRaw(view.component) }))
  }

  find(name: string | null | undefined) { return name ? this.views.find(view => view.name === name) : undefined }
}
