import { createTheme } from '~/services/createTheme'
import { defaultThemeColors } from '~/services/Themes'

export default defineNuxtPlugin(() => {
  const appConfig = useAppConfig() as { ui: { colors: Record<string, string> } }
  appConfig.ui.colors ??= { ...defaultThemeColors }
  const theme = createTheme(appConfig.ui)
  theme.restore()
  return { provide: { theme } }
})
