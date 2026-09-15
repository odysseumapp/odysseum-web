/** Serialize local mirror changes without holding the queue during network requests. */
export class MutationQueue {
  private tail: Promise<unknown> = Promise.resolve()
  run<T>(action: () => Promise<T>): Promise<T> {
    const result = this.tail.then(action)
    this.tail = result.catch(() => undefined)
    return result
  }
}
