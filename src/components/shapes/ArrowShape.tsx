import React from 'react';
import type { CanvasObject } from '../../types';

export const ArrowShape: React.FC<{ object: CanvasObject }> = ({ object }) => {
  const { geometry, style, text } = object;
  // If points are provided, use them. Else fallback (should not happen in real app)

  const points = geometry.points;
  if (!points || points.length < 2) return null;

  const p1 = points[0];
  const p2 = points[points.length - 1];

  // Calculate direction vector
  const d = `M ${p1.x},${p1.y} L ${p2.x},${p2.y}`;

  // Calculate center for text
  const cx = (p1.x + p2.x) / 2;
  const cy = (p1.y + p2.y) / 2;

  return (
    <g>
      <defs>
        <marker
          id={`arrowhead-${object.id}`}
          markerWidth="12"
          markerHeight="8"
          refX="10"
          refY="4"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path
            d="M 0,0 L 10,4 L 0,8 Z"
            fill={style.stroke || '#e4e4e7'}
          />
        </marker>
      </defs>
      {/* Invisible thicker path for hit testing */}
      <path
        d={d}
        stroke="transparent"
        strokeWidth={20}
        fill="none"
        pointerEvents="visibleStroke"
      />
      <path
        d={d}
        stroke={style.stroke || '#e4e4e7'}
        strokeWidth={2}
        fill="none"
        markerEnd={`url(#arrowhead-${object.id})`}
        strokeLinecap="round"
      />
      {text && (
        <foreignObject
          x={cx - 60}
          y={cy - 15}
          width={120}
          height={30}
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
              fontSize: style.fontSize || 12,
              fontFamily: 'Outfit',
              background: '#09090b', // Match zinc-950 exactly
              padding: '2px 8px',
              borderRadius: '2px', // Very subtle rounding
            }}
          >
            {text}
          </div>
        </foreignObject>
      )}
    </g>
  );
};
