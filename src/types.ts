export type CanvasObjectType = 'box' | 'arrow' | 'text' | 'annotation';

export type Connection = {
  objectId: string;
  anchorId: 'n' | 's' | 'e' | 'w';
};

export type CanvasObject = {
  id: string;
  type: CanvasObjectType;

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

  text?: string; // Added specifically for text/annotation objects

  appearStep: number;
  disappearStep?: number; // defaults to Infinity

  role?: 'core' | 'context' | 'annotation';

  startConnection?: Connection;
  endConnection?: Connection;
};

export type Tool = 'select' | 'box' | 'arrow' | 'text';

export type WhiteboardUiState = {
  mode: 'edit' | 'present';
  activeTool: Tool;
  spotlightEnabled: boolean;
  zoom: number;
  pan: { x: number; y: number };
  selectedObjectIds: string[];
};

export type WhiteboardState = {
  objects: Record<string, CanvasObject>;
  currentStep: number;
  ui: WhiteboardUiState;
};
