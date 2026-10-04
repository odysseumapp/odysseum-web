import { ApiError, OFFLINE_MESSAGE, type IApiClient, type RequestOptions } from './IApiClient'

interface Envelope<T> { apiVersion: string; data?: T; error?: { code: number; message: string } }

export class FetchApiClient implements IApiClient {
  constructor(private readonly root = '/api') {}

  async request<T = void>(path: string, { method = 'GET', body, ifMatch }: RequestOptions = {}): Promise<T> {
    let response: Response
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (ifMatch !== undefined) headers['If-Match'] = `"${ifMatch}"`
    try {
      response = await fetch(`${this.root}${path}`, {
        method,
        credentials: 'same-origin',
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch {
      throw new ApiError(0, OFFLINE_MESSAGE)
    }
    const text = await response.text()
    let envelope: Envelope<T> | undefined
    try { envelope = text ? JSON.parse(text) as Envelope<T> : undefined } catch { envelope = undefined }
    if (!response.ok) throw new ApiError(response.status, envelope?.error?.message ?? `Request failed (${response.status}). Your work is saved on this device.`)
    return envelope?.data as T
  }
}
