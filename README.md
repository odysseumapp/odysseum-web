<p align="center">
  <img src="public/favicon.svg" width="96" alt="">
</p>

<h1 align="center">Odysseum Web</h1>

<p align="center">The web UI for <a href="https://github.com/odysseumapp/odysseum">Odysseum</a>, self-hosted writing software for novels and books.</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-315a4b" alt="License: AGPL v3"></a>
  <img src="https://img.shields.io/badge/Nuxt-4-00dc82" alt="Nuxt 4">
  <img src="https://img.shields.io/badge/Node-24-5fa04e" alt="Node 24">
</p>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/odysseumapp/odysseum/main/docs/images/screenshot-dark.png">
  <img src="https://raw.githubusercontent.com/odysseumapp/odysseum/main/docs/images/screenshot-light.png" alt="The Odysseum editor with a sample manuscript open">
</picture>

Built with Nuxt 4, Nuxt UI 4, Tailwind CSS 4 and Tiptap. Issues for both the server and the web UI go to the [main repository](https://github.com/odysseumapp/odysseum/issues).

## Development

Requires Node.js 22.19+ or 24.11+ (Node 24 recommended) and npm. Start the Odysseum server first, then:

```sh
npm ci
cp .env.example .env
npm run dev
```

Open **http://localhost:3000/webui/**. On PowerShell, use `Copy-Item .env.example .env`.

The dev server proxies `/api` and `/plugins` to `ODYSSEUM_API_ORIGIN` (default `http://127.0.0.1:5080`).

## Build

```sh
npm run typecheck
npm run build
npm run package -- webui.zip
```

`npm run build` writes a static site to `.output/public/`. `npm run package` zips it, and the server installs the zip:

```sh
dotnet Odysseum.Server.dll --install-webui webui.zip
```

The server's `./scripts/build.ps1` does all of this for you. `docker build --output ./dist .` builds the same static files in a container.

## Project structure

| Folder | Contents |
|---|---|
| `app/pages/` | The project library and the `/p/[id]` project route |
| `app/components/` | Editor, details panel, collections, timelines and dialogs |
| `app/composables/` | Reactive UI state and document drafts |
| `app/api/` | Typed clients for the server API |
| `app/services/`, `app/storage/`, `app/sync/` | Project sessions, the IndexedDB mirror, queued edits and conflict handling |
| `app/plugin-host/` | Loads plugin views that the server registers |
| `views-plugin/` | Source for the built-in board, outline and grid views |

The app is client rendered (`ssr: false`) because editing works from a local browser copy.

## Offline use

The service worker caches the app shell. IndexedDB keeps projects, documents and pending edits; API responses are never cached by the service worker. Open a project online once before you use it offline. Edits made offline sync when the connection returns, and a conflict asks you which version to keep.

## Tests

The Playwright suite starts a server against an isolated `.test-data/workspace`. Build the server in Release and the UI first:

```sh
dotnet build ../odysseum-server/server/Odysseum.Server/Odysseum.Server.csproj -c Release
npm run build
npx playwright install chromium
npm test
```

The tests look for the server checkout at `../odysseum-server`. Set `ODYSSEUM_SERVER_ROOT` for another location, and `PLAYWRIGHT_CHANNEL=msedge` to use Microsoft Edge.

## License

[GNU AGPL v3](LICENSE)
