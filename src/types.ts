export type CanvasObjectType = 'rectangle' | 'diamond' | 'ellipse' | 'arrow' | 'line' | 'text' | 'group';

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

  text?: string; // Added specifically for text objects

  appearFrame: number;
  disappearFrame?: number; // defaults to Infinity
 

  startConnection?: Connection;
  endConnection?: Connection;
};

export type Tool = 'select' | 'rectangle' | 'diamond' | 'ellipse' | 'arrow' | 'line' | 'text';


export type WhiteboardUiState = {
  mode: 'edit' | 'present';
  activeTool: Tool;
  spotlightEnabled: boolean;
  zoom: number;
  pan: { x: number; y: number };
  selectedObjectIds: string[];
  editingObjectId?: string | null;
};

export type WhiteboardState = {
  objects: Record<string, CanvasObject>;
  currentFrame: number;
  ui: WhiteboardUiState;
};
