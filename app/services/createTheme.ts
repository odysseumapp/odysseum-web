import { computed, reactive, ref } from 'vue'
import { FetchApiClient } from '../api/FetchApiClient'
import { OdysseumApi } from '../api/OdysseumApi'
import type { IOdysseumApi } from '../api/IOdysseumApi'
import { themeRoles, type Theme, type ThemeColors, type ThemeRole } from '../models'
import { defaultThemeColors, normalizeColors, palettesFor, sameColors, themeFor } from './Themes'

const StorageKey = 'odysseum:theme'

export function createTheme(target: { colors: Record<string, string> }, api: IOdysseumApi = new OdysseumApi(new FetchApiClient())) {
  const colors = reactive<ThemeColors>({ ...defaultThemeColors })
  const name = ref('')
  const saved = ref<Theme[]>([])
  const isDefault = computed(() => sameColors(colors, defaultThemeColors))

  function paint() {
    for (const role of themeRoles) target.colors[role] = colors[role]
    remember()
  }
  function remember() {
    try { localStorage.setItem(StorageKey, JSON.stringify(themeFor(name.value, colors))) } catch {  }
  }

  function set(role: ThemeRole, palette: string) {
    if (!palettesFor(role).includes(palette) || colors[role] === palette) return
    colors[role] = palette
    name.value = ''
    paint()
  }

  function use(theme: Theme) {
    Object.assign(colors, normalizeColors(theme.colors))
    name.value = theme.name
    paint()
  }

  function reset() {
    Object.assign(colors, defaultThemeColors)
    name.value = ''
    paint()
  }

  function restore() {
    try {
      const stored = JSON.parse(localStorage.getItem(StorageKey) ?? 'null')
      if (stored) {
        Object.assign(colors, normalizeColors(stored.colors))
        name.value = typeof stored.name === 'string' ? stored.name : ''
      }
    } catch {  }
    for (const role of themeRoles) target.colors[role] = colors[role]
  }

  async function list() {
    saved.value = (await api.listThemes()).map(theme => themeFor(theme.name, normalizeColors(theme.colors)))
    return saved.value
  }

  async function save(as: string) {
    const stored = await api.saveTheme(themeFor(as.trim(), colors))
    name.value = stored.name
    remember()
    await list()
    return stored
  }

  async function remove(named: string) {
    await api.deleteTheme(named)
    if (name.value === named) { name.value = ''; remember() }
    await list()
  }

  return { colors, name, saved, isDefault, set, use, reset, restore, list, save, remove }
}

export type ThemeStore = ReturnType<typeof createTheme>
