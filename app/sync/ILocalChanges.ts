import type { DocumentDetails, DocumentSummary, ProjectSettings, ViewSettings } from '../models'

/** Changes the user makes. Each one shows at once and goes into the queue, which sends it when the server can be reached. */
export interface ILocalChanges {
  createDocument(folderId: string, title: string, text?: string): Promise<DocumentSummary>
  updateDetails(documentId: string, fields: DocumentDetails, base: DocumentDetails): Promise<void>
  renameDocument(documentId: string, name: string): Promise<void>
  /** Puts a document or folder at `index` among the target folder's children. This is also how the order changes. */
  move(itemId: string, targetFolderId: string, index: number): Promise<void>
  createFolder(parentFolderId: string, name: string): Promise<string>
  deleteFolder(folderId: string): Promise<void>
  /** `pinnedView` undefined keeps the pinned view. A view in `views` gets those settings; null removes them. */
  updateLayout(folderId: string, change: { pinnedView?: string | null; views?: Record<string, ViewSettings | null> }): Promise<void>
  updateSettings(settings: ProjectSettings): Promise<void>
  createLink(firstDocumentId: string, secondDocumentId: string, note?: string): Promise<void>
  deleteLink(linkId: string): Promise<void>
  setLinkNote(linkId: string, note: string): Promise<void>
}
