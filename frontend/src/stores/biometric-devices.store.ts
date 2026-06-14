import { create } from 'zustand';
import type { BiometricDeviceDto } from '@/services/biometric-devices.api';

export type DrawerTab = 'overview' | 'transactions' | 'commands';
export type ActiveModal =
  | 'duplicate-punch'
  | 'enroll'
  | 'confirm-restart'
  | 'confirm-deactivate'
  | 'rename'
  | null;

interface BiometricDevicesStore {
  // Selection state
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  isSelected: (id: string) => boolean;

  // Detail drawer
  drawerDeviceId: string | null;
  drawerTab: DrawerTab;
  openDrawer: (id: string, tab?: DrawerTab) => void;
  closeDrawer: () => void;
  setDrawerTab: (tab: DrawerTab) => void;

  // Active modal
  activeModal: ActiveModal;
  modalDevice: BiometricDeviceDto | null;
  openModal: (modal: Exclude<ActiveModal, null>, device?: BiometricDeviceDto) => void;
  closeModal: () => void;
}

export const useBiometricDevicesStore = create<BiometricDevicesStore>((set, get) => ({
  selectedIds: new Set<string>(),
  toggleSelect: (id) =>
    set((s) => {
      const next = new Set(s.selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedIds: next };
    }),
  selectAll: (ids) => set({ selectedIds: new Set(ids) }),
  clearSelection: () => set({ selectedIds: new Set<string>() }),
  isSelected: (id) => get().selectedIds.has(id),

  drawerDeviceId: null,
  drawerTab: 'overview',
  openDrawer: (id, tab = 'overview') =>
    set({ drawerDeviceId: id, drawerTab: tab }),
  closeDrawer: () => set({ drawerDeviceId: null }),
  setDrawerTab: (tab) => set({ drawerTab: tab }),

  activeModal: null,
  modalDevice: null,
  openModal: (modal, device) => set({ activeModal: modal, modalDevice: device ?? null }),
  closeModal: () => set({ activeModal: null, modalDevice: null }),
}));
