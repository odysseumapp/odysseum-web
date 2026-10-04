<script setup lang="ts">
import type { Component } from 'vue'
import type { DocumentSummary } from '~/models'
import { folderIcon, kindIcons } from '~/services/FolderStructure'
import type { ViewItem } from '../contract'
const props = defineProps<{ icon?: Component; item?: ViewItem | DocumentSummary }>()
const { project } = useWorkspace()
/** The host's icon for a document or folder, the same as in the sidebar. */
const name = computed(() => {
  const item = props.item
  if (!item) return ''
  if ('type' in item) return item.folder ? (project.value ? folderIcon(project.value, item.folder) : 'i-lucide-folder') : kindIcons[item.document.kind]
  return kindIcons[item.kind]
})
</script>

<template>
  <component :is="icon" v-if="icon" aria-hidden="true" />
  <UIcon v-else-if="name" :name="name" />
</template>
