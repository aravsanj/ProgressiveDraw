import React from 'react';
import { useWhiteboard } from '../../store/useWhiteboard';

interface CanvasSelectionProps {
  selectionRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
}

export const CanvasSelection: React.FC<CanvasSelectionProps> = ({ selectionRect }) => {
  const { ui } = useWhiteboard();

  if (!selectionRect) return null;

  return (
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
  );
};
