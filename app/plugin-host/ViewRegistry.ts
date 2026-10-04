import { markRaw, shallowReactive } from 'vue'
import { WRITE_VIEW } from '../models'
import type { ViewRegistration } from './contract'

const NAME = /^[a-z0-9][a-z0-9._-]{0,63}$/

/** The views that plugins add. The editor ('write') is the core's and is never in here. */
export interface IViewRegistry {
  readonly views: readonly ViewRegistration[]
  add(view: ViewRegistration, pluginId: string): void
  find(name: string | null | undefined): ViewRegistration | undefined
}

export class ViewRegistry implements IViewRegistry {
  readonly views = shallowReactive<ViewRegistration[]>([])

  add(view: ViewRegistration, pluginId: string) {
    if (!view || typeof view.name !== 'string' || !NAME.test(view.name)) throw new Error(`Plugin "${pluginId}" registered a view with a name that is not allowed: ${String(view?.name)}`)
    if (view.name === WRITE_VIEW || this.find(view.name)) throw new Error(`Plugin "${pluginId}" registered the view "${view.name}", which already exists.`)
    if (!view.component) throw new Error(`Plugin "${pluginId}" registered the view "${view.name}" without a component.`)
    this.views.push(markRaw({ name: view.name, label: view.label || view.name, icon: markRaw(view.icon), component: markRaw(view.component) }))
  }

  find(name: string | null | undefined) { return name ? this.views.find(view => view.name === name) : undefined }
}
