import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { COT, Tool, type CanvasObject } from '../types';
import { useWhiteboard } from '../store/useWhiteboard';
import { RectangleShape } from './shapes/RectangleShape';
import { DiamondShape } from './shapes/DiamondShape';
import { EllipseShape } from './shapes/EllipseShape';
import { ArrowShape } from './shapes/ArrowShape';
import { LineShape } from './shapes/LineShape';
import { TextShape } from './shapes/TextShape';
import { GroupShape } from './shapes/GroupShape';
import { useGesture } from '@use-gesture/react';
import { cn } from '../lib/utils';

interface Props {
  object: CanvasObject;
}

let measuringDiv: HTMLDivElement | null = null;
const getTextHeight = (text: string, fontSize: number, width: number) => {
  if (typeof document === 'undefined') return 0;
  if (!measuringDiv) {
    measuringDiv = document.createElement('div');
    measuringDiv.style.position = 'absolute';
    measuringDiv.style.visibility = 'hidden';
    measuringDiv.style.top = '-9999px';
    measuringDiv.style.left = '-9999px';
    measuringDiv.style.lineHeight = '1.5';
    measuringDiv.style.whiteSpace = 'pre-wrap';
    measuringDiv.style.wordBreak = 'break-word';
    measuringDiv.style.padding = '0';
    measuringDiv.style.fontFamily = '"Outfit", sans-serif';
    document.body.appendChild(measuringDiv);
  }
  measuringDiv.style.width = `${width}px`;
  measuringDiv.style.fontSize = `${fontSize}px`;
  measuringDiv.innerText = text || ' ';
  return measuringDiv.scrollHeight || 20;
};

