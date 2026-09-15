# Odysseum Web

The Vue 3 frontend for [Odysseum](https://github.com/odysseumapp/odysseum), built with Nuxt 4, Nuxt UI 4, and Tailwind CSS 4. Uses the standard Nuxt UI theme, with light and dark modes.

## Development

Requires Node.js 22.19+ or 24.11+ (Node 24 LTS recommended) and npm. Run the .NET API from the Odysseum repository first, then:

```sh
npm ci
cp .env.example .env
npm run dev
```

Open **http://localhost:3000**. On PowerShell, use `Copy-Item .env.example .env`.

`NUXT_API_ORIGIN` defaults to `http://127.0.0.1:5080`. Set it to the API server's origin. Nuxt's server proxies `/api/**`, including authentication cookies and streamed project events, so the browser uses one origin. The .NET server owns the API, files, manifests and history; Nuxt owns the frontend and its proxy.

## Build and run

```sh
npm run typecheck
npm run build
npm start
```

The build produces a standalone Node server in `.output/`. Set `NUXT_API_ORIGIN`, `HOST` and `PORT` in the production process environment; the built server does not load `.env` automatically. `npm run preview` is available for local previews.

```sh
docker build -t odysseum-web .
docker run --rm -p 3000:3000 -e NUXT_API_ORIGIN=http://host.docker.internal:5080 odysseum-web
```

Docker Desktop provides `host.docker.internal`; on Linux use the API's reachable hostname or run the two services on the same Docker network. The server repository includes Compose configuration for both services. Use HTTPS when exposing the app remotely.

## Project structure

- `app/pages/`: the project library and `/p/[slug]` project route.
- `app/components/`: Vue components for editing, details, collections, arc timelines and dialogs.
- `app/composables/`: reactive UI state and document detail drafts.
- `app/plugins/workspace.client.ts`: one workspace session shared across routes.
- `app/api/`: typed clients for the .NET API.
- `app/services/`, `app/storage/`, `app/sync/`: project sessions, IndexedDB mirrors, queued operations, revision checks and conflict handling.
- `server/api/`: the API proxy; `server/routes/health.get.ts` checks the Nuxt process.

The workspace is client rendered (`ssr: false`) because editing relies on the local browser mirror. Nuxt still provides routing, component imports, configuration, build tooling and the server proxy. CodeMirror handles Markdown editing; Nuxt UI supplies the application controls.

## Documents and offline use

Manuscript, Notes, Characters, Locations, Arcs and Beats retain the server's existing file format. Arcs contain only Beat documents. Each arc keeps independent beat positions, and a beat may appear on several arcs.

The production service worker caches the application shell and assets. IndexedDB stores projects, documents and pending edits separately; API responses are never service-worker cached. Open a project online before using it offline. New documents, projects and metadata changes queue locally and sync when connectivity returns. Conflicting versions require an explicit choice. An available application update prompts for reload rather than interrupting editing.

Browser storage belongs to an origin. To retain existing local drafts when moving from the old UI, keep the same scheme, host and port. If changing origins, sync or export pending work from the old origin first. The two-container Compose setup retains the previous frontend port, 5080.

## Tests

The integration suite starts the production frontend and a .NET server against an isolated `.test-data/workspace`. Build both first:

```sh
dotnet build ../odysseum/server/Odysseum.Server/Odysseum.Server.csproj -c Release
npm run build
npx playwright install chromium
npm test
```

The default server checkout is `../odysseum`. Set `ODYSSEUM_SERVER_ROOT` for a different location (use `..` when this checkout is inside the server repository). Set `PLAYWRIGHT_CHANNEL=msedge` to use installed Microsoft Edge instead of Playwright Chromium. Tests cover routing, editing, metadata links, Beats, offline reloads and replay, live events, conflicts, history, export and password cookies.

## Repositories

This is an independent Git repository. Commit and push frontend changes here; commit and push API changes in the `odysseum` checkout. Neither push includes the other checkout. The server repository ignores a nested `odysseum-web/` checkout and also supports a sibling checkout through `ODYSSEUM_WEB_PATH` in Compose.

## License

[GNU AGPL v3](LICENSE)
