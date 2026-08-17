import React from 'react';

interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: string[] | string;
  is_default?: boolean;
}

interface RoleCardProps {
  role: Role;
  isSelected: boolean;
  onClick: () => void;
  onDelete: (id: string) => void;
}

export default function RoleCard({
  role,
  isSelected,
  onClick,
  onDelete,
}: RoleCardProps) {
  const permCount = Array.isArray(role.permissions)
    ? role.permissions.length
    : JSON.parse(role.permissions || '[]').length;

  return (
    <div
      onClick={onClick}
      className={`cursor-pointer p-4 rounded-lg border-2 transition-colors ${
        isSelected
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="font-semibold text-gray-900">{role.name}</h3>
          {role.description && (
            <p className="text-xs text-gray-600 mt-1">{role.description}</p>
          )}
        </div>
        {role.is_default && (
          <span className="text-xs bg-gray-200 text-gray-800 px-2 py-1 rounded">
            Default
          </span>
        )}
      </div>
      <div className="flex items-center justify-between text-xs text-gray-600">
        <span>{permCount} permissions</span>
        {!role.is_default && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(role.id);
            }}
            className="text-red-600 hover:text-red-700 font-medium"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
