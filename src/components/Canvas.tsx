import React, { useRef, useEffect, useState } from 'react';
import { useGesture } from '@use-gesture/react';
import { COT, Tool, type Connection } from '../types';
import { useWhiteboard } from '../store/useWhiteboard';
import { ObjectRenderer } from './ObjectRenderer';
import { AnimatePresence } from 'framer-motion';

export const Canvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ctrlPressed, setCtrlPressed] = useState(false);
  const {
    ui,
    setPan,
    objects,
    addObject,
    updateObject,
    selectObject,
    selectObjects,
    deleteObjects,
    clearSelection,
    currentFrame,
    setEditingObject,
    setIsPanning,
  } = useWhiteboard();
  const { isPanning } = ui;
  const [drawingId, setDrawingId] = useState<string | null>(null);
  const [selectionRect, setSelectionRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const mousePosRef = useRef<{ x: number; y: number } | null>(null);
  const isPlacingDuplicatedRef = useRef(false);
  const pendingDrawRef = useRef<{
    type: COT;
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

      // Copy/Paste/Duplicate
      if (
        (e.ctrlKey || e.metaKey) &&
        !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName) &&
        !(e.target as HTMLElement).isContentEditable
      ) {
        const key = e.key.toLowerCase();
        if (key === 'c') {
          e.preventDefault();
          useWhiteboard.getState().copy();
        } else if (key === 'v') {
          e.preventDefault();
          const newIds = useWhiteboard.getState().paste();

          if (mousePosRef.current && newIds.length > 0) {
            const state = useWhiteboard.getState();
            const newObjs = newIds.map((id) => state.objects[id]).filter(Boolean);
            if (newObjs.length > 0) {
              let minX = Infinity,
                minY = Infinity,
                maxX = -Infinity,
                maxY = -Infinity;

              newObjs.forEach((obj) => {
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

              const centerX = (minX + maxX) / 2;
              const centerY = (minY + maxY) / 2;
              const dx = mousePosRef.current.x - centerX;
              const dy = mousePosRef.current.y - centerY;

              state.moveObjects(newIds, dx, dy);
            }
          }
        } else if (key === 'd') {
          e.preventDefault();
          const newIds = useWhiteboard.getState().duplicate();
          isPlacingDuplicatedRef.current = true;

          // Snap to cursor
          if (mousePosRef.current && newIds.length > 0) {
            const state = useWhiteboard.getState();
            const newObjs = newIds.map((id) => state.objects[id]).filter(Boolean);
            if (newObjs.length > 0) {
              let minX = Infinity,
                minY = Infinity,
                maxX = -Infinity,
                maxY = -Infinity;

              newObjs.forEach((obj) => {
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

              const centerX = (minX + maxX) / 2;
              const centerY = (minY + maxY) / 2;
              const dx = mousePosRef.current.x - centerX;
              const dy = mousePosRef.current.y - centerY;

              state.moveObjects(newIds, dx, dy);
            }
          }
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
            (id) => state.objects[id]?.type === COT.Group,
          );
          groupsToUngroup.forEach((id) => state.ungroupObjects(id));
        } else {
          // Group selected items
          if (selectedObjectIds.length > 1) {
            state.groupObjects(selectedObjectIds);
          }
        }
      }

      // Tool shortcuts
      if (
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName) &&
        !(e.target as HTMLElement).isContentEditable
      ) {
        const key = e.key.toLowerCase();
        const setTool = useWhiteboard.getState().setTool;

        if (key === '1' || key === 'v') setTool(Tool.Select);
        else if (key === '2' || key === 'r') setTool(Tool.Rectangle);
        else if (key === '3' || key === 'd') setTool(Tool.Diamond);
        else if (key === '4' || key === 'o') setTool(Tool.Ellipse);
        else if (key === '5' || key === 'a') setTool(Tool.Arrow);
        else if (key === '6' || key === 'l') setTool(Tool.Line);
        else if (key === '8' || key === 't') {
          setTool(Tool.Text);
          // Important: Don't prevent default here if t is pressed,
          // but we already checked !isContentEditable, so it should be fine.
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        if (
          !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName) &&
          !(e.target as HTMLElement).isContentEditable
        ) {
          e.preventDefault();
          const state = useWhiteboard.getState();
          // Select all top-level objects (not children of groups)
          const allTopLevelIds = Object.values(state.objects)
            .filter((o) => !o.parentId)
            .map((o) => o.id);
          state.selectObjects(allTopLevelIds);
        }
      }
    };

    if (el) {
      el.addEventListener('mousedown', preventAutoscroll, { passive: false });
      el.addEventListener('wheel', preventWheelZoom, { passive: false });
    }
    // Note: We use window for keydown to catch events globally
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

        const isStillDragging = active;
        const isDraggingEnd = !active;
        const isPanningAction = buttons === 4 || (buttons === 1 && ctrlKey);
        const isCreatingNewObject = !drawingId && pendingDrawRef.current && isStillDragging;
        const isUpdatingObject = !!(drawingId && startPosRef.current);
        const isDrawingSelectionRect = ui.activeTool === Tool.Select && startPosRef.current && isStillDragging;


        switch (true) {
          case isPanningAction:
            setPan((p) => ({
              x: p.x + dx,
              y: p.y + dy,
            }));
            setIsPanning(true);
            break;

          case isCreatingNewObject: {
            const { type, x, y, startConnection } = pendingDrawRef.current!;
            const id = addObject({
              type,
              geometry: {
                x,
                y,
                width: ([COT.Rectangle, COT.Diamond, COT.Ellipse] as COT[]).includes(type) ? 1 : undefined,
                height: ([COT.Rectangle, COT.Diamond, COT.Ellipse] as COT[]).includes(type) ? 1 : undefined,
                points:
                  type === COT.Arrow || type === COT.Line
                    ? [
                        { x, y },
                        { x, y },
                      ]
                    : undefined,
              },
              style: {
                stroke: '#e4e4e7',
                fill: ([COT.Rectangle, COT.Diamond, COT.Ellipse] as COT[]).includes(type)
                  ? 'rgba(255,255,255,0.05)'
                  : undefined,
                fontSize: type === COT.Arrow || type === COT.Line ? 12 : undefined,
              },
              appearFrame: currentFrame,
              text: '',
              startConnection,
            });
            setDrawingId(id);
            selectObject(id);
            pendingDrawRef.current = null;
            break;
          }

          case isUpdatingObject: {
            const { x, y } = getCanvasCoords(cx, cy);
            const obj = objects[drawingId!];
            if (!obj) break;

            const start = startPosRef.current!;
            if (([COT.Rectangle, COT.Diamond, COT.Ellipse] as COT[]).includes(obj.type)) {
              updateObject(drawingId!, {
                geometry: {
                  ...obj.geometry,
                  width: Math.abs(x - start.x),
                  height: Math.abs(y - start.y),
                  x: Math.min(x, start.x),
                  y: Math.min(y, start.y),
                },
              });
            } else if (obj.type === COT.Arrow || obj.type === COT.Line) {
              updateArrowPreview(drawingId!, x, y, start);
            }
            break;
          }

          case isDrawingSelectionRect: {
            const { x, y } = getCanvasCoords(cx, cy);
            const start = startPosRef.current!;
            setSelectionRect({
              x: Math.min(x, start.x),
              y: Math.min(y, start.y),
              width: Math.abs(x - start.x),
              height: Math.abs(y - start.y),
            });
            break;
          }
        }

        if (isDraggingEnd) {
          if (ui.activeTool === Tool.Select && selectionRect) {
            const selectedIds = Object.values(objects)
              .filter((obj) => {
                // If it's a rectangle, check if it's within the selection rect
                // If it's a closed shape, check intersection
                if (([COT.Rectangle, COT.Diamond, COT.Ellipse] as COT[]).includes(obj.type)) {
                  const { x, y, width = 0, height = 0 } = obj.geometry;
                  return (
                    x < selectionRect.x + selectionRect.width &&
                    x + width > selectionRect.x &&
                    y < selectionRect.y + selectionRect.height &&
                    y + height > selectionRect.y
                  );
                }
                // If it's an arrow or line, check points
                if ((obj.type === COT.Arrow || obj.type === COT.Line) && obj.geometry.points) {
                  return obj.geometry.points.some(
                    (p) =>
                      p.x >= selectionRect.x &&
                      p.x <= selectionRect.x + selectionRect.width &&
                      p.y >= selectionRect.y &&
                      p.y <= selectionRect.y + selectionRect.height,
                  );
                }
                // Text
                if (obj.type === COT.Text) {
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
          if (!obj || (obj.type !== COT.Arrow && obj.type !== COT.Line)) {
            setDrawingId(null);
            startPosRef.current = null;
          }
          pendingDrawRef.current = null;
        }
      },
      onMove: ({ xy: [cx, cy] }) => {
        const { x, y } = getCanvasCoords(cx, cy);

        if (isPlacingDuplicatedRef.current && mousePosRef.current) {
          const dx = x - mousePosRef.current.x;
          const dy = y - mousePosRef.current.y;
          const { selectedObjectIds } = useWhiteboard.getState().ui;
          useWhiteboard.getState().moveObjects(selectedObjectIds, dx, dy);
        }

        mousePosRef.current = { x, y };

        if (drawingId && startPosRef.current) {
          const obj = objects[drawingId];
          if (obj && (obj.type === COT.Arrow || obj.type === COT.Line)) {
            updateArrowPreview(drawingId, x, y, startPosRef.current);
          }
        }
      },
      onWheel: ({ event, delta: [dx, dy], ctrlKey }) => {
        if (ctrlKey) {
          event.preventDefault();

          // Use latest state to avoid stale closure issues during high-frequency events
          const state = useWhiteboard.getState();
          const { zoom: oldZoom, pan: oldPan } = state.ui;

          const zoomSensitivity = 0.0015;
          const factor = Math.exp(-dy * zoomSensitivity);
          const newZoom = Math.min(Math.max(0.1, oldZoom * factor), 15);

          if (newZoom !== oldZoom) {
            const rect = containerRef.current?.getBoundingClientRect();
            if (rect) {
              const mouseX = event.clientX - rect.left;
              const mouseY = event.clientY - rect.top;

              const zoomRatio = newZoom / oldZoom;

              // Update both zoom and pan in a single state change to maintain consistency
              useWhiteboard.setState((state) => ({
                ui: {
                  ...state.ui,
                  zoom: newZoom,
                  pan: {
                    x: mouseX - (mouseX - oldPan.x) * zoomRatio,
                    y: mouseY - (mouseY - oldPan.y) * zoomRatio,
                  },
                },
              }));
            }
          }
        } else {
          // Normal scroll/trackpad pan (handles both axes)
          setPan((p) => ({
            x: p.x - dx,
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

        if (isPlacingDuplicatedRef.current && e.button === 0) {
          e.stopPropagation();
          e.preventDefault();
          isPlacingDuplicatedRef.current = false;
          useWhiteboard.getState().saveHistory();
          return;
        }

        if (e.button === 1 || (e.button === 0 && e.ctrlKey)) {
          e.preventDefault();
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          setIsPanning(true);
        } else if (
          drawingId &&
          objects[drawingId] &&
          (objects[drawingId].type === COT.Arrow || objects[drawingId].type === COT.Line) &&
          e.button === 0
        ) {
          // Finalize arrow/line on second click
          setDrawingId(null);
          startPosRef.current = null;
          e.stopPropagation();
        } else if (ui.activeTool === Tool.Select && e.button === 0 && !isAnchor) {
          // Clear selection when clicking the background
          if (target.getAttribute('data-bg') === 'true' || target === containerRef.current) {
            clearSelection();
            const { x, y } = getCanvasCoords(e.clientX, e.clientY);
            startPosRef.current = { x, y };
          }
        } else if (
          e.button === 0 &&
          ((ui.activeTool !== Tool.Select &&
            (target.getAttribute('data-bg') === 'true' || target === containerRef.current)) ||
            (isAnchor && !isResizeHandle))
        ) {
          const isBg = target.getAttribute('data-bg') === 'true' || target === containerRef.current;
          if (useWhiteboard.getState().ui.selectedObjectIds.length > 0 && isBg) {
            clearSelection();
            // For arrow and line, we want to deselect first, then click again to draw
            if (ui.activeTool === Tool.Arrow || ui.activeTool === Tool.Line) {
              return;
            }
          }

          let { x, y } = getCanvasCoords(e.clientX, e.clientY);
          let type: COT = ui.activeTool as unknown as COT;
          let startConnection = undefined;

          if (isAnchor && !isResizeHandle) {
            // If we are already in line mode, stay in line mode. Otherwise default to arrow.
            if (ui.activeTool !== Tool.Line) {
              type = COT.Arrow;
              useWhiteboard.getState().setTool(Tool.Arrow);
            } else {
              type = COT.Line; // Keep existing tool
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
          } else if (type === COT.Arrow || type === COT.Line) {
            const SNAP_THRESHOLD = 25 / ui.zoom;
            for (const otherObj of Object.values(objects)) {
              if (
                otherObj.type === COT.Rectangle ||
                otherObj.type === COT.Diamond ||
                otherObj.type === COT.Ellipse
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

          if (type === COT.Arrow || type === COT.Line) {
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
          } else if (type === COT.Rectangle || type === COT.Diamond || type === COT.Ellipse) {
            pendingDrawRef.current = { type, x, y, startConnection };
            startPosRef.current = { x, y };
          } else {
            const id = addObject({
              type,
              geometry: {
                x,
                y,
                width: type === COT.Text ? 200 : undefined,
                height: type === COT.Text ? 40 : undefined,
                points: undefined,
              },
              style: {
                stroke: '#e4e4e7',
                fill: undefined,
                fontSize: 24,
              },
              appearFrame: currentFrame,
              text: type === COT.Text ? '' : undefined,
              startConnection,
            });

            setDrawingId(id);
            selectObject(id);
            if (type === COT.Text) {
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
        if (!obj || (obj.type !== COT.Arrow && obj.type !== COT.Line)) {
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
        (otherObj.type === COT.Rectangle ||
          otherObj.type === COT.Diamond ||
          otherObj.type === COT.Ellipse) &&
        otherObj.id !== id &&
        otherObj.id !== objects[id]?.startConnection?.objectId
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
            : ui.activeTool !== Tool.Select
              ? 'cursor-crosshair'
              : 'cursor-default'
      }`}
    >
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
              {Object.values(objects)
                .sort((a, b) => {
                  const aSelected = ui.selectedObjectIds.includes(a.id);
                  const bSelected = ui.selectedObjectIds.includes(b.id);
                  if (aSelected !== bSelected) return aSelected ? 1 : -1;

                  // If both selected or both not, prioritize children over parents
                  if (a.parentId === b.id) return 1;
                  if (b.parentId === a.id) return -1;

                  return 0;
                })
                .map((obj) => (
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

            {ui.selectedObjectIds.length === 1 &&
              objects[ui.selectedObjectIds[0]]?.type === COT.Group && (
                <>
                  {objects[ui.selectedObjectIds[0]].children?.map((childId, index) => {
                    const child = objects[childId];
                    if (!child) return null;

                    let x = 0;
                    let y = 0;

                    if (child.geometry.points) {
                      // Arrow/Line: use start point
                      x = child.geometry.points[0].x;
                      y = child.geometry.points[0].y;
                    } else {
                      // Shapes: use center
                      x = child.geometry.x + (child.geometry.width || 0) / 2;
                      y = child.geometry.y + (child.geometry.height || 0) / 2;
                    }

                    const r = 12 / ui.zoom;

                    return (
                      <g key={childId} pointerEvents="auto">
                        {/* Number Button: Click to select */}
                        <g
                          onClick={(e) => {
                            e.stopPropagation();
                            selectObject(childId);
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          <circle
                            cx={x}
                            cy={y}
                            r={r}
                            fill="#8b5cf6"
                            stroke="white"
                            strokeWidth={2 / ui.zoom}
                            className="hover:fill-violet-600 transition-colors"
                          />
                          <text
                            x={x}
                            y={y}
                            fill="white"
                            fontSize={12 / ui.zoom}
                            fontWeight="bold"
                            textAnchor="middle"
                            dominantBaseline="central"
                          >
                            {index + 1}
                          </text>
                        </g>
                      </g>
                    );
                  })}
                </>
              )}
          </g>
        </g>
      </svg>
    </div>
  );
};
