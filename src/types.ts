export const CanvasObjectType = {
  Rectangle: 'rectangle',
  Diamond: 'diamond',
  Ellipse: 'ellipse',
  Arrow: 'arrow',
  Line: 'line',
  Text: 'text',
  Group: 'group',
} as const;

export type CanvasObjectType = typeof CanvasObjectType[keyof typeof CanvasObjectType];

export const COT = CanvasObjectType;
export type COT = CanvasObjectType;


export type Connection = {
  objectId: string;
  anchorId: 'n' | 's' | 'e' | 'w';
};

export type CanvasObject = {
  id: string;
  type: CanvasObjectType;
  parentId?: string;
  children?: string[];
  geometry: {
    x: number;
    y: number;
    width?: number;
    height?: number;
    points?: { x: number; y: number }[];
  };
  style: {
    stroke?: string;
    fill?: string;
    fontSize?: number;
  };
  text?: string; 
  appearFrame: number;
  disappearFrame?: number; 
  startConnection?: Connection;
  endConnection?: Connection;
};

export const Tool = {
  Select: 'select',
  Rectangle: 'rectangle',
  Diamond: 'diamond',
  Ellipse: 'ellipse',
  Arrow: 'arrow',
  Line: 'line',
  Text: 'text',
} as const;

export type Tool = typeof Tool[keyof typeof Tool];

export type WhiteboardUiState = {
  mode: 'edit' | 'present';
  activeTool: Tool;
  spotlightEnabled: boolean;
  zoom: number;
  pan: { x: number; y: number };
  isPanning: boolean;
  selectedObjectIds: string[];
  editingObjectId?: string | null;
};

export type WhiteboardState = {
  objects: Record<string, CanvasObject>;
  currentFrame: number;
  ui: WhiteboardUiState;
};
