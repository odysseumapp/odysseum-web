import { build } from 'vite'

/** One self-contained module and one stylesheet per view (`board.js` and `board.css`). The names are the client entries
 *  in ViewsPlugin.cs. The first build empties the output folder and copies `public/` (the icons). */
const views = ['board', 'outline', 'grid']

for (const [index, name] of views.entries()) {
  await build({
    build: {
      emptyOutDir: index === 0,
      copyPublicDir: index === 0,
      lib: { entry: `src/${name}.ts`, formats: ['es'], fileName: () => `${name}.js`, cssFileName: name },
    },
  })
}
