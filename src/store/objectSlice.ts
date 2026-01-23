import type { StateCreator } from 'zustand';
import type { CanvasObject } from '../types';
import { COT } from '../types';
import { nanoid } from 'nanoid';
import {
  calculateGroupBounds,
  getRecursiveChildrenIds,
  getUpdatedConnections,
} from '../utils/whiteboardUtils';

export interface ObjectSlice {
  objects: Record<string, CanvasObject>;
  addObject: (obj: Omit<CanvasObject, 'id'>) => string;
  updateObject: (id: string, updates: Partial<CanvasObject>, saveHistory?: boolean) => void;
  updateObjects: (ids: string[], updates: Partial<CanvasObject>, saveHistory?: boolean) => void;
  deleteObject: (id: string) => void;
  deleteObjects: (ids: string[]) => void;
  groupObjects: (ids: string[]) => void;
  ungroupObjects: (groupId: string) => void;
  moveObjects: (ids: string[], dx: number, dy: number, saveHistory?: boolean) => void;
  removeObjectFromGroup: (groupId: string, childId: string) => void;
  recalculateGroupBounds: (groupId: string) => void;
  loadFromObject: (state: {
    objects: Record<string, CanvasObject>;
    currentFrame: number;
    ui: any;
  }) => void;
}

type StoreWithDeps = ObjectSlice & {
  ui: {
    selectedObjectIds: string[];
    editingObjectId: string | null;
  };
  past: Record<string, CanvasObject>[];
  future: Record<string, CanvasObject>[];
  setFrame: (frame: number) => void;
};

// Helper: Remove object from old parent and cleanup parent if empty
const removeFromOldParent = (
  objects: Record<string, CanvasObject>,
  childId: string,
  newParentId?: string,
) => {
  const obj = objects[childId];
  if (obj?.parentId && objects[obj.parentId] && obj.parentId !== newParentId) {
    const oldParent = objects[obj.parentId];
    if (oldParent.children) {
      objects[obj.parentId] = {
        ...oldParent,
        children: oldParent.children.filter((cid) => cid !== childId),
      };
      // Recalculate old parent bounds if it still has children
      if (objects[obj.parentId].children!.length > 0) {
        const newBounds = calculateGroupBounds(objects, objects[obj.parentId].children!);
        if (newBounds) {
          objects[obj.parentId] = {
            ...objects[obj.parentId],
            geometry: newBounds,
          };
        }
      } else {
        // If no children left, remove the old group
        delete objects[obj.parentId];
      }
    }
  }
};

export const createObjectSlice: StateCreator<StoreWithDeps, [], [], ObjectSlice> = (set, get) => ({
  objects: {},

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
          if (startParent && startParent === endParent && newObjects[startParent]) {
            const targetParentId = startParent;
            const parent = newObjects[targetParentId];
            newObjects[targetParentId] = {
              ...parent,
              children: Array.from(new Set([...(parent.children || []), id])),
            };
            newObject = { ...newObject, parentId: targetParentId };
            newObjects[id] = newObject;

            const newBounds = calculateGroupBounds(newObjects, newObjects[targetParentId].children!);
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

      // Update connections attached to this object
      const updatedConnections = getUpdatedConnections(newObj, newObjects);
      Object.assign(newObjects, updatedConnections);

      // Handle arrow/line group membership
      let currentObj = newObjects[id];
      const finalObjects = newObjects; // Alias for consistency with original code style, though we mutated newObjects

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
          if (oldParentId) {
              removeFromOldParent(finalObjects, id, targetParentId);
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
      const allIdsToUpdate = getRecursiveChildrenIds(newObjects, ids);

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

      if (existingGroups.length === 1) {
        const existingGroup = existingGroups[0];
        const otherIds = ids.filter((id) => id !== existingGroup.id);

        const updatedChildren = Array.from(
          new Set([...(existingGroup.children || []), ...otherIds]),
        );

        otherIds.forEach((id) => {
          removeFromOldParent(newObjects, id, existingGroup.id);
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

      // Create new group
      const newBounds = calculateGroupBounds(newObjects, ids);
      if (!newBounds) return {}; // Should technically not happen if objects exist

      const groupId = nanoid();
      const group: CanvasObject = {
        id: groupId,
        type: COT.Group,
        children: ids,
        geometry: newBounds,
        style: { stroke: 'rgba(0,0,0,0)', fill: 'transparent' },
        appearFrame: Math.min(...objectsToGroup.map((o) => o.appearFrame)),
      };

      newObjects[groupId] = group;
      ids.forEach((id) => {
        removeFromOldParent(newObjects, id, groupId);
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
      const idsToDelete = getRecursiveChildrenIds(newObjects, ids);

      idsToDelete.forEach((id) => {
        delete newObjects[id];
      });

      // Cleanup groups
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

  loadFromObject: (loadedState) => {
    set({
      objects: loadedState.objects,
      ui: {
        ...get().ui, // preserve existing UI state bits not loaded or reset relevant ones
        // Reset transient UI state
        editingObjectId: null,
        selectedObjectIds: [],
      },
    });
    // Frame is handled by frame slice usually, but we might want to sync it here or call setFrame
    if (loadedState.currentFrame !== undefined) {
      get().setFrame(loadedState.currentFrame);
    }
  },
});
