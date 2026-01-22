import React, { useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { COT, type Connection, Tool } from '../types';
import { useWhiteboard } from '../store/useWhiteboard';
import { ObjectRenderer } from './ObjectRenderer';
import { CanvasGrid } from './canvas/CanvasGrid';
import { CanvasSelection } from './canvas/CanvasSelection';
import { CanvasGroupHelpers } from './canvas/CanvasGroupHelpers';
import { useCanvasEvents, useCanvasGestures, useCanvasShortcuts } from '../hooks/canvas';

export const Canvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { ui, objects } = useWhiteboard();
  const { isPanning, ctrlPressed, selectedObjectIds } = ui;

  // Local State
  const [drawingId, setDrawingId] = useState<string | null>(null);
  const [selectionRect, setSelectionRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  // Refs
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const mousePosRef = useRef<{ x: number; y: number } | null>(null);
  const isPlacingDuplicatedRef = useRef(false);
  const pendingDrawRef = useRef<{
    type: COT;
    x: number;
    y: number;
    startConnection?: Connection;
  } | null>(null);

  // Hooks
  useCanvasEvents(containerRef);

  useCanvasShortcuts({
    drawingId,
    setDrawingId,
    startPosRef,
    pendingDrawRef,
    mousePosRef,
    isPlacingDuplicatedRef,
  });

  useCanvasGestures({
    containerRef,
    drawingId,
    setDrawingId,
    selectionRect,
    setSelectionRect,
    startPosRef,
    pendingDrawRef,
    mousePosRef,
    isPlacingDuplicatedRef,
  });

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
          <CanvasGrid />

          <g pointerEvents="auto">
            <AnimatePresence>
              {Object.values(objects)
                .sort((a, b) => {
                  const aSelected = selectedObjectIds.includes(a.id);
                  const bSelected = selectedObjectIds.includes(b.id);
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

            <CanvasSelection selectionRect={selectionRect} />
            <CanvasGroupHelpers />
          </g>
        </g>
      </svg>
    </div>
  );
};
