<script setup lang="ts">
const workspace = useWorkspace()
const { projects, passwordRequired } = workspace
const title = ref('')
const { busy, error, run } = useTask()
const create = () => run(async () => { await workspace.createProject(title.value); title.value = '' })
</script>

<template>
  <UContainer class="w-full py-8 space-y-8">
    <header class="flex items-center justify-between gap-4">
      <h1 class="text-2xl font-semibold">Projects</h1>
      <div class="flex gap-2"><UColorModeButton /><UButton color="neutral" variant="outline" icon="i-lucide-refresh-cw" aria-label="Refresh projects" @click="run(workspace.refresh)" /><UButton v-if="passwordRequired" color="neutral" variant="outline" @click="run(workspace.logout)">Lock workspace</UButton></div>
    </header>
    <UAlert v-if="error" color="error" :description="error" role="alert" />
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Projects">
      <UCard v-for="item in projects" :key="item.id">
        <h2 class="font-semibold mb-2">{{ item.title }}</h2>
        <p class="text-sm text-muted mb-4">{{ item.slug }}</p>
        <UButton :to="`/p/${encodeURIComponent(item.slug)}`" variant="soft" trailing-icon="i-lucide-arrow-right">Open project</UButton>
      </UCard>
    </div>
    <UCard class="max-w-lg">
      <template #header><h2 class="font-semibold">New project</h2></template>
      <form class="space-y-4" @submit.prevent="create">
        <UFormField label="Project title" required><UInput v-model="title" required maxlength="200" class="w-full" /></UFormField>
        <UButton type="submit" icon="i-lucide-plus" :loading="busy">Create project</UButton>
      </form>
    </UCard>
  </UContainer>
</template>
