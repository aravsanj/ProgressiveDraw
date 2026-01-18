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
  selectObjects: (ids: string[]) => void;
  clearSelection: () => void;
  setTool: (tool: Tool) => void;
  deleteObjects: (ids: string[]) => void;
  setEditingObject: (id: string | null) => void;
  moveObjects: (ids: string[], dx: number, dy: number) => void;
}

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
    editingObjectId: null,
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

      if (newObj.type === 'box') {
        const getAnchorPos = (box: CanvasObject, anchorId: string) => {
          const { x, y, width = 0, height = 0 } = box.geometry;
          switch (anchorId) {
            case 'n':
              return { x: x + width / 2, y };
            case 's':
              return { x: x + width / 2, y: y + height };
            case 'e':
              return { x: x + width, y: y + height / 2 };
            case 'w':
              return { x, y: y + height / 2 };
            default:
              return { x, y };
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
      const newSelected = state.ui.selectedObjectIds.filter((oid) => oid !== id);
      return { objects: rest, ui: { ...state.ui, selectedObjectIds: newSelected } };
    });
  },

  deleteObjects: (ids) => {
    set((state) => {
      const newObjects = { ...state.objects };
      ids.forEach((id) => delete newObjects[id]);
      const newSelected = state.ui.selectedObjectIds.filter((oid) => !ids.includes(oid));
      return { objects: newObjects, ui: { ...state.ui, selectedObjectIds: newSelected } };
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

  setEditingObject: (id) => set((state) => ({ ui: { ...state.ui, editingObjectId: id } })),

  moveObjects: (ids, dx, dy) => {
    set((state) => {
      const newObjects = { ...state.objects };

      // First pass: move all objects
      ids.forEach((id) => {
        const obj = newObjects[id];
        if (!obj) return;

        if (obj.type === 'arrow' && obj.geometry.points) {
          const newPoints = obj.geometry.points.map((p) => ({
            x: p.x + dx,
            y: p.y + dy,
          }));
          newObjects[id] = {
            ...obj,
            geometry: { ...obj.geometry, points: newPoints },
            startConnection: undefined,
            endConnection: undefined,
          };
        } else {
          newObjects[id] = {
            ...obj,
            geometry: {
              ...obj.geometry,
              x: obj.geometry.x + dx,
              y: obj.geometry.y + dy,
            },
          };
        }
      });

      // Second pass: update any arrows connected to moved boxes
      // This is a bit expensive but necessary for consistency
      Object.keys(newObjects).forEach((id) => {
        // Skip if this object was already moved in the first pass
        if (ids.includes(id)) return;

        const other = newObjects[id];
        if (other.type === 'arrow') {
          let pointsMoved = false;
          const points = [...(other.geometry.points || [])];

          if (other.startConnection && ids.includes(other.startConnection.objectId)) {
            points[0] = { x: points[0].x + dx, y: points[0].y + dy };
            pointsMoved = true;
          }
          if (other.endConnection && ids.includes(other.endConnection.objectId)) {
            points[points.length - 1] = {
              x: points[points.length - 1].x + dx,
              y: points[points.length - 1].y + dy,
            };
            pointsMoved = true;
          }

          if (pointsMoved) {
            newObjects[id] = {
              ...other,
              geometry: { ...other.geometry, points },
            };
          }
        }
      });

      return { objects: newObjects };
    });
  },
}));
