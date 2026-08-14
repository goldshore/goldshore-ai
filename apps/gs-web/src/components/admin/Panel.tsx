import React, { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface PanelProps {
  id: string;
  title: string;
  icon?: string;
  children: ReactNode;
  onClose?: () => void;
  className?: string;
  isDragging?: boolean;
}

export const Panel: React.FC<PanelProps> = ({
  id,
  title,
  icon,
  children,
  onClose,
  className = '',
  isDragging = false
}) => {
  return (
    <motion.div
      className={`gs-panel ${isDragging ? 'dragging' : ''} ${className}`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      <div className="gs-panel-header">
        <div className="gs-panel-title">
          {icon && <span className="gs-panel-icon">{icon}</span>}
          <h3>{title}</h3>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="gs-panel-close"
            aria-label="Close panel"
          >
            ×
          </button>
        )}
      </div>
      <div className="gs-panel-content">
        {children}
      </div>
    </motion.div>
  );
};
