import tailwindColors from 'tailwindcss/colors'
import { themeRoles, type Theme, type ThemeColors, type ThemeRole } from '../models'

/**
 * Mirrors the palettes the server accepts. A palette name ends up inside a CSS variable name,
 * so a theme that came from anywhere but this list is refused rather than applied.
 */
export const accentPalettes = [
  'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue',
  'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
]
/** The greys: the only sensible choice for `neutral`, which colours text, borders and backgrounds. */
export const neutralPalettes = ['slate', 'gray', 'zinc', 'neutral', 'stone', 'mauve', 'olive', 'mist', 'taupe']
export const palettes = [...accentPalettes, ...neutralPalettes]
/** Which palettes a role may name. */
export const palettesFor = (role: ThemeRole) => role === 'neutral' ? neutralPalettes : accentPalettes

/** What the app looks like with no theme applied; also what `Reset` returns to. */
export const defaultThemeColors: ThemeColors = {
  primary: 'green', secondary: 'blue', success: 'green', info: 'blue', warning: 'yellow', error: 'red', neutral: 'slate',
}

export const roleLabels: Record<ThemeRole, string> = {
  primary: 'Primary', secondary: 'Secondary', success: 'Success', info: 'Information', warning: 'Warning', error: 'Error', neutral: 'Neutral',
}

/** A palette's mid shade, for the swatch beside its name. */
export function swatch(palette: string) {
  const shades = (tailwindColors as Record<string, Record<string, string> | string>)[palette]
  return typeof shades === 'object' ? shades['500'] ?? '' : ''
}

/** Keeps only roles and palettes this build knows, filling the rest from the defaults. */
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
