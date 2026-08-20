import React, { useState, useEffect, ReactNode, useCallback } from 'react';
import { Rnd } from 'react-rnd';
import { motion, AnimatePresence } from 'framer-motion';
import { Panel } from './Panel';

export interface PanelConfig {
  id: string;
  title: string;
  icon?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  zIndex: number;
  isCollapsed?: boolean;
  content: ReactNode;
}

interface PanelLayoutProps {
  panels: PanelConfig[];
  onPanelsChange?: (panels: PanelConfig[]) => void;
  storageKey?: string;
}

export const PanelLayout: React.FC<PanelLayoutProps> = ({
  panels: initialPanels,
  onPanelsChange,
  storageKey = 'admin-panel-layout'
}) => {
  const [panels, setPanels] = useState<PanelConfig[]>(initialPanels);
  const [maxZIndex, setMaxZIndex] = useState(100);

  // Load saved layout on mount
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setPanels(parsed);
      } catch (e) {
        console.error('Failed to parse saved panel layout:', e);
      }
    }
  }, [storageKey]);

  // Save layout changes
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(panels));
    onPanelsChange?.(panels);
  }, [panels, storageKey, onPanelsChange]);

  const handleDragStop = useCallback((id: string, d: { x: number; y: number }) => {
    setPanels(panels.map(p =>
      p.id === id ? { ...p, x: d.x, y: d.y } : p
    ));
  }, [panels]);

  const handleResizeStop = useCallback((
    id: string,
    direction: string,
    ref: HTMLDivElement,
    delta: { height: number; width: number },
    position: { x: number; y: number }
  ) => {
    setPanels(panels.map(p =>
      p.id === id
        ? {
            ...p,
            width: ref.offsetWidth,
            height: ref.offsetHeight,
            x: position.x,
            y: position.y
          }
        : p
    ));
  }, [panels]);

  const handlePanelClose = useCallback((id: string) => {
    setPanels(panels.filter(p => p.id !== id));
  }, [panels]);

  const handlePanelFocus = useCallback((id: string) => {
    setPanels(panels.map(p =>
      p.id === id
        ? { ...p, zIndex: maxZIndex + 1 }
        : p
    ));
    setMaxZIndex(maxZIndex + 1);
  }, [panels, maxZIndex]);

  const handleToggleCollapse = useCallback((id: string) => {
    setPanels(panels.map(p =>
      p.id === id ? { ...p, isCollapsed: !p.isCollapsed } : p
    ));
  }, [panels]);

  return (
    <div className="gs-panel-layout">
      <AnimatePresence>
        {panels.map((panel) => (
          <Rnd
            key={panel.id}
            default={{
              x: panel.x,
              y: panel.y,
              width: panel.width,
              height: panel.height
            }}
            minWidth={panel.minWidth}
            minHeight={panel.minHeight}
            onDragStop={(e, d) => handleDragStop(panel.id, d)}
            onResizeStop={(e, direction, ref, delta, position) =>
              handleResizeStop(panel.id, direction, ref, delta, position)
            }
            style={{
              zIndex: panel.zIndex,
              position: 'absolute'
            }}
            onMouseDown={() => handlePanelFocus(panel.id)}
          >
            <motion.div
              className={`gs-rnd-wrapper ${panel.isCollapsed ? 'collapsed' : ''}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="gs-panel-drag-handle" onDoubleClick={() => handleToggleCollapse(panel.id)}>
                <div className="gs-drag-indicator" />
              </div>
              <Panel
                id={panel.id}
                title={panel.title}
                icon={panel.icon}
                onClose={() => handlePanelClose(panel.id)}
              >
                {!panel.isCollapsed && panel.content}
              </Panel>
            </motion.div>
          </Rnd>
        ))}
      </AnimatePresence>
    </div>
  );
};
