import { spawn, spawnSync } from 'node:child_process'
import path from 'node:path'

// Packages the built UI, installs it into the isolated test server, then serves the API and UI from one process.
const project = path.join(process.env.ODYSSEUM_SERVER_ROOT, 'server/Odysseum.Server/Odysseum.Server.csproj')
const archive = path.resolve('.test-data/odysseum-webui.zip')
const dotnet = ['run', '--project', project, '-c', 'Release', '--no-build', '--no-launch-profile', '--']
function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
run(process.execPath, ['scripts/package.mjs', archive])
run('dotnet', [...dotnet, '--install-webui', archive])
const server = spawn('dotnet', [...dotnet, '--urls', 'http://127.0.0.1:5082'], { stdio: 'inherit' })
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.kill(signal))
server.on('exit', code => process.exit(code ?? 1))
