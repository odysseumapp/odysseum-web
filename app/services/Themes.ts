import tailwindColors from 'tailwindcss/colors'
import { themeRoles, type Theme, type ThemeColors, type ThemeRole } from '../models'

export const accentPalettes = [
  'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue',
  'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
]
export const neutralPalettes = ['slate', 'gray', 'zinc', 'neutral', 'stone', 'mauve', 'olive', 'mist', 'taupe']
export const palettes = [...accentPalettes, ...neutralPalettes]
export const palettesFor = (role: ThemeRole) => role === 'neutral' ? neutralPalettes : accentPalettes

export const defaultThemeColors: ThemeColors = {
  primary: 'green', secondary: 'blue', success: 'green', info: 'blue', warning: 'yellow', error: 'red', neutral: 'slate',
}

export const roleLabels: Record<ThemeRole, string> = {
  primary: 'Primary', secondary: 'Secondary', success: 'Success', info: 'Information', warning: 'Warning', error: 'Error', neutral: 'Neutral',
}

export function swatch(palette: string) {
  const shades = (tailwindColors as Record<string, Record<string, string> | string>)[palette]
  return typeof shades === 'object' ? shades['500'] ?? '' : ''
}

export function normalizeColors(colors: Partial<Record<string, unknown>> | null | undefined): ThemeColors {
  const result = { ...defaultThemeColors }
  for (const role of themeRoles) {
    const value = colors?.[role]
    if (typeof value === 'string' && palettes.includes(value)) result[role] = value
  }
  return result
}

export const sameColors = (a: ThemeColors, b: ThemeColors) => themeRoles.every(role => a[role] === b[role])
export const themeFor = (name: string, colors: ThemeColors): Theme => ({ name, colors: { ...colors } })
