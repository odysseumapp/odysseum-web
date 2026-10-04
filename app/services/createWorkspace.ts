import { computed, reactive, ref } from 'vue'
import type { Router } from 'vue-router'
import { FetchApiClient } from '../api/FetchApiClient'
import { OdysseumApi } from '../api/OdysseumApi'
import { ApiError, OFFLINE_MESSAGE, isOffline } from '../api/IApiClient'
import type { IOdysseumApi } from '../api/IOdysseumApi'
import type { DocumentDetails, DocumentSummary, ProjectInfo, ProjectSettings, ProjectSnapshot, ProjectTemplate, ServerSettings, ViewSettings } from '../models'
import { allDocuments } from './FolderStructure'
import { downloadText, exportMarkdown } from './ManuscriptExport'
import { searchManuscript } from './ManuscriptSearch'
import { ProjectSession } from './ProjectSession'
import { WorkspaceLibrary } from './WorkspaceLibrary'
import { openMirrorRepository, type IMirrorRepository, type MirroredDocument, type PendingEdit } from '../storage'
import type { ILiveUpdates } from '../sync/ILiveUpdates'
import type { ISyncListener, SyncStatus } from '../sync/ISyncEngine'
import { SignalRLiveUpdates } from '../sync/SignalRLiveUpdates'

export interface Buffer {
  document: DocumentSummary
  text: string
  /** The text the server last had, as far as this device knows. */
  base: string
  saving: boolean
  error: string
  conflict: { document: DocumentSummary; text: string } | 'deleted' | null
}

function projectFromUrl(path: string) {
  const match = path.match(/^\/p\/([^/]+)/)
  try { return match ? decodeURIComponent(match[1]!) : '' } catch { return '' }
}

