import { create } from 'zustand';
import type { CanvasObject, WhiteboardState, Tool } from '../types';

interface WhiteboardActions {
  addObject: (obj: Omit<CanvasObject, 'id'>) => string;
  updateObject: (id: string, updates: Partial<CanvasObject>) => void;
  deleteObject: (id: string) => void;

  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;

  setMode: (mode: 'edit' | 'present') => void;
  toggleSpotlight: () => void;
  setPan: (
    pan: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number }),
  ) => void;
  setZoom: (zoom: number) => void;

  selectObject: (id: string, multi?: boolean) => void;
  clearSelection: () => void;
  setTool: (tool: Tool) => void;
}

// Helper to generate UUIDs if `uuid` package isn't available, but I'll add a simple random string generator
const generateId = () => Math.random().toString(36).substr(2, 9);

export const useWhiteboard = create<WhiteboardState & WhiteboardActions>((set) => ({
  objects: {},
  currentStep: 0,
  ui: {
    mode: 'edit',
    activeTool: 'select',
    spotlightEnabled: false,
    zoom: 1,
    pan: { x: 0, y: 0 },
    selectedObjectIds: [],
  },

  addObject: (obj) => {
    const id = generateId();
    const newObject: CanvasObject = { ...obj, id };
    set((state) => ({
      objects: { ...state.objects, [id]: newObject },
    }));
    return id;
  },

  updateObject: (id, updates) => {
    set((state) => {
      const obj = state.objects[id];
      if (!obj) return {};

      const newObj = { ...obj, ...updates };
      const newObjects = { ...state.objects, [id]: newObj };

      // Update connected arrows if this is a box
      if (newObj.type === 'box') {
        const getAnchorPos = (box: CanvasObject, anchorId: string) => {
          const { x, y, width = 0, height = 0 } = box.geometry;
          switch (anchorId) {
            case 'n': return { x: x + width / 2, y };
            case 's': return { x: x + width / 2, y: y + height };
            case 'e': return { x: x + width, y: y + height / 2 };
            case 'w': return { x, y: y + height / 2 };
            default: return { x, y };
          }
        };

        Object.values(newObjects).forEach((other) => {
          if (other.type === 'arrow') {
            let pointsMoved = false;
            const points = [...(other.geometry.points || [])];

            if (other.startConnection?.objectId === id) {
              points[0] = getAnchorPos(newObj, other.startConnection.anchorId);
              pointsMoved = true;
            }
            if (other.endConnection?.objectId === id) {
              points[points.length - 1] = getAnchorPos(newObj, other.endConnection.anchorId);
              pointsMoved = true;
            }

            if (pointsMoved) {
              newObjects[other.id] = {
                ...other,
                geometry: { ...other.geometry, points },
              };
            }
          }
        });
      }

      return {
        objects: newObjects,
      };
    });
  },

  deleteObject: (id) => {
    set((state) => {
      const rest = { ...state.objects };
      delete rest[id];
      return { objects: rest };
    });
  },

  setStep: (step) => set({ currentStep: Math.max(0, step) }),

  nextStep: () => set((state) => ({ currentStep: state.currentStep + 1 })),

  prevStep: () => set((state) => ({ currentStep: Math.max(0, state.currentStep - 1) })),

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
      return { ui: { ...state.ui, selectedObjectIds: [id] } };
    });
  },

  clearSelection: () => set((state) => ({ ui: { ...state.ui, selectedObjectIds: [] } })),

  setTool: (tool) => set((state) => ({ ui: { ...state.ui, activeTool: tool } })),
}));
