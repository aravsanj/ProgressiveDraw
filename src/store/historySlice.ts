import type { StateCreator } from 'zustand';
import type { CanvasObject } from '../types';

export interface HistorySlice {
  past: Record<string, CanvasObject>[];
  future: Record<string, CanvasObject>[];
  undo: () => void;
  redo: () => void;
  saveHistory: () => void;
}

// We need a way to access 'objects' from the store, so we define a generic type that includes objects
type StoreWithObjects = HistorySlice & { objects: Record<string, CanvasObject> };

export const createHistorySlice: StateCreator<StoreWithObjects, [], [], HistorySlice> = (set) => ({
  past: [],
  future: [],

  undo: () => {
    set((state) => {
      if (state.past.length === 0) return {};

      const previous = state.past[state.past.length - 1];
      const newPast = state.past.slice(0, state.past.length - 1);

      return {
        past: newPast,
        future: [state.objects, ...state.future],
        objects: previous,
      };
    });
  },

  redo: () => {
    set((state) => {
      if (state.future.length === 0) return {};

      const next = state.future[0];
      const newFuture = state.future.slice(1);

      return {
        past: [...state.past, state.objects],
        future: newFuture,
        objects: next,
      };
    });
  },

  saveHistory: () => {
    set((state) => ({
      past: [...state.past, state.objects],
      future: [],
    }));
  },
});
