import { writeFile } from 'node:fs/promises'

// Packaging contract consumed by the independently built C# server.
await writeFile(new URL('../.output/public/webui-release.json', import.meta.url), JSON.stringify({
  version: process.env.WEBUI_VERSION || '0.0.0-local',
  apiVersion: 1,
  basePath: '/webui/',
}, null, 2) + '\n')
