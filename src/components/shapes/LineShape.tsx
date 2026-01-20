import React from 'react';
import type { CanvasObject } from '../../types';

export const LineShape: React.FC<{ object: CanvasObject; isEditing?: boolean }> = ({
  object,
  isEditing,
}) => {
  const { geometry, style, text } = object;

  const points = geometry.points;
  if (!points || points.length < 2) return null;

  const p1 = points[0];
  const p2 = points[points.length - 1];

  // Calculate direction vector for path
  const d = `M ${p1.x},${p1.y} L ${p2.x},${p2.y}`;

  // Calculate center for text
  const cx = (p1.x + p2.x) / 2;
  const cy = (p1.y + p2.y) / 2;

  // Calculate line length for max width
  const length = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  // Cap at ~80 chars (approx 600px) for readability, but at least 100px
  const textMaxWidth = Math.max(Math.min(length, 600), 100);
  const foreignObjectWidth = textMaxWidth + 40; // Add buffer

  return (
    <g>
      {/* Invisible thicker path for hit testing */}
      <path d={d} stroke="transparent" strokeWidth={20} fill="none" pointerEvents="visibleStroke" />
      <path
        d={d}
        stroke={style.stroke || '#e4e4e7'}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
      />
      {text && (
        <foreignObject
          x={cx - foreignObjectWidth / 2}
          y={cy - 100}
          width={foreignObjectWidth}
          height={200}
          style={{ pointerEvents: 'none', overflow: 'visible' }}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                color: isEditing ? 'transparent' : style.stroke || '#e4e4e7',
                fontSize: style.fontSize || 12,
                fontFamily: 'Outfit',
                background: '#09090b', // Match zinc-950
                padding: '2px 4px', // Reduced padding
                borderRadius: '4px',
                textAlign: 'center',
                width: 'max-content',
                maxWidth: `${textMaxWidth}px`,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                pointerEvents: 'auto',
                lineHeight: '1.3', // Tighter line height
              }}
            >
              {text}
            </div>
          </div>
        </foreignObject>
      )}
    </g>
  );
};
