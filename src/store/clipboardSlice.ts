import type { StateCreator } from 'zustand';
import type { CanvasObject } from '../types';
import { nanoid } from 'nanoid';

export interface ClipboardSlice {
  clipboard: CanvasObject[];
  copy: () => void;
  paste: () => string[];
  duplicate: () => string[];
}

type StoreWithDeps = ClipboardSlice & {
  objects: Record<string, CanvasObject>;
  ui: { selectedObjectIds: string[]; editingObjectId: string | null };
  past: Record<string, CanvasObject>[];
  future: Record<string, CanvasObject>[];
};

export const createClipboardSlice: StateCreator<StoreWithDeps, [], [], ClipboardSlice> = (
  set,
  get,
) => ({
  clipboard: [],

  copy: () => {
    const state = get();
    const { selectedObjectIds, editingObjectId } = state.ui;
    // Don't copy if editing text
    if (editingObjectId) return;

    const objectsToCopy = selectedObjectIds.map((id) => state.objects[id]).filter(Boolean);

    // Deep copy to clipboard
    set({ clipboard: JSON.parse(JSON.stringify(objectsToCopy)) });
  },

  paste: () => {
    const state = get();
    if (state.clipboard.length === 0) return [];
    if (state.ui.editingObjectId) return [];

    const idMap = new Map<string, string>();
    const newObjects: Record<string, CanvasObject> = {};
    const newIds: string[] = [];

    // Generate new IDs
    state.clipboard.forEach((obj) => {
      const newId = nanoid();
      idMap.set(obj.id, newId);
      newIds.push(newId);
    });

    // Create new objects
    state.clipboard.forEach((obj) => {
      const newId = idMap.get(obj.id)!;
      const newObj = JSON.parse(JSON.stringify(obj));
      newObj.id = newId;

      // Offset for paste
      if (newObj.geometry) {
        newObj.geometry.x = (newObj.geometry.x || 0) + 20;
        newObj.geometry.y = (newObj.geometry.y || 0) + 20;
        if (newObj.geometry.points) {
          newObj.geometry.points = newObj.geometry.points.map(
            (p: { x: number; y: number }) => ({
              x: p.x + 20,
              y: p.y + 20,
            }),
          );
        }
      }

      // Resolve references
      if (newObj.parentId && idMap.has(newObj.parentId)) {
        newObj.parentId = idMap.get(newObj.parentId);
      } else {
        newObj.parentId = undefined;
      }

      if (newObj.children) {
        newObj.children = newObj.children.map((cid: string) => idMap.get(cid)).filter(Boolean);
      }

      if (newObj.startConnection && idMap.has(newObj.startConnection.objectId)) {
        newObj.startConnection.objectId = idMap.get(newObj.startConnection.objectId)!;
      } else {
        newObj.startConnection = undefined;
      }

      if (newObj.endConnection && idMap.has(newObj.endConnection.objectId)) {
        newObj.endConnection.objectId = idMap.get(newObj.endConnection.objectId)!;
      } else {
        newObj.endConnection = undefined;
      }

      newObjects[newId] = newObj;
    });

    set((state) => ({
      past: [...state.past, state.objects],
      future: [],
      objects: { ...state.objects, ...newObjects },
      ui: { ...state.ui, selectedObjectIds: newIds },
    }));

    return newIds;
  },

  duplicate: () => {
    const state = get();
    const { selectedObjectIds, editingObjectId } = state.ui;
    if (editingObjectId || selectedObjectIds.length === 0) return [];

    const objectsToDup = selectedObjectIds.map((id) => state.objects[id]).filter(Boolean);

    const idMap = new Map<string, string>();
    const newObjects: Record<string, CanvasObject> = {};
    const newIds: string[] = [];

    objectsToDup.forEach((obj) => {
      const newId = nanoid();
      idMap.set(obj.id, newId);
      newIds.push(newId);
    });

    objectsToDup.forEach((obj) => {
      const newId = idMap.get(obj.id)!;
      const newObj = JSON.parse(JSON.stringify(obj));
      newObj.id = newId;

      // Resolve references within the duplicated set
      if (newObj.parentId && idMap.has(newObj.parentId)) {
        newObj.parentId = idMap.get(newObj.parentId);
      } else {
        newObj.parentId = undefined;
      }

      if (newObj.children) {
        newObj.children = newObj.children.map((cid: string) => idMap.get(cid)).filter(Boolean);
      }

      if (newObj.startConnection && idMap.has(newObj.startConnection.objectId)) {
        newObj.startConnection.objectId = idMap.get(newObj.startConnection.objectId)!;
      } else {
        newObj.startConnection = undefined;
      }

      if (newObj.endConnection && idMap.has(newObj.endConnection.objectId)) {
        newObj.endConnection.objectId = idMap.get(newObj.endConnection.objectId)!;
      } else {
        newObj.endConnection = undefined;
      }

      newObjects[newId] = newObj;
    });

    set((state) => ({
      past: [...state.past, state.objects],
      future: [],
      objects: { ...state.objects, ...newObjects },
      ui: { ...state.ui, selectedObjectIds: newIds },
    }));

    return newIds;
  },
});
