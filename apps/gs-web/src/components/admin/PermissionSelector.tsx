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
      <label className="block text-sm font-medium text-gray-900 mb-3">
        Permissions
      </label>
      <div className="space-y-4 max-h-96 overflow-y-auto border border-gray-200 rounded-lg p-4 bg-gray-50">
        {Object.entries(groupedByCategory).map(([category, perms]) => (
          <div key={category}>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">{category}</h4>
            <div className="space-y-2 ml-2">
              {perms.map((perm) => (
                <label key={perm.id} className="flex items-start cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(perm.id)}
                    onChange={() => handleToggle(perm.id)}
                    disabled={disabled}
                    className="mt-1 mr-2 cursor-pointer disabled:opacity-50"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900">{perm.name}</div>
                    <div className="text-xs text-gray-600">{perm.description}</div>
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
