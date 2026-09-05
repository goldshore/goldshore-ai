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
      className={`gs-selectable ${isSelected ? 'is-selected' : ''}`}
    >
      <div>
        <div>
          <h3>{role.name}</h3>
          {role.description && (
            <p className="gs-cell-meta">{role.description}</p>
          )}
        </div>
        {role.is_default && (
          <span className="gs-badge">
            Default
          </span>
        )}
      </div>
      <div className="gs-row gs-row--between">
        <span>{permCount} permissions</span>
        {!role.is_default && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(role.id);
            }}
            className="gs-link-button gs-link-button--danger"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
