import { Mark, Node, mergeAttributes } from '@tiptap/core'
import type { MarkdownToken } from '@tiptap/core'
import type { DocumentSummary } from '../models'

const NAME = /^[A-Za-z_][\w-]*$/
export function classesOf(attributes: string | undefined) {
  const text = (attributes ?? '').trim().replace(/^\{|\}$/g, '')
  if (NAME.test(text)) return text
  const names = [...text.matchAll(/\.([\w-]+)|\bclass="([^"]*)"/g)].flatMap(match => (match[1] ?? match[2] ?? '').split(/\s+/)).filter(Boolean)
  return names.join(' ')
}
export const attributesFor = (classes: string, braced: boolean) => {
  const names = classes.split(/\s+/).filter(Boolean)
  return names.length === 1 && !braced ? names[0]! : `{${names.map(name => `.${name}`).join(' ')}}`
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> { styles: { setStyle: (name: string) => ReturnType } }
}

const OPEN = /^:{3,}[ \t]*(?:\{([^}\n]*)\}|([A-Za-z_][\w-]*))?[ \t]*(?:\n|$)/

export const StyledBlock = Node.create({
  name: 'styled',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return { class: { default: '', parseHTML: element => element.getAttribute('data-style') ?? '', renderHTML: () => ({}) } }
  },
  parseHTML: () => [{ tag: 'div[data-style]' }],
  renderHTML: ({ node, HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-style': node.attrs.class, class: node.attrs.class }), 0],
  markdownTokenizer: {
    name: 'styled',
    level: 'block',
    start: src => src.search(/^:{3,}/m),
    tokenize(src, _tokens, lexer) {
      const open = OPEN.exec(src)
      if (!open) return undefined
      const fence = /^:{3,}(.*)$/gm
      fence.lastIndex = open[0].length
      for (let depth = 1, match = fence.exec(src); match; match = fence.exec(src)) {
        depth += match[1]!.trim() ? 1 : -1
        if (depth > 0) continue
        const inner = src.slice(open[0].length, match.index)
        const tokens = lexer.blockTokens(inner) as MarkdownToken[]
        for (const token of tokens) if (token.text && !token.tokens?.length) token.tokens = lexer.inlineTokens(token.text)
        return { type: 'styled', raw: src.slice(0, match.index + match[0].length), style: classesOf(open[1] ?? open[2]), tokens }
      }
      return undefined
    },
  },
  parseMarkdown: (token, h) => ({ type: 'styled', attrs: { class: token.style ?? '' }, content: h.parseChildren(token.tokens ?? []) }),
  renderMarkdown: (node, h) => `::: ${attributesFor(node.attrs?.class ?? '', false)}\n\n${h.renderChildren(node.content ?? [], '\n\n')}\n\n:::`,
})

export const StyledText = Mark.create({
  name: 'styledText',
  addAttributes() {
    return { class: { default: '', parseHTML: element => element.getAttribute('data-style') ?? '', renderHTML: () => ({}) } }
  },
  parseHTML: () => [{ tag: 'span[data-style]' }],
  renderHTML: ({ mark, HTMLAttributes }) => ['span', mergeAttributes(HTMLAttributes, { 'data-style': mark.attrs.class, class: mark.attrs.class }), 0],
  markdownTokenizer: {
    name: 'styledText',
    level: 'inline',
    start: src => src.indexOf('['),
    tokenize(src, _tokens, lexer) {
      const match = /^\[((?:[^[\]\n]|\[[^[\]\n]*\])+)\]\{([^}\n]*)\}/.exec(src)
      const style = match && classesOf(match[2])
      if (!match || !style) return undefined
      return { type: 'styledText', raw: match[0], text: match[1], style, tokens: lexer.inlineTokens(match[1]!) }
    },
  },
  parseMarkdown: (token, h) => h.applyMark('styledText', h.parseInline(token.tokens ?? []), { class: token.style }),
  renderMarkdown: (node, h) => `[${h.renderChildren(node)}]${attributesFor(node.attrs?.class ?? '', true)}`,
  addCommands() {
    return {
      setStyle: name => ({ chain, state, editor }) => {
        const styled = editor.isActive('styled')
        if (!state.selection.empty) return name ? chain().setMark('styledText', { class: name }).run() : chain().unsetMark('styledText').run()
        if (styled) return name ? chain().updateAttributes('styled', { class: name }).run() : chain().lift('styled').run()
        return !!name && chain().wrapIn('styled', { class: name }).run()
      },
    }
  },
})

