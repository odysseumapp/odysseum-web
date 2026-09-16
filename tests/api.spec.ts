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
    // The site root redirects to the installed static UI; the SPA fallback does not cover other paths.
    const root = await request.get('/', { maxRedirects: 0 })
    expect(root.status()).toBe(302)
    expect(root.headers()['location']).toBe('/webui/')
    expect((await request.get('/nothing')).status()).toBe(404)
  } finally { await request.dispose() }
})

test('standard JSON writes work against the API and preserve API response headers', async ({ request }) => {
  expect((await request.post('/api/login', { data: { password: 'integration-password' } })).status()).toBe(200)
  const createdProject = await request.post('/api/projects', { data: { title: `API check ${Date.now()}` } })
  expect(createdProject.status()).toBe(201)
  const project = (await createdProject.json()).data
  const documents = `/api/projects/${encodeURIComponent(project.slug)}/documents`
  const createdDocument = await request.post(documents, { data: { title: 'Scene', folder: 'Manuscript', content: 'First draft.' } })
  expect(createdDocument.status()).toBe(201)
  const original = (await createdDocument.json()).data
  const url = `${documents}/${original.document.id}`
  const saved = await request.put(url, { data: { content: 'Revised draft.', revision: original.document.revision } })
  expect(saved.status()).toBe(200)
  expect(saved.headers()['cache-control']).toBe('no-store')
  expect(saved.headers()['x-content-type-options']).toBe('nosniff')
  expect((await (await request.get(url)).json()).data.content).toBe('Revised draft.')
})
