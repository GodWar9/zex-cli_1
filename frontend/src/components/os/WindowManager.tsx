import { useState, useCallback } from 'react';

export interface WindowConfig {
  id: string;
  title: string;
  icon: string;
  defaultWidth: number;
  defaultHeight: number;
  minWidth?: number;
  minHeight?: number;
}

export interface WindowState {
  id: string;
  title: string;
  icon: string;
  x: number;
  y: number;
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
}

let nextZ = 10;

export function useWindowManager() {
  const [windows, setWindows] = useState<Record<string, WindowState>>({});

  const openWindow = useCallback((config: WindowConfig) => {
    setWindows(prev => {
      if (prev[config.id]?.isOpen) {
        // Already open — just focus it
        const maxZ = Math.max(...Object.values(prev).map(w => w.zIndex), nextZ);
        nextZ = maxZ + 1;
        return {
          ...prev,
          [config.id]: {
            ...prev[config.id],
            isMinimized: false,
            zIndex: nextZ,
          },
        };
      }

      nextZ += 1;
      const centerX = Math.max(40, (window.innerWidth - config.defaultWidth) / 2 + Math.random() * 40 - 20);
      const centerY = Math.max(40, (window.innerHeight - config.defaultHeight) / 2 + Math.random() * 40 - 20 - 40);

      return {
        ...prev,
        [config.id]: {
          id: config.id,
          title: config.title,
          icon: config.icon,
          x: centerX,
          y: centerY,
          width: config.defaultWidth,
          height: config.defaultHeight,
          minWidth: config.minWidth || 400,
          minHeight: config.minHeight || 300,
          isOpen: true,
          isMinimized: false,
          isMaximized: false,
          zIndex: nextZ,
        },
      };
    });
  }, []);

  const closeWindow = useCallback((id: string) => {
    setWindows(prev => ({
      ...prev,
      [id]: { ...prev[id], isOpen: false },
    }));
  }, []);

  const minimizeWindow = useCallback((id: string) => {
    setWindows(prev => ({
      ...prev,
      [id]: { ...prev[id], isMinimized: true },
    }));
  }, []);

  const maximizeWindow = useCallback((id: string) => {
    setWindows(prev => {
      const w = prev[id];
      if (!w) return prev;
      return {
        ...prev,
        [id]: { ...w, isMaximized: !w.isMaximized },
      };
    });
  }, []);

  const focusWindow = useCallback((id: string) => {
    setWindows(prev => {
      const maxZ = Math.max(...Object.values(prev).map(w => w.zIndex), nextZ);
      nextZ = maxZ + 1;
      return {
        ...prev,
        [id]: { ...prev[id], zIndex: nextZ },
      };
    });
  }, []);

  const updateWindowPosition = useCallback((id: string, x: number, y: number) => {
    setWindows(prev => ({
      ...prev,
      [id]: { ...prev[id], x, y },
    }));
  }, []);

  const updateWindowSize = useCallback((id: string, width: number, height: number) => {
    setWindows(prev => ({
      ...prev,
      [id]: { ...prev[id], width, height },
    }));
  }, []);

  const openWindows = Object.values(windows).filter(w => w.isOpen);
  const isWindowOpen = (id: string) => windows[id]?.isOpen && !windows[id]?.isMinimized;

  return {
    windows: openWindows,
    openWindow,
    closeWindow,
    minimizeWindow,
    maximizeWindow,
    focusWindow,
    updateWindowPosition,
    updateWindowSize,
    isWindowOpen,
  };
}
