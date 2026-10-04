import { test, expect } from '@playwright/test'

test('API documentation remains available directly from the production API without login', async ({ playwright }) => {
  const request = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:5082' })
  try {
    const schema = await request.get('/openapi/v1.json')
    expect(schema.status()).toBe(200)
    const document = await schema.json()
    expect(document.openapi).toMatch(/^3\./)
    expect(document.paths['/api/projects'].post).toBeDefined()
    const reference = await request.get('/scalar')
    expect(reference.status()).toBe(200)
    expect(reference.headers()['content-type']).toContain('text/html')
    expect(await reference.text()).toContain('Odysseum API')
    const root = await request.get('/', { maxRedirects: 0 })
    expect(root.status()).toBe(302)
    expect(root.headers()['location']).toBe('/webui/')
    expect((await request.get('/nothing')).status()).toBe(404)
  } finally { await request.dispose() }
})

test('writes send the item ETag and keep the API response headers', async ({ request }) => {
  expect((await request.post('/api/login', { data: { password: 'integration-password' } })).status()).toBe(200)
  const createdProject = await request.post('/api/projects', { data: { title: `API check ${Date.now()}` } })
  expect(createdProject.status()).toBe(201)
  const project = (await createdProject.json()).data
  const folders = (await (await request.get(`/api/projects/${project.id}/folders`)).json()).data.items
  const manuscript = folders.find((folder: { name: string }) => folder.name === 'Manuscript')
  const createdDocument = await request.post('/api/documents', { data: { folderId: manuscript.id, title: 'Scene', text: 'First draft.' } })
  expect(createdDocument.status()).toBe(201)
  const original = (await createdDocument.json()).data
  const url = `/api/documents/${original.id}/text`
  expect((await request.put(url, { data: { text: 'No ETag.' } })).status()).toBe(428)
  const saved = await request.put(url, { data: { text: 'Revised draft.' }, headers: { 'If-Match': `"${original.etag}"` } })
  expect(saved.status()).toBe(200)
  expect(saved.headers()['cache-control']).toBe('no-store')
  expect(saved.headers()['x-content-type-options']).toBe('nosniff')
  expect((await saved.json()).data.wordCount).toBe(2)
  expect((await request.put(url, { data: { text: 'Stale.' }, headers: { 'If-Match': `"${original.etag}"` } })).status()).toBe(412)
  expect((await (await request.get(url)).json()).data.text).toBe('Revised draft.')
})
