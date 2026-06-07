import React from 'react';
import type { CanvasObject } from '../../types';

const buildSmoothPath = (points: { x: number; y: number }[]): string => {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x},${points[0].y}`;
  if (points.length === 2)
    return `M ${points[0].x},${points[0].y} L ${points[1].x},${points[1].y}`;

  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const midX = (points[i].x + points[i + 1].x) / 2;
    const midY = (points[i].y + points[i + 1].y) / 2;
    d += ` Q ${points[i].x},${points[i].y} ${midX},${midY}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x},${last.y}`;
  return d;
};

export const PenShape: React.FC<{ object: CanvasObject }> = ({ object }) => {
  const { geometry, style } = object;
  const points = geometry.points;
  if (!points || points.length === 0) return null;

  const d = buildSmoothPath(points);

  return (
    <g>
      <path d={d} stroke="transparent" strokeWidth={20} fill="none" pointerEvents="visibleStroke" />
      <path
        d={d}
        stroke={style.stroke || '#e4e4e7'}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
};
