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

  // Use geometry dimensions if available, otherwise estimate
  const width = geometry.width || (hasText ? Math.max(100, text.length * fontSize * 0.6) : 150);
  const height = geometry.height || (hasText ? fontSize * 1.5 : fontSize * 2.5);

  return (
    <g>
      {/* Hit area for drag/selection with move cursor */}
      <rect
        x={geometry.x}
        y={geometry.y}
        width={width}
        height={height}
        fill="transparent"
        style={{ cursor: isEditing ? 'text' : 'move', pointerEvents: 'all' }}
      />
      {hasText ? (
        <foreignObject
          x={geometry.x}
          y={geometry.y}
          width={width}
          height={height}
          style={{ pointerEvents: 'none' }}
        >
          <div
            style={{
              color: style.fill || '#e4e4e7',
              fontSize: `${fontSize}px`,
              fontFamily: '"Outfit", sans-serif',
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              width: '100%',
            }}
          >
            {text}
          </div>
        </foreignObject>
      ) : (
        !isEditing && (
          <foreignObject
            x={geometry.x}
            y={geometry.y}
            width={width}
            height={height}
            style={{ pointerEvents: 'none' }}
          >
            <div
              style={{
                color: '#52525b',
                fontSize: '12px',
                fontFamily: '"Outfit", sans-serif',
                fontStyle: 'italic',
                lineHeight: 1.5,
                marginTop: '1.5em',
              }}
            >
              Double click to edit
            </div>
          </foreignObject>
        )
      )}
    </g>
  );
};
