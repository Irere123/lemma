import { useEffect, useState } from 'react'

// Returns a copy of `value` that only updates after it has stopped changing for
// `delayMs`. Used to throttle the command-palette search query so we don't fire
// a request on every keystroke.
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])

  return debounced
}
