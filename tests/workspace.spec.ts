import { test, expect, type Page, type APIRequestContext, type BrowserContext } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { DocumentContent, Project, ProjectInfo } from '../app/models'

const unique = (label: string) => `${label} ${Date.now()}`
const base = (slug: string) => `/api/projects/${encodeURIComponent(slug)}`
const projectUrl = (slug: string) => `/webui/p/${encodeURIComponent(slug)}`
const filePath = (slug: string, doc: DocumentContent) => path.resolve('.test-data/workspace', slug, doc.document.path)
const editor = (page: Page) => page.getByRole('textbox', { name: 'Document editor' })
const closeDialog = (page: Page) => page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click()
async function project(request: APIRequestContext, slug: string): Promise<Project> {
  return (await (await request.get(base(slug))).json()).data
}
async function createProject(request: APIRequestContext): Promise<ProjectInfo> {
  const response = await request.post('/api/projects', { data: { title: unique('Browser project') } })
  expect(response.ok()).toBeTruthy()
  return (await response.json()).data
}
async function createDoc(request: APIRequestContext, slug: string, title: string, folder = 'Manuscript', content = 'Original paragraph.'): Promise<DocumentContent> {
  const response = await request.post(`${base(slug)}/documents`, { data: { title, folder, content } })
  expect(response.ok()).toBeTruthy()
  return (await response.json()).data
}
async function chooseSection(page: Page, name: string) {
  await page.locator('aside').getByRole('button', { name: `Folder ${name}`, exact: true }).click()
}
async function newDocument(page: Page, kind: string, title: string) {
  await page.getByRole('button', { name: 'New document', exact: true }).click()
  await page.getByRole('dialog').getByRole('textbox', { name: /^Title/ }).fill(title)
  await page.getByRole('button', { name: 'Create document', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
}
let cookies: Awaited<ReturnType<BrowserContext['cookies']>>
test.beforeAll(async ({ playwright }) => {
  const request = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:5082' })
  const result = await request.post('/api/login', { data: { password: 'integration-password' } })
  expect(result.ok()).toBeTruthy()
  cookies = (await request.storageState()).cookies
  await request.dispose()
})
test.beforeEach(async ({ context }) => { await context.addCookies(cookies) })

test('Vue pages render, format Markdown, switch views and work on mobile', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const info = await createProject(page.request)
  await createDoc(page.request, info.slug, 'First scene', 'Manuscript', 'A **bold** beginning.')
  await page.goto(projectUrl(info.slug))
  await expect(editor(page)).toContainText('beginning.')
  await page.getByRole('button', { name: 'Read', exact: true }).click()
  await expect(page.locator('.document-prose strong')).toHaveText('bold')
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByRole('button', { name: 'Source', exact: true }).click()
  await expect(editor(page)).toContainText('**bold**')
  await editor(page).fill('Formatting')
  await editor(page).press('ControlOrMeta+a')
  await page.getByRole('button', { name: 'Bold', exact: true }).click()
  await expect(editor(page)).toContainText('**Formatting**')
  await page.getByRole('tab', { name: 'Corkboard' }).click()
  await expect(page.getByLabel('Corkboard', { exact: true })).toContainText('First scene')
  await page.getByRole('tab', { name: 'Outline' }).click()
  await expect(page.getByLabel('Outline', { exact: true })).toContainText('First scene')
  await page.getByRole('tab', { name: 'Write', exact: true }).click()
  await page.getByRole('button', { name: 'Focus', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Projects', exact: true })).toBeHidden()
  await page.getByRole('button', { name: 'Exit focus', exact: true }).click()
  await page.screenshot({ path: '.test-data/desktop.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Documents', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Open First scene', exact: true }).click()
  await expect(editor(page)).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: '.test-data/mobile.png', fullPage: true })
  expect(errors).toEqual([])
})

test('creates files, saves metadata and links documents to each other', async ({ page }) => {
  const info = await createProject(page.request)
  await page.goto(projectUrl(info.slug))
  await chooseSection(page, 'Characters')
  await newDocument(page, 'character', 'Ada')
  await chooseSection(page, 'Locations')
  await newDocument(page, 'location', 'Harbor')
  await chooseSection(page, 'Manuscript')
  await newDocument(page, 'scene', 'Arrival')
  await editor(page).fill('A **new** chapter begins.')
  await page.getByRole('button', { name: 'Details', exact: true }).click()
  await page.getByRole('textbox', { name: 'Synopsis', exact: true }).fill('A meeting by the water.')
  for (const item of ['Ada · Character', 'Harbor · Location']) {
    await page.getByRole('combobox', { name: 'Links', exact: true }).click()
    await page.getByRole('option', { name: item, exact: true }).click()
    await page.keyboard.press('Escape')
  }
  await page.getByRole('button', { name: 'Save details', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Save details', exact: true })).toBeHidden()
  await closeDialog(page)
  await expect.poll(async () => {
    const current = await project(page.request, info.slug)
    const scene = current.documents.find(doc => doc.title === 'Arrival')
    return scene && { synopsis: scene.synopsis, links: scene.links.length }
  }).toEqual({ synopsis: 'A meeting by the water.', links: 2 })
  const scene = (await project(page.request, info.slug)).documents.find(doc => doc.title === 'Arrival')!
  await expect.poll(() => readFile(path.resolve('.test-data/workspace', info.slug, scene.path), 'utf8')).toContain('A **new** chapter begins.')
  await page.reload()
  await expect(editor(page)).toContainText('chapter begins.')
  await page.getByRole('button', { name: 'Details', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Synopsis' })).toHaveValue('A meeting by the water.')
  await closeDialog(page)
  await chooseSection(page, 'Characters')
  await page.locator('aside').getByRole('button', { name: 'Open Ada', exact: true }).click()
  await page.getByRole('button', { name: 'Details', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Arrival', exact: true })).toBeVisible()
})

async function newFolder(page: Page, name: string, topLevel = false) {
  await page.getByRole('button', { name: topLevel ? 'New top-level folder' : 'New folder', exact: true }).click()
  await page.getByRole('textbox', { name: 'Folder name' }).fill(name)
  await page.getByRole('button', { name: 'Create folder', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
}

test('every folder has a grid of its documents against another folder, with collapsible groups', async ({ page }) => {
  const info = await createProject(page.request)
  await createDoc(page.request, info.slug, 'Revelation', 'Characters/Race')
  const second = await createDoc(page.request, info.slug, 'Discovery', 'Characters')
  const nested = await createDoc(page.request, info.slug, 'Nested point', 'Characters/Race/Nested')
  const race = await createDoc(page.request, info.slug, 'Race', 'Threads')
  const cute = await createDoc(page.request, info.slug, 'Meet Cute', 'Threads/Story Beats')
  const idea = await createDoc(page.request, info.slug, 'A stray idea', 'Notes/Ideas')
  await page.goto(projectUrl(info.slug))
  for (const name of ['Manuscript', 'Characters', 'Locations', 'Notes', 'Threads']) {
    await expect(page.locator('aside').getByRole('button', { name: `Folder ${name}`, exact: true })).toBeVisible()
  }
  await chooseSection(page, 'Characters')
  await page.getByRole('tab', { name: 'Grid', exact: true }).click()
  const grid = page.getByRole('table', { name: 'Grid', exact: true })
  // Columns default to the Threads folder; rows are this folder's documents, grouped by subfolder.
  await expect(grid.getByRole('columnheader').filter({ hasText: 'Race' })).toBeVisible()
  await expect(grid.getByRole('columnheader').filter({ hasText: 'Meet Cute' })).toBeVisible()
  await grid.getByRole('button', { name: 'Link Discovery to Race', exact: true }).click()
  await expect(grid.getByRole('button', { name: 'Unlink Discovery from Race', exact: true })).toBeVisible()
  await expect.poll(async () => {
    const current = await project(page.request, info.slug)
    return [current.documents.find(doc => doc.id === second.document.id)?.links, current.documents.find(doc => doc.id === race.document.id)?.links]
  }).toEqual([[race.document.id], [second.document.id]])
  // The mark takes a note that both ends of the link share.
  await grid.getByRole('button', { name: 'Note on Discovery and Race', exact: true }).click()
  await grid.getByRole('textbox', { name: 'Note on Discovery and Race', exact: true }).fill('Where the race begins')
  await page.keyboard.press('Enter')
  await expect(grid.getByRole('button', { name: 'Edit note on Discovery and Race', exact: true })).toHaveText('Where the race begins')
  await expect.poll(async () => {
    const current = await project(page.request, info.slug)
    return [current.documents.find(doc => doc.id === second.document.id)?.linkNotes, current.documents.find(doc => doc.id === race.document.id)?.linkNotes]
  }).toEqual([{ [race.document.id]: 'Where the race begins' }, { [second.document.id]: 'Where the race begins' }])
  await grid.getByRole('button', { name: 'Link Nested point to Meet Cute', exact: true }).click()
  await expect.poll(async () => (await project(page.request, info.slug)).documents.find(doc => doc.id === nested.document.id)?.links).toEqual([cute.document.id])
  await grid.getByRole('button', { name: 'Link Nested to Meet Cute', exact: true }).click()
  await expect.poll(async () => (await project(page.request, info.slug)).documents.find(doc => doc.path === 'Characters/Race/Nested/.Nested.md')?.links).toEqual([cute.document.id])
  // Collapsing a subfolder rolls its linked documents up into the group row.
  await grid.getByRole('button', { name: 'Collapse Race', exact: true }).click()
  await expect(grid.getByRole('rowheader').filter({ hasText: 'Nested point' })).toBeHidden()
  await expect(grid.getByRole('button', { name: 'Open Nested point', exact: true })).toBeVisible()
  await grid.getByRole('button', { name: 'Expand Race', exact: true }).click()
  // Columns can come from any other folder, and the choice is saved with the folder.
  await page.getByRole('combobox', { name: 'Columns from folder', exact: true }).click()
  await page.getByRole('option', { name: 'Notes', exact: true }).click()
  await expect(grid.getByRole('columnheader').filter({ hasText: 'A stray idea' })).toBeVisible()
  await grid.getByRole('button', { name: 'Link Discovery to A stray idea', exact: true }).click()
  await expect.poll(async () => {
    const current = await project(page.request, info.slug)
    const notes = current.folders.find(folder => folder.path === 'Notes')!
    return { column: current.folders.find(folder => folder.path === 'Characters')?.gridFolder === notes.id, idea: current.documents.find(doc => doc.id === idea.document.id)?.links }
  }).toEqual({ column: true, idea: [second.document.id] })
  await page.screenshot({ path: '.test-data/threads.png', fullPage: true })
  await page.reload()
  await chooseSection(page, 'Characters')
  await page.getByRole('tab', { name: 'Grid', exact: true }).click()
  await expect(grid.getByRole('columnheader').filter({ hasText: 'A stray idea' })).toBeVisible()
  await grid.getByRole('rowheader').getByRole('button', { name: 'Open Nested point', exact: true }).click()
  await page.getByRole('button', { name: 'Details', exact: true }).click()
  await expect(page.getByRole('combobox', { name: 'Links', exact: true })).toContainText('Meet Cute')
  await closeDialog(page)
  await editor(page).fill('A document on a thread.')
  await expect.poll(() => readFile(path.resolve('.test-data/workspace', info.slug, nested.document.path), 'utf8')).toContain('A document on a thread.')
  // The Corkboard shows a document's links on its card.
  await chooseSection(page, 'Characters')
  await page.getByRole('tab', { name: 'Corkboard', exact: true }).click()
  await expect(page.getByLabel('Corkboard', { exact: true }).getByLabel('Linked documents').filter({ hasText: 'Race' }).first()).toBeVisible()
})

test('folder stacks keep the view, pins persist, folders open their own document and empty folders can be removed', async ({ page }) => {
  const info = await createProject(page.request)
  const first = await createDoc(page.request, info.slug, 'First', 'Manuscript/Part')
  const second = await createDoc(page.request, info.slug, 'Second', 'Manuscript/Part')
  await page.goto(projectUrl(info.slug))
  await chooseSection(page, 'Manuscript')
  await page.getByRole('tab', { name: 'Corkboard' }).click()
  await page.getByRole('button', { name: 'Open folder Part', exact: true }).dblclick()
  await expect(page.getByRole('tab', { name: 'Corkboard' })).toHaveAttribute('aria-selected', 'true')
  const board = page.getByLabel('Corkboard', { exact: true })
  await board.locator(`[data-item-key="${second.document.id}"]`).dragTo(board.locator(`[data-item-key="${first.document.id}"]`))
  await expect(board.locator('[data-item-key]').first()).toHaveAttribute('data-item-key', second.document.id)
  await page.getByRole('tab', { name: 'Outline' }).click()
  const outline = page.getByLabel('Outline', { exact: true })
  await outline.locator(`[data-item-key="${second.document.id}"]`).dragTo(outline.locator(`[data-item-key="${first.document.id}"]`))
  await expect(outline.locator('[data-item-key]').first()).toHaveAttribute('data-item-key', first.document.id)
  await chooseSection(page, 'Manuscript/Part')
  await expect(page.getByRole('heading', { name: 'Part', exact: true })).toBeVisible()
  await editor(page).fill('Folder introduction.')
  await expect.poll(() => readFile(path.resolve('.test-data/workspace', info.slug, 'Manuscript/Part/.Part.md'), 'utf8')).toContain('Folder introduction.')
  await expect(page.locator('aside').getByRole('button', { name: 'Open Part', exact: true })).toBeHidden()
  await expect(page.locator('aside').getByRole('button', { name: 'Open First', exact: true })).toBeVisible()
  await chooseSection(page, 'Notes')
  await page.getByRole('tab', { name: 'Grid', exact: true }).click()
  await page.getByRole('button', { name: 'Pin view for this folder' }).click()
  await expect.poll(async () => (await project(page.request, info.slug)).folders.find(folder => folder.path === 'Notes')?.pinnedView).toBe('grid')
  await page.reload()
  await chooseSection(page, 'Notes')
  await expect(page.getByRole('tab', { name: 'Grid', exact: true })).toHaveAttribute('aria-selected', 'true')
  await newFolder(page, 'Empty')
  await chooseSection(page, 'Notes/Empty')
  await page.getByRole('button', { name: 'Remove empty folder' }).click()
  await expect(page.locator('aside').getByRole('button', { name: 'Folder Notes/Empty', exact: true })).toBeHidden()
  await expect.poll(async () => (await project(page.request, info.slug)).folders.some(folder => folder.path === 'Notes/Empty')).toBe(false)
  await chooseSection(page, 'Manuscript/Part')
  await expect(page.getByRole('button', { name: 'Remove empty folder' })).toBeDisabled()
  await newFolder(page, 'Custom', true)
  await expect(page.locator('aside').getByRole('button', { name: 'Folder Custom', exact: true })).toBeVisible()
})

test('offline reload preserves edits, pins and links made in the grid', async ({ page, context }) => {
  const info = await createProject(page.request)
  const original = await createDoc(page.request, info.slug, 'Offline scene')
  await page.goto(projectUrl(info.slug))
  await expect(editor(page)).toContainText('Original paragraph.')
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await context.setOffline(true)
  await page.reload()
  await expect(editor(page)).toContainText('Original paragraph.')
  await editor(page).fill('Written with no connection.')
  await expect(page.getByRole('button', { name: 'Saved on this device', exact: true })).toBeVisible()
  await page.waitForTimeout(250)
  await page.reload()
  await expect(editor(page)).toContainText('Written with no connection.')
  await chooseSection(page, 'Threads')
  await newDocument(page, 'thread', 'Offline thread')
  await chooseSection(page, 'Manuscript')
  await page.getByRole('tab', { name: 'Grid', exact: true }).click()
  await page.getByRole('button', { name: 'Pin view for this folder' }).click()
  await page.getByRole('button', { name: 'Link Offline scene to Offline thread', exact: true }).click()
  // The unlink button only shows under the pointer; the mark itself is always there.
  const on = page.getByRole('button', { name: 'Note on Offline scene and Offline thread', exact: true })
  await expect(on).toBeVisible()
  await page.reload()
  await chooseSection(page, 'Manuscript')
  await expect(on).toBeVisible()
  await context.setOffline(false)
  await expect.poll(async () => {
    const current = await project(page.request, info.slug)
    const thread = current.documents.find(doc => doc.title === 'Offline thread')
    const folder = current.folders.find(folder => folder.path === 'Manuscript')
    const scene = current.documents.find(doc => doc.id === original.document.id)
    return thread && folder && scene ? { pinned: folder.pinnedView, on: scene.links.includes(thread.id) && thread.links.includes(scene.id), path: thread.path } : null
  }, { timeout: 20000 }).toEqual({ pinned: 'grid', on: true, path: 'Threads/Offline thread.md' })
  await expect.poll(() => readFile(filePath(info.slug, original), 'utf8')).toContain('Written with no connection.')
})
test('live events cross the Nuxt proxy and conflicts preserve both versions', async ({ page, context }) => {
  const info = await createProject(page.request)
  const doc = await createDoc(page.request, info.slug, 'External edits')
  await page.goto(projectUrl(info.slug))
  await expect(editor(page)).toContainText('Original paragraph.')
  const file = filePath(info.slug, doc)
  const raw = await readFile(file, 'utf8')
  await writeFile(file, raw.replace('Original paragraph.', 'Live external update.'))
  // Shorter than the engine's 20-second full-sync interval: this exercises SSE streaming.
  await expect(editor(page)).toContainText('Live external update.', { timeout: 8000 })
  await context.setOffline(true)
  await editor(page).fill('Keep this browser draft.')
  await page.waitForTimeout(250)
  await writeFile(file, raw.replace('Original paragraph.', 'Independent disk version.'))
  await context.setOffline(false)
  await expect(page.getByText('This document has conflicting changes')).toBeVisible({ timeout: 20000 })
  await page.getByRole('button', { name: 'Review changes', exact: true }).first().click()
  await expect(page.getByRole('textbox', { name: 'Your browser draft' })).toHaveValue('Keep this browser draft.')
  await expect(page.getByRole('dialog').locator('pre')).toContainText('Independent disk version.')
  await page.getByRole('button', { name: 'Save my version', exact: true }).click()
  await expect.poll(() => readFile(file, 'utf8')).toContain('Keep this browser draft.')
})

test('history, search, file moves, ordering, settings, export and router navigation', async ({ page }) => {
  const info = await createProject(page.request)
  await createDoc(page.request, info.slug, 'Toolbox scene')
  await createDoc(page.request, info.slug, 'Another scene')
  await page.goto(projectUrl(info.slug))
  await page.locator('aside').getByRole('button', { name: 'Open Toolbox scene', exact: true }).click()
  await editor(page).fill('Updated paragraph.')
  await expect(page.getByRole('button', { name: 'All changes saved', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Details', exact: true }).click()
  await page.getByRole('button', { name: 'Version history', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: /words/ }).last().click()
  await expect(page.getByLabel('Revision preview')).toContainText('Original paragraph.')
  await page.getByRole('button', { name: 'Restore to editor', exact: true }).click()
  await expect(editor(page)).toContainText('Original paragraph.')
  await page.getByRole('button', { name: 'Search documents', exact: true }).click()
  await page.getByRole('textbox', { name: 'Search documents', exact: true }).fill('Toolbox')
  await page.getByRole('dialog').getByRole('button', { name: /Toolbox scene/ }).click()
  await page.getByRole('button', { name: 'Details', exact: true }).click()
  await page.getByRole('button', { name: 'Move or rename file', exact: true }).click()
  await page.getByRole('textbox', { name: 'Path within project' }).fill('Manuscript/Chapter 2/Moved.md')
  await page.getByRole('button', { name: 'Move file', exact: true }).click()
  await expect.poll(async () => (await project(page.request, info.slug)).documents.find(doc => doc.title === 'Toolbox scene')?.path).toBe('Manuscript/Chapter 2/Moved.md')
  await chooseSection(page, 'Manuscript')
  await page.getByRole('tab', { name: 'Corkboard' }).click()
  await page.getByRole('button', { name: 'Move Chapter 2 later', exact: true }).click()
  await expect.poll(async () => (await project(page.request, info.slug)).folders.find(folder => folder.path === 'Manuscript')?.itemOrder.at(-1)).toBe('folder:Chapter 2')
  await page.getByRole('button', { name: 'Project settings', exact: true }).click()
  await page.getByRole('spinbutton', { name: 'Manuscript word goal', exact: true }).fill('75000')
  await page.getByRole('button', { name: 'Save settings', exact: true }).click()
  await expect.poll(async () => (await project(page.request, info.slug)).settings.wordGoal).toBe(75000)
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export manuscript', exact: true }).click()
  const download = await downloadPromise
  expect(await readFile((await download.path())!, 'utf8')).toContain('Original paragraph.')
  await page.getByRole('button', { name: 'Projects', exact: true }).click()
  await expect(page).toHaveURL('/webui/')
  const other = unique('New project')
  await page.getByRole('textbox', { name: /^Project title/ }).fill(other)
  await page.getByRole('button', { name: 'Create project', exact: true }).click()
  await expect(page).toHaveURL(projectUrl(other))
  await newDocument(page, 'scene', 'Second project scene')
  await expect(editor(page)).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL(projectUrl(info.slug))
  // The project reopens on what was last open: the Manuscript folder's own document.
  await expect(page.getByRole('heading', { name: 'Manuscript', exact: true })).toBeVisible()
  await page.locator('aside').getByRole('button', { name: 'Open Another scene', exact: true }).click()
  await expect(editor(page)).toContainText('Original paragraph.')
})

test('password login and logout pass cookies between the static UI and the API', async ({ page, context }) => {
  await context.clearCookies()
  await page.goto('/webui/')
  await expect(page.getByRole('heading', { name: 'Unlock Odysseum' })).toBeVisible()
  await page.getByRole('textbox', { name: 'Workspace password' }).fill('wrong-password')
  await page.getByRole('button', { name: 'Unlock workspace', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText(/password/i)
  await page.getByRole('textbox', { name: 'Workspace password' }).fill('integration-password')
  await page.getByRole('button', { name: 'Unlock workspace', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible()
  expect((await context.cookies()).some(cookie => cookie.name === 'odysseum.session' && cookie.httpOnly)).toBe(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Lock workspace', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Unlock Odysseum' })).toBeVisible()
  expect((await page.request.get('/api/projects')).status()).toBe(401)
})

test('unsaved details survive server ID assignment and a second save survives an in-flight metadata request', async ({ page }) => {
  const info = await createProject(page.request)
  await page.goto(projectUrl(info.slug))
  let releaseCreate!: () => void
  const createHeld = new Promise<void>(resolve => { releaseCreate = resolve })
  let creationReceived = false
  await page.route(`**${base(info.slug)}/documents`, async route => {
    if (route.request().method() !== 'POST') return route.continue()
    const response = await route.fetch()
    creationReceived = true
    await createHeld
    await route.fulfill({ response })
  })
  await newDocument(page, 'scene', 'ID handover')
  await editor(page).fill('Typing while the server assigns an ID.')
  await page.getByRole('button', { name: 'Details', exact: true }).click()
  await page.getByRole('textbox', { name: 'Synopsis', exact: true }).fill('An unsaved detail draft.')
  await expect.poll(() => creationReceived).toBe(true)
  releaseCreate()
  await expect.poll(async () => {
    const id = (await project(page.request, info.slug)).documents.find(doc => doc.title === 'ID handover')?.id
    return page.evaluate(realId => Object.keys(localStorage).some(key => key.endsWith(`:details:${realId}`)), id)
  }).toBe(true)
  await expect(page.getByRole('textbox', { name: 'Synopsis', exact: true })).toHaveValue('An unsaved detail draft.')
  let releaseMetadata!: () => void
  const metadataHeld = new Promise<void>(resolve => { releaseMetadata = resolve })
  let metadataReceived = false
  await page.route('**/metadata', async route => {
    if (metadataReceived) return route.continue()
    metadataReceived = true
    const response = await route.fetch()
    await metadataHeld
    await route.fulfill({ response })
  })
  await page.getByRole('button', { name: 'Save details', exact: true }).click()
  await expect.poll(() => metadataReceived).toBe(true)
  await page.getByRole('textbox', { name: 'Synopsis', exact: true }).fill('The later detail edit.')
  await page.getByRole('button', { name: 'Save details', exact: true }).click()
  releaseMetadata()
  await expect.poll(async () => (await project(page.request, info.slug)).documents.find(doc => doc.title === 'ID handover')?.synopsis).toBe('The later detail edit.')
  await closeDialog(page)
  await page.reload()
  await expect(editor(page)).toContainText('Typing while the server assigns an ID.')
  await page.getByRole('button', { name: 'Details', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Synopsis', exact: true })).toHaveValue('The later detail edit.')
})

test('new projects seed Chapter 01, order default folders and protect them until the server setting allows removal', async ({ page }) => {
  const info = await createProject(page.request)
  await page.goto(projectUrl(info.slug))
  const tree = page.locator('aside')
  await expect(tree.getByRole('button', { name: 'Folder Manuscript/Chapter 01', exact: true })).toBeVisible()
  expect((await tree.getByRole('button', { name: /^Folder [^/]+$/ }).allInnerTexts()).map(text => text.trim())).toEqual(['Manuscript', 'Characters', 'Locations', 'Threads', 'Notes'])
  await chooseSection(page, 'Threads')
  await expect(page.getByRole('button', { name: 'Remove empty folder' })).toBeDisabled()
  const toggleSetting = async () => {
    await page.getByRole('button', { name: 'Projects', exact: true }).click()
    await page.getByRole('button', { name: 'Server settings', exact: true }).click()
    await page.getByRole('switch', { name: 'Allow deleting default project folders?' }).click()
    await page.getByRole('button', { name: 'Save settings', exact: true }).click()
    await expect(page.getByRole('dialog')).toBeHidden()
  }
  await toggleSetting()
  await page.goto(projectUrl(info.slug))
  await chooseSection(page, 'Threads')
  await page.getByRole('button', { name: 'Remove empty folder' }).click()
  await expect(tree.getByRole('button', { name: 'Folder Threads', exact: true })).toBeHidden()
  await toggleSetting()
})