export function cssOf(markdown: string) {
  return [...markdown.matchAll(/^ {0,3}(`{3,}|~{3,})[ \t]*(?:css)?[ \t]*\n([\s\S]*?)\n {0,3}\1[ \t]*$/gm)].map(match => match[2]!).join('\n')
}

interface Rule { prelude: string; body: string }
function rulesOf(source: string) {
  const css = source.replace(/\/\*[\s\S]*?\*\//g, '')
  const rules: Rule[] = []
  for (let start = 0, open = -1, depth = 0, i = 0; i < css.length; i++) {
    const char = css[i]
    if (char === '"' || char === "'") { i = css.indexOf(char, i + 1); if (i < 0) break; continue }
    if (char === '{') { if (depth++ === 0) open = i }
    else if (char === '}') { if (depth > 0 && --depth === 0) { rules.push({ prelude: css.slice(start, open).trim(), body: css.slice(open + 1, i) }); start = i + 1 } }
    else if (char === ';' && depth === 0) { rules.push({ prelude: css.slice(start, i + 1).trim(), body: '' }); start = i + 1 }
  }
  return rules
}
const declared = (body: string) => [...body.matchAll(/(?:^|[;{}]|\*\/)\s*([a-zA-Z-]+)\s*:/g)].map(match => match[1]!.toLowerCase())

const STYLE = /^\.([A-Za-z_][\w-]*)(?![\w-])/
const passThrough = /^@(?:font-face|page|import|charset|namespace|counter-style|property|font-feature-values)\b/
const pageValues: Record<string, string> = {
  'color': 'var(--ui-text)', 'font-family': 'var(--default-font-family, ui-sans-serif, system-ui, sans-serif)',
  'font-size': 'var(--document-font-size)', 'line-height': '1.75',
}

export function compileStyles(sheets: string[]) {
  const rules = rulesOf(sheets.join('\n'))
  const kept = rules.filter(rule => passThrough.test(rule.prelude)).map(rule => rule.body ? `${rule.prelude} {${rule.body}}` : rule.prelude)
  const styles = rules.map(rule => ({ ...rule, selectors: rule.prelude.split(',').map(s => s.trim()).filter(s => STYLE.test(s)) })).filter(rule => rule.selectors.length)
  const nameOf = (selector: string) => STYLE.exec(selector)![1]!
  const names = [...new Set(styles.flatMap(rule => rule.selectors.map(nameOf)))]
  const page = styles.flatMap(rule => rule.selectors.filter(s => nameOf(s) === 'normal').map(s => `.document-prose${s.slice('.normal'.length)} {${rule.body}}`))
  const used = new Set(styles.filter(rule => rule.selectors.some(s => nameOf(s) !== 'normal')).flatMap(rule => declared(rule.body)))
  const set = new Set(styles.filter(rule => rule.selectors.some(s => nameOf(s) === 'normal')).flatMap(rule => declared(rule.body)))
  const resets = [...used].filter(property => !set.has(property)).map(property => `${property}: ${pageValues[property] ?? 'initial'};`).join(' ')
  const scoped = styles.map(rule => `${rule.selectors.map(s => `.document-prose ${s}`).join(', ')} {${rule.body}}`)
  return { css: [...kept, ...page, resets && `.document-prose .normal { ${resets} }`, ...scoped].filter(Boolean).join('\n'), names }
}

export const isStyleDocument = (doc: DocumentSummary) => doc.kind === 'style'
