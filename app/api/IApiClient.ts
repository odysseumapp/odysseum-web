export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

export const OFFLINE_MESSAGE = "Can't reach the server. Your work is saved on this device."

export const isOffline = (ex: unknown) => ex instanceof ApiError && (ex.status === 0 || ex.status >= 502)
/** The item changed on the server since the browser read it (412), so its ETag no longer matches. */
export const isETagMismatch = (ex: unknown) => ex instanceof ApiError && ex.status === 412
export const isNotFound = (ex: unknown) => ex instanceof ApiError && ex.status === 404

export interface RequestOptions {
  method?: string
  body?: unknown
  /** The ETag of the item as the browser last read it. It goes in the If-Match header. */
  ifMatch?: string
}

export interface IApiClient {
  request<T = void>(path: string, options?: RequestOptions): Promise<T>
}
