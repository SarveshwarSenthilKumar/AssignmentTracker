export const appearanceOptions = {
  textSize: ['small', 'standard', 'large', 'extra-large'],
  density: ['compact', 'standard', 'comfortable'],
  corners: ['square', 'standard', 'round'],
  contrast: ['standard', 'high'],
  motion: ['system', 'reduced'],
}

export const defaultAppearance = {
  accent: 'default',
  textSize: 'standard',
  density: 'standard',
  corners: 'standard',
  contrast: 'standard',
  motion: 'system',
}

export function normalizeAppearance(value) {
  const result = { ...defaultAppearance }
  if (typeof value?.accent === 'string' && /^#[a-f\d]{6}$/i.test(value.accent)) result.accent = value.accent.toLowerCase()
  for (const [key, options] of Object.entries(appearanceOptions)) {
    if (options.includes(value?.[key])) result[key] = value[key]
  }
  return result
}

export function appearanceAttributes(value) {
  const { accent, textSize, density, corners, contrast, motion } = normalizeAppearance(value)
  return {
    'data-app-accent': accent === 'default' ? undefined : 'custom',
    'data-app-text-size': textSize,
    'data-app-density': density,
    'data-app-corners': corners,
    'data-app-contrast': contrast,
    'data-app-motion': motion,
  }
}
