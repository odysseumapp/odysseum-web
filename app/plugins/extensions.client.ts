import * as vue from 'vue'
import { PLUGIN_API_VERSION } from '~/plugin-host/contract'
import { componentKit } from '~/plugin-host/kit'
import { PluginLoader } from '~/plugin-host/PluginLoader'
import { ViewRegistry } from '~/plugin-host/ViewRegistry'

/** Loads the client modules of the server's enabled plugins once the workspace is unlocked. */
export default defineNuxtPlugin({
  name: 'odysseum-extensions',
  dependsOn: ['odysseum-workspace'],
  setup() {
    const workspace = useWorkspace()
    const views = new ViewRegistry()
    const loader = new PluginLoader(workspace.api, async () => (await workspace.services()).mirror, views,
      { apiVersion: PLUGIN_API_VERSION, vue, ui: componentKit })
    vue.watch(workspace.authenticated, unlocked => { if (unlocked) void loader.load() }, { immediate: true })
    return { provide: { views } }
  },
})
