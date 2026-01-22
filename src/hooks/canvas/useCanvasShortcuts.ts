import { useEffect } from 'react';
import { useWhiteboard } from '../../store/useWhiteboard';
import { Tool, COT, type Connection } from '../../types';

interface UseCanvasShortcutsProps {
  drawingId: string | null;
  setDrawingId: (id: string | null) => void;
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

export const useCanvasShortcuts = ({
  drawingId,
  setDrawingId,
  startPosRef,
  pendingDrawRef,
  mousePosRef,
  isPlacingDuplicatedRef,
}: UseCanvasShortcutsProps) => {
  const { deleteObjects, clearSelection, setTool } = useWhiteboard();

  // Helper function for snapping pasted/duplicated objects to cursor
  const snapToCursor = (ids: string[], mousePos: { x: number; y: number }) => {
    const state = useWhiteboard.getState();
    const newObjs = ids.map((id) => state.objects[id]).filter(Boolean);
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
      const dx = mousePos.x - centerX;
      const dy = mousePos.y - centerY;

      state.moveObjects(ids, dx, dy);
    }
  };

  useEffect(() => {
    const handleKeyDownGlobal = (e: KeyboardEvent) => {
      // Escape key
      if (e.key === 'Escape') {
        const state = useWhiteboard.getState();
        if (state.ui.editingObjectId) {
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

      // Delete/Backspace
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
            snapToCursor(newIds, mousePosRef.current);
          }
        } else if (key === 'd') {
          e.preventDefault();
          const newIds = useWhiteboard.getState().duplicate();
          isPlacingDuplicatedRef.current = true;
          if (mousePosRef.current && newIds.length > 0) {
            snapToCursor(newIds, mousePosRef.current);
          }
        }
      }

      // Undo/Redo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          useWhiteboard.getState().redo();
        } else {
          e.preventDefault();
          useWhiteboard.getState().undo();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        useWhiteboard.getState().redo();
      }

      // Grouping
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        const state = useWhiteboard.getState();
        const { selectedObjectIds } = state.ui;

        if (e.shiftKey) {
          const groupsToUngroup = selectedObjectIds.filter(
            (id) => state.objects[id]?.type === COT.Group,
          );
          groupsToUngroup.forEach((id) => state.ungroupObjects(id));
        } else {
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
        if (key === '1' || key === 'v') setTool(Tool.Select);
        else if (key === '2' || key === 'r') setTool(Tool.Rectangle);
        else if (key === '3' || key === 'd') setTool(Tool.Diamond);
        else if (key === '4' || key === 'o') setTool(Tool.Ellipse);
        else if (key === '5' || key === 'a') setTool(Tool.Arrow);
        else if (key === '6' || key === 'l') setTool(Tool.Line);
        else if (key === '8' || key === 't') setTool(Tool.Text);
      }

      // Select All
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        if (
          !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName) &&
          !(e.target as HTMLElement).isContentEditable
        ) {
          e.preventDefault();
          const state = useWhiteboard.getState();
          const allTopLevelIds = Object.values(state.objects)
            .filter((o) => !o.parentId)
            .map((o) => o.id);
          state.selectObjects(allTopLevelIds);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDownGlobal);
    return () => {
      window.removeEventListener('keydown', handleKeyDownGlobal);
    };
  }, [
    deleteObjects,
    drawingId,
    clearSelection,
    setTool,
    setDrawingId,
    startPosRef,
    pendingDrawRef,
    mousePosRef,
    isPlacingDuplicatedRef,
  ]);
};
