import type { Project } from '../models'
import { isScene } from './FileNames'

export function exportMarkdown(project: Project, content: (id: string) => string) {
  const scenes = project.documents.filter(doc => isScene(doc.path))
  return `# ${project.settings.title}\n\n` + scenes.map(doc => `## ${doc.title}\n\n${content(doc.id).trim()}`).join('\n\n---\n\n') + '\n'
}

export function downloadText(name: string, text: string, type = 'text/markdown;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
