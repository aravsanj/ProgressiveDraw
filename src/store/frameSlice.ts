import type { StateCreator } from 'zustand';

export interface FrameSlice {
  currentFrame: number;
  setFrame: (frame: number) => void;
  nextFrame: () => void;
  prevFrame: () => void;
}

export const createFrameSlice: StateCreator<FrameSlice> = (set) => ({
  currentFrame: 0,
  setFrame: (frame) => set({ currentFrame: Math.max(0, frame) }),
  nextFrame: () => set((state) => ({ currentFrame: state.currentFrame + 1 })),
  prevFrame: () => set((state) => ({ currentFrame: Math.max(0, state.currentFrame - 1) })),
});
