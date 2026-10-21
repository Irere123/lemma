export const isMac = () =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform ?? '')

/** ⌘ on Apple platforms, Ctrl elsewhere — the event check for a shortcut. */
export const hasMod = (event: { metaKey: boolean; ctrlKey: boolean }) =>
  isMac() ? event.metaKey : event.ctrlKey
