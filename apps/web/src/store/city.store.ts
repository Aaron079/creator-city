import { create } from 'zustand'

export interface Building {
  id?: string
  type: string
  level: number
  name?: string
  positionX?: number
  positionY?: number
}

export interface CityBase {
  id: string
  name: string
  description?: string
  positionX: number
  positionY: number
  reputation: number
  buildings: Building[]
  owner?: { username: string; displayName: string; reputation: number }
}

interface CityState {
  myBase: CityBase | null
  cityMap: CityBase[]
  selectedBaseId: string | null
  isLoading: boolean
  setMyBase: (base: CityBase) => void
  setCityMap: (map: CityBase[]) => void
  selectBase: (id: string | null) => void
  setLoading: (loading: boolean) => void
}

export const useCityStore = create<CityState>((set) => ({
  myBase: null,
  cityMap: [],
  selectedBaseId: null,
  isLoading: false,

  setMyBase: (base) => set({ myBase: base }),
  setCityMap: (map) => set({ cityMap: map }),
  selectBase: (id) => set({ selectedBaseId: id }),
  setLoading: (isLoading) => set({ isLoading }),
}))
