import type { StateCreator } from 'zustand';
import type { WhiteboardStore } from './useWhiteboard';

export interface FrameSlice {
  currentFrame: number;
  setFrame: (frame: number) => void;
  nextFrame: () => void;
  prevFrame: () => void;
}

export const createFrameSlice: StateCreator<WhiteboardStore, [], [], FrameSlice> = (set, get) => ({
  currentFrame: 0,
  setFrame: (frame) => {
    const state = get();
    let targetFrame = Math.max(0, frame);

    if (state.ui?.mode === 'present') {
      const objects = Object.values(state.objects || {});
      if (objects.length > 0) {
        const frames = objects.flatMap((o) => [
          o.appearFrame,
          o.disappearFrame !== undefined && o.disappearFrame !== Infinity ? o.disappearFrame : -1,
        ]);
        const maxFrame = Math.max(...frames, 0);
        targetFrame = Math.min(targetFrame, maxFrame);
      } else {
        targetFrame = 0;
      }
    }

    set({ currentFrame: targetFrame });
  },
  nextFrame: () => {
    const state = get();
    if (state.ui.mode === 'present') {
      const objects = Object.values(state.objects || {});
      const frames = objects.flatMap((o) => [
        o.appearFrame,
        o.disappearFrame !== undefined && o.disappearFrame !== Infinity ? o.disappearFrame : -1,
      ]);
      const maxFrame = Math.max(...frames, 0);
      set((state) => ({
        currentFrame: Math.min(state.currentFrame + 1, maxFrame),
      }));
    } else {
      set((state) => ({ currentFrame: state.currentFrame + 1 }));
    }
  },
  prevFrame: () => set((state) => ({ currentFrame: Math.max(0, state.currentFrame - 1) })),
});
