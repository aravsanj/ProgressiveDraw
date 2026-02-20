import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { createFrameSlice } from './frameSlice';
import type { FrameSlice } from './frameSlice';
import { createUiSlice } from './uiSlice';
import type { UiSlice } from './uiSlice';
import { createHistorySlice } from './historySlice';
import type { HistorySlice } from './historySlice';
import { createClipboardSlice } from './clipboardSlice';
import type { ClipboardSlice } from './clipboardSlice';
import { createObjectSlice } from './objectSlice';
import type { ObjectSlice } from './objectSlice';

// Combine all slice interfaces
export type WhiteboardStore = FrameSlice & UiSlice & HistorySlice & ClipboardSlice & ObjectSlice;

export const useWhiteboard = create<WhiteboardStore>()(
  persist(
    (...a) => ({
      ...createFrameSlice(...a),
      ...createUiSlice(...a),
      ...createHistorySlice(...a),
      ...createClipboardSlice(...a),
      ...createObjectSlice(...a),
    }),
    {
      name: 'progressivedraw',
      partialize: (state) => ({
        objects: state.objects,
        currentFrame: state.currentFrame,
        ui: {
          ...state.ui,
          // Don't persist selection or transient states
          selectedObjectIds: [],
          editingObjectId: null,
        },
      }),
    },
  ),
);
