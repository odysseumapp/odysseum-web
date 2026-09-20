<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { Editor, EditorContent } from '@tiptap/vue-3'
import { BubbleMenu } from '@tiptap/vue-3/menus'
import { Extension, type Editor as CoreEditor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import Typography from '@tiptap/extension-typography'
import Highlight from '@tiptap/extension-highlight'
import Image from '@tiptap/extension-image'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { TableKit } from '@tiptap/extension-table'
import { Focus, Placeholder } from '@tiptap/extensions'
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Mark, Node as PMNode } from '@tiptap/pm/model'
import { StyledBlock, StyledText, attributesFor } from '~/services/Styles'

/** `editable` off is reading mode: the same rendering, nothing to type into and no Markdown hints. */
const props = defineProps<{ modelValue: string; documentId: string; source: boolean; focus: boolean; editable: boolean; fontSize: number }>()
const emit = defineEmits<{ 'update:modelValue': [value: string]; save: [] }>()
const editor = shallowRef<Editor>()
/** The style at the cursor, '' for none: of the selected text when there is a selection, else of the block. */
const style = ref('')
let newline = '\n'
let current = '' // the markdown the editor last loaded or emitted, so echoes from the store do not reset the cursor

// Shows the Markdown syntax (`## `, `**`, `> `, `- `…) as dimmed, non-editable hints inside the
// block the cursor is in, or in every block when the Source toggle is on. The document itself
// stays rich text; the hints are widget decorations so they never end up in the saved file.
const hintKey = new PluginKey('markdown-hints')
const symbols: Record<string, [string, (mark: Mark) => string]> = {
  bold: ['**', () => '**'], italic: ['*', () => '*'], strike: ['~~', () => '~~'], code: ['`', () => '`'],
  highlight: ['==', () => '=='], link: ['[', mark => `](${mark.attrs.href ?? ''})`],
  styledText: ['[', mark => `]${attributesFor(mark.attrs.class ?? '', true)}`],
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
    else if (node.type.name === 'taskItem' && $pos.index(depth) === 0) text += node.attrs.checked ? '- [x] ' : '- [ ] '
  }
  if (block.type.name === 'heading') text += `${'#'.repeat(block.attrs.level)} `
  if (block.type.name === 'codeBlock') text += `\`\`\`${block.attrs.language ?? ''}\n`
  return text
}
function hints(state: EditorState, all: boolean) {
  if (!props.editable) return DecorationSet.empty
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

function currentStyle(instance: CoreEditor) {
  if (!instance.state.selection.empty && instance.isActive('styledText')) return instance.getAttributes('styledText').class ?? ''
  return instance.isActive('styled') ? instance.getAttributes('styled').class ?? '' : ''
}

function create() {
  editor.value?.destroy()
  newline = props.modelValue.includes('\r\n') ? '\r\n' : '\n'
  current = props.modelValue
  editor.value = new Editor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }), Markdown, MarkdownHints, Shortcuts, StyledBlock, StyledText,
      // Curly quotes, em dashes and ellipses as you type; the symbol and fraction rules stay off so prose like 1/2 or 2x4 is left alone.
      Typography.configure({ copyright: false, trademark: false, servicemark: false, registeredTrademark: false, oneHalf: false, oneQuarter: false, threeQuarters: false, plusMinus: false, notEqual: false, laquo: false, raquo: false, multiplication: false, superscriptTwo: false, superscriptThree: false }),
      Highlight, Image, TaskList, TaskItem.configure({ nested: true }), TableKit.configure({ table: { resizable: false } }),
      Placeholder.configure({ placeholder: 'Start writing…' }),
      // Marks the top-level block the cursor is in; focus mode dims the others.
      Focus.configure({ mode: 'shallowest' }),
    ],
    content: props.modelValue,
    contentType: 'markdown',
    editable: props.editable,
    editorProps: { attributes: { 'aria-label': 'Document editor', role: 'textbox', 'aria-multiline': 'true', spellcheck: 'true', autocapitalize: 'sentences' } },
    onUpdate: ({ editor }) => {
      current = editor.getMarkdown().replaceAll('\n', newline)
      emit('update:modelValue', current)
    },
    onTransaction: ({ editor }) => { style.value = currentStyle(editor) },
  })
}
function setStyle(name: string) { editor.value?.chain().focus().setStyle(name).run() }

const bubble = [
  { type: 'bold', mark: 'bold', label: 'Bold', icon: 'i-lucide-bold' }, { type: 'italic', mark: 'italic', label: 'Italic', icon: 'i-lucide-italic' },
  { type: 'strike', mark: 'strike', label: 'Strikethrough', icon: 'i-lucide-strikethrough' }, { type: 'highlight', mark: 'highlight', label: 'Highlight', icon: 'i-lucide-highlighter' },
  { type: 'code', mark: 'code', label: 'Code', icon: 'i-lucide-code' },
]
function format(type: string) {
  const chain = editor.value?.chain().focus()
  if (!chain) return
  if (type === 'undo') chain.undo()
  else if (type === 'redo') chain.redo()
  else if (type === 'bold') chain.toggleBold()
  else if (type === 'italic') chain.toggleItalic()
  else if (type === 'strike') chain.toggleStrike()
  else if (type === 'code') chain.toggleCode()
  else if (type === 'heading') chain.toggleHeading({ level: 2 })
  else if (type === 'quote') chain.toggleBlockquote()
  else if (type === 'list') chain.toggleBulletList()
  else if (type === 'tasks') chain.toggleTaskList()
  else if (type === 'highlight') chain.toggleHighlight()
  else if (type === 'table') chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true })
  else if (type === 'break') chain.setHorizontalRule()
  chain.run()
}
const refreshHints = () => { const view = editor.value?.view; view?.dispatch(view.state.tr.setMeta(hintKey, true)) }
onMounted(create)
watch(() => props.documentId, create)
watch(() => props.modelValue, value => {
  if (!editor.value || value === current) return
  current = value
  editor.value.commands.setContent(value, { contentType: 'markdown', emitUpdate: false })
})
watch(() => props.source, refreshHints)
watch(() => props.editable, value => { editor.value?.setEditable(value, false); refreshHints() })
onBeforeUnmount(() => editor.value?.destroy())
defineExpose({ format, setStyle, style, focus: () => editor.value?.commands.focus() })
</script>

<template>
  <!-- The size is also a variable, so text tagged `normal` inside a resized style can come back to it. -->
  <EditorContent :editor="editor" class="document-editor document-prose" :class="{ 'show-source': source && editable, 'focus-mode': focus }" :style="{ fontSize: `${fontSize}px`, '--document-font-size': `${fontSize}px` }" />
  <!-- Floating formatting menu over the selected text, so the top toolbar is not needed mid-paragraph. -->
  <BubbleMenu v-if="editor && editable" :editor="editor" :should-show="({ editor, from, to }) => from !== to && editor.isEditable && !editor.isActive('codeBlock')" class="flex items-center gap-0.5 rounded-md border border-default bg-default p-1 shadow-lg">
    <UButton v-for="action in bubble" :key="action.type" size="xs" color="neutral" :variant="editor.isActive(action.mark) ? 'soft' : 'ghost'" :icon="action.icon" :aria-label="action.label" :title="action.label" :aria-pressed="editor.isActive(action.mark)" @click="format(action.type)" />
  </BubbleMenu>
</template>
