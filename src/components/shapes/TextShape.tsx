import React from 'react';
import type { CanvasObject } from '../../types';

export const TextShape: React.FC<{ object: CanvasObject }> = ({ object }) => {
  const { geometry, style, text } = object;

  return (
    // If we want to hide it while editing, we could pass a prop, 
    // but for now we'll just check if text is empty and show a placeholder
    <text
      x={geometry.x}
      y={geometry.y}
      fill={style.fill || '#e4e4e7'}
      fontSize={style.fontSize || 16}
      fontFamily="sans-serif"
      dy="1em"
    >
      {text}
    </text>
  );
};
