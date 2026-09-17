import { createTheme } from '~/services/createTheme'
import { defaultThemeColors } from '~/services/Themes'

export default defineNuxtPlugin(() => {
  const appConfig = useAppConfig() as { ui: { colors: Record<string, string> } }
  appConfig.ui.colors ??= { ...defaultThemeColors }
  const theme = createTheme(appConfig.ui)
  // Before the first paint, so the app never shows the default colours and then swaps.
  theme.restore()
  return { provide: { theme } }
})
