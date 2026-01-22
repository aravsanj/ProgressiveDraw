import React from 'react';

export const CanvasGrid: React.FC = () => {
  return (
    <>
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path
            d="M 40 0 L 0 0 0 40"
            fill="none"
            stroke="#27272a"
            strokeWidth="0.5"
            strokeOpacity="1"
          />
        </pattern>
      </defs>
      <rect data-bg="true" x="-50000" y="-50000" width="100000" height="100000" fill="url(#grid)" />
    </>
  );
};
