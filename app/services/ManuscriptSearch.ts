import type { ProjectSnapshot, SearchResult } from '../models'
import { allDocuments } from './FolderStructure'

/** Searches on this device, so that it works offline and finds edits that are not saved yet. */
export function searchManuscript(project: ProjectSnapshot, text: (id: string) => string, query: string): SearchResult[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return []
  const results: SearchResult[] = []
  for (const document of allDocuments(project)) {
    const body = text(document.id)
    const position = body.toLowerCase().indexOf(needle)
    if (position < 0 && ![document.title, document.synopsis, document.notes].some(field => field.toLowerCase().includes(needle))) continue
    const start = Math.max(0, position - 55)
    results.push({ document, excerpt: body.substring(start, start + 180).replace(/\n/g, ' ') })
    if (results.length === 50) break
  }
  return results
}
