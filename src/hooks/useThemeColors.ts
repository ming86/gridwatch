import { useMemo } from 'react'

export function useThemeColors() {
  const theme = document.documentElement.getAttribute('data-theme') || 'grid'
  return useMemo(() => {
    const s = getComputedStyle(document.documentElement)
    return {
      cyan: s.getPropertyValue('--tron-cyan').trim(),
      blue: s.getPropertyValue('--tron-blue').trim(),
      orange: s.getPropertyValue('--tron-orange').trim(),
      text: s.getPropertyValue('--tron-text').trim(),
      textDim: s.getPropertyValue('--tron-text-dim').trim(),
      border: s.getPropertyValue('--tron-border').trim(),
      panel: s.getPropertyValue('--tron-panel').trim(),
    }
  }, [theme])
}