const ResizeHandle: React.FC<{
  object: CanvasObject;
  handle: string;
  cx?: number;
  cy?: number;
  zoom: number;
  updateObject: (id: string, updates: Partial<CanvasObject>) => void;
}> = ({ object, handle, cx, cy, zoom, updateObject }) => {
  const getCursor = (h: string) => {
    switch (h) {
      case 'nw':
      case 'se':
        return 'nwse-resize';
      case 'ne':
      case 'sw':
        return 'nesw-resize';
      case 'n':
      case 's':
        return 'ns-resize';
      case 'e':
      case 'w':
        return 'ew-resize';
      default:
        return 'pointer';
    }
  };

  const bind = useGesture(
    {
      onDrag: ({ movement: [mx, my], event, first, memo }) => {
        event.stopPropagation();
        const scale = zoom;

        if (first) {
          useWhiteboard.getState().saveHistory();
          return {
            x: object.geometry.x,
            y: object.geometry.y,
            width: object.geometry.width || 0,
            height: object.geometry.height || 0,
            fontSize: object.style.fontSize || 16,
          };
        }

        const dx = mx / scale;
        const dy = my / scale;
        const { x, y, width, height, fontSize } = memo;

        let newX = x;
        let newY = y;
        let newWidth = width;
        let newHeight = height;

        // Base geometric resize logic
        if (handle.includes('e')) newWidth = width + dx;
        if (handle.includes('s')) newHeight = height + dy;
        if (handle.includes('w')) {
          newX = x + dx;
          newWidth = width - dx;
        }
        if (handle.includes('n')) {
          newY = y + dy;
          newHeight = height - dy;
        }

        const updates: Partial<CanvasObject> = {};

        // Special handling for text: Vector-like scaling vs Reflow
        if (object.type === COT.Text) {
          const isCorner = handle.length === 2;
          const isVert = handle === 'n' || handle === 's';
          const isHoriz = handle === 'e' || handle === 'w';

          if (isCorner || isVert) {
            // UNIFORM VECTOR SCALING
            let s = 1;

            if (isCorner) {
              // Dominant axis scaling
              const targetW = handle.includes('w') ? width - dx : width + dx;
              const targetH = handle.includes('n') ? height - dy : height + dy;

              const sW = targetW / (width || 1);
              const sH = targetH / (height || 1);

              // Use the scale factor that represents the larger visual change
              if (Math.abs(sW - 1) > Math.abs(sH - 1)) {
                s = sW;
              } else {
                s = sH;
              }
            } else {
              // Vertical handle scaling
              const targetH = handle === 'n' ? height - dy : height + dy;
              s = targetH / (height || 1);
            }

            s = Math.max(0.1, s);

            const newFontSize = Math.max(4, fontSize * s);
            updates.style = { ...object.style, fontSize: newFontSize };

            // Force box dimensions to match the same scale factor (Vector behavior)
            newWidth = width * s;
            newHeight = height * s;

            // Recalculate anchors based on new sizes
            if (handle.includes('w')) newX = x + (width - newWidth);
            else newX = x;

            if (handle.includes('n')) newY = y + (height - newHeight);
            else newY = y;
          } else if (isHoriz) {
            // HORIZONTAL REFLOW
            newWidth = Math.max(10, newWidth);
            newHeight = getTextHeight(object.text || '', fontSize, newWidth);
            // newX/newWidth are already handled by base logic for 'w'.
            if (handle === 'w') newX = x + width - newWidth;
          }
        }

        updateObject(object.id, {
          ...updates,
          geometry: {
            ...object.geometry,
            x: newX,
            y: newY,
            width: Math.max(10, newWidth),
            height: Math.max(10, newHeight),
          },
        });

        return memo;
      },
    },
    {
      drag: { filterTaps: true },
    },
  );

  const isCorner = handle.length === 2;

  if (isCorner && cx !== undefined && cy !== undefined) {
    return (
      <rect
        x={cx - 4}
        y={cy - 4}
        width={8}
        height={8}
        fill="white"
        stroke="#3b82f6"
        strokeWidth={1}
        style={{ cursor: getCursor(handle) }}
        data-anchor="true"
        data-resize-handle="true"
        {...bind()}
      />
    );
  }

  // Edge handle
  const { x, y, width = 0, height = 0 } = object.geometry;
  let rx, ry, rw, rh;
  const padding = 2; // match selection ring offset
  const hitWidth = 6;

  if (handle === 'n') {
    rx = x;
    ry = y - padding - hitWidth / 2;
    rw = width;
    rh = hitWidth;
  } else if (handle === 's') {
    rx = x;
    ry = y + height + padding - hitWidth / 2;
    rw = width;
    rh = hitWidth;
  } else if (handle === 'w') {
    rx = x - padding - hitWidth / 2;
    ry = y;
    rw = hitWidth;
    rh = height;
  } else {
    // 'e'
    rx = x + width + padding - hitWidth / 2;
    ry = y;
    rw = hitWidth;
    rh = height;
  }

  return (
    <rect
      x={rx}
      y={ry}
      width={rw}
      height={rh}
      fill="transparent"
      style={{ cursor: getCursor(handle) }}
      data-anchor="true"
      data-resize-handle="true"
      {...bind()}
    />
  );
};

