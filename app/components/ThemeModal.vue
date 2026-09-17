<script setup lang="ts">
import { themeRoles, type Theme } from '~/models'
import { palettesFor, roleLabels, swatch } from '~/services/Themes'

const open = defineModel<boolean>('open', { required: true })
const theme = useTheme()
const { colors, name, saved, isDefault } = theme
const { busy, error, run } = useTask()
const saveAs = ref('')
const confirming = ref('')
watch(open, value => {
  if (!value) return
  error.value = ''
  confirming.value = ''
  saveAs.value = name.value
  // Offline the library is simply empty; the colours on screen are kept on this device either way.
  void run(theme.list)
})
watch(name, value => { if (value) saveAs.value = value })
const canSave = computed(() => saveAs.value.trim().length > 0 && saveAs.value.trim().length <= 60)
const save = () => run(async () => { await theme.save(saveAs.value); confirming.value = '' })
const remove = (named: string) => run(async () => { await theme.remove(named); confirming.value = '' })
function load(item: Theme) {
  theme.use(item)
  saveAs.value = item.name
}
</script>

<template>
  <UModal v-model:open="open" title="Appearance" description="Choose the colours this browser shows, and keep the ones you like on the server." :ui="{ content: 'max-w-2xl' }">
    <template #body>
      <div class="space-y-6">
        <UFormField label="Light or dark" help="Remembered by this browser.">
          <UColorModeSelect />
        </UFormField>

        <section class="space-y-3" aria-label="Colour scheme">
          <h3 class="font-semibold">Colours</h3>
          <fieldset v-for="role in themeRoles" :key="role">
            <legend class="text-sm text-muted mb-1">{{ roleLabels[role] }}</legend>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="palette in palettesFor(role)" :key="palette" type="button"
                class="size-5 rounded-full border border-default ring-offset-2 ring-offset-default transition"
                :class="colors[role] === palette ? 'ring-2 ring-inverted' : 'hover:scale-110'"
                :style="{ backgroundColor: swatch(palette) }"
                :aria-label="`${roleLabels[role]} ${palette}`" :aria-pressed="colors[role] === palette"
                @click="theme.set(role, palette)"
              />
            </div>
          </fieldset>
        </section>

        <section class="space-y-2" aria-label="Saved themes">
          <h3 class="font-semibold">Saved themes</h3>
          <p v-if="!saved.length" class="text-sm text-muted">Nothing saved yet. Name the colours above to keep them on the server.</p>
          <ul v-else class="space-y-1">
            <li v-for="item in saved" :key="item.name" class="flex items-center gap-2">
              <UButton color="neutral" :variant="name === item.name ? 'soft' : 'ghost'" class="flex-1 min-w-0 justify-start gap-2" :aria-label="`Use theme ${item.name}`" @click="load(item)">
                <span class="flex gap-1 shrink-0"><span v-for="role in themeRoles" :key="role" class="size-3 rounded-full border border-default" :style="{ backgroundColor: swatch(item.colors[role]) }" /></span>
                <span class="truncate">{{ item.name }}</span>
              </UButton>
              <UButton v-if="confirming === item.name" color="error" variant="soft" :loading="busy" @click="remove(item.name)">Delete</UButton>
              <UButton color="neutral" variant="ghost" :icon="confirming === item.name ? 'i-lucide-x' : 'i-lucide-trash-2'" :aria-label="confirming === item.name ? `Keep ${item.name}` : `Delete ${item.name}`" @click="confirming = confirming === item.name ? '' : item.name" />
            </li>
          </ul>
        </section>

        <UAlert v-if="error" color="error" :description="error" role="alert" />

        <form class="flex flex-wrap items-end gap-2" @submit.prevent="save">
          <UFormField label="Save these colours as" class="flex-1 min-w-48"><UInput v-model="saveAs" maxlength="60" placeholder="Midnight" class="w-full" /></UFormField>
          <UButton type="submit" icon="i-lucide-save" :disabled="!canSave" :loading="busy">Save</UButton>
          <UButton color="neutral" variant="outline" icon="i-lucide-rotate-ccw" :disabled="isDefault" @click="theme.reset()">Reset</UButton>
        </form>
      </div>
    </template>
  </UModal>
</template>
