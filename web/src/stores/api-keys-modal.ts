import { create } from 'zustand'

type Data = {
  id?: string
  name?: string
  scopes?: string[]
}

type Type = 'create' | 'edit' | 'delete'

interface ApiKeysModalState {
  type?: Type
  data?: Data
  createdKey?: string
  setData: (data?: Data, type?: Type) => void
  setCreatedKey: (key?: string) => void
}

export const useApiKeysModalStore = create<ApiKeysModalState>()((set) => ({
  type: undefined,
  data: undefined,
  createdKey: undefined,
  setData: (data, type) => set({ data, type }),
  setCreatedKey: (key) => set({ createdKey: key }),
}))
