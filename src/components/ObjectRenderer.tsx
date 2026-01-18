import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { CanvasObject } from '../types';
import { useWhiteboard } from '../store/useWhiteboard';
import { RectangleShape } from './shapes/RectangleShape';
import { ArrowShape } from './shapes/ArrowShape';
import { TextShape } from './shapes/TextShape';
import { useGesture } from '@use-gesture/react';
import { cn } from '../lib/utils';

interface Props {
  object: CanvasObject;
}

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
      onDrag: ({ delta: [dx, dy], event }) => {
        event.stopPropagation();
        const scale = zoom;
        const { x, y, width = 0, height = 0 } = object.geometry;
        let newX = x;
        let newY = y;
        let newWidth = width;
        let newHeight = height;

        if (handle.includes('e')) newWidth += dx / scale;
        if (handle.includes('s')) newHeight += dy / scale;
        if (handle.includes('w')) {
          const deltaX = dx / scale;
          newX += deltaX;
          newWidth -= deltaX;
        }
        if (handle.includes('n')) {
          const deltaY = dy / scale;
          newY += deltaY;
          newHeight -= deltaY;
        }

        updateObject(object.id, {
          geometry: {
            ...object.geometry,
            x: newX,
            y: newY,
            width: Math.max(10, newWidth),
            height: Math.max(10, newHeight),
          },
        });
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
          if (otherObj.type === 'rectangle' && otherObj.id !== object.id) {
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
  const { currentFrame, ui, selectObject, updateObject, setEditingObject, moveObjects } =
    useWhiteboard();
  const editRef = useRef<HTMLDivElement>(null);

  const isEditing = ui.editingObjectId === object.id;

  useEffect(() => {
    if (isEditing && editRef.current) {
      // Small timeout to ensure DOM is ready in all browsers/SVG environments
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
    }
  }, [isEditing]);

  const isVisible =
    currentFrame >= object.appearFrame && currentFrame < (object.disappearFrame ?? Infinity);

  const isSelected = ui.selectedObjectIds.includes(object.id);

  const bind = useGesture(
    {
      onPointerDown: ({ event, ctrlKey }) => {
        const e = event as unknown as PointerEvent;
        const target = e.target as HTMLElement;
        if (target.getAttribute('data-anchor') === 'true') return;

        if (ctrlKey || e.button !== 0 || isEditing) return;

        if (ui.activeTool !== 'arrow') {
          event.stopPropagation();
        }
        selectObject(object.id, e.shiftKey);
      },
      onDrag: ({ delta: [dx, dy], event, buttons, ctrlKey }) => {
        const target = event.target as HTMLElement;
        if (target.getAttribute('data-anchor') === 'true') return;

        if (buttons !== 1 || ctrlKey || isEditing) return;
        event.stopPropagation();

        const scale = ui.zoom;
        const isSelected = ui.selectedObjectIds.includes(object.id);
        const idsToMove = isSelected ? ui.selectedObjectIds : [object.id];

        moveObjects(idsToMove, dx / scale, dy / scale);
      },
      onDoubleClick: (state) => {
        // Prevent event from bubbling up to create new objects if applicable
        state.event.stopPropagation();
        if (object.type === 'rectangle' || object.type === 'text' || object.type === 'arrow') {
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

  if (!isVisible && ui.mode === 'present') return null;

  const opacity = isVisible ? 1 : 0.2;

  const renderShape = () => {
    // Hide the primary shape text while editing to avoid overlap
    const visibleObject = isEditing ? { ...object, text: '' } : object;

    return (
      <g style={{ pointerEvents: isEditing ? 'none' : 'auto' }}>
        {(() => {
          switch (object.type) {
            case 'rectangle':
              return <RectangleShape object={visibleObject} />;
            case 'arrow':
              return <ArrowShape object={visibleObject} />;
            case 'text':
              return <TextShape object={visibleObject} isEditing={isEditing} />;
            case 'annotation':
              return <TextShape object={visibleObject} isEditing={isEditing} />;
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

  if (object.type === 'arrow' && object.geometry.points) {
    const points = object.geometry.points;
    const p1 = points[0];
    const p2 = points[points.length - 1];
    editX = (p1.x + p2.x) / 2 - 50;
    editY = (p1.y + p2.y) / 2 - 20;
    editWidth = 100;
    editHeight = 40;
  } else if (object.type === 'text') {
    editWidth = 200;
    editHeight = 40;
    editX = x;
    editY = y;
  }

  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      {...(isEditing ? {} : (bind() as Record<string, unknown>))}
      style={{ cursor: isEditing ? 'text' : 'move' }}
    >
      {renderShape()}

      {isEditing && (
        <foreignObject
          x={object.type === 'rectangle' ? x : editX - 50}
          y={object.type === 'rectangle' ? y : editY - 10}
          width={object.type === 'rectangle' ? width : editWidth + 100}
          height={object.type === 'rectangle' ? height : editHeight + 80}
          style={{ pointerEvents: 'auto', cursor: 'text' }}
        >
          <div
            className={cn(
              'w-full h-full flex justify-center p-2',
              object.type === 'rectangle' ? 'items-center' : 'items-start',
              'transition-all duration-200',
            )}
          >
            <div
              ref={editRef}
              contentEditable
              suppressContentEditableWarning
              tabIndex={0}
              className={cn(
                'w-full border-none outline-none overflow-hidden text-center cursor-text',
                object.type === 'rectangle'
                  ? 'text-white p-1'
                  : 'text-white p-3 bg-zinc-900/90 rounded-lg shadow-2xl backdrop-blur-sm ring-2 ring-blue-500/50 shadow-blue-500/20',
              )}
              style={{
                fontSize:
                  object.style.fontSize ||
                  (object.type === 'arrow' ? 12 : object.type === 'rectangle' ? 14 : 24),
                fontFamily: 'Outfit, Inter, sans-serif',
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap',
                minWidth: '120px',
              }}
              onBlur={(e) => {
                updateObject(object.id, { text: e.currentTarget.innerText });
                setEditingObject(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
              }}
            >
              {object.text}
            </div>
          </div>
        </foreignObject>
      )}

      {isSelected && !isEditing && (
        <>
          {/* Selection ring */}
          {object.type === 'arrow' && object.geometry.points ? (
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
          {object.type === 'rectangle' && (
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
          {object.type === 'arrow' && object.geometry.points && (
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
      {object.type === 'rectangle' && (isSelected || ui.activeTool === 'arrow') && (
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
              r={ui.activeTool === 'arrow' ? 7 : 5}
              fill={ui.activeTool === 'arrow' ? '#60a5fa' : '#3b82f6'}
              stroke="white"
              strokeWidth={1.5}
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
