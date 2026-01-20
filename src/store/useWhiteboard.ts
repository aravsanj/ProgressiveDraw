import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import { Tool, COT } from '../types';
import type { CanvasObject, WhiteboardState } from '../types';

interface WhiteboardActions {
  addObject: (obj: Omit<CanvasObject, 'id'>) => string;
  updateObject: (id: string, updates: Partial<CanvasObject>, saveHistory?: boolean) => void;
  updateObjects: (ids: string[], updates: Partial<CanvasObject>, saveHistory?: boolean) => void;
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
  setIsPanning: (isPanning: boolean) => void;
  deleteObjects: (ids: string[]) => void;
  setEditingObject: (id: string | null) => void;
  moveObjects: (ids: string[], dx: number, dy: number, saveHistory?: boolean) => void;
  loadFromObject: (state: WhiteboardState) => void;

  undo: () => void;
  redo: () => void;
  saveHistory: () => void;
  copy: () => void;
  paste: () => string[];
  duplicate: () => string[];
  removeObjectFromGroup: (groupId: string, childId: string) => void;
  recalculateGroupBounds: (groupId: string) => void;
}

const calculateGroupBounds = (
  objects: Record<string, CanvasObject>,
  childrenIds: string[],
): { x: number; y: number; width: number; height: number } | null => {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  let hasChildren = false;

  childrenIds.forEach((childId) => {
    const child = objects[childId];
    if (!child) return;
    hasChildren = true;

    if (child.geometry.points) {
      child.geometry.points.forEach((p) => {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      });
    } else {
      const { x, y, width = 0, height = 0 } = child.geometry;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + width);
      maxY = Math.max(maxY, y + height);
    }
  });

  if (!hasChildren) return null;

  return {
    x: minX - 10,
    y: minY - 10,
    width: maxX - minX + 20,
    height: maxY - minY + 20,
  };
};

export const useWhiteboard = create<
  WhiteboardState &
    WhiteboardActions & {
      past: Record<string, CanvasObject>[];
      future: Record<string, CanvasObject>[];
      clipboard: CanvasObject[];
    }
