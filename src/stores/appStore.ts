import { create } from 'zustand';
import { getCurrentMonth } from '../utils/formatters';

interface AppState {
  selectedMonth: string;
  sidebarOpen: boolean;
  setSelectedMonth: (month: string) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedMonth: getCurrentMonth(),
  sidebarOpen: true,
  setSelectedMonth: (month) => set({ selectedMonth: month }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));