export function createWorkspace(router: Router, api: IOdysseumApi = new OdysseumApi(new FetchApiClient()), live: ILiveUpdates = new SignalRLiveUpdates()) {
  const projects = ref<ProjectInfo[]>([])
  const templates = ref<ProjectTemplate[]>([])
  const projectId = ref('')
  const project = ref<ProjectSnapshot | null>(null)
  const selectedId = ref('')
  const buffers = reactive(new Map<string, Buffer>())
  const active = computed(() => buffers.get(selectedId.value))
  const error = ref('')
  const notice = ref('')
  const sync = ref<SyncStatus>({ online: true, syncing: false, pending: 0, lastSync: null, error: '' })
  const connected = computed(() => sync.value.online)
  const durable = ref(true)
  const authenticated = ref(false)
  const passwordRequired = ref(false)
  const allowDeletingDefaultFolders = ref(false)
  const loading = ref(true)
  const rejectedDetails = reactive(new Map<string, DocumentDetails>())
  /** Local IDs that got server IDs, so that the UI can follow an item it holds by its old ID. */
  const idRenames = reactive(new Map<string, string>())
  let mirror: IMirrorRepository | undefined
  let library: WorkspaceLibrary | undefined
  let session: ProjectSession | undefined
  let stopRouting: (() => void) | undefined
  let stopLive: (() => void) | undefined
  let listTimer: ReturnType<typeof setTimeout> | undefined
  const dirty = (buffer: Buffer) => buffer.text !== buffer.base
  const textOf = (id: string) => buffers.get(id)?.text ?? ''
  const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value))
  const resolveId = (id: string) => { while (idRenames.has(id)) id = idRenames.get(id)!; return id }
  const lastDocumentKey = () => `odysseum:${projectId.value}:last-document`

  async function services() {
    mirror ??= await openMirrorRepository()
    library ??= new WorkspaceLibrary(api, mirror)
    return { mirror, library }
  }

  function requireSession() {
    if (!session) throw new Error('Open a project first.')
    return session
  }

  function applyDocument(doc: MirroredDocument, pending: PendingEdit | undefined) {
    const existing = buffers.get(doc.id)
    const typing = !!existing && !!session?.engine.isWriting(doc.id) && existing.text !== doc.text
    const text = typing ? existing!.text : pending?.text ?? doc.text
    if (!existing) {
      buffers.set(doc.id, { document: doc.document, text, base: doc.text, saving: false, error: '', conflict: pending?.conflict ?? null })
      return
    }
    // Only when the text on screen changes because of the server, not when one of our own saves comes back.
    const updatedFromServer = existing.base !== doc.text && existing.text !== doc.text && !pending && !typing
    existing.document = doc.document
    existing.base = doc.text
    existing.conflict = pending?.conflict ?? null
    if (existing.text !== text) existing.text = text
    if (updatedFromServer && doc.id === selectedId.value) notice.value = 'Updated from the server'
  }

  function selectFirst() {
    const first = project.value ? allDocuments(project.value).find(doc => buffers.has(doc.id)) : undefined
    selectedId.value = first?.id ?? ''
  }

  function rememberProject(next: string) {
    try { localStorage.setItem('odysseum:last-project', next) } catch {  }
  }

  function listenerFor(target: () => string): ISyncListener {
    const current = () => projectId.value === target()
    return {
      onProject(view) {
        if (!current()) return
        project.value = view
        for (const summary of view.documents) {
          const buffer = buffers.get(summary.id)
          if (buffer) buffer.document = summary
        }
      },
      onDocument(doc, pending) { if (current()) applyDocument(doc, pending) },
      onIdsReplaced(ids) {
        const previousProject = projectId.value
        if (ids[previousProject]) {
          projectId.value = ids[previousProject]!
          setUrl(projectId.value, true)
          rememberProject(projectId.value)
          projects.value = projects.value.filter(item => item.id !== previousProject)
        } else if (!current()) return
        for (const [from, to] of Object.entries(ids)) {
          idRenames.set(from, to)
          const buffer = buffers.get(from)
          if (buffer) { buffers.delete(from); buffer.document = { ...buffer.document, id: to }; buffers.set(to, buffer) }
          if (selectedId.value === from) {
            selectedId.value = to
            try { localStorage.setItem(lastDocumentKey(), to) } catch {  }
          }
          const rejected = rejectedDetails.get(from)
          if (rejected) { rejectedDetails.delete(from); rejectedDetails.set(to, rejected) }
        }
      },
      onRemoved(id) {
        if (!current()) return
        buffers.delete(id)
        if (selectedId.value === id) selectFirst()
      },
      onStatus(status) {
        if (!current()) return
        sync.value = status
        for (const buffer of buffers.values()) buffer.saving = status.syncing && dirty(buffer) && !buffer.conflict
      },
      onProblem(message) { if (current()) error.value = message },
      onDetailsRejected(id, fields, message) {
        if (!current()) return
        rejectedDetails.set(id, fields)
        error.value = message
      },
      isOpen: id => current() && id === selectedId.value,
    }
  }

  function edit(text: string) {
    const buffer = active.value
    if (!buffer) return
    buffer.text = text
    buffer.error = ''
    notice.value = ''
    session?.engine.edit(buffer.document.id, text)
  }

  async function open(id: string) {
    id = resolveId(id)
    selectedId.value = id
    try { localStorage.setItem(lastDocumentKey(), id) } catch {  }
    if (buffers.has(id) || !session) return
    const { mirror: m } = await services()
    const doc = await m.getDocument(session.projectId, id)
    if (doc) applyDocument(doc, await m.getPending(session.projectId, id))
    else await session.engine.syncNow()
  }

  async function save() { await session?.engine.syncNow() }
  async function refresh() {
    if (session) { session.engine.requestFullPull(); await session.engine.syncNow() }
    else await loadProjects()
  }

  async function loadProjects() {
    const { library: lib } = await services()
    const result = await lib.list()
    projects.value = result.projects
    sync.value = { ...sync.value, online: result.online }
  }

  function setUrl(next: string, replace = false) {
    const url = next ? `/p/${encodeURIComponent(next)}` : '/'
    if (router.currentRoute.value.path !== url) void router[replace ? 'replace' : 'push'](url).catch(showError)
  }

  async function closeProject() {
    await session?.close()
    session = undefined
    buffers.clear()
    rejectedDetails.clear()
    idRenames.clear()
    selectedId.value = ''
    project.value = null
    notice.value = ''
    error.value = ''
  }

  async function openProject(next: string, replaceHistory = false) {
    await closeProject()
    projectId.value = next
    setUrl(next, replaceHistory)
    loading.value = true
    try {
      const { mirror: m } = await services()
      let opened: ProjectSession
      opened = new ProjectSession(api, m, live, next, listenerFor(() => opened.projectId))
      session = opened
      const hydrated = await opened.hydrate()
      opened.start()
      if (!hydrated) {
        await opened.engine.syncNow()
        if (!project.value) {
          error.value = sync.value.online ? sync.value.error || 'Could not open this project.'
            : "This project hasn't been opened on this device yet, so it isn't available offline."
          await opened.close()
          session = undefined
          projectId.value = ''
          setUrl('', true)
          return
        }
      }
      rememberProject(projectId.value)
      let last: string | null = null
      try { last = localStorage.getItem(lastDocumentKey()) } catch {  }
      const documents = project.value?.documents ?? []
      const first = documents.find(doc => doc.id === last) ?? (project.value ? allDocuments(project.value)[0] : undefined) ?? documents[0]
      if (first) await open(first.id)
    } finally { loading.value = false }
  }

  async function leaveProject(replaceHistory = false) {
    await closeProject()
    projectId.value = ''
    setUrl('', replaceHistory)
    try { localStorage.removeItem('odysseum:last-project') } catch {  }
    try { await loadProjects() } catch (ex) { showError(ex) }
  }

  async function loadTemplates() {
    const { library: lib } = await services()
    templates.value = await lib.templates()
    return templates.value
  }

  async function createProject(title: string, template?: string) {
    const { library: lib } = await services()
    const created = await lib.create(title, templates.value.find(item => item.name === template))
    projects.value = [...projects.value, created]
    await openProject(created.id)
    if (!selectedId.value && session) {
      await session.engine.syncNow()
      const first = project.value ? allDocuments(project.value)[0] : undefined
      if (first) await open(first.id)
    }
    return created
  }

  /** Sends everything first, for actions that the server does on its own copy. */
  async function settled() {
    const current = requireSession()
    await current.engine.syncNow()
    if (sync.value.pending) throw new Error(sync.value.online ? 'Some changes have not reached the server yet. Try again once they are saved.' : OFFLINE_MESSAGE)
    return current
  }

  async function saveTemplate(name: string) {
    const current = await settled()
    const saved = await api.saveTemplate(name.trim(), current.projectId)
    await loadTemplates()
    return saved
  }

  async function deleteTemplate(name: string) {
    await api.deleteTemplate(name)
    await loadTemplates()
  }

  async function projectVersions() { return session ? api.listVersions(session.projectId) : [] }

  async function saveVersion(name: string) {
    const current = await settled()
    return api.saveVersion(current.projectId, name.trim())
  }

  async function restoreVersion(id: string) {
    const current = await settled()
    await api.restoreVersion(current.projectId, id)
    current.engine.requestFullPull()
    await current.engine.syncNow()
  }

  function onRoute() {
    if (!authenticated.value) return
    const next = projectFromUrl(router.currentRoute.value.path)
    if (next === projectId.value) return
    if (next) void openProject(next, true).catch(showError)
    else void leaveProject(true).catch(showError)
  }

  /** Keeps the project list current: changes to projects reach every browser. */
  function watchProjects() {
    stopLive ??= live.onChanged(message => {
      if (session || !message.changes.some(change => change.type === 'project')) return
      clearTimeout(listTimer)
      listTimer = setTimeout(() => { void loadProjects().catch(() => undefined) }, 300)
    })
  }

  async function start() {
    loading.value = true
    try {
      const { mirror: m, library: lib } = await services()
      durable.value = m.durable
      const info = await lib.session()
      if (info) {
        authenticated.value = info.authenticated
        passwordRequired.value = info.passwordRequired
        allowDeletingDefaultFolders.value = info.allowDeletingDefaultFolders
      } else {
        authenticated.value = true
        sync.value = { ...sync.value, online: false }
        error.value = OFFLINE_MESSAGE
      }
      if (!authenticated.value) return
      watchProjects()
      void live.start()
      await loadProjects()
      stopRouting ??= router.afterEach(onRoute)
      const fromUrl = projectFromUrl(router.currentRoute.value.path)
      let last = ''
      try { last = localStorage.getItem('odysseum:last-project') ?? '' } catch {  }
      const target = fromUrl || (projects.value.some(item => item.id === last) ? last : projects.value.length === 1 ? projects.value[0]!.id : '')
      if (target) await openProject(target, true)
      else setUrl('', true)
    } catch (ex) { showError(ex) }
    finally { loading.value = false }
  }

  async function login(password: string) {
    const { library: lib } = await services()
    await lib.login(password)
  }

  async function updateServerSettings(settings: ServerSettings) {
    const saved = await api.updateServerSettings(settings)
    allowDeletingDefaultFolders.value = saved.allowDeletingDefaultFolders
  }

  async function logout() {
    const { library: lib } = await services()
    await lib.logout()
    stop()
    authenticated.value = false
  }

  async function create(folderId: string, title: string, text?: string) {
    const created = await requireSession().changes.createDocument(resolveId(folderId), title, text)
    await open(created.id)
    return created
  }

  async function saveDetails(id: string, fields: DocumentDetails, base: DocumentDetails) {
    await requireSession().changes.updateDetails(resolveId(id), plain(fields), plain(base))
  }
  async function rename(id: string, name: string) { await requireSession().changes.renameDocument(resolveId(id), name) }
  /** Puts a document or folder at `index` among the target folder's children; also how the order changes. */
  async function move(itemId: string, targetFolderId: string, index: number) {
    await requireSession().changes.move(resolveId(itemId), resolveId(targetFolderId), index)
  }
  async function createFolder(parentFolderId: string, name: string) { return requireSession().changes.createFolder(resolveId(parentFolderId), name) }
  async function removeFolder(folderId: string) { await requireSession().changes.deleteFolder(resolveId(folderId)) }
  async function updateLayout(folderId: string, change: { pinnedView?: string | null; views?: Record<string, ViewSettings | null> }) {
    await requireSession().changes.updateLayout(resolveId(folderId), plain(change))
  }
  async function updateSettings(settings: ProjectSettings) { await requireSession().changes.updateSettings(plain(settings)) }
  async function link(firstDocumentId: string, secondDocumentId: string, note?: string) {
    await requireSession().changes.createLink(resolveId(firstDocumentId), resolveId(secondDocumentId), note)
  }
  async function unlink(linkId: string) { await requireSession().changes.deleteLink(resolveId(linkId)) }
  async function setLinkNote(linkId: string, note: string) { await requireSession().changes.setLinkNote(resolveId(linkId), note) }

  function search(query: string) {
    return project.value ? searchManuscript(project.value, textOf, query) : []
  }

  function exportManuscript() {
    if (!project.value) return
    downloadText(`${project.value.project.title}.md`, exportMarkdown(project.value, textOf))
  }

  async function documentVersions(id: string) {
    if (!session) return { versions: [], fresh: false }
    return session.history.list(session.projectId, resolveId(id))
  }

  async function documentVersionText(id: string, versionId: string) {
    const current = requireSession()
    return current.history.read(current.projectId, resolveId(id), versionId)
  }

  async function useServer() {
    const buffer = active.value
    if (!buffer || !buffer.conflict || buffer.conflict === 'deleted') return
    await session?.engine.useServer(buffer.document.id)
  }

  async function keepMine() {
    const buffer = active.value
    if (!buffer || !buffer.conflict || buffer.conflict === 'deleted') return
    await session?.engine.keepMine(buffer.document.id)
  }

  async function saveCopy() {
    const buffer = active.value
    if (!buffer) return
    const deleted = buffer.conflict === 'deleted' ? buffer.document.id : ''
    const folderId = project.value?.folders.some(folder => folder.id === buffer.document.folderId) ? buffer.document.folderId : project.value?.project.rootFolderId
    if (!folderId) return
    await create(folderId, `${buffer.document.title} — recovered`, buffer.text)
    if (deleted) await session?.engine.discard(deleted)
  }

  async function discard() {
    const buffer = active.value
    if (!buffer || buffer.conflict !== 'deleted') return
    await session?.engine.discard(buffer.document.id)
  }

  function showError(ex: unknown) {
    error.value = ex instanceof Error ? ex.message : 'Could not reach your workspace.'
    if (ex instanceof ApiError && ex.status === 401) authenticated.value = false
    if (isOffline(ex)) sync.value = { ...sync.value, online: false }
  }

  function beforeUnload(event: BeforeUnloadEvent) {
    if (!session?.engine.hasUnwritten()) return
    void session.engine.flush()
    event.preventDefault()
  }

  function stop() {
    void session?.close()
    session = undefined
    stopRouting?.()
    stopRouting = undefined
    stopLive?.()
    stopLive = undefined
    void live.stop()
  }

  return {
    api, services, projects, templates, projectId, project, selectedId, active, error, notice, sync, connected, durable, authenticated, passwordRequired,
    allowDeletingDefaultFolders, loading, rejectedDetails, idRenames,
    dirty, textOf, edit, open, save, refresh, start, login, logout, create, saveDetails, rename, move, createFolder, removeFolder, updateLayout,
    updateSettings, link, unlink, setLinkNote, updateServerSettings, search, exportManuscript, documentVersions, documentVersionText,
    useServer, keepMine, saveCopy, discard, showError, beforeUnload, stop, loadProjects, openProject, leaveProject, createProject, loadTemplates,
    saveTemplate, deleteTemplate, projectVersions, saveVersion, restoreVersion,
  }
}

export type Workspace = ReturnType<typeof createWorkspace>
