import type { ProjectSnapshot } from '../models'
import { allDocuments, isScene } from './FolderStructure'

export function exportMarkdown(project: ProjectSnapshot, text: (id: string) => string) {
  const scenes = allDocuments(project).filter(isScene)
  return `# ${project.project.title}\n\n` + scenes.map(doc => `## ${doc.title}\n\n${text(doc.id).trim()}`).join('\n\n---\n\n') + '\n'
}

export function downloadText(name: string, text: string, type = 'text/markdown;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
