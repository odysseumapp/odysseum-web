import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { access, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import archiver from 'archiver'

// Packages the generated static UI as the ZIP release the C# server installs with --install-webui.
const webRoot = path.resolve(import.meta.dirname, '..')
const publicDir = path.join(webRoot, '.output', 'public')
await access(path.join(publicDir, 'webui-release.json')).catch(() => { throw new Error('Run npm run build before packaging the UI.') })
const output = path.resolve(process.argv[2] || path.join(webRoot, '.output', 'odysseum-webui.zip'))
if (output.startsWith(publicDir + path.sep)) throw new Error('The ZIP must be outside the public directory.')
await mkdir(path.dirname(output), { recursive: true })
const temporary = `${output}.${process.pid}.tmp`
try {
  await new Promise((resolve, reject) => {
    const stream = createWriteStream(temporary)
    const archive = archiver('zip', { zlib: { level: 9 } })
    archive.on('error', reject)
    stream.on('error', reject)
    stream.on('close', resolve)
    archive.pipe(stream)
    archive.directory(publicDir, false)
    archive.finalize()
  })
  await rename(temporary, output)
} finally { await rm(temporary, { force: true }) }
const hash = createHash('sha256').update(await readFile(output)).digest('hex')
await writeFile(`${output}.sha256`, `${hash}  ${path.basename(output)}\n`)
console.log(`Packaged static UI: ${output}`)
