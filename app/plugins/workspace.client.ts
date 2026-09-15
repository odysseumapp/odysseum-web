import { createWorkspace } from '~/services/createWorkspace'

export default defineNuxtPlugin(nuxtApp => {
  const workspace = createWorkspace(useRouter())
  nuxtApp.hook('app:mounted', () => { void workspace.start() })
  window.addEventListener('beforeunload', workspace.beforeUnload)
  const dispose = () => {
    workspace.stop()
    window.removeEventListener('beforeunload', workspace.beforeUnload)
  }
  nuxtApp.vueApp.onUnmount(dispose)
  if (import.meta.hot) import.meta.hot.dispose(dispose)
  return { provide: { workspace } }
})
