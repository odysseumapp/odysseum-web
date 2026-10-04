import type { ComponentKit, OdysseumPluginApi } from './odysseum'

declare global {
  var __odysseum: OdysseumPluginApi | undefined
}

/** The host's shared components. The host sets its API before it imports a view, so it is always there. */
export function ui(): ComponentKit {
  const api = globalThis.__odysseum
  if (!api) throw new Error('The Odysseum host API is missing.')
  return api.ui
}
