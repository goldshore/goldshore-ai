import React from 'react';

interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
}

interface PermissionSelectorProps {
  permissions: Permission[];
  selectedIds: string[];
  onChange: (permIds: string[]) => void;
  disabled?: boolean;
}

export default function PermissionSelector({
  permissions,
  selectedIds,
  onChange,
  disabled = false,
}: PermissionSelectorProps) {
  const handleToggle = (permId: string) => {
    if (selectedIds.includes(permId)) {
      onChange(selectedIds.filter(id => id !== permId));
    } else {
      onChange([...selectedIds, permId]);
    }
  };

  const groupedByCategory = permissions.reduce((acc, perm) => {
    if (!acc[perm.category]) {
      acc[perm.category] = [];
    }
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  return (
    <div>
      <label>
        Permissions
      </label>
      <div className="gs-stack-sm">
        {Object.entries(groupedByCategory).map(([category, perms]) => (
          <div key={category}>
            <h4>{category}</h4>
            <div className="gs-input-group">
              {perms.map((perm) => (
                <label key={perm.id} >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(perm.id)}
                    onChange={() => handleToggle(perm.id)}
                    disabled={disabled}
                    
                  />
                  <div>
                    <div>{perm.name}</div>
                    <div className="gs-cell-meta">{perm.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
