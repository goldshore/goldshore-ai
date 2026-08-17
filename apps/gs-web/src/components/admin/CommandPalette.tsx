import React, { useState, useEffect, useMemo } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { motion, AnimatePresence } from 'framer-motion';

interface Command {
  id: string;
  label: string;
  icon?: string;
  category: string;
  description?: string;
  action: () => void;
  keywords?: string[];
}

interface CommandPaletteProps {
  commands: Command[];
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  commands,
  isOpen: controlledIsOpen,
  onOpenChange
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalOpen;

  const handleOpenChange = (open: boolean) => {
    setInternalOpen(open);
    onOpenChange?.(open);
    if (open) {
      setSearch('');
      setSelectedIndex(0);
    }
  };

  useHotkeys('cmd+k,ctrl+k', (e) => {
    e.preventDefault();
    handleOpenChange(!isOpen);
  });

  useHotkeys(
    'escape',
    () => handleOpenChange(false),
    { enabled: isOpen }
  );

  useHotkeys(
    'arrowdown',
    (e) => {
      e.preventDefault();
      setSelectedIndex((i) => (i + 1) % filteredCommands.length);
    },
    { enabled: isOpen && filteredCommands.length > 0 }
  );

  useHotkeys(
    'arrowup',
    (e) => {
      e.preventDefault();
      setSelectedIndex((i) => (i - 1 + filteredCommands.length) % filteredCommands.length);
    },
    { enabled: isOpen && filteredCommands.length > 0 }
  );

  useHotkeys(
    'enter',
    () => {
      if (filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].action();
        handleOpenChange(false);
      }
    },
    { enabled: isOpen && filteredCommands.length > 0 }
  );

  const filteredCommands = useMemo(() => {
    if (!search) return commands;

    const query = search.toLowerCase();
    return commands.filter(cmd =>
      cmd.label.toLowerCase().includes(query) ||
      cmd.description?.toLowerCase().includes(query) ||
      cmd.keywords?.some(kw => kw.toLowerCase().includes(query))
    );
  }, [search, commands]);

  const groupedCommands = useMemo(() => {
    const groups: { [key: string]: Command[] } = {};
    filteredCommands.forEach(cmd => {
      if (!groups[cmd.category]) {
        groups[cmd.category] = [];
      }
      groups[cmd.category].push(cmd);
    });
    return groups;
  }, [filteredCommands]);

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => handleOpenChange(!isOpen)}
        className="gs-command-palette-trigger"
        aria-label="Open command palette"
      >
        <span className="gs-command-icon">⌘</span>
        <span className="gs-command-label">Quick access</span>
        <kbd>⌘K</kbd>
      </button>

      {/* Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="gs-command-palette-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => handleOpenChange(false)}
          >
            <motion.div
              className="gs-command-palette-modal"
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="gs-command-palette-header">
                <input
                  type="text"
                  placeholder="Type a command or search..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setSelectedIndex(0);
                  }}
                  autoFocus
                  className="gs-command-input"
                />
              </div>

              <div className="gs-command-palette-body">
                {filteredCommands.length === 0 ? (
                  <div className="gs-command-empty">
                    <p>No commands found for "{search}"</p>
                  </div>
                ) : (
                  Object.entries(groupedCommands).map(([category, categoryCommands]) => (
                    <div key={category} className="gs-command-group">
                      <h3 className="gs-command-group-title">{category}</h3>
                      <ul className="gs-command-list">
                        {categoryCommands.map((cmd, idx) => {
                          const globalIndex = filteredCommands.findIndex(c => c.id === cmd.id);
                          return (
                            <motion.li
                              key={cmd.id}
                              className={`gs-command-item ${globalIndex === selectedIndex ? 'selected' : ''}`}
                              onClick={() => {
                                cmd.action();
                                handleOpenChange(false);
                              }}
                              whileHover={{ x: 4 }}
                            >
                              {cmd.icon && <span className="gs-command-item-icon">{cmd.icon}</span>}
                              <div className="gs-command-item-content">
                                <div className="gs-command-item-label">{cmd.label}</div>
                                {cmd.description && (
                                  <div className="gs-command-item-description">{cmd.description}</div>
                                )}
                              </div>
                            </motion.li>
                          );
                        })}
                      </ul>
                    </div>
                  ))
                )}
              </div>

              <div className="gs-command-palette-footer">
                <div className="gs-command-hint">
                  <kbd>↑</kbd> <kbd>↓</kbd> to navigate • <kbd>↵</kbd> to select • <kbd>Esc</kbd> to close
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
