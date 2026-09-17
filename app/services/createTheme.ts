import { computed, reactive, ref } from 'vue'
import { FetchApiClient } from '../api/FetchApiClient'
import { OdysseumApi } from '../api/OdysseumApi'
import type { IOdysseumApi } from '../api/IOdysseumApi'
import { themeRoles, type Theme, type ThemeColors, type ThemeRole } from '../models'
import { defaultThemeColors, normalizeColors, palettesFor, sameColors, themeFor } from './Themes'

const StorageKey = 'odysseum:theme'

/**
 * The colours the interface is wearing, and the library of named schemes on the server.
 * Which scheme this browser shows is a local choice, so the app still looks right offline;
 * the server only keeps the schemes themselves, one JSON file each.
 */
export function createTheme(target: { colors: Record<string, string> }, api: IOdysseumApi = new OdysseumApi(new FetchApiClient())) {
  const colors = reactive<ThemeColors>({ ...defaultThemeColors })
  /** The saved theme these colours came from; empty once they are the writer's own mix. */
  const name = ref('')
  const saved = ref<Theme[]>([])
  const isDefault = computed(() => sameColors(colors, defaultThemeColors))

  /** Nuxt UI generates its colour variables from the app config, so writing there repaints everything at once. */
  function paint() {
    for (const role of themeRoles) target.colors[role] = colors[role]
    remember()
  }
  function remember() {
    try { localStorage.setItem(StorageKey, JSON.stringify(themeFor(name.value, colors))) } catch { /* Storage may be unavailable. */ }
  }

  function set(role: ThemeRole, palette: string) {
    if (!palettesFor(role).includes(palette) || colors[role] === palette) return
    colors[role] = palette
    // Changing a colour makes this the writer's own mix until they save it under a name again.
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

  /** Applies whatever this browser was last showing. Called before the app mounts, so nothing flashes. */
  function restore() {
    try {
      const stored = JSON.parse(localStorage.getItem(StorageKey) ?? 'null')
      if (stored) {
        Object.assign(colors, normalizeColors(stored.colors))
        name.value = typeof stored.name === 'string' ? stored.name : ''
      }
    } catch { /* Storage may be unavailable, or hold something this build cannot read. */ }
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
