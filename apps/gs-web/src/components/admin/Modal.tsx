import React from 'react';

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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-lg max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 font-bold text-2xl leading-none"
            aria-label="Close"
            title="Close (Esc)"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-4">{children}</div>

        {onSubmit && (
          <div className="flex gap-2 p-6 border-t justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              onClick={onSubmit}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
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
