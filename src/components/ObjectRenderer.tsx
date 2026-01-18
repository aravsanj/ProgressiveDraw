import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { CanvasObject } from '../types';
import { useWhiteboard } from '../store/useWhiteboard';
import { BoxShape } from './shapes/BoxShape';
import { ArrowShape } from './shapes/ArrowShape';
import { TextShape } from './shapes/TextShape';
import { useGesture } from '@use-gesture/react';

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
        {...(bind() as any)}
      />
    );
  }

  // Edge handle
  const { x, y, width = 0, height = 0 } = object.geometry;
  let rx, ry, rw, rh;
  const padding = 2; // match selection ring offset
  const hitWidth = 6;

  if (handle === 'n') {
    rx = x; ry = y - padding - hitWidth / 2; rw = width; rh = hitWidth;
  } else if (handle === 's') {
    rx = x; ry = y + height + padding - hitWidth / 2; rw = width; rh = hitWidth;
  } else if (handle === 'w') {
    rx = x - padding - hitWidth / 2; ry = y; rw = hitWidth; rh = height;
  } else { // 'e'
    rx = x + width + padding - hitWidth / 2; ry = y; rw = hitWidth; rh = height;
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
      {...(bind() as any)}
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
          if (otherObj.type === 'box' && otherObj.id !== object.id) {
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
      {...(bind() as any)}
    />
  );
};

export const ObjectRenderer: React.FC<Props> = ({ object }) => {
  const { currentStep, ui, selectObject, updateObject } = useWhiteboard();
  const [isEditing, setIsEditing] = useState(false);
  const editRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditing && editRef.current) {
      editRef.current.focus();
      // Move cursor to end of text
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(editRef.current);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  }, [isEditing]);

  const isVisible =
    currentStep >= object.appearStep && currentStep < (object.disappearStep ?? Infinity);

  const isSelected = ui.selectedObjectIds.includes(object.id);

  const bind = useGesture(
    {
      onPointerDown: ({ event, ctrlKey }) => {
        const e = event as unknown as PointerEvent;
        const target = e.target as HTMLElement;
        if (target.getAttribute('data-anchor') === 'true') return;

        if (ctrlKey || e.button !== 0 || ui.activeTool !== 'select' || isEditing) return;

        event.stopPropagation();
        selectObject(object.id, e.shiftKey);
      },
      onDrag: ({
        delta: [dx, dy],
        event,
        buttons,
        ctrlKey,
      }) => {
        const target = event.target as HTMLElement;
        if (target.getAttribute('data-anchor') === 'true') return;
        
        if (buttons !== 1 || ctrlKey || isEditing) return;
        event.stopPropagation();

        const scale = ui.zoom;
        if (object.type === 'arrow' && object.geometry.points) {
          const newPoints = object.geometry.points.map(p => ({
            x: p.x + dx / scale,
            y: p.y + dy / scale
          }));
          updateObject(object.id, {
            geometry: {
              ...object.geometry,
              points: newPoints,
            },
            // Clear connections when moving the whole arrow? 
            // Usually yes, unless we want to move the connected boxes too, but that's complex.
            startConnection: undefined,
            endConnection: undefined,
          });
        } else {
          const newX = object.geometry.x + dx / scale;
          const newY = object.geometry.y + dy / scale;

          updateObject(object.id, {
            geometry: {
              ...object.geometry,
              x: newX,
              y: newY,
            },
          });
        }
      },
      onDoubleClick: (state) => {
        // Prevent event from bubbling up to create new objects if applicable
        state.event.stopPropagation();
        if (object.type === 'box' || object.type === 'text' || object.type === 'arrow') {
          setIsEditing(true);
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
            case 'box':
              return <BoxShape object={visibleObject} />;
            case 'arrow':
              return <ArrowShape object={visibleObject} />;
            case 'text':
              return (
                <>
                  <TextShape object={visibleObject} />
                  {!object.text && !isEditing && (
                    <text
                      x={object.geometry.x}
                      y={object.geometry.y}
                      fill="#52525b"
                      fontSize={12}
                      fontStyle="italic"
                      dy="2em"
                    >
                      Double click to edit
                    </text>
                  )}
                </>
              );
            case 'annotation':
              return <TextShape object={visibleObject} />;
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
      {...(bind() as any)}
      style={{ cursor: isEditing ? 'text' : 'move' }}
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
          <div className={`w-full h-full flex items-center justify-center ring-1 ring-blue-500/50 ${object.type === 'arrow' ? 'bg-zinc-900/90 rounded' : 'bg-zinc-800/80'}`}>
            <div
              ref={editRef}
              contentEditable
              suppressContentEditableWarning
              tabIndex={0}
              className="w-full text-white p-2 border-none outline-none overflow-hidden text-center cursor-text"
              style={{ 
                fontSize: object.style.fontSize || (object.type === 'arrow' ? 12 : 14),
                fontFamily: 'sans-serif',
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap',
              }}
              onBlur={(e) => {
                updateObject(object.id, { text: e.currentTarget.innerText });
                setIsEditing(false);
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
               d={`M ${object.geometry.points.map(p => `${p.x},${p.y}`).join(' L ')}`}
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
          {object.type === 'box' && (
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
      {object.type === 'box' && (isSelected || ui.activeTool === 'arrow') && (
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
