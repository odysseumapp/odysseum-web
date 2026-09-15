<script setup lang="ts">
const workspace = useWorkspace()
const password = ref('')
const { busy, error, run } = useTask()
const login = () => run(async () => { await workspace.login(password.value); password.value = ''; await workspace.start() })
</script>

<template>
  <main class="flex flex-1 items-center justify-center p-6">
    <UCard class="w-full max-w-sm">
      <template #header><h1 class="text-xl font-semibold">Unlock Odysseum</h1></template>
      <form class="space-y-4" @submit.prevent="login">
        <UFormField label="Workspace password" required><UInput v-model="password" type="password" autocomplete="current-password" autofocus required class="w-full" /></UFormField>
        <UAlert v-if="error" color="error" :description="error" role="alert" />
        <UButton type="submit" :loading="busy" block>Unlock workspace</UButton>
      </form>
    </UCard>
  </main>
</template>
