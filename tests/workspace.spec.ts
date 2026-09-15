import { test, expect, type Page, type APIRequestContext, type BrowserContext } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { DocumentContent, Project, ProjectInfo } from '../app/models'

const unique = (label: string) => `${label} ${Date.now()}`
const base = (slug: string) => `/api/projects/${encodeURIComponent(slug)}`
const projectUrl = (slug: string) => `/p/${encodeURIComponent(slug)}`
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
  await page.getByRole('combobox', { name: 'Section', exact: true }).click()
  await page.getByRole('option', { name, exact: true }).click()
}
async function newDocument(page: Page, kind: string, title: string) {
  await page.getByRole('button', { name: `New ${kind}`, exact: true }).first().click()
  await page.getByRole('dialog').getByRole('textbox', { name: /^Title/ }).fill(title)
  await page.getByRole('button', { name: `Create ${kind}`, exact: true }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
}
let cookies: Awaited<ReturnType<BrowserContext['cookies']>>
test.beforeAll(async ({ playwright }) => {
  const request = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:3001' })
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
  await expect(page.getByRole('heading', { name: 'Corkboard' })).toBeVisible()
  await page.getByRole('tab', { name: 'Outline' }).click()
  await expect(page.getByRole('table')).toContainText('First scene')
  await page.getByRole('tab', { name: 'Write', exact: true }).click()
  await page.getByRole('button', { name: 'Focus', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Projects', exact: true })).toBeHidden()
  await page.getByRole('button', { name: 'Exit focus', exact: true }).click()
  await page.screenshot({ path: '.test-data/desktop.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Documents', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'First scene', exact: true }).click()
  await expect(editor(page)).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: '.test-data/mobile.png', fullPage: true })
  expect(errors).toEqual([])
})

test('creates files, saves metadata and links characters and locations', async ({ page }) => {
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
  for (const [field, item] of [['Characters', 'Ada'], ['Locations', 'Harbor']]) {
    await page.getByRole('combobox', { name: field, exact: true }).click()
    await page.getByRole('option', { name: item, exact: true }).click()
    await page.keyboard.press('Escape')
  }
  await page.getByRole('button', { name: 'Save details', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Save details', exact: true })).toBeHidden()
  await closeDialog(page)
  await expect.poll(async () => {
    const current = await project(page.request, info.slug)
    const scene = current.documents.find(doc => doc.title === 'Arrival')
    return scene && { synopsis: scene.synopsis, characters: scene.characters.length, locations: scene.locations.length }
  }).toEqual({ synopsis: 'A meeting by the water.', characters: 1, locations: 1 })
  const scene = (await project(page.request, info.slug)).documents.find(doc => doc.title === 'Arrival')!
  await expect.poll(() => readFile(path.resolve('.test-data/workspace', info.slug, scene.path), 'utf8')).toContain('A **new** chapter begins.')
  await page.reload()
  await expect(editor(page)).toContainText('chapter begins.')
  await page.getByRole('button', { name: 'Details', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Synopsis' })).toHaveValue('A meeting by the water.')
  await closeDialog(page)
  await chooseSection(page, 'Characters')
  await page.getByRole('button', { name: 'Ada', exact: true }).click()
  await page.getByRole('button', { name: 'Details', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Arrival', exact: true })).toBeVisible()
})

test('arcs contain only Beats with independent positions, keyboard controls and dragging', async ({ page }) => {
  const info = await createProject(page.request)
  await createDoc(page.request, info.slug, 'A character', 'Characters')
  await createDoc(page.request, info.slug, 'A location', 'Locations')
  await page.goto(projectUrl(info.slug))
  await chooseSection(page, 'Arcs')
  await newDocument(page, 'arc', 'Race')
  await newDocument(page, 'arc', 'Class')
  await page.getByRole('button', { name: 'Add beat to Race', exact: true }).click()
  await page.getByRole('textbox', { name: 'Beat title' }).fill('Revelation')
  await page.getByRole('button', { name: 'Create beat', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Race arc', exact: true })).toContainText('Revelation')
  await page.getByRole('button', { name: 'Add beat to Class', exact: true }).click()
  await page.getByRole('button', { name: 'Existing beat', exact: true }).click()
  await page.getByRole('combobox', { name: /^Beat/ }).click()
  await expect(page.getByRole('option')).toHaveCount(1)
  await page.getByRole('option', { name: 'Revelation', exact: true }).click()
  await page.getByRole('spinbutton', { name: /^Position/ }).fill('4')
  await page.getByRole('button', { name: 'Add to arc', exact: true }).click()
  const race = page.getByRole('region', { name: 'Race arc', exact: true })
  const classArc = page.getByRole('region', { name: 'Class arc', exact: true })
  await page.getByRole('button', { name: 'Move Revelation right on Race', exact: true }).click()
  await expect(race.locator('[data-position]')).toHaveAttribute('data-position', '1')
  await expect(classArc.locator('[data-position]')).toHaveAttribute('data-position', '3')
  const point = race.locator('[data-position]')
  const bounds = await point.boundingBox()
  expect(bounds).not.toBeNull()
  await page.mouse.move(bounds!.x + 12, bounds!.y + 10)
  await page.mouse.down()
  await page.mouse.move(bounds!.x + 202, bounds!.y + 10, { steps: 12 })
  await page.mouse.up()
  await expect(point).toHaveAttribute('data-position', '2')
  await expect(classArc.locator('[data-position]')).toHaveAttribute('data-position', '3')
  await page.screenshot({ path: '.test-data/arcs.png', fullPage: true })
  await race.getByRole('button', { name: 'Open Revelation', exact: true }).click()
  await editor(page).fill('A beat has its own document content.')
  await expect.poll(async () => (await project(page.request, info.slug)).documents.find(doc => doc.title === 'Revelation')?.kind).toBe('beat')
  await expect.poll(async () => {
    const doc = (await project(page.request, info.slug)).documents.find(doc => doc.title === 'Revelation')!
    return readFile(path.resolve('.test-data/workspace', info.slug, doc.path), 'utf8')
  }).toContain('A beat has its own document content.')
})

test('offline reload preserves edits and replays newly created arcs and beats', async ({ page, context }) => {
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
  await page.waitForTimeout(250) // The local mirror batches keystrokes for 150ms.
  await page.reload()
  await expect(editor(page)).toContainText('Written with no connection.')
  await chooseSection(page, 'Arcs')
  await newDocument(page, 'arc', 'Offline arc')
  await page.getByRole('button', { name: 'Add beat to Offline arc' }).click()
  await page.getByRole('textbox', { name: 'Beat title' }).fill('Offline beat')
  await page.getByRole('button', { name: 'Create beat', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Offline arc arc', exact: true })).toContainText('Offline beat')
  await page.reload()
  await chooseSection(page, 'Arcs')
  await expect(page.getByRole('region', { name: 'Offline arc arc', exact: true })).toContainText('Offline beat')
  await context.setOffline(false)
  await expect.poll(async () => {
    const current = await project(page.request, info.slug)
    const arc = current.documents.find(doc => doc.title === 'Offline arc')
    const beat = current.documents.find(doc => doc.title === 'Offline beat')
    return arc && beat ? { kind: beat.kind, position: beat.arcPositions[arc.id] } : null
  }, { timeout: 20000 }).toEqual({ kind: 'beat', position: 0 })
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
  await page.getByRole('button', { name: 'Toolbox scene', exact: true }).click()
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
  const before = (await project(page.request, info.slug)).documents.map(doc => doc.id)
  await page.getByRole('button', { name: 'Move Toolbox scene down', exact: true }).click()
  await expect.poll(async () => (await project(page.request, info.slug)).documents.map(doc => doc.id)).not.toEqual(before)
  await page.getByRole('button', { name: 'Project settings', exact: true }).click()
  await page.getByRole('spinbutton', { name: 'Manuscript word goal', exact: true }).fill('75000')
  await page.getByRole('button', { name: 'Save settings', exact: true }).click()
  await expect.poll(async () => (await project(page.request, info.slug)).settings.wordGoal).toBe(75000)
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export manuscript', exact: true }).click()
  const download = await downloadPromise
  expect(await readFile((await download.path())!, 'utf8')).toContain('Original paragraph.')
  await page.getByRole('button', { name: 'Projects', exact: true }).click()
  await expect(page).toHaveURL('/')
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
  await expect(editor(page)).toContainText('Original paragraph.')
})

test('password login and logout pass cookies through the frontend proxy', async ({ page, context }) => {
  await context.clearCookies()
  await page.goto('/')
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
