import React from 'react';
import type { CanvasObject } from '../../types';

export const EllipseShape: React.FC<{ object: CanvasObject }> = ({ object }) => {
  const { geometry, style } = object;
  const { x, y, width = 0, height = 0 } = geometry;

  const cx = x + width / 2;
  const cy = y + height / 2;
  const rx = width / 2;
  const ry = height / 2;

  return (
    <g>
      <ellipse
        cx={cx}
        cy={cy}
        rx={rx}
        ry={ry}
        fill={style.fill || 'transparent'}
        stroke={style.stroke || '#e4e4e7'}
        strokeWidth={2}
      />
      {object.text && (
        <foreignObject
          x={x + width * 0.15}
          y={y + height * 0.15}
          width={Math.max(0, width * 0.7)}
          height={Math.max(0, height * 0.7)}
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
              fontFamily: 'Outfit, Inter, Outfit',
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
