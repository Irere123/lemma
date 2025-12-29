import { create } from 'zustand'

export interface OAuthApp {
  id: string
  name: string
  description: string | null
  overview: string | null
  logoUrl: string | null
  website: string | null
  installUrl: string | null
  screenshots: string[]
  redirectUris: string[]
  clientId: string
  scopes: string[]
  isPublic: boolean
  active: boolean
  status: 'draft' | 'pending' | 'approved' | 'rejected'
  createdAt: string
  updatedAt: string
}

export type ModalType = 'create' | 'edit' | 'delete' | 'view-credentials' | null

interface OAuthAppsModalStore {
  isOpen: boolean
  modalType: ModalType
  selectedApp: OAuthApp | null
  clientSecret: string | null
  setData: (app?: OAuthApp, type?: ModalType) => void
  setClientSecret: (secret: string | null) => void
  close: () => void
}

export const useOAuthAppsModalStore = create<OAuthAppsModalStore>((set) => ({
  isOpen: false,
  modalType: null,
  selectedApp: null,
  clientSecret: null,
  setData: (app, type) =>
    set({
      isOpen: true,
      modalType: type ?? 'create',
      selectedApp: app ?? null,
    }),
  setClientSecret: (secret) => set({ clientSecret: secret }),
  close: () =>
    set({
      isOpen: false,
      modalType: null,
      selectedApp: null,
      clientSecret: null,
    }),
}))