>()(
  persist(
    (set, get) => ({
      objects: {},
      clipboard: [],
      currentFrame: 0,
      past: [],
      future: [],
      ui: {
        mode: 'edit',
        activeTool: Tool.Select,
        spotlightEnabled: false,
        zoom: 1,
        pan: { x: 0, y: 0 },
        isPanning: false,
        selectedObjectIds: [],
        editingObjectId: null,
      },

      addObject: (obj) => {
        const id = nanoid();
        let newObject: CanvasObject = { ...obj, id };

        set((state) => {
          const newObjects = { ...state.objects, [id]: newObject };

          // This handles adding arrows/lines to groups if both ends connect to objects in the same group
          if (newObject.type === COT.Arrow || newObject.type === COT.Line) {
            const startId = newObject.startConnection?.objectId;
            const endId = newObject.endConnection?.objectId;

            if (startId && endId) {
              const startParent = newObjects[startId]?.parentId;
              const endParent = newObjects[endId]?.parentId;
              // If both ends connect to objects in the same group, add arrow/line to that group
              // newObjects[startParent] is a defensive check to avoid adding to deleted groups (JUST IN CASE)
              if (startParent && startParent === endParent && newObjects[startParent]) {
                const targetParentId = startParent;
                const parent = newObjects[targetParentId];
                newObjects[targetParentId] = {
                  ...parent,
                  children: Array.from(new Set([...(parent.children || []), id])),
                };
                newObject = { ...newObject, parentId: targetParentId };
                newObjects[id] = newObject;

                const newBounds = calculateGroupBounds(
                  newObjects,
                  newObjects[targetParentId].children!,
                );
                if (newBounds) {
                  newObjects[targetParentId] = {
                    ...newObjects[targetParentId],
                    geometry: newBounds,
                  };
                }
              }
            }
          }

          return {
            past: [...state.past, state.objects],
            future: [],
            objects: newObjects,
          };
        });
        return id;
      },

      updateObject: (id, updates, saveHistory = false) => {
        set((state) => {
          const obj = state.objects[id];
          if (!obj) return {};

          const newObj = { ...obj, ...updates };
          const newObjects = { ...state.objects, [id]: newObj };

          // If resizing a group, scale children proportionally
          if (newObj.type === COT.Group && updates.geometry && obj.children) {
            const oldGeom = obj.geometry;
            const newGeom = newObj.geometry;

            const scaleX = (newGeom.width || 0) / (oldGeom.width || 1);
            const scaleY = (newGeom.height || 0) / (oldGeom.height || 1);

            obj.children.forEach((childId) => {
              const child = newObjects[childId];
              if (!child) return;

              if (child.geometry.points) {
                // Handle arrow/line children
                const newPoints = child.geometry.points.map((p) => ({
                  x: (newGeom.x || 0) + (p.x - (oldGeom.x || 0)) * scaleX,
                  y: (newGeom.y || 0) + (p.y - (oldGeom.y || 0)) * scaleY,
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
                    x: (newGeom.x || 0) + relX * scaleX,
                    y: (newGeom.y || 0) + relY * scaleY,
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
            if (
              newObj.type === COT.Rectangle ||
              newObj.type === COT.Diamond ||
              newObj.type === COT.Ellipse ||
              newObj.type === COT.Group
            ) {
              const getAnchorPos = (obj: CanvasObject, anchorId: string) => {
                const { x, y, width = 0, height = 0 } = obj.geometry;
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

              Object.values(updatedObjects).forEach((other) => {
                if (other.type === COT.Arrow || other.type === COT.Line) {
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

          const finalObjects = updateConnections(newObjects);

          // Handle arrow/line group membership
          let currentObj = finalObjects[id];
          if (
            (currentObj.type === COT.Arrow || currentObj.type === COT.Line) &&
            (updates.startConnection !== undefined || updates.endConnection !== undefined)
          ) {
            const startId = currentObj.startConnection?.objectId;
            const endId = currentObj.endConnection?.objectId;
            let targetParentId: string | undefined = undefined;

            if (startId && endId) {
              const startParent = finalObjects[startId]?.parentId;
              const endParent = finalObjects[endId]?.parentId;
              if (startParent && startParent === endParent) {
                targetParentId = startParent;
              }
            }

            if (currentObj.parentId !== targetParentId) {
              const oldParentId = currentObj.parentId;
              // Remove from old parent
              if (oldParentId && finalObjects[oldParentId]) {
                const oldParent = finalObjects[oldParentId];
                finalObjects[oldParentId] = {
                  ...oldParent,
                  children: oldParent.children?.filter((cid) => cid !== id),
                };
                const oldBounds = calculateGroupBounds(
                  finalObjects,
                  finalObjects[oldParentId].children || [],
                );
                if (oldBounds) {
                  finalObjects[oldParentId].geometry = oldBounds;
                } else {
                  delete finalObjects[oldParentId]; // Remove empty group
                }
              }

              // Add to new parent
              if (targetParentId && finalObjects[targetParentId]) {
                const newParent = finalObjects[targetParentId];
                finalObjects[targetParentId] = {
                  ...newParent,
                  children: Array.from(new Set([...(newParent.children || []), id])),
                };
                finalObjects[id] = { ...finalObjects[id], parentId: targetParentId };
                const newBounds = calculateGroupBounds(
                  finalObjects,
                  finalObjects[targetParentId].children || [],
                );
                if (newBounds) {
                  finalObjects[targetParentId].geometry = newBounds;
                }
              } else {
                finalObjects[id] = { ...finalObjects[id], parentId: undefined };
              }
              currentObj = finalObjects[id];
            }
          }

          // Update parent group bounds if needed
          if (currentObj?.parentId && finalObjects[currentObj.parentId]) {
            const parent = finalObjects[currentObj.parentId];
            if (parent.children) {
              const newBounds = calculateGroupBounds(finalObjects, parent.children);
              if (newBounds) {
                finalObjects[parent.id] = {
                  ...parent,
                  geometry: newBounds,
                };
              }
            }
          }

          const historyUpdate = saveHistory
            ? {
                past: [...state.past, state.objects],
                future: [],
              }
            : {};

          return {
            objects: finalObjects,
            ...historyUpdate,
          };
        });
      },

      updateObjects: (ids, updates, saveHistory = false) => {
        set((state) => {
          const newObjects = { ...state.objects };

          // Helper to recursively collect all object IDs including children
          const collectIds = (targetIds: string[], collected = new Set<string>()) => {
            targetIds.forEach((id) => {
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

          allIdsToUpdate.forEach((id) => {
            if (newObjects[id]) {
              newObjects[id] = { ...newObjects[id], ...updates };
            }
          });

          const historyUpdate = saveHistory
            ? {
                past: [...state.past, state.objects],
                future: [],
              }
            : {};

          return { objects: newObjects, ...historyUpdate };
        });
      },

      groupObjects: (ids) => {
        set((state) => {
          if (ids.length < 2) return {};

          const objectsToGroup = ids.map((id) => state.objects[id]).filter(Boolean);
          if (objectsToGroup.length === 0) return {};

          const existingGroups = objectsToGroup.filter((obj) => obj.type === COT.Group);

          const newObjects = { ...state.objects };

          // Helper to clean up parent reference properly
          const removeFromOldParent = (objectId: string, newParentId?: string) => {
            const obj = newObjects[objectId];
            if (obj?.parentId && newObjects[obj.parentId] && obj.parentId !== newParentId) {
              const oldParent = newObjects[obj.parentId];
              if (oldParent.children) {
                newObjects[obj.parentId] = {
                  ...oldParent,
                  children: oldParent.children.filter((cid) => cid !== objectId),
                };
                // Recalculate old parent bounds if it still has children
                if (newObjects[obj.parentId].children!.length > 0) {
                  const newBounds = calculateGroupBounds(
                    newObjects,
                    newObjects[obj.parentId].children!,
                  );
                  if (newBounds) {
                    newObjects[obj.parentId] = {
                      ...newObjects[obj.parentId],
                      geometry: newBounds,
                    };
                  }
                } else {
                  // If no children left, remove the old group
                  delete newObjects[obj.parentId];
                }
              }
            }
          };

          if (existingGroups.length === 1) {
            const existingGroup = existingGroups[0];
            const otherIds = ids.filter((id) => id !== existingGroup.id);

            // Add items to existing group, ensuring no duplicates
            const updatedChildren = Array.from(
              new Set([...(existingGroup.children || []), ...otherIds]),
            );

            otherIds.forEach((id) => {
              removeFromOldParent(id, existingGroup.id);
              newObjects[id] = { ...newObjects[id], parentId: existingGroup.id };
            });

            const newBounds = calculateGroupBounds(newObjects, updatedChildren);
            newObjects[existingGroup.id] = {
              ...existingGroup,
              children: updatedChildren,
              geometry: newBounds || existingGroup.geometry,
            };

            return {
              past: [...state.past, state.objects],
              future: [],
              objects: newObjects,
              ui: { ...state.ui, selectedObjectIds: [existingGroup.id] },
            };
          }

          // Default: Create new group (if 0 or >1 groups selected)
          let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;

          objectsToGroup.forEach((obj) => {
            if (obj.geometry.points) {
              obj.geometry.points.forEach((p) => {
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
            type: COT.Group,
            children: ids,
            geometry: {
              x: minX - 10,
              y: minY - 10,
              width: maxX - minX + 20,
              height: maxY - minY + 20,
            },
            style: { stroke: 'rgba(0,0,0,0)', fill: 'transparent' },
            appearFrame: Math.min(...objectsToGroup.map((o) => o.appearFrame)),
          };

          newObjects[groupId] = group;
          ids.forEach((id) => {
            removeFromOldParent(id, groupId);
            newObjects[id] = { ...newObjects[id], parentId: groupId };
          });

          return {
            past: [...state.past, state.objects],
            future: [],
            objects: newObjects,
            ui: { ...state.ui, selectedObjectIds: [groupId] },
          };
        });
      },

      ungroupObjects: (groupId) => {
        set((state) => {
          const group = state.objects[groupId];
          if (!group || group.type !== COT.Group || !group.children) return {};

          const newObjects = { ...state.objects };
          const childrenIds = group.children;

          childrenIds.forEach((childId) => {
            if (newObjects[childId]) {
              newObjects[childId] = { ...newObjects[childId], parentId: undefined };
            }
          });

          delete newObjects[groupId];

          return {
            past: [...state.past, state.objects],
            future: [],
            objects: newObjects,
            ui: { ...state.ui, selectedObjectIds: childrenIds },
          };
        });
      },

      deleteObject: (id) => {
        get().deleteObjects([id]);
      },

      deleteObjects: (ids) => {
        set((state) => {
          const newObjects = { ...state.objects };

          // Recursively collect all IDs to delete (including children of groups)
          const collectIdsToDelete = (targetIds: string[], collected = new Set<string>()) => {
            targetIds.forEach((id) => {
              if (collected.has(id)) return;
              collected.add(id);

              const obj = state.objects[id];
              if (obj?.children) {
                collectIdsToDelete(obj.children, collected);
              }
            });
            return collected;
          };

          const idsToDelete = collectIdsToDelete(ids);

          idsToDelete.forEach((id) => {
            delete newObjects[id];
          });

          // Cleanup groups: update children lists, recalculate bounds, or remove empty groups
          Object.keys(newObjects).forEach((id) => {
            const obj = newObjects[id];
            if (obj.type === COT.Group && obj.children) {
              let updatedChildren = obj.children.filter((cid) => newObjects[cid]);

              // Check if any remaining arrows should leave the group
              const arrowsInGroup = updatedChildren.filter((cid) => {
                const o = newObjects[cid];
                return o && (o.type === COT.Arrow || o.type === COT.Line);
              });

              arrowsInGroup.forEach((aid) => {
                const arrow = newObjects[aid];
                const startId = arrow.startConnection?.objectId;
                const endId = arrow.endConnection?.objectId;
                const startParent = startId ? newObjects[startId]?.parentId : undefined;
                const endParent = endId ? newObjects[endId]?.parentId : undefined;

                if (startParent !== id || endParent !== id) {
                  newObjects[aid] = { ...arrow, parentId: undefined };
                  updatedChildren = updatedChildren.filter((cid) => cid !== aid);
                }
              });

              if (updatedChildren.length === 0) {
                delete newObjects[id];
              } else {
                const newBounds = calculateGroupBounds(newObjects, updatedChildren);
                newObjects[id] = {
                  ...obj,
                  children: updatedChildren,
                  geometry: newBounds || obj.geometry,
                };
              }
            }
          });

          const newSelected = state.ui.selectedObjectIds.filter((oid) => !idsToDelete.has(oid));
          const newEditingId =
            state.ui.editingObjectId && idsToDelete.has(state.ui.editingObjectId)
              ? null
              : state.ui.editingObjectId;

          return {
            past: [...state.past, state.objects],
            future: [],
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

      setIsPanning: (isPanning) => set((state) => ({ ui: { ...state.ui, isPanning } })),

      setEditingObject: (id) => set((state) => ({ ui: { ...state.ui, editingObjectId: id } })),

      moveObjects: (ids, dx, dy, saveHistory = false) => {
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

            if ((obj.type === COT.Arrow || obj.type === COT.Line) && obj.geometry.points) {
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
            if (other.type === COT.Arrow || other.type === COT.Line) {
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

          // Update parent group bounds for all moved objects
          const parentIdsToUpdate = new Set<string>();
          movedIds.forEach((id) => {
            const obj = newObjects[id];
            if (obj?.parentId) {
              parentIdsToUpdate.add(obj.parentId);
            }
          });

          parentIdsToUpdate.forEach((parentId) => {
            const parent = newObjects[parentId];
            if (parent && parent.children) {
              const newBounds = calculateGroupBounds(newObjects, parent.children);
              if (newBounds) {
                newObjects[parentId] = {
                  ...parent,
                  geometry: newBounds,
                };
              }
            }
          });

          const historyUpdate = saveHistory
            ? {
                past: [...state.past, state.objects],
                future: [],
              }
            : {};

          return { objects: newObjects, ...historyUpdate };
        });
      },

      undo: () => {
        set((state) => {
          if (state.past.length === 0) return {};

          const previous = state.past[state.past.length - 1];
          const newPast = state.past.slice(0, state.past.length - 1);

          return {
            past: newPast,
            future: [state.objects, ...state.future],
            objects: previous,
            ui: { ...state.ui, selectedObjectIds: [], editingObjectId: null },
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
            ui: { ...state.ui, selectedObjectIds: [], editingObjectId: null },
          };
        });
      },

      saveHistory: () => {
        set((state) => ({
          past: [...state.past, state.objects],
          future: [],
        }));
      },

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

      removeObjectFromGroup: (groupId, childId) => {
        set((state) => {
          const group = state.objects[groupId];
          const child = state.objects[childId];
          if (!group || !child || group.type !== COT.Group || !group.children) return {};

          const newChildren = group.children.filter((id) => id !== childId);
          const newObjects = { ...state.objects };

          // Update child
          newObjects[childId] = { ...child, parentId: undefined };

          // Check for arrows in this group that should now leave it
          let childrenToKeep = newChildren;
          const arrowsToProcess = newChildren.filter((id) => {
            const o = newObjects[id];
            return o && (o.type === COT.Arrow || o.type === COT.Line);
          });

          arrowsToProcess.forEach((aid) => {
            const arrow = newObjects[aid];
            const startId = arrow.startConnection?.objectId;
            const endId = arrow.endConnection?.objectId;
            const startParent = startId ? newObjects[startId]?.parentId : undefined;
            const endParent = endId ? newObjects[endId]?.parentId : undefined;

            if (startParent !== groupId || endParent !== groupId) {
              newObjects[aid] = { ...arrow, parentId: undefined };
              childrenToKeep = childrenToKeep.filter((id) => id !== aid);
            }
          });

          // Update group
          if (childrenToKeep.length === 0) {
            delete newObjects[groupId];
          } else {
            const newBounds = calculateGroupBounds(newObjects, childrenToKeep);
            if (newBounds) {
              newObjects[groupId] = {
                ...group,
                children: childrenToKeep,
                geometry: newBounds,
              };
            } else {
              newObjects[groupId] = { ...group, children: childrenToKeep };
            }
          }

          return {
            past: [...state.past, state.objects],
            future: [],
            objects: newObjects,
            ui: {
              ...state.ui,
              selectedObjectIds: newObjects[groupId]
                ? state.ui.selectedObjectIds
                : state.ui.selectedObjectIds.filter((id) => id !== groupId),
            },
          };
        });
      },

      recalculateGroupBounds: (groupId) => {
        set((state) => {
          const group = state.objects[groupId];
          if (!group || group.type !== COT.Group || !group.children) return {};

          const newBounds = calculateGroupBounds(state.objects, group.children);
          if (!newBounds) return {};

          return {
            objects: {
              ...state.objects,
              [groupId]: { ...group, geometry: newBounds },
            },
          };
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
        },
      }),
    },
  ),
);
