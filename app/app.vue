<script setup lang="ts">
const workspace = useWorkspace()
const { loading, authenticated, error, connected, durable, project } = workspace
const { $pwa } = useNuxtApp()
useHead({ title: () => project.value ? `${project.value.settings.title} — Odysseum` : 'Odysseum' })
</script>

<template>
  <UApp>
    <VitePwaManifest />
    <div class="min-h-dvh flex flex-col">
      <UAlert v-if="error" color="error" variant="soft" :description="error" :close="{ onClick: () => error = '' }" role="alert" />
      <UAlert v-if="!connected" color="warning" variant="soft" title="Offline" description="Changes are saved on this device and will sync when the server is available." />
      <UAlert v-if="!durable" color="warning" title="Browser storage is unavailable" description="Download your drafts before closing this tab." />
      <UAlert v-if="$pwa?.needRefresh" title="An update is available" description="Save your work, then reload to update." :actions="[{ label: 'Reload', onClick: () => $pwa?.updateServiceWorker(true) }]" />
      <div v-if="loading" class="flex flex-1 items-center justify-center gap-3 p-12" role="status"><UIcon name="i-lucide-loader-circle" class="animate-spin" />Loading workspace…</div>
      <WorkspaceLogin v-else-if="!authenticated" />
      <NuxtPage v-else />
    </div>
  </UApp>
</template>
