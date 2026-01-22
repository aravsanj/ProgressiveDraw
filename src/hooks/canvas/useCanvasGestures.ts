import { useGesture } from '@use-gesture/react';
import { useWhiteboard } from '../../store/useWhiteboard';
import { COT, Tool, type Connection } from '../../types';

interface UseCanvasGesturesProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  drawingId: string | null;
  setDrawingId: (id: string | null) => void;
  selectionRect: { x: number; y: number; width: number; height: number } | null;
  setSelectionRect: (rect: { x: number; y: number; width: number; height: number } | null) => void;
  startPosRef: React.MutableRefObject<{ x: number; y: number } | null>;
  pendingDrawRef: React.MutableRefObject<{
    type: COT;
    x: number;
    y: number;
    startConnection?: Connection;
  } | null>;
  mousePosRef: React.MutableRefObject<{ x: number; y: number } | null>;
  isPlacingDuplicatedRef: React.MutableRefObject<boolean>;
}

export const useCanvasGestures = ({
  containerRef,
  drawingId,
  setDrawingId,
  selectionRect,
  setSelectionRect,
  startPosRef,
  pendingDrawRef,
  mousePosRef,
  isPlacingDuplicatedRef,
}: UseCanvasGesturesProps) => {
  const {
    ui,
    setPan,
    addObject,
    updateObject,
    selectObject,
    selectObjects,
    setIsPanning,
    objects,
    clearSelection,
    setEditingObject,
    currentFrame,
  } = useWhiteboard();

  const getCanvasCoords = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - ui.pan.x) / ui.zoom,
      y: (clientY - rect.top - ui.pan.y) / ui.zoom,
    };
  };

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

  useGesture(
    {
      onDrag: ({ active, delta: [dx, dy], buttons, ctrlKey, xy: [cx, cy] }) => {
        const isStillDragging = active;
        const isDraggingEnd = !active;
        const isPanningAction = buttons === 4 || (buttons === 1 && ctrlKey);
        const isCreatingNewObject = !drawingId && pendingDrawRef.current && isStillDragging;
        const isUpdatingObject = !!(drawingId && startPosRef.current);
        const isDrawingSelectionRect =
          ui.activeTool === Tool.Select && startPosRef.current && isStillDragging;

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
                width: ([COT.Rectangle, COT.Diamond, COT.Ellipse] as COT[]).includes(type)
                  ? 1
                  : undefined,
                height: ([COT.Rectangle, COT.Diamond, COT.Ellipse] as COT[]).includes(type)
                  ? 1
                  : undefined,
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
                if (([COT.Rectangle, COT.Diamond, COT.Ellipse] as COT[]).includes(obj.type)) {
                  const { x, y, width = 0, height = 0 } = obj.geometry;
                  return (
                    x < selectionRect.x + selectionRect.width &&
                    x + width > selectionRect.x &&
                    y < selectionRect.y + selectionRect.height &&
                    y + height > selectionRect.y
                  );
                }
                if ((obj.type === COT.Arrow || obj.type === COT.Line) && obj.geometry.points) {
                  return obj.geometry.points.some(
                    (p) =>
                      p.x >= selectionRect.x &&
                      p.x <= selectionRect.x + selectionRect.width &&
                      p.y >= selectionRect.y &&
                      p.y <= selectionRect.y + selectionRect.height,
                  );
                }
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
          setDrawingId(null);
          startPosRef.current = null;
          e.stopPropagation();
        } else if (ui.activeTool === Tool.Select && e.button === 0 && !isAnchor) {
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
            if (ui.activeTool === Tool.Arrow || ui.activeTool === Tool.Line) {
              return;
            }
          }

          let { x, y } = getCanvasCoords(e.clientX, e.clientY);
          let type: COT = ui.activeTool as unknown as COT;
          let startConnection = undefined;

          if (isAnchor && !isResizeHandle) {
            if (ui.activeTool !== Tool.Line) {
              type = COT.Arrow;
              useWhiteboard.getState().setTool(Tool.Arrow);
            } else {
              type = COT.Line;
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
            // Snapping to anchors
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
          // Ignore
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
        filterTaps: false,
        threshold: 5,
        buttons: [1, 4],
      },
      eventOptions: { passive: false },
    },
  );
};
