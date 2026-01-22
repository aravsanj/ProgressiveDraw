import { useEffect } from 'react';
import { useWhiteboard } from '../../store/useWhiteboard';

export const useCanvasEvents = (containerRef: React.RefObject<HTMLDivElement | null>) => {
  const { setCtrlPressed } = useWhiteboard();

  useEffect(() => {
    const preventGestures = (e: Event) => e.preventDefault();
    document.addEventListener('gesturestart', preventGestures);
    document.addEventListener('gesturechange', preventGestures);
    document.addEventListener('gestureend', preventGestures);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control') setCtrlPressed(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control') setCtrlPressed(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const el = containerRef.current;

    const preventAutoscroll = (e: MouseEvent) => {
      if (e.button === 1) e.preventDefault();
    };
    const preventWheelZoom = (e: WheelEvent) => {
      if (e.ctrlKey) e.preventDefault();
    };

    if (el) {
      el.addEventListener('mousedown', preventAutoscroll, { passive: false });
      el.addEventListener('wheel', preventWheelZoom, { passive: false });
    }

    return () => {
      document.removeEventListener('gesturestart', preventGestures);
      document.removeEventListener('gesturechange', preventGestures);
      document.removeEventListener('gestureend', preventGestures);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (el) {
        el.removeEventListener('mousedown', preventAutoscroll);
        el.removeEventListener('wheel', preventWheelZoom);
      }
    };
  }, [containerRef, setCtrlPressed]);
};
