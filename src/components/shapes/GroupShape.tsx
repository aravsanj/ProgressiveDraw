import React from 'react';
import type { CanvasObject } from '../../types';

interface Props {
  object: CanvasObject;
}

export const GroupShape: React.FC<Props> = ({ object }) => {
  const { x, y, width = 0, height = 0 } = object.geometry;

  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      fill="transparent"
      stroke="#8b5cf6"
      strokeWidth={1}
      strokeDasharray="4 4"
      strokeOpacity={0.5}
      pointerEvents="all"
    />
  );
};
