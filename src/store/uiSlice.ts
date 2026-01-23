import type { StateCreator } from 'zustand';
import { Tool } from '../types';

export interface UiState {
  mode: 'edit' | 'present';
  activeTool: Tool;
  spotlightEnabled: boolean;
  zoom: number;
  pan: { x: number; y: number };
  isPanning: boolean;
  ctrlPressed: boolean;
  selectedObjectIds: string[];
  editingObjectId: string | null;
}

export interface UiSlice {
  ui: UiState;
  setMode: (mode: 'edit' | 'present') => void;
  toggleSpotlight: () => void;
  setPan: (
    pan: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number }),
  ) => void;
  setZoom: (zoom: number) => void;

  selectObject: (id: string, multi?: boolean) => void;
  selectObjects: (ids: string[]) => void;
  clearSelection: () => void;
  setTool: (tool: Tool) => void;
  setIsPanning: (isPanning: boolean) => void;
  setCtrlPressed: (ctrlPressed: boolean) => void;
  setEditingObject: (id: string | null) => void;
}

export const createUiSlice: StateCreator<UiSlice> = (set) => ({
  ui: {
    mode: 'edit',
    activeTool: Tool.Select,
    spotlightEnabled: false, // TODO: implement spotlight
    zoom: 1,
    pan: { x: 0, y: 0 },
    isPanning: false,
    ctrlPressed: false,
    selectedObjectIds: [],
    editingObjectId: null,
  },

  setMode: (mode) => set((state) => ({ ui: { ...state.ui, mode } })),

  toggleSpotlight: () =>
    set((state) => ({ ui: { ...state.ui, spotlightEnabled: !state.ui.spotlightEnabled } })),

  setPan: (pan) =>
    set((state) => {
      const newPan = typeof pan === 'function' ? pan(state.ui.pan) : pan;
      return { ui: { ...state.ui, pan: newPan } };
    }),

  setZoom: (zoom) => set((state) => ({ ui: { ...state.ui, zoom } })),

  selectObject: (id, multi = false) => {
    set((state) => {
      const currentSelected = state.ui.selectedObjectIds;
      if (multi) {
        if (currentSelected.includes(id)) {
          return {
            ui: { ...state.ui, selectedObjectIds: currentSelected.filter((oid) => oid !== id) },
          };
        }
        return { ui: { ...state.ui, selectedObjectIds: [...currentSelected, id] } };
      }

      // If already selected, don't change selection (allows moving multiple objects)
      if (currentSelected.includes(id)) return {};

      return { ui: { ...state.ui, selectedObjectIds: [id] } };
    });
  },

  selectObjects: (ids) => {
    set((state) => ({
      ui: { ...state.ui, selectedObjectIds: ids },
    }));
  },

  clearSelection: () => set((state) => ({ ui: { ...state.ui, selectedObjectIds: [] } })),

  setTool: (tool) => set((state) => ({ ui: { ...state.ui, activeTool: tool } })),

  setIsPanning: (isPanning) => set((state) => ({ ui: { ...state.ui, isPanning } })),

  setCtrlPressed: (ctrlPressed) => set((state) => ({ ui: { ...state.ui, ctrlPressed } })),

  setEditingObject: (id) => set((state) => ({ ui: { ...state.ui, editingObjectId: id } })),
});
