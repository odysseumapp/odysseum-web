/** Keep cookies and live events on the UI's origin while the API runs separately. */
export default defineEventHandler(event => {
  const origin = useRuntimeConfig(event).apiOrigin.replace(/\/$/, '')
  const url = getRequestURL(event)
  return proxyRequest(event, `${origin}${url.pathname}${url.search}`)
})
