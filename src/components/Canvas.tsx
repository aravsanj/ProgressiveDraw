import React, { useRef, useEffect, useState } from 'react';
import { useGesture } from '@use-gesture/react';
import { useWhiteboard } from '../store/useWhiteboard';
import { ObjectRenderer } from './ObjectRenderer';
import { AnimatePresence } from 'framer-motion';

export const Canvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [ctrlPressed, setCtrlPressed] = useState(false);
  const { ui, setPan, setZoom, objects, addObject, updateObject, selectObject, clearSelection, currentStep } =
    useWhiteboard();
  const [drawingId, setDrawingId] = useState<string | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);

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
    if (el) {
      const preventAutoscroll = (e: MouseEvent) => {
        if (e.button === 1) e.preventDefault();
      };
      const preventWheelZoom = (e: WheelEvent) => {
        if (e.ctrlKey) e.preventDefault();
      };

      el.addEventListener('mousedown', preventAutoscroll, { passive: false });
      el.addEventListener('wheel', preventWheelZoom, { passive: false });

      return () => {
        el.removeEventListener('mousedown', preventAutoscroll);
        el.removeEventListener('wheel', preventWheelZoom);
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
      };
    }

    return () => {
      document.removeEventListener('gesturestart', preventGestures);
      document.removeEventListener('gesturechange', preventGestures);
      document.removeEventListener('gestureend', preventGestures);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

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
        } else if (drawingId && startPosRef.current) {
          let { x, y } = getCanvasCoords(cx, cy);
          const obj = objects[drawingId];
          if (!obj) return;

          const start = startPosRef.current;

          if (obj.type === 'box') {
            updateObject(drawingId, {
              geometry: {
                ...obj.geometry,
                width: Math.abs(x - start.x),
                height: Math.abs(y - start.y),
                x: Math.min(x, start.x),
                y: Math.min(y, start.y),
              },
            });
          } else if (obj.type === 'arrow') {
            // Snapping logic for arrows
            const SNAP_THRESHOLD = 25 / ui.zoom;
            let snappedEnd = { x, y };
            let endConnection = undefined;

            for (const otherObj of Object.values(objects)) {
              if (otherObj.type === 'box' && otherObj.id !== drawingId) {
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

            updateObject(drawingId, {
              geometry: {
                ...obj.geometry,
                points: [start, snappedEnd],
              },
              endConnection
            });
          }
        }

        if (!active) {
          setIsPanning(false);
          setDrawingId(null);
          startPosRef.current = null;
          // Switch back to select tool after drawing a box or arrow
          if (ui.activeTool === 'box' || ui.activeTool === 'arrow') {
            useWhiteboard.getState().setTool('select');
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
        const target = e.target as HTMLElement;
        const isAnchor = target.getAttribute('data-anchor') === 'true';
        const isResizeHandle = target.getAttribute('data-resize-handle') === 'true';

        if (e.button === 1 || (e.button === 0 && e.ctrlKey)) {
          e.preventDefault();
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          setIsPanning(true);
        } else if (ui.activeTool === 'select' && e.button === 0 && !isAnchor) {
          // Clear selection when clicking the background
          if (target.getAttribute('data-bg') === 'true' || target === containerRef.current) {
            clearSelection();
          }
        } else if ((ui.activeTool !== 'select' || (isAnchor && !isResizeHandle)) && e.button === 0) {
          let { x, y } = getCanvasCoords(e.clientX, e.clientY);
          let type = ui.activeTool as any;
          let startConnection = undefined;

          if (isAnchor && !isResizeHandle) {
            type = 'arrow';
            useWhiteboard.getState().setTool('arrow');
            const objId = target.getAttribute('data-object-id')!;
            const anchorId = target.getAttribute('data-anchor-id')! as any;
            const anchorObj = objects[objId];
            if (anchorObj) {
              const { x: ox, y: oy, width = 0, height = 0 } = anchorObj.geometry;
              if (anchorId === 'n') { x = ox + width / 2; y = oy; }
              else if (anchorId === 's') { x = ox + width / 2; y = oy + height; }
              else if (anchorId === 'e') { x = ox + width; y = oy + height / 2; }
              else if (anchorId === 'w') { x = ox; y = oy + height / 2; }
              startConnection = { objectId: objId, anchorId };
            }
          } else if (type === 'arrow') {
            const SNAP_THRESHOLD = 25 / ui.zoom;
            for (const otherObj of Object.values(objects)) {
              if (otherObj.type === 'box') {
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

          const id = addObject({
            type,
            geometry: {
              x,
              y,
              width: type === 'box' ? 1 : undefined,
              height: type === 'box' ? 1 : undefined,
              points: type === 'arrow' ? [{ x, y }, { x, y }] : undefined,
            },
            style: {
              stroke: '#e4e4e7',
              fill: type === 'box' ? 'rgba(255,255,255,0.05)' : undefined,
              fontSize: (type === 'text' || type === 'annotation' || type === 'arrow') ? (type === 'arrow' ? 12 : 24) : undefined,
            },
            appearStep: currentStep,
            text: (type === 'text' || type === 'box' || type === 'arrow') ? '' : undefined,
            startConnection
          });

          setDrawingId(id);
          selectObject(id);
          startPosRef.current = { x, y };

          // Reset tool to select after adding text
          if (type === 'text') {
            useWhiteboard.getState().setTool('select');
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
      },
    },
    {
      target: containerRef,
      drag: {
        filterTaps: true,
        threshold: 0,
        buttons: [1, 4],
      },
      eventOptions: { passive: false },
    },
  );

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
          </g>
        </g>
      </svg>
    </div>
  );
};
