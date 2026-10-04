import type { DocumentKind, DocumentSummary, Folder, Link, ProjectSnapshot, ProjectTemplate } from '../models'
import { kindForTopFolder } from './FileNames'

export const defaultFolders = ['Manuscript', 'Characters', 'Locations', 'Threads', 'Notes', 'Styles']
/** The template used when the server cannot be reached and no template list was saved on this device. */
export const defaultTemplate: ProjectTemplate = {
  name: 'Default', wordGoal: 50000, defaultSceneWordGoal: 1000,
  folders: ['', ...defaultFolders, 'Manuscript/Chapter 01'].map(path => ({
    path, pinnedView: null, children: path ? [] : [...defaultFolders], views: null,
  })),
  documents: [{ path: 'Manuscript/Chapter 01/Scene 01.md', title: 'Scene 01' }, { path: 'Styles/Default.md', title: 'Default' }],
}

export type FolderItem = { type: 'folder'; id: string; title: string; folder: Folder; document?: never }
  | { type: 'document'; id: string; title: string; document: DocumentSummary; folder?: never }

export const rootFolder = (project: ProjectSnapshot) => project.folders.find(folder => folder.id === project.project.rootFolderId)
export const findFolder = (project: ProjectSnapshot, id: string | null | undefined) => id ? project.folders.find(folder => folder.id === id) : undefined
export const findDocument = (project: ProjectSnapshot, id: string | null | undefined) => id ? project.documents.find(doc => doc.id === id) : undefined

/** The folders from the top folder down to this one, both included. */
export function folderChain(project: ProjectSnapshot, folderId: string): Folder[] {
  const chain: Folder[] = []
  for (let folder = findFolder(project, folderId); folder && !chain.includes(folder); folder = findFolder(project, folder.parentFolderId)) chain.unshift(folder)
  return chain
}
/** The folder's path inside the project, for display: "Manuscript/Chapter 01". The top folder has the empty path. */
export const folderPath = (project: ProjectSnapshot, folderId: string) => folderChain(project, folderId).slice(1).map(folder => folder.name).join('/')
export const topFolder = (project: ProjectSnapshot, folderId: string): Folder | undefined => folderChain(project, folderId)[1]
export const kindInFolder = (project: ProjectSnapshot, folderId: string): DocumentKind => kindForTopFolder(topFolder(project, folderId)?.name)
export const isDefaultFolder = (project: ProjectSnapshot, folder: Folder) =>
  folder.parentFolderId === project.project.rootFolderId && defaultFolders.some(name => name.toLocaleLowerCase() === folder.name.toLocaleLowerCase())
/** Every folder in tree order, labelled with its path, for a folder picker. */
export function folderChoices(project: ProjectSnapshot, except?: string) {
  const walk = (folder: Folder | undefined): Folder[] => folder
    ? [folder, ...folder.childIds.flatMap(id => walk(findFolder(project, id)))] : []
  return walk(rootFolder(project)).filter(folder => folder.id !== except)
    .map(folder => ({ label: folderPath(project, folder.id) || project.project.title, value: folder.id }))
}
export const isInside =(project: ProjectSnapshot, folderId: string, ancestorId: string) => folderChain(project, folderId).some(folder => folder.id === ancestorId)

/** The folder's subfolders and documents in order. The folder's own document is not one of them. */
export function folderItems(project: ProjectSnapshot, folderId: string): FolderItem[] {
  const folder = findFolder(project, folderId)
  if (!folder) return []
  return folder.childIds.flatMap((id): FolderItem[] => {
    const child = findFolder(project, id)
    if (child) return [{ type: 'folder', id, title: child.name, folder: child }]
    const doc = findDocument(project, id)
    return doc && !doc.isFolderDocument ? [{ type: 'document', id, title: doc.title, document: doc }] : []
  })
}

export function descendantDocuments(project: ProjectSnapshot, folderId: string): DocumentSummary[] {
  return folderItems(project, folderId).flatMap(item => item.document ? [item.document] : descendantDocuments(project, item.folder.id))
}
export const allDocuments = (project: ProjectSnapshot) => {
  const root = rootFolder(project)
  return root ? descendantDocuments(project, root.id) : []
}
export const isScene = (doc: DocumentSummary) => doc.kind === 'scene' && !doc.isFolderDocument
export const folderDocument = (project: ProjectSnapshot, folder: Folder) => findDocument(project, folder.ownDocumentId)

export const kindOrder: DocumentKind[] = ['thread', 'character', 'location', 'scene', 'note', 'style']
export const kindLabels: Record<DocumentKind, string> = { thread: 'Thread', character: 'Character', location: 'Location', scene: 'Scene', note: 'Note', style: 'Style' }
export const kindIcons: Record<DocumentKind, string> = { thread: 'i-lucide-route', character: 'i-lucide-user-round', location: 'i-lucide-map-pin', scene: 'i-lucide-file-text', note: 'i-lucide-sticky-note', style: 'i-lucide-paintbrush' }
export const kindFolderIcons: Record<DocumentKind, string> = { thread: 'i-lucide-git-branch', character: 'i-lucide-users', location: 'i-lucide-map', scene: 'i-lucide-book-open', note: 'i-lucide-notebook-pen', style: 'i-lucide-swatch-book' }
const kindFolders = new Set(['manuscript', 'characters', 'locations', 'threads', 'notes', 'research', 'story notes', 'styles'])
export function folderIcon(project: ProjectSnapshot, folder: Folder) {
  const top = topFolder(project, folder.id)
  return top && kindFolders.has(top.name.toLowerCase()) ? kindFolderIcons[kindForTopFolder(top.name)] : 'i-lucide-folder'
}
export const itemIcon = (project: ProjectSnapshot, item: FolderItem) => item.folder ? folderIcon(project, item.folder) : kindIcons[item.document.kind]

export const linksOf = (project: ProjectSnapshot, documentId: string): Link[] =>
  project.links.filter(link => link.firstDocumentId === documentId || link.secondDocumentId === documentId)
export const otherEnd = (link: Link, documentId: string) => link.firstDocumentId === documentId ? link.secondDocumentId : link.firstDocumentId
export const linkBetween = (project: ProjectSnapshot, a: string, b: string) =>
  project.links.find(link => (link.firstDocumentId === a && link.secondDocumentId === b) || (link.firstDocumentId === b && link.secondDocumentId === a))
export function linkedDocuments(project: ProjectSnapshot, documentId: string) {
  const others = new Set(linksOf(project, documentId).map(link => otherEnd(link, documentId)))
  return allDocuments(project).filter(doc => others.has(doc.id))
}
export function documentChoices(project: ProjectSnapshot, except?: string) {
  const ordered = allDocuments(project)
  return kindOrder.flatMap(kind => ordered.filter(doc => doc.kind === kind && doc.id !== except))
}