const PointHandle: React.FC<{
  object: CanvasObject;
  pointIndex: number;
  cx: number;
  cy: number;
  zoom: number;
  updateObject: (id: string, updates: Partial<CanvasObject>) => void;
  allObjects: Record<string, CanvasObject>;
}> = ({ object, pointIndex, cx, cy, zoom, updateObject, allObjects }) => {
  const bind = useGesture(
    {
      onDrag: ({ movement: [mx, my], first, memo, event }) => {
        event.stopPropagation();
        const scale = zoom;

        // Use memo to store the initial point position when drag starts
        if (first) {
          useWhiteboard.getState().saveHistory();
          memo = { ...object.geometry.points![pointIndex] };
        }

        const unsnapped = {
          x: memo.x + mx / scale,
          y: memo.y + my / scale,
        };

        const points = [...(object.geometry.points || [])];
        let startConnection = object.startConnection;
        let endConnection = object.endConnection;

        // Snapping logic
        const SNAP_THRESHOLD = 25 / zoom;
        let snapped = false;
        let currentPoint = { ...unsnapped };

        for (const otherObj of Object.values(allObjects)) {
          if (
            (otherObj.type === COT.Rectangle ||
              otherObj.type === COT.Diamond ||
              otherObj.type === COT.Ellipse) &&
            otherObj.id !== object.id &&
            // Prevent connecting start to end connection object
            !(pointIndex === 0 && otherObj.id === object.endConnection?.objectId) &&
            // Prevent connecting end to start connection object
            !(pointIndex === points.length - 1 && otherObj.id === object.startConnection?.objectId)
          ) {
            const { x: ox, y: oy, width = 0, height = 0 } = otherObj.geometry;
            const anchors: { id: 'n' | 's' | 'e' | 'w'; x: number; y: number }[] = [
              { id: 'n', x: ox + width / 2, y: oy },
              { id: 's', x: ox + width / 2, y: oy + height },
              { id: 'e', x: ox + width, y: oy + height / 2 },
              { id: 'w', x: ox, y: oy + height / 2 },
            ];

            for (const anchor of anchors) {
              const dist = Math.hypot(anchor.x - unsnapped.x, anchor.y - unsnapped.y);
              if (dist < SNAP_THRESHOLD) {
                currentPoint = { x: anchor.x, y: anchor.y };
                const connection = { objectId: otherObj.id, anchorId: anchor.id };
                if (pointIndex === 0) startConnection = connection;
                else if (pointIndex === points.length - 1) endConnection = connection;
                snapped = true;
                break;
              }
            }
          }
          if (snapped) break;
        }

        if (!snapped) {
          if (pointIndex === 0) startConnection = undefined;
          else if (pointIndex === points.length - 1) endConnection = undefined;
        }

        points[pointIndex] = currentPoint;

        updateObject(object.id, {
          geometry: {
            ...object.geometry,
            points,
          },
          startConnection,
          endConnection,
        });

        return memo;
      },
    },
    {
      drag: { filterTaps: true },
    },
  );

  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      fill="white"
      stroke="#3b82f6"
      strokeWidth={1.5}
      style={{ cursor: 'pointer' }}
      {...bind()}
    />
  );
};

