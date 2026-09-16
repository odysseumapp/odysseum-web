export function startItemDrag(event: DragEvent, path: string, key: string) {
  event.dataTransfer?.setData('application/x-odysseum-item', JSON.stringify({ path, key }))
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}
export function draggedItem(event: DragEvent, path: string): string | undefined {
  try {
    const item = JSON.parse(event.dataTransfer?.getData('application/x-odysseum-item') ?? '')
    if (item.path === path && typeof item.key === 'string') return item.key
  } catch { /* Ignore drags from other applications. */ }
}
