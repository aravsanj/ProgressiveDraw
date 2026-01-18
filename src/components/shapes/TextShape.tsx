import React from 'react';
import type { CanvasObject } from '../../types';

interface Props {
  object: CanvasObject;
  isEditing?: boolean;
}

export const TextShape: React.FC<Props> = ({ object, isEditing }) => {
  const { geometry, style, text } = object;
  const fontSize = style.fontSize || 16;
  const hasText = !!text;

  // Estimate text dimensions for a transparent hit area
  // This ensures the move cursor is consistent and the object is easy to select
  const estimatedWidth = hasText ? Math.max(100, text.length * fontSize * 0.6) : 150;
  // Increase height if we're showing the placeholder to cover both lines
  const estimatedHeight = hasText ? fontSize * 1.5 : fontSize * 2.5;

  return (
    <g>
      {/* Hit area for drag/selection with move cursor */}
      <rect
        x={geometry.x}
        y={geometry.y}
        width={estimatedWidth}
        height={estimatedHeight}
        fill="transparent"
        style={{ cursor: 'move', pointerEvents: 'all' }}
      />
      {hasText ? (
        <text
          x={geometry.x}
          y={geometry.y}
          fill={style.fill || '#e4e4e7'}
          fontSize={fontSize}
          fontFamily="sans-serif"
          dy="1em"
          style={{
            cursor: 'move',
            userSelect: 'none',
            pointerEvents: 'none',
            WebkitUserSelect: 'none',
          }}
        >
          {text}
        </text>
      ) : (
        !isEditing && (
          <text
            x={geometry.x}
            y={geometry.y}
            fill="#52525b"
            fontSize={12}
            fontFamily="sans-serif"
            fontStyle="italic"
            dy="2em"
            style={{
              cursor: 'move',
              userSelect: 'none',
              pointerEvents: 'none',
              WebkitUserSelect: 'none',
            }}
          >
            Double click to edit
          </text>
        )
      )}
    </g>
  );
};
