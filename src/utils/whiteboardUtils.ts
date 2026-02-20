import type { CanvasObject } from '../types';
import { COT } from '../types';

/**
 * Calculates the bounding box of a group based on its children.
 */
export const calculateGroupBounds = (
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

/**
 * Recursively collects all object IDs starting from the given IDs,
 * traversing into children of groups.
 */
export const getRecursiveChildrenIds = (
  objects: Record<string, CanvasObject>,
  targetIds: string[],
  collected = new Set<string>(),
): Set<string> => {
  targetIds.forEach((id) => {
    if (collected.has(id)) return;
    collected.add(id);
    const obj = objects[id];
    if (obj?.children) {
      getRecursiveChildrenIds(objects, obj.children, collected);
    }
  });
  return collected;
};

/**
 * Updates connections for arrows/lines attached to a modified object.
 */
export const getUpdatedConnections = (
  modifiedObj: CanvasObject,
  objects: Record<string, CanvasObject>,
): Record<string, CanvasObject> => {
  const updatedObjects: Record<string, CanvasObject> = {};

  if (
    modifiedObj.type === COT.Rectangle ||
    modifiedObj.type === COT.Diamond ||
    modifiedObj.type === COT.Ellipse ||
    modifiedObj.type === COT.Group
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

    Object.values(objects).forEach((other) => {
      if (other.type === COT.Arrow || other.type === COT.Line) {
        let pointsMoved = false;
        const points = [...(other.geometry.points || [])];

        if (other.startConnection?.objectId === modifiedObj.id) {
          points[0] = getAnchorPos(modifiedObj, other.startConnection.anchorId);
          pointsMoved = true;
        }
        if (other.endConnection?.objectId === modifiedObj.id) {
          points[points.length - 1] = getAnchorPos(modifiedObj, other.endConnection.anchorId);
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
