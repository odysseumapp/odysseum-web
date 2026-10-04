import { HubConnectionBuilder, HubConnectionState, LogLevel, type HubConnection } from '@microsoft/signalr'
import type { ChangedMessage } from '../models'
import type { ILiveUpdates } from './ILiveUpdates'

const RESTART_MS = 15000

export class SignalRLiveUpdates implements ILiveUpdates {
  private readonly connection: HubConnection
  private readonly projects = new Set<string>()
  private readonly changed = new Set<(message: ChangedMessage) => void>()
  private readonly reconnected = new Set<() => void>()
  private stopped = true
  private restartTimer: ReturnType<typeof setTimeout> | undefined
  private everConnected = false

  constructor(url = '/api/hub') {
    this.connection = new HubConnectionBuilder()
      .withUrl(url, { withCredentials: true })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(LogLevel.None)
      .build()
    this.connection.on('changed', (message: ChangedMessage) => { for (const handler of this.changed) handler(message) })
    this.connection.onreconnected(() => { void this.rejoin() })
    this.connection.onclose(() => this.scheduleRestart())
  }

  get connected() { return this.connection.state === HubConnectionState.Connected }

  async start() {
    this.stopped = false
    await this.connect()
  }

  async stop() {
    this.stopped = true
    clearTimeout(this.restartTimer)
    await this.connection.stop().catch(() => undefined)
  }

  openProject(projectId: string) {
    this.projects.add(projectId)
    if (this.connected) void this.connection.invoke('OpenProject', projectId).catch(() => undefined)
  }

  closeProject(projectId: string) {
    this.projects.delete(projectId)
    if (this.connected) void this.connection.invoke('CloseProject', projectId).catch(() => undefined)
  }

  onChanged(handler: (message: ChangedMessage) => void) { this.changed.add(handler); return () => { this.changed.delete(handler) } }
  onReconnected(handler: () => void) { this.reconnected.add(handler); return () => { this.reconnected.delete(handler) } }

  private async connect() {
    if (this.stopped || this.connection.state !== HubConnectionState.Disconnected) return
    try {
      await this.connection.start()
      const again = this.everConnected
      this.everConnected = true
      await this.rejoin(again)
    } catch {
      this.scheduleRestart()
    }
  }

  private async rejoin(notify = true) {
    await Promise.all([...this.projects].map(id => this.connection.invoke('OpenProject', id).catch(() => undefined)))
    if (notify) for (const handler of this.reconnected) handler()
  }

  /** The automatic reconnect gives up after a while, e.g. when the server is down for long; keep trying slowly. */
  private scheduleRestart() {
    if (this.stopped) return
    clearTimeout(this.restartTimer)
    this.restartTimer = setTimeout(() => { void this.connect() }, RESTART_MS)
  }
}
