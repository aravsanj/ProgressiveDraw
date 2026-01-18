import React from 'react';
import type { CanvasObject } from '../../types';

export const BoxShape: React.FC<{ object: CanvasObject }> = ({ object }) => {
  const { geometry, style } = object;
  const { x, y, width = 0, height = 0 } = geometry;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={style.fill || 'transparent'}
        stroke={style.stroke || '#e4e4e7'}
        strokeWidth={2}
        rx={4}
      />
      {object.text && (
        <foreignObject
          x={x + 4}
          y={y + 4}
          width={Math.max(0, width - 8)}
          height={Math.max(0, height - 8)}
          style={{ pointerEvents: 'none' }}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              color: style.stroke || '#e4e4e7',
              fontSize: style.fontSize || 14,
              fontFamily: 'sans-serif',
              wordBreak: 'break-word',
              overflow: 'hidden',
            }}
          >
            {object.text}
          </div>
        </foreignObject>
      )}
    </g>
  );
};
