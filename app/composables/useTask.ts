/** Present recoverable action failures beside the form that initiated them. */
export function useTask() {
  const busy = ref(false)
  const error = ref('')
  async function run(action: () => Promise<unknown>) {
    if (busy.value) return
    busy.value = true
    error.value = ''
    try { await action() }
    catch (ex) { error.value = ex instanceof Error ? ex.message : 'The action could not be completed.' }
    finally { busy.value = false }
  }
  return { busy, error, run }
}
