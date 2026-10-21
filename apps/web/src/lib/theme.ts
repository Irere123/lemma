import { useCallback, useEffect, useSyncExternalStore } from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'

const KEY = 'lemma-theme'

/**
 * Runs before first paint (inlined in <head>) so a dark-mode reader never
 * sees a white flash: applies the stored choice, or the system's.
 */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('${KEY}');var d=t==='dark'||((!t||t==='system')&&matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light'}catch(e){}})()`

const listeners = new Set<() => void>()

function read(): ThemePreference {
  if (typeof localStorage === 'undefined') return 'system'
  const stored = localStorage.getItem(KEY)
  return stored === 'light' || stored === 'dark' ? stored : 'system'
}

function apply(preference: ThemePreference) {
  const dark =
    preference === 'dark' ||
    (preference === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  const root = document.documentElement
  root.classList.toggle('dark', dark)
  root.style.colorScheme = dark ? 'dark' : 'light'
}

export function setTheme(preference: ThemePreference) {
  localStorage.setItem(KEY, preference)
  apply(preference)
  for (const listener of listeners) listener()
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** The stored preference, and the effective light/dark it resolves to. */
export function useTheme() {
  const preference = useSyncExternalStore(subscribe, read, () => 'system' as ThemePreference)
  // Follow the system while the preference is "system".
  useEffect(() => {
    if (preference !== 'system') return
    const media = matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      apply('system')
      for (const listener of listeners) listener()
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [preference])
  const resolved = useSyncExternalStore(
    subscribe,
    () => (document.documentElement.classList.contains('dark') ? 'dark' : 'light'),
    () => 'light' as const
  )
  return { preference, resolved, setTheme: useCallback(setTheme, []) }
}