export const ObjectRenderer: React.FC<Props> = ({ object }) => {
  const { currentFrame, ui, selectObject, updateObject, setEditingObject, moveObjects, objects } =
    useWhiteboard();
  const editRef = useRef<HTMLDivElement>(null);

  const isEditing = ui.editingObjectId === object.id;

  const isAnyArrowOrLineSelected = ui.selectedObjectIds.some((id) => {
    const obj = objects[id];
    return obj && (obj.type === COT.Arrow || obj.type === COT.Line);
  });

  const isConnectedToSelectedArrow = ui.selectedObjectIds.some((id) => {
    const obj = objects[id];
    return (
      obj &&
      (obj.type === COT.Arrow || obj.type === COT.Line) &&
      (obj.startConnection?.objectId === object.id || obj.endConnection?.objectId === object.id)
    );
  });

  useEffect(() => {
    if (isEditing && editRef.current) {
      // Set initial text only once when starting to edit
      // We use a property check to avoid resetting if user already typed and a re-render occurred
      if (editRef.current.innerHTML === '') {
        editRef.current.innerText = object.text || '';
      }

      const timer = setTimeout(() => {
        if (!editRef.current) return;
        editRef.current.focus();

        // Move cursor to end of text
        try {
          const selection = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(editRef.current);
          range.collapse(false);
          selection?.removeAllRanges();
          selection?.addRange(range);
        } catch (err) {
          console.warn('Failed to set selection:', err);
        }
      }, 50);
      return () => clearTimeout(timer);
    } else if (!isEditing && editRef.current) {
      // Clear for next session
      editRef.current.innerHTML = '';
    }
  }, [isEditing]); // eslint-disable-line react-hooks/exhaustive-deps

  const isVisible =
    currentFrame >= object.appearFrame && currentFrame < (object.disappearFrame ?? Infinity);

  // Check parent visibility if this object is part of a group
  const parentVisible = object.parentId
    ? (() => {
        const parent = objects[object.parentId];
        if (!parent) return true;
        return (
          currentFrame >= parent.appearFrame && currentFrame < (parent.disappearFrame ?? Infinity)
        );
      })()
    : true;

  const isSelected = ui.selectedObjectIds.includes(object.id);

  const bind = useGesture(
    {
      onPointerDown: ({ event }) => {
        const e = event as unknown as PointerEvent;
        const target = e.target as HTMLElement;
        if (target.getAttribute('data-anchor') === 'true') return;

        if (e.button !== 0 || isEditing) return;

        if (ui.activeTool !== Tool.Arrow && ui.activeTool !== Tool.Line) {
          event.stopPropagation();
        }

        // If object is part of a group, select the group instead
        // UNLESS this specific object is already selected (allows "drilling down")
        const isSelected = ui.selectedObjectIds.includes(object.id);
        const targetId =
          object.parentId && objects[object.parentId] && !isSelected ? object.parentId : object.id;
        const targetObj = objects[targetId];

        if (e.shiftKey && ui.selectedObjectIds.length > 0 && targetObj) {
          const lastId = ui.selectedObjectIds[ui.selectedObjectIds.length - 1];
          const lastObj = objects[lastId];

          if (lastObj) {
            // Calculate union bounding box of the last selected object and the clicked object
            const getBounds = (o: CanvasObject) => {
              if (o.geometry.points) {
                let minX = Infinity,
                  minY = Infinity,
                  maxX = -Infinity,
                  maxY = -Infinity;
                o.geometry.points.forEach((p) => {
                  minX = Math.min(minX, p.x);
                  minY = Math.min(minY, p.y);
                  maxX = Math.max(maxX, p.x);
                  maxY = Math.max(maxY, p.y);
                });
                return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
              }
              const { x, y, width = 0, height = 0 } = o.geometry;
              return { x, y, width, height };
            };

            const b1 = getBounds(lastObj);
            const b2 = getBounds(targetObj);

            const selectionRect = {
              x: Math.min(b1.x, b2.x),
              y: Math.min(b1.y, b2.y),
              width: Math.max(b1.x + b1.width, b2.x + b2.width) - Math.min(b1.x, b2.x),
              height: Math.max(b1.y + b1.height, b2.y + b2.height) - Math.min(b1.y, b2.y),
            };

            // Find all objects intersecting this rect
            const newSelectedIds = Object.values(objects)
              .filter((obj) => {
                // Skip if not visible/selectable (simplified check)
                if (obj.parentId) return false; // We'll select parents instead

                const b = getBounds(obj);
                // Rect intersection check
                return (
                  b.x < selectionRect.x + selectionRect.width &&
                  b.x + b.width > selectionRect.x &&
                  b.y < selectionRect.y + selectionRect.height &&
                  b.y + b.height > selectionRect.y
                );
              })
              .map((o) => o.id);

            // Ensure the explicitly clicked one and anchor are included (they should be by geom check)
            // But handle groups: parentIds might be needed if children matched?
            // The filter above skips objects with parents, so we only select top-level items.
            // This is consistent with canvas drags.

            useWhiteboard.getState().selectObjects(newSelectedIds);
            return;
          }
        }

        selectObject(targetId, e.ctrlKey || e.metaKey);
      },
      onDrag: ({ delta: [dx, dy], event, buttons, ctrlKey, first }) => {
        const target = event.target as HTMLElement;
        if (target.getAttribute('data-anchor') === 'true') return;

        if (buttons !== 1 || ctrlKey || isEditing) return;
        event.stopPropagation();

        if (first) {
          useWhiteboard.getState().saveHistory();
        }

        const scale = ui.zoom;
        const isSelected = ui.selectedObjectIds.includes(object.id);
        const idsToMove = isSelected ? ui.selectedObjectIds : [object.id];

        moveObjects(idsToMove, dx / scale, dy / scale);
      },
      onDoubleClick: (state) => {
        // Prevent event from bubbling up to create new objects if applicable
        state.event.stopPropagation();
        if (
          object.type === COT.Rectangle ||
          object.type === COT.Diamond ||
          object.type === COT.Ellipse ||
          object.type === COT.Text ||
          object.type === COT.Arrow ||
          object.type === COT.Line
        ) {
          setEditingObject(object.id);
        }
      },
    },
    {
      drag: {
        filterTaps: true,
      },
    },
  );

  if ((!isVisible || !parentVisible) && ui.mode === 'present') return null;

  const opacity = isVisible && parentVisible ? 1 : 0.2;

  const renderShape = () => {
    // Hide the primary shape text while editing to avoid overlap, EXCEPT for arrows/lines where we need it for the gap
    const visibleObject =
      isEditing && object.type !== COT.Arrow && object.type !== COT.Line
        ? { ...object, text: '' }
        : object;

    return (
      <g style={{ pointerEvents: isEditing ? 'none' : 'auto' }}>
        {(() => {
          switch (object.type) {
            case COT.Rectangle:
              return <RectangleShape object={visibleObject} />;
            case COT.Diamond:
              return <DiamondShape object={visibleObject} />;
            case COT.Ellipse:
              return <EllipseShape object={visibleObject} />;
            case COT.Arrow:
              return <ArrowShape object={visibleObject} isEditing={isEditing} />;
            case COT.Line:
              return <LineShape object={visibleObject} isEditing={isEditing} />;
            case COT.Text:
              return <TextShape object={visibleObject} isEditing={isEditing} />;
            case COT.Group:
              return <GroupShape object={visibleObject} />;
            default:
              return null;
          }
        })()}
      </g>
    );
  };

  const { x, y, width = 0, height = 0 } = object.geometry;

  let editX = x;
  let editY = y;
  let editWidth = width;
  let editHeight = height;

  // Determine the Center Point and Dimensions for the edit box
  if ((object.type === COT.Arrow || object.type === COT.Line) && object.geometry.points) {
    const points = object.geometry.points;
    const p1 = points[0];
    const p2 = points[points.length - 1];

    // Center point of the line
    const centerX = (p1.x + p2.x) / 2;
    const centerY = (p1.y + p2.y) / 2;

    // Calculate arrow length for max width linkage
    const length = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    const textMaxWidth = Math.max(Math.min(length, 600), 100);

    // Match ArrowShape's foreignObject width
    editWidth = textMaxWidth + 40;
    editHeight = 200; // ample space for multi-line

    // Top-left of the edit box
    editX = centerX - editWidth / 2;
    editY = centerY - editHeight / 2;
  } else if (object.type === COT.Text) {
    editWidth = Math.max(width, 100);
    editHeight = Math.max(height, 40);
    editX = x; // Text anchors top-left
    editY = y;
  } else {
    // Shapes (Rectangle, Diamond, Ellipse)
    // We want the edit box to match the shape's bounds + some padding
    const padding = 20;
    editWidth = Math.max(width, 20) + padding;
    editHeight = Math.max(height, 20) + padding;

    const centerX = x + width / 2;
    const centerY = y + height / 2;

    editX = centerX - editWidth / 2;
    editY = centerY - editHeight / 2;
  }

  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      {...(isEditing ? {} : (bind() as Record<string, unknown>))}
      style={{
        cursor: isEditing ? 'text' : 'move',
        pointerEvents:
          object.type === COT.Group &&
          !isSelected &&
          object.children?.some((id) => ui.selectedObjectIds.includes(id))
            ? 'none'
            : 'auto',
      }}
    >
      {renderShape()}

      {isEditing && (
        <foreignObject
          x={editX}
          y={editY}
          width={editWidth}
          height={editHeight}
          style={{ pointerEvents: 'auto', cursor: 'text' }}
        >
          <div
            className={cn(
              'w-full h-full flex',
              object.type === COT.Text
                ? 'justify-start items-start p-0'
                : 'justify-center items-center', // Removed p-2 for arrows to avoid double padding if we handle it inner, but Rect needs p-2? Rect uses w-full h-full.
              // Actually, arrows need centered flex. Rects need centered flex.
              // We will adjust padding on the inner element specifically for Arrow/Line.
              object.type !== COT.Arrow && object.type !== COT.Line && object.type !== COT.Text
                ? 'p-2'
                : 'p-0',
              'transition-all duration-200',
            )}
          >
            <div
              ref={editRef}
              contentEditable
              suppressContentEditableWarning
              tabIndex={0}
              className={cn(
                'border-none outline-none cursor-text',
                object.type === COT.Text
                  ? 'text-[#e4e4e7] p-0 bg-transparent text-left min-w-[10px] min-h-[1em]'
                  : 'text-white text-center overflow-hidden min-w-[10px]',
                // Apply specific padding for arrows/lines to match ArrowShape
                object.type === COT.Arrow || object.type === COT.Line ? 'rounded-[4px]' : 'p-1', // Removed w-full h-full to allow flex container to actually center the content
              )}
              style={{
                fontSize:
                  object.style.fontSize ||
                  (object.type === COT.Arrow || object.type === COT.Line
                    ? 12
                    : object.type === COT.Rectangle ||
                        object.type === COT.Diamond ||
                        object.type === COT.Ellipse
                      ? 14
                      : 24),
                lineHeight: object.type === COT.Arrow || object.type === COT.Line ? '1.3' : '1.5',
                padding:
                  object.type === COT.Arrow || object.type === COT.Line ? '2px 4px' : undefined,
                backgroundColor:
                  object.type === COT.Arrow || object.type === COT.Line ? '#09090b' : undefined, // Match arrow background
                fontFamily: '"Outfit", sans-serif',
                wordBreak: 'break-word',
                // Important: Match maxWidth logic from ArrowShape
                maxWidth:
                  (object.type === COT.Arrow || object.type === COT.Line) && object.geometry.points
                    ? `${Math.max(Math.min(Math.sqrt(Math.pow(object.geometry.points[object.geometry.points.length - 1].x - object.geometry.points[0].x, 2) + Math.pow(object.geometry.points[object.geometry.points.length - 1].y - object.geometry.points[0].y, 2)), 600), 100)}px`
                    : '100%',
                whiteSpace: 'pre-wrap',
                minWidth: '10px',
              }}
              onInput={(e) => {
                const el = e.currentTarget;
                if (object.type === COT.Text) {
                  // Temporarily disable constraints to measure natural size
                  const originalWidth = el.style.width;
                  const originalHeight = el.style.height;
                  el.style.width = 'auto';
                  el.style.height = 'auto';
                  el.style.display = 'inline-block';

                  // scrollWidth/Height are ideal here as they reflect the content size
                  // in the local coordinate system (independent of SVG zoom)
                  const newWidth = Math.max(el.scrollWidth, 20);
                  const newHeight = Math.max(el.scrollHeight, 20);

                  // Restore styles
                  el.style.width = originalWidth;
                  el.style.height = originalHeight;
                  el.style.display = '';

                  updateObject(
                    object.id,
                    {
                      geometry: {
                        ...object.geometry,
                        width: newWidth,
                        height: newHeight,
                      },
                    },
                    false,
                  );
                } else if (object.type === COT.Arrow || object.type === COT.Line) {
                  // Update text in real-time for arrows/lines to resize the gap
                  updateObject(object.id, { text: el.innerText }, false);
                }
              }}
              onBlur={(e) => {
                const newText = e.currentTarget.innerText;
                const el = e.currentTarget;

                if (object.type === COT.Text) {
                  // Final measurement for text objects
                  const originalWidth = el.style.width;
                  const originalHeight = el.style.height;
                  el.style.width = 'auto';
                  el.style.height = 'auto';
                  el.style.display = 'inline-block';

                  const finalWidth = Math.max(el.scrollWidth, 20);
                  const finalHeight = Math.max(el.scrollHeight, 20);

                  el.style.width = originalWidth;
                  el.style.height = originalHeight;
                  el.style.display = '';

                  if (
                    newText !== object.text ||
                    object.geometry.width !== finalWidth ||
                    object.geometry.height !== finalHeight
                  ) {
                    useWhiteboard.getState().saveHistory();
                    updateObject(object.id, {
                      text: newText,
                      geometry: {
                        ...object.geometry,
                        width: finalWidth,
                        height: finalHeight,
                      },
                    });
                  }
                } else {
                  // For shapes (rect, arrow, etc), just update text without changing geometry
                  if (newText !== object.text) {
                    useWhiteboard.getState().saveHistory();
                    updateObject(object.id, { text: newText });
                  }
                }
                setEditingObject(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.blur();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
              }}
            >
              {!isEditing && object.text}
            </div>
          </div>
        </foreignObject>
      )}

      {isSelected && !isEditing && (
        <>
          {/* Selection ring */}
          {(object.type === COT.Arrow || object.type === COT.Line) && object.geometry.points ? (
            <path
              d={`M ${object.geometry.points.map((p) => `${p.x},${p.y}`).join(' L ')}`}
              fill="none"
              stroke="#3b82f6"
              strokeWidth="4"
              strokeOpacity="0.2"
              pointerEvents="none"
            />
          ) : (
            <rect
              x={x - 2}
              y={y - 2}
              width={width + 4}
              height={height + 4}
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2"
              pointerEvents="none"
            />
          )}

          {/* Resize handles */}
          {(object.type === COT.Rectangle ||
            object.type === COT.Diamond ||
            object.type === COT.Ellipse ||
            object.type === COT.Group ||
            object.type === COT.Text) && (
            <>
              {/* Edge handles */}
              {['n', 's', 'e', 'w'].map((id) => (
                <ResizeHandle
                  key={id}
                  object={object}
                  handle={id}
                  zoom={ui.zoom}
                  updateObject={updateObject}
                />
              ))}
              {/* Corner handles */}
              {[
                { id: 'nw', cx: x - 2, cy: y - 2 },
                { id: 'ne', cx: x + width + 2, cy: y - 2 },
                { id: 'sw', cx: x - 2, cy: y + height + 2 },
                { id: 'se', cx: x + width + 2, cy: y + height + 2 },
              ].map((h) => (
                <ResizeHandle
                  key={h.id}
                  object={object}
                  handle={h.id}
                  cx={h.cx}
                  cy={h.cy}
                  zoom={ui.zoom}
                  updateObject={updateObject}
                />
              ))}
            </>
          )}

          {/* Arrow points handles */}
          {(object.type === COT.Arrow || object.type === COT.Line) && object.geometry.points && (
            <>
              {object.geometry.points.map((p, i) => (
                <PointHandle
                  key={i}
                  object={object}
                  pointIndex={i}
                  cx={p.x}
                  cy={p.y}
                  zoom={ui.zoom}
                  updateObject={updateObject}
                  allObjects={useWhiteboard.getState().objects}
                />
              ))}
            </>
          )}
        </>
      )}

      {/* Anchor points for arrows */}
      {([COT.Rectangle, COT.Diamond, COT.Ellipse] as COT[]).includes(object.type) &&
        (isSelected ||
          ui.activeTool === Tool.Arrow ||
          ui.activeTool === Tool.Line ||
          isAnyArrowOrLineSelected) &&
        !isConnectedToSelectedArrow && (
          <>
            {[
              { id: 'n' as const, cx: x + width / 2, cy: y },
              { id: 's' as const, cx: x + width / 2, cy: y + height },
              { id: 'e' as const, cx: x + width, cy: y + height / 2 },
              { id: 'w' as const, cx: x, cy: y + height / 2 },
            ].map((a) => (
              <circle
                key={a.id}
                cx={a.cx}
                cy={a.cy}
                r={ui.activeTool === Tool.Arrow || ui.activeTool === Tool.Line ? 6 : 4}
                fill="#18181b"
                stroke={
                  ui.activeTool === Tool.Arrow || ui.activeTool === Tool.Line
                    ? '#60a5fa'
                    : '#3b82f6'
                }
                strokeWidth={2}
                data-anchor="true"
                data-object-id={object.id}
                data-anchor-id={a.id}
                style={{ cursor: 'pointer', pointerEvents: 'auto' }}
              />
            ))}
          </>
        )}
    </motion.g>
  );
};
