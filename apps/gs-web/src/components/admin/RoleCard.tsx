import React, { useState } from 'react';
import { Trash2, Edit3, Users } from 'lucide-react';

interface RoleCardProps {
  role: {
    id: string;
    name: string;
    description?: string;
    permissions: string[];
    is_default?: boolean;
  };
  userCount?: number;
  onEdit?: (role: any) => void;
  onDelete?: (roleId: string) => void;
  onViewUsers?: (roleId: string) => void;
}

export default function RoleCard({
  role,
  userCount = 0,
  onEdit,
  onDelete,
  onViewUsers,
}: RoleCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const permissionCount = Array.isArray(role.permissions)
    ? role.permissions.length
    : JSON.parse(role.permissions || '[]').length;

  const handleDelete = () => {
    if (onDelete) {
      onDelete(role.id);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">{role.name}</h3>
          {role.description && (
            <p className="text-sm text-gray-600 mt-1">{role.description}</p>
          )}
        </div>
        {role.is_default && (
          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
            System
          </span>
        )}
      </div>

      <div className="space-y-3 mb-4 pb-4 border-b border-gray-200">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium text-gray-700 w-24">Permissions:</span>
          <span className="text-gray-600">{permissionCount} assigned</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Users className="w-4 h-4 text-gray-500" />
          <span className="text-gray-600">{userCount} users assigned</span>
        </div>
      </div>

      <div className="flex gap-2">
        {onViewUsers && (
          <button
            onClick={() => onViewUsers(role.id)}
            className="flex-1 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-900 rounded transition-colors"
          >
            View Users
          </button>
        )}
        {onEdit && !role.is_default && (
          <button
            onClick={() => onEdit(role)}
            className="flex-1 px-3 py-2 text-sm bg-blue-100 hover:bg-blue-200 text-blue-900 rounded transition-colors flex items-center justify-center gap-1"
          >
            <Edit3 className="w-4 h-4" />
            Edit
          </button>
        )}
        {onDelete && !role.is_default && (
          <div className="relative">
            <button
              onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
              className="flex-1 px-3 py-2 text-sm bg-red-100 hover:bg-red-200 text-red-900 rounded transition-colors flex items-center justify-center gap-1"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>

            {showDeleteConfirm && (
              <div className="absolute top-full mt-2 right-0 bg-white border border-red-200 rounded-lg shadow-lg p-3 z-10 w-48">
                <p className="text-sm font-medium text-gray-900 mb-3">
                  Delete "{role.name}"?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDelete}
                    className="flex-1 px-3 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded"
                  >
                    Yes, delete
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 px-3 py-1 text-xs bg-gray-200 hover:bg-gray-300 text-gray-900 rounded"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
