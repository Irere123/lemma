import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'

// SSR-safe synchronous storage. Returns null on the server so the store
// renders in its default (collapsed) state during SSR and the first client
// paint, then rehydrates from localStorage in an effect — avoiding hydration
// mismatches while keeping the expanded/collapsed choice stable across reloads.
const storage: StateStorage = {
  getItem: (name) => {
    if (typeof window === 'undefined') return null
    return window.localStorage.getItem(name)
  },
  setItem: (name, value) => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(name, value)
  },
  removeItem: (name) => {
    if (typeof window === 'undefined') return
    window.localStorage.removeItem(name)
  },
}

interface SidebarStore {
  expanded: boolean
  hasHydrated: boolean
  toggle: () => void
  setExpanded: (expanded: boolean) => void
}

export const useSidebarStore = create<SidebarStore>()(
  persist(
    (set) => ({
      expanded: false,
      hasHydrated: false,
      toggle: () => set((state) => ({ expanded: !state.expanded })),
      setExpanded: (expanded) => set({ expanded }),
    }),
    {
      name: 'sidebar-expanded',
      version: 1,
      storage: createJSONStorage(() => storage),
      // Rehydrate manually (see Sidebar) so SSR and the first client render
      // always agree on the default state.
      skipHydration: true,
      partialize: (state) => ({ expanded: state.expanded }),
      onRehydrateStorage: () => (state) => {
        if (state) state.hasHydrated = true
      },
    }
  )
)
