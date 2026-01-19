import React, { useRef, useEffect, useState } from 'react';
import { useGesture } from '@use-gesture/react';
import type { CanvasObjectType, Connection } from '../types';
import { useWhiteboard } from '../store/useWhiteboard';
import { ObjectRenderer } from './ObjectRenderer';
import { AnimatePresence } from 'framer-motion';

export const Canvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [ctrlPressed, setCtrlPressed] = useState(false);
  const {
    ui,
    setPan,
    setZoom,
    objects,
    addObject,
    updateObject,
    selectObject,
    selectObjects,
    deleteObjects,
    clearSelection,
    currentFrame,
    setEditingObject,
  } = useWhiteboard();
  const [drawingId, setDrawingId] = useState<string | null>(null);
  const [selectionRect, setSelectionRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const pendingDrawRef = useRef<{
    type: CanvasObjectType;
    x: number;
    y: number;
    startConnection?: Connection;
  } | null>(null);

  const getCanvasCoords = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - ui.pan.x) / ui.zoom,
      y: (clientY - rect.top - ui.pan.y) / ui.zoom,
    };
  };

  useEffect(() => {
    const preventGestures = (e: Event) => e.preventDefault();
    document.addEventListener('gesturestart', preventGestures);
    document.addEventListener('gesturechange', preventGestures);
    document.addEventListener('gestureend', preventGestures);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control') setCtrlPressed(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control') setCtrlPressed(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const el = containerRef.current;

    const preventAutoscroll = (e: MouseEvent) => {
      if (e.button === 1) e.preventDefault();
    };
    const preventWheelZoom = (e: WheelEvent) => {
      if (e.ctrlKey) e.preventDefault();
    };
    const handleKeyDownGlobal = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const state = useWhiteboard.getState();
        if (state.ui.editingObjectId) {
          // If editing, blur to trigger onBlur save logic
          (document.activeElement as HTMLElement)?.blur();
          return;
        }

        if (drawingId) {
          deleteObjects([drawingId]);
        }
        setDrawingId(null);
        startPosRef.current = null;
        pendingDrawRef.current = null;
        clearSelection();
      }

      if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName) &&
        !(e.target as HTMLElement).isContentEditable
      ) {
        const { selectedObjectIds } = useWhiteboard.getState().ui;
        if (selectedObjectIds.length > 0) {
          deleteObjects(selectedObjectIds);
        }
      }

      // Undo/Redo shortcuts
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          // Redo (Cmd+Shift+Z)
          e.preventDefault();
          useWhiteboard.getState().redo();
        } else {
          // Undo (Cmd+Z)
          e.preventDefault();
          useWhiteboard.getState().undo();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        // Redo (Ctrl+Y)
        e.preventDefault();
        useWhiteboard.getState().redo();
      }

      // Grouping shortcuts
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        const state = useWhiteboard.getState();
        const { selectedObjectIds } = state.ui;

        if (e.shiftKey) {
          // Ungroup all selected groups
          const groupsToUngroup = selectedObjectIds.filter(
            (id) => state.objects[id]?.type === 'group',
          );
          groupsToUngroup.forEach((id) => state.ungroupObjects(id));
        } else {
          // Group selected items
          if (selectedObjectIds.length > 1) {
            state.groupObjects(selectedObjectIds);
          }
        }
      }
    };

    if (el) {
      el.addEventListener('mousedown', preventAutoscroll, { passive: false });
      el.addEventListener('wheel', preventWheelZoom, { passive: false });
    }
    window.addEventListener('keydown', handleKeyDownGlobal);

    return () => {
      document.removeEventListener('gesturestart', preventGestures);
      document.removeEventListener('gesturechange', preventGestures);
      document.removeEventListener('gestureend', preventGestures);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('keydown', handleKeyDownGlobal);
      if (el) {
        el.removeEventListener('mousedown', preventAutoscroll);
        el.removeEventListener('wheel', preventWheelZoom);
      }
    };
  }, [deleteObjects, drawingId, clearSelection, setEditingObject]);

  useGesture(
    {
      onDrag: ({ active, delta: [dx, dy], buttons, ctrlKey, xy: [cx, cy] }) => {
        const isPanningButton = buttons === 4 || (buttons === 1 && ctrlKey);
        if (isPanningButton) {
          setPan((p) => ({
            x: p.x + dx,
            y: p.y + dy,
          }));
          setIsPanning(active);
        } else if (!drawingId && pendingDrawRef.current && active) {
          const { type, x, y, startConnection } = pendingDrawRef.current;
          const id = addObject({
            type,
            geometry: {
              x,
              y,
              width: ['rectangle', 'diamond', 'ellipse'].includes(type) ? 1 : undefined,
              height: ['rectangle', 'diamond', 'ellipse'].includes(type) ? 1 : undefined,
              points:
                type === 'arrow' || type === 'line'
                  ? [
                      { x, y },
                      { x, y },
                    ]
                  : undefined,
            },
            style: {
              stroke: '#e4e4e7',
              // Default fill for closed shapes
              fill: ['rectangle', 'diamond', 'ellipse'].includes(type)
                ? 'rgba(255,255,255,0.05)'
                : undefined,
              fontSize: type === 'arrow' || type === 'line' ? 12 : undefined,
            },
            appearFrame: currentFrame,
            text: '',
            startConnection,
          });
          setDrawingId(id);
          selectObject(id);
          pendingDrawRef.current = null;
        } else if (drawingId && startPosRef.current) {
          const { x, y } = getCanvasCoords(cx, cy);
          const obj = objects[drawingId];
          if (!obj) return;

          const start = startPosRef.current;

          if (['rectangle', 'diamond', 'ellipse'].includes(obj.type)) {
            updateObject(drawingId, {
              geometry: {
                ...obj.geometry,
                width: Math.abs(x - start.x),
                height: Math.abs(y - start.y),
                x: Math.min(x, start.x),
                y: Math.min(y, start.y),
              },
            });
          } else if (obj.type === 'arrow' || obj.type === 'line') {
            updateArrowPreview(drawingId, x, y, start);
          }
        } else if (ui.activeTool === 'select' && startPosRef.current && active) {
          const { x, y } = getCanvasCoords(cx, cy);
          const start = startPosRef.current;
          setSelectionRect({
            x: Math.min(x, start.x),
            y: Math.min(y, start.y),
            width: Math.abs(x - start.x),
            height: Math.abs(y - start.y),
          });
        }

        if (!active) {
          if (ui.activeTool === 'select' && selectionRect) {
            const selectedIds = Object.values(objects)
              .filter((obj) => {
                // If it's a rectangle, check if it's within the selection rect
                // If it's a closed shape, check intersection
                if (['rectangle', 'diamond', 'ellipse'].includes(obj.type)) {
                  const { x, y, width = 0, height = 0 } = obj.geometry;
                  return (
                    x < selectionRect.x + selectionRect.width &&
                    x + width > selectionRect.x &&
                    y < selectionRect.y + selectionRect.height &&
                    y + height > selectionRect.y
                  );
                }
                // If it's an arrow or line, check points
                if ((obj.type === 'arrow' || obj.type === 'line') && obj.geometry.points) {
                  return obj.geometry.points.some(
                    (p) =>
                      p.x >= selectionRect.x &&
                      p.x <= selectionRect.x + selectionRect.width &&
                      p.y >= selectionRect.y &&
                      p.y <= selectionRect.y + selectionRect.height,
                  );
                }
                // Text
                if (obj.type === 'text') {
                  const { x, y } = obj.geometry;
                  return (
                    x >= selectionRect.x &&
                    x <= selectionRect.x + selectionRect.width &&
                    y >= selectionRect.y &&
                    y <= selectionRect.y + selectionRect.height
                  );
                }
                return false;
              })
              .map((obj) => obj.id);

            // Resolve to parents if applicable
            const resolvedIds = new Set<string>();
            selectedIds.forEach((id) => {
              const obj = objects[id];
              if (obj.parentId && objects[obj.parentId]) {
                resolvedIds.add(obj.parentId);
              } else {
                resolvedIds.add(id);
              }
            });

            selectObjects(Array.from(resolvedIds));
          }

          setIsPanning(false);
          setSelectionRect(null);
          // Only clear drawingId for non-connector objects
          // Arrows/lines stay active until the second click
          const obj = drawingId ? objects[drawingId] : null;
          if (!obj || (obj.type !== 'arrow' && obj.type !== 'line')) {
            setDrawingId(null);
            startPosRef.current = null;
          }
          pendingDrawRef.current = null;
        }
      },
      onMove: ({ xy: [cx, cy] }) => {
        if (drawingId && startPosRef.current) {
          const obj = objects[drawingId];
          if (obj && (obj.type === 'arrow' || obj.type === 'line')) {
            const { x, y } = getCanvasCoords(cx, cy);
            updateArrowPreview(drawingId, x, y, startPosRef.current);
          }
        }
      },
      onWheel: ({ event, delta: [, dy], ctrlKey }) => {
        if (ctrlKey || event.shiftKey) {
          event.preventDefault();
          const zoomSensitivity = 0.001;
          const zoomFactor = -dy * zoomSensitivity;
          const newZoom = Math.min(Math.max(0.1, ui.zoom + zoomFactor), 5);
          setZoom(newZoom);
        } else {
          // Normal scroll pans vertically
          setPan((p) => ({
            x: p.x,
            y: p.y - dy,
          }));
        }
      },
      onPointerDown: ({ event }) => {
        const e = event as PointerEvent;
        const { editingObjectId } = useWhiteboard.getState().ui;

        if (editingObjectId) {
          return;
        }

        const target = e.target as HTMLElement;
        const isAnchor = target.getAttribute('data-anchor') === 'true';
        const isResizeHandle = target.getAttribute('data-resize-handle') === 'true';

        if (e.button === 1 || (e.button === 0 && e.ctrlKey)) {
          e.preventDefault();
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          setIsPanning(true);
        } else if (
          drawingId &&
          objects[drawingId] &&
          (objects[drawingId].type === 'arrow' || objects[drawingId].type === 'line') &&
          e.button === 0
        ) {
          // Finalize arrow/line on second click
          setDrawingId(null);
          startPosRef.current = null;
          e.stopPropagation();
        } else if (ui.activeTool === 'select' && e.button === 0 && !isAnchor) {
          // Clear selection when clicking the background
          if (target.getAttribute('data-bg') === 'true' || target === containerRef.current) {
            clearSelection();
            const { x, y } = getCanvasCoords(e.clientX, e.clientY);
            startPosRef.current = { x, y };
          }
        } else if (
          e.button === 0 &&
          ((ui.activeTool !== 'select' &&
            (target.getAttribute('data-bg') === 'true' || target === containerRef.current)) ||
            (isAnchor && !isResizeHandle))
        ) {
          let { x, y } = getCanvasCoords(e.clientX, e.clientY);
          let type: CanvasObjectType = ui.activeTool as CanvasObjectType;
          let startConnection = undefined;

          if (isAnchor && !isResizeHandle) {
            // If we are already in line mode, stay in line mode. Otherwise default to arrow.
            if (ui.activeTool !== 'line') {
              type = 'arrow';
              useWhiteboard.getState().setTool('arrow');
            } else {
              type = 'line'; // Keep existing tool
            }
            const objId = target.getAttribute('data-object-id')!;
            const anchorId = target.getAttribute('data-anchor-id')! as Connection['anchorId'];
            const anchorObj = objects[objId];
            if (anchorObj) {
              const { x: ox, y: oy, width = 0, height = 0 } = anchorObj.geometry;
              if (anchorId === 'n') {
                x = ox + width / 2;
                y = oy;
              } else if (anchorId === 's') {
                x = ox + width / 2;
                y = oy + height;
              } else if (anchorId === 'e') {
                x = ox + width;
                y = oy + height / 2;
              } else if (anchorId === 'w') {
                x = ox;
                y = oy + height / 2;
              }
              startConnection = { objectId: objId, anchorId };
            }
          } else if (type === 'arrow' || type === 'line') {
            const SNAP_THRESHOLD = 25 / ui.zoom;
            for (const otherObj of Object.values(objects)) {
              if (
                otherObj.type === 'rectangle' ||
                otherObj.type === 'diamond' ||
                otherObj.type === 'ellipse'
              ) {
                const { x: ox, y: oy, width = 0, height = 0 } = otherObj.geometry;
                const anchors: { id: 'n' | 's' | 'e' | 'w'; x: number; y: number }[] = [
                  { id: 'n', x: ox + width / 2, y: oy },
                  { id: 's', x: ox + width / 2, y: oy + height },
                  { id: 'e', x: ox + width, y: oy + height / 2 },
                  { id: 'w', x: ox, y: oy + height / 2 },
                ];
                for (const anchor of anchors) {
                  const dist = Math.hypot(anchor.x - x, anchor.y - y);
                  if (dist < SNAP_THRESHOLD) {
                    x = anchor.x;
                    y = anchor.y;
                    startConnection = { objectId: otherObj.id, anchorId: anchor.id };
                    break;
                  }
                }
              }
              if (startConnection) break;
            }
          }

          if (type === 'arrow' || type === 'line') {
            const id = addObject({
              type,
              geometry: {
                x,
                y,
                points: [
                  { x, y },
                  { x, y },
                ],
              },
              style: {
                stroke: '#e4e4e7',
                fontSize: 12,
              },
              appearFrame: currentFrame,
              text: '',
              startConnection,
            });
            setDrawingId(id);
            selectObject(id);
            startPosRef.current = { x, y };
          } else if (type === 'rectangle' || type === 'diamond' || type === 'ellipse') {
            pendingDrawRef.current = { type, x, y, startConnection };
            startPosRef.current = { x, y };
          } else {
            const id = addObject({
              type,
              geometry: {
                x,
                y,
                width: undefined,
                height: undefined,
                points: undefined,
              },
              style: {
                stroke: '#e4e4e7',
                fill: undefined,
                fontSize: 24,
              },
              appearFrame: currentFrame,
              text: type === 'text' ? '' : undefined,
              startConnection,
            });

            setDrawingId(id);
            selectObject(id);
            if (type === 'text') {
              setEditingObject(id);
            }
            startPosRef.current = { x, y };
          }
        }
      },
      onPointerUp: ({ event }) => {
        const e = event as PointerEvent;
        try {
          (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {
          // Ignore releasePointerCapture errors
        }
        setIsPanning(false);
        const obj = drawingId ? objects[drawingId] : null;
        if (!obj || (obj.type !== 'arrow' && obj.type !== 'line')) {
          setDrawingId(null);
          startPosRef.current = null;
        }
        pendingDrawRef.current = null;
      },
    },
    {
      target: containerRef,
      drag: {
        filterTaps: false, // Need to catch clicks properly
        threshold: 5,
        buttons: [1, 4],
      },
      eventOptions: { passive: false },
    },
  );

  const updateArrowPreview = (
    id: string,
    x: number,
    y: number,
    start: { x: number; y: number },
  ) => {
    const SNAP_THRESHOLD = 25 / ui.zoom;
    let snappedEnd = { x, y };
    let endConnection = undefined;

    for (const otherObj of Object.values(objects)) {
      if (
        (otherObj.type === 'rectangle' ||
          otherObj.type === 'diamond' ||
          otherObj.type === 'ellipse') &&
        otherObj.id !== id
      ) {
        const { x: ox, y: oy, width = 0, height = 0 } = otherObj.geometry;
        const anchors: { id: 'n' | 's' | 'e' | 'w'; x: number; y: number }[] = [
          { id: 'n', x: ox + width / 2, y: oy },
          { id: 's', x: ox + width / 2, y: oy + height },
          { id: 'e', x: ox + width, y: oy + height / 2 },
          { id: 'w', x: ox, y: oy + height / 2 },
        ];

        for (const anchor of anchors) {
          const dist = Math.hypot(anchor.x - x, anchor.y - y);
          if (dist < SNAP_THRESHOLD) {
            snappedEnd = { x: anchor.x, y: anchor.y };
            endConnection = { objectId: otherObj.id, anchorId: anchor.id };
            break;
          }
        }
      }
      if (endConnection) break;
    }

    updateObject(id, {
      geometry: {
        ...objects[id].geometry,
        points: [start, snappedEnd],
      },
      endConnection,
    });
  };

  return (
    <div
      ref={containerRef}
      className={`w-full h-screen overflow-hidden bg-zinc-950 touch-none select-none relative ${
        isPanning
          ? 'cursor-grabbing'
          : ctrlPressed
            ? 'cursor-grab'
            : ui.activeTool !== 'select'
              ? 'cursor-crosshair'
              : 'cursor-default'
      }`}
    >
      <div className="absolute top-4 left-4 z-50 bg-zinc-900/80 text-zinc-400 p-2 rounded text-xs pointer-events-none">
        Zoom: {ui.zoom.toFixed(2)} | Pan: {ui.pan.x.toFixed(0)}, {ui.pan.y.toFixed(0)}
      </div>

      <svg className="w-full h-full block pointer-events-none">
        <g transform={`translate(${ui.pan.x},${ui.pan.y}) scale(${ui.zoom})`}>
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="#27272a"
                strokeWidth="0.5"
                strokeOpacity="1"
              />
            </pattern>
          </defs>
          <rect
            data-bg="true"
            x="-50000"
            y="-50000"
            width="100000"
            height="100000"
            fill="url(#grid)"
          />

          <g pointerEvents="auto">
            <AnimatePresence>
              {Object.values(objects).map((obj) => (
                <ObjectRenderer key={obj.id} object={obj} />
              ))}
            </AnimatePresence>

            {selectionRect && (
              <rect
                x={selectionRect.x}
                y={selectionRect.y}
                width={selectionRect.width}
                height={selectionRect.height}
                fill="rgba(59, 130, 246, 0.1)"
                stroke="rgba(59, 130, 246, 0.5)"
                strokeWidth={1 / ui.zoom}
                strokeDasharray={`${4 / ui.zoom},${4 / ui.zoom}`}
              />
            )}
          </g>
        </g>
      </svg>
    </div>
  );
};
