import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import type { CanvasObject, WhiteboardState, Tool } from '../types';

interface WhiteboardActions {
  addObject: (obj: Omit<CanvasObject, 'id'>) => string;
  updateObject: (id: string, updates: Partial<CanvasObject>) => void;
  updateObjects: (ids: string[], updates: Partial<CanvasObject>) => void;
  deleteObject: (id: string) => void;
  groupObjects: (ids: string[]) => void;
  ungroupObjects: (groupId: string) => void;

  setFrame: (frame: number) => void;
  nextFrame: () => void;
  prevFrame: () => void;

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
  loadFromObject: (state: WhiteboardState) => void;
}

export const useWhiteboard = create<WhiteboardState & WhiteboardActions>()(persist((set) => ({
  objects: {},
  currentFrame: 0,
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
    const id = nanoid();
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

      // If resizing a group, scale children proportionally
      if (newObj.type === 'group' && updates.geometry && obj.children) {
        const oldGeom = obj.geometry;
        const newGeom = newObj.geometry;
        
        const scaleX = (newGeom.width || 0) / (oldGeom.width || 1);
        const scaleY = (newGeom.height || 0) / (oldGeom.height || 1);

        obj.children.forEach(childId => {
          const child = newObjects[childId];
          if (!child) return;

          if (child.geometry.points) {
            // Handle arrow/line children
            const newPoints = child.geometry.points.map(p => ({
              x: (newGeom.x || 0) + ((p.x - (oldGeom.x || 0)) * scaleX),
              y: (newGeom.y || 0) + ((p.y - (oldGeom.y || 0)) * scaleY),
            }));
            newObjects[childId] = {
              ...child,
              geometry: { ...child.geometry, points: newPoints },
            };
          } else {
            // Handle rectangle/diamond/ellipse/text children
            const oldChildX = child.geometry.x || 0;
            const oldChildY = child.geometry.y || 0;
            const oldChildW = child.geometry.width || 0;
            const oldChildH = child.geometry.height || 0;

            const relX = oldChildX - (oldGeom.x || 0);
            const relY = oldChildY - (oldGeom.y || 0);

            newObjects[childId] = {
              ...child,
              geometry: {
                ...child.geometry,
                x: (newGeom.x || 0) + (relX * scaleX),
                y: (newGeom.y || 0) + (relY * scaleY),
                width: oldChildW * scaleX,
                height: oldChildH * scaleY,
              },
            };
          }
        });
      }

      // Helper to update connections
      const updateConnections = (objectsInput: Record<string, CanvasObject>) => {
        const updatedObjects = { ...objectsInput };
        if (newObj.type === 'rectangle' || newObj.type === 'diamond' || newObj.type === 'ellipse' || newObj.type === 'group') {
          const getAnchorPos = (obj: CanvasObject, anchorId: string) => {
            const { x, y, width = 0, height = 0 } = obj.geometry;
            switch (anchorId) {
              case 'n': return { x: x + width / 2, y };
              case 's': return { x: x + width / 2, y: y + height };
              case 'e': return { x: x + width, y: y + height / 2 };
              case 'w': return { x, y: y + height / 2 };
              default: return { x, y };
            }
          };

          Object.values(updatedObjects).forEach((other) => {
            if (other.type === 'arrow' || other.type === 'line') {
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
                updatedObjects[other.id] = {
                  ...other,
                  geometry: { ...other.geometry, points },
                };
              }
            }
          });
        }
        return updatedObjects;
      };

      return {
        objects: updateConnections(newObjects),
      };
    });
  },

  updateObjects: (ids, updates) => {
      set((state) => {
          const newObjects = { ...state.objects };
          
          // Helper to recursively collect all object IDs including children
          const collectIds = (targetIds: string[], collected = new Set<string>()) => {
            targetIds.forEach(id => {
              if (collected.has(id)) return;
              collected.add(id);
              const obj = newObjects[id];
              if (obj?.children) {
                collectIds(obj.children, collected);
              }
            });
            return collected;
          };

          const allIdsToUpdate = collectIds(ids);

          allIdsToUpdate.forEach(id => {
              if (newObjects[id]) {
                  newObjects[id] = { ...newObjects[id], ...updates };
              }
          });
          return { objects: newObjects };
      });
  },

  groupObjects: (ids) => {
    set((state) => {
      if (ids.length < 2) return {};

      const objectsToGroup = ids.map(id => state.objects[id]).filter(Boolean);
      if (objectsToGroup.length === 0) return {};

      // Calculate bounding box
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      
      objectsToGroup.forEach(obj => {
          if (obj.geometry.points) {
              obj.geometry.points.forEach(p => {
                  minX = Math.min(minX, p.x);
                  minY = Math.min(minY, p.y);
                  maxX = Math.max(maxX, p.x);
                  maxY = Math.max(maxY, p.y);
              });
          } else {
              const { x, y, width = 0, height = 0 } = obj.geometry;
              minX = Math.min(minX, x);
              minY = Math.min(minY, y);
              maxX = Math.max(maxX, x + width);
              maxY = Math.max(maxY, y + height);
          }
      });

      const groupId = nanoid();
      const group: CanvasObject = {
        id: groupId,
        type: 'group',
        children: ids,
        parentId: undefined,
        geometry: {
            x: minX - 10,
            y: minY - 10,
            width: (maxX - minX) + 20,
            height: (maxY - minY) + 20,
        },
        style: { stroke: 'rgba(0,0,0,0)', fill: 'transparent' }, // Invisible wrapper by default, or dashed
        appearFrame: Math.min(...objectsToGroup.map(o => o.appearFrame)),
        disappearFrame: undefined, 
      };

      const newObjects = { ...state.objects, [groupId]: group };
      ids.forEach(id => {
          newObjects[id] = { ...newObjects[id], parentId: groupId };
      });

      return {
          objects: newObjects,
          ui: { ...state.ui, selectedObjectIds: [groupId] }
      };
    });
  },

  ungroupObjects: (groupId) => {
      set((state) => {
          const group = state.objects[groupId];
          if (!group || group.type !== 'group' || !group.children) return {};

          const newObjects = { ...state.objects };
          const childrenIds = group.children;
          
          childrenIds.forEach(childId => {
              if (newObjects[childId]) {
                  const { parentId, ...rest } = newObjects[childId];
                  newObjects[childId] = { ...rest, parentId: undefined };
              }
          });

          delete newObjects[groupId];

          return {
              objects: newObjects,
              ui: { ...state.ui, selectedObjectIds: childrenIds }
          };
      });
  },

  deleteObject: (id) => {
    set((state) => {
      const rest = { ...state.objects };
      delete rest[id];
      const newSelected = state.ui.selectedObjectIds.filter((oid) => oid !== id);
      const newEditingId = state.ui.editingObjectId === id ? null : state.ui.editingObjectId;
      return {
        objects: rest,
        ui: { ...state.ui, selectedObjectIds: newSelected, editingObjectId: newEditingId },
      };
    });
  },

  deleteObjects: (ids) => {
    set((state) => {
      const newObjects = { ...state.objects };
      ids.forEach((id) => delete newObjects[id]);
      const newSelected = state.ui.selectedObjectIds.filter((oid) => !ids.includes(oid));
      const newEditingId = ids.includes(state.ui.editingObjectId || '') 
        ? null 
        : state.ui.editingObjectId;

      return {
        objects: newObjects,
        ui: { ...state.ui, selectedObjectIds: newSelected, editingObjectId: newEditingId },
      };
    });
  },

  setFrame: (frame) => set({ currentFrame: Math.max(0, frame) }),

  nextFrame: () => set((state) => ({ currentFrame: state.currentFrame + 1 })),

  prevFrame: () => set((state) => ({ currentFrame: Math.max(0, state.currentFrame - 1) })),

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
      
      // Collect all objects to move, including children
      const idsToMove = new Set<string>();
      const collectIds = (id: string) => {
          if (idsToMove.has(id)) return;
          idsToMove.add(id);
          const obj = state.objects[id];
          if (obj?.children) {
              obj.children.forEach(collectIds);
          }
      };
      ids.forEach(collectIds);
      
      const movedIds = Array.from(idsToMove);

      // First pass: move all objects
      movedIds.forEach((id) => {
        const obj = newObjects[id];
        if (!obj) return;

        if ((obj.type === 'arrow' || obj.type === 'line') && obj.geometry.points) {
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

      // Second pass: update any arrows connected to moved matching objects
       Object.keys(newObjects).forEach((id) => {
        // Skip if this object was already moved in the first pass
        if (movedIds.includes(id)) return;

        const other = newObjects[id];
        if (other.type === 'arrow' || other.type === 'line') {
          let pointsMoved = false;
          const points = [...(other.geometry.points || [])];

          if (other.startConnection && movedIds.includes(other.startConnection.objectId)) {
            points[0] = { x: points[0].x + dx, y: points[0].y + dy };
            pointsMoved = true;
          }
          if (other.endConnection && movedIds.includes(other.endConnection.objectId)) {
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


  loadFromObject: (state) => {
    set({
      objects: state.objects,
      currentFrame: state.currentFrame || 0,
      ui: {
        ...state.ui,
        // Reset transient UI state
        editingObjectId: null,
        selectedObjectIds: [],
      },
    });
  },
}),
{
  name: 'progressivedraw',
  partialize: (state) => ({
    objects: state.objects,
    currentFrame: state.currentFrame,
    ui: {
      ...state.ui,
      // Don't persist selection or transient states
      selectedObjectIds: [],
      editingObjectId: null,
    }

  }),
}
));
