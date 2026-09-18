<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef, watch } from 'vue'
import { Editor, EditorContent } from '@tiptap/vue-3'
import { Extension } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Mark, Node as PMNode } from '@tiptap/pm/model'

const props = defineProps<{ modelValue: string; documentId: string; source: boolean; fontSize: number }>()
const emit = defineEmits<{ 'update:modelValue': [value: string]; save: [] }>()
const editor = shallowRef<Editor>()
let newline = '\n'
let current = '' // the markdown the editor last loaded or emitted, so echoes from the store do not reset the cursor

// Shows the Markdown syntax (`## `, `**`, `> `, `- `…) as dimmed, non-editable hints inside the
// block the cursor is in, or in every block when the Source toggle is on. The document itself
// stays rich text; the hints are widget decorations so they never end up in the saved file.
const hintKey = new PluginKey('markdown-hints')
const symbols: Record<string, [string, (mark: Mark) => string]> = {
  bold: ['**', () => '**'], italic: ['*', () => '*'], strike: ['~~', () => '~~'], code: ['`', () => '`'],
  link: ['[', mark => `](${mark.attrs.href ?? ''})`],
}
function hint(pos: number, text: string, side: number, className = 'md-mark') {
  return Decoration.widget(pos, () => Object.assign(document.createElement('span'), { className, textContent: text }), { side, key: `${side}${text}` })
}
function blockPrefix(doc: PMNode, pos: number, block: PMNode) {
  const $pos = doc.resolve(pos)
  let text = ''
  for (let depth = 1; depth <= $pos.depth; depth++) {
    const node = $pos.node(depth)
    if (node.type.name === 'blockquote') text += '> '
    else if (node.type.name === 'listItem' && $pos.index(depth) === 0) {
      const list = $pos.node(depth - 1)
      text += list.type.name === 'orderedList' ? `${(list.attrs.start ?? 1) + $pos.index(depth - 1)}. ` : '- '
    }
  }
  if (block.type.name === 'heading') text += `${'#'.repeat(block.attrs.level)} `
  if (block.type.name === 'codeBlock') text += `\`\`\`${block.attrs.language ?? ''}\n`
  return text
}
function hints(state: EditorState, all: boolean) {
  const out: Decoration[] = []
  const ranges = state.selection.ranges.map(range => [range.$from.pos, range.$to.pos])
  state.doc.descendants((block, pos) => {
    if (!block.isTextblock) return true
    const end = pos + block.nodeSize
    if (!all && !ranges.some(([from, to]) => from <= end && to >= pos)) return false
    const prefix = blockPrefix(state.doc, pos, block)
    if (prefix) out.push(hint(pos + 1, prefix, -1, /^(- |\d+\. )/.test(prefix) ? 'md-mark md-list' : 'md-mark'))
    let open: Mark[] = []
    block.forEach((child, offset) => {
      const at = pos + 1 + offset
      for (const mark of [...open].reverse()) if (!mark.isInSet(child.marks)) { out.push(hint(at, symbols[mark.type.name]![1](mark), -1)); open = open.filter(other => other !== mark) }
      for (const mark of child.marks) if (symbols[mark.type.name] && !open.some(other => other.eq(mark))) { out.push(hint(at, symbols[mark.type.name]![0], 1)); open.push(mark) }
    })
    for (const mark of [...open].reverse()) out.push(hint(end - 1, symbols[mark.type.name]![1](mark), -1))
    if (block.type.name === 'codeBlock') out.push(hint(end - 1, '\n```', 1))
    return false
  })
  return DecorationSet.create(state.doc, out)
}
const MarkdownHints = Extension.create({
  name: 'markdownHints',
  addProseMirrorPlugins() {
    return [new Plugin({
      key: hintKey,
      state: {
        init: (_, state) => hints(state, props.source),
        apply: (tr, old, _, state) => tr.docChanged || tr.selectionSet || tr.getMeta(hintKey) ? hints(state, props.source) : old,
      },
      props: { decorations: state => hintKey.getState(state) },
    })]
  },
})
const Shortcuts = Extension.create({
  name: 'documentShortcuts',
  addKeyboardShortcuts: () => ({ 'Mod-s': () => { emit('save'); return true } }),
})

function create() {
  editor.value?.destroy()
  newline = props.modelValue.includes('\r\n') ? '\r\n' : '\n'
  current = props.modelValue
  editor.value = new Editor({
    extensions: [StarterKit.configure({ link: { openOnClick: false } }), Markdown, MarkdownHints, Shortcuts],
    content: props.modelValue,
    contentType: 'markdown',
    editorProps: { attributes: { 'aria-label': 'Document editor', role: 'textbox', 'aria-multiline': 'true', spellcheck: 'true', autocapitalize: 'sentences' } },
    onUpdate: ({ editor }) => {
      current = editor.getMarkdown().replaceAll('\n', newline)
      emit('update:modelValue', current)
    },
  })
}

function format(type: string) {
  const chain = editor.value?.chain().focus()
  if (!chain) return
  if (type === 'undo') chain.undo()
  else if (type === 'redo') chain.redo()
  else if (type === 'bold') chain.toggleBold()
  else if (type === 'italic') chain.toggleItalic()
  else if (type === 'strike') chain.toggleStrike()
  else if (type === 'heading') chain.toggleHeading({ level: 2 })
  else if (type === 'quote') chain.toggleBlockquote()
  else if (type === 'list') chain.toggleBulletList()
  else if (type === 'break') chain.setHorizontalRule()
  chain.run()
}
onMounted(create)
watch(() => props.documentId, create)
watch(() => props.modelValue, value => {
  if (!editor.value || value === current) return
  current = value
  editor.value.commands.setContent(value, { contentType: 'markdown' })
})
watch(() => props.source, () => { const view = editor.value?.view; view?.dispatch(view.state.tr.setMeta(hintKey, true)) })
onBeforeUnmount(() => editor.value?.destroy())
defineExpose({ format, focus: () => editor.value?.commands.focus() })
</script>

<template><EditorContent :editor="editor" class="document-editor document-prose" :class="{ 'show-source': source }" :style="{ fontSize: `${fontSize}px` }" /></template>
