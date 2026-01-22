import React from 'react';
import { useWhiteboard } from '../../store/useWhiteboard';
import { COT } from '../../types';

export const CanvasGroupHelpers: React.FC = () => {
  const { ui, objects, selectObject } = useWhiteboard();

  if (ui.selectedObjectIds.length !== 1 || objects[ui.selectedObjectIds[0]]?.type !== COT.Group) {
    return null;
  }

  const group = objects[ui.selectedObjectIds[0]];
  if (!group.children) return null;

  return (
    <>
      {group.children.map((childId, index) => {
        const child = objects[childId];
        if (!child) return null;

        let x = 0;
        let y = 0;

        if (child.geometry.points) {
          // Arrow/Line: use start point
          x = child.geometry.points[0].x;
          y = child.geometry.points[0].y;
        } else {
          // Shapes: use center
          x = child.geometry.x + (child.geometry.width || 0) / 2;
          y = child.geometry.y + (child.geometry.height || 0) / 2;
        }

        const r = 12 / ui.zoom;

        return (
          <g key={childId} pointerEvents="auto">
            {/* Number Button: Click to select */}
            <g
              onClick={(e) => {
                e.stopPropagation();
                selectObject(childId);
              }}
              style={{ cursor: 'pointer' }}
            >
              <circle
                cx={x}
                cy={y}
                r={r}
                fill="#8b5cf6"
                stroke="white"
                strokeWidth={2 / ui.zoom}
                className="hover:fill-violet-600 transition-colors"
              />
              <text
                x={x}
                y={y}
                fill="white"
                fontSize={12 / ui.zoom}
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="central"
              >
                {index + 1}
              </text>
            </g>
          </g>
        );
      })}
    </>
  );
};
