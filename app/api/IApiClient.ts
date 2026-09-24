export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

export const OFFLINE_MESSAGE = "Can't reach the server. Your work is saved on this device."

export const isOffline = (ex: unknown) => ex instanceof ApiError && (ex.status === 0 || ex.status >= 502)

export interface IApiClient {
  request<T = void>(path: string, method?: string, body?: unknown): Promise<T>
}
