import type { ChangedMessage } from '../models'

/** The live connection to the server. It reports the changes of the projects, and of the items of the open projects. */
export interface ILiveUpdates {
  readonly connected: boolean
  start(): Promise<void>
  stop(): Promise<void>
  /** Asks for the changes to the project's folders, documents and links. Also sent again after a reconnect. */
  openProject(projectId: string): void
  closeProject(projectId: string): void
  onChanged(handler: (message: ChangedMessage) => void): () => void
  /** Called after the connection comes back. Messages sent while it was down are lost, so read everything again. */
  onReconnected(handler: () => void): () => void
}
