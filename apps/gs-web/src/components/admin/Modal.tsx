import React, { useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  onSubmit?: () => void;
  submitLabel?: string;
  isLoading?: boolean;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  onSubmit,
  submitLabel = 'Save',
  isLoading = false,
}: ModalProps) {
  // The close button has always advertised "Close (Esc)" without anything
  // listening for it.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="gs-modal-overlay" role="dialog" aria-modal="true" aria-label={title}>
      {/* A real button, not a bare div: the backdrop is the expected way out of
          a dialog on touch, and it needs to be reachable by keyboard too. */}
      <button type="button" className="gs-modal-backdrop" aria-label="Close" onClick={onClose} />

      <div className="gs-modal-panel">
        <div className="gs-modal-head">
          <h2 className="gs-modal-title">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="gs-modal-close"
            aria-label="Close"
            title="Close (Esc)"
          >
            ×
          </button>
        </div>

        <div className="gs-modal-body gs-stack-sm">{children}</div>

        {onSubmit && (
          <div className="gs-modal-foot">
            <button
              type="button"
              onClick={onClose}
              className="gs-button gs-button--secondary gs-button--small"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSubmit}
              className="gs-button gs-button--small"
              disabled={isLoading}
            >
              {isLoading ? 'Saving...' : submitLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
