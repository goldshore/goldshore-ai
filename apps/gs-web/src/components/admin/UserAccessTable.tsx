import React from 'react';

interface User {
  id: string;
  email: string;
  name?: string;
  role_id: string;
  status: 'active' | 'suspended' | 'pending';
  created_at: string;
}

interface UserAccessTableProps {
  users: User[];
  roles: Array<{ id: string; name: string }>;
  isLoading?: boolean;
  onEdit?: (user: User) => void;
  onSuspend?: (userId: string) => void;
  onRestore?: (userId: string) => void;
  onDelete?: (userId: string) => void;
}

export default function UserAccessTable({
  users,
  roles,
  isLoading = false,
  onEdit,
  onSuspend,
  onRestore,
  onDelete,
}: UserAccessTableProps) {
  const getRoleName = (roleId: string) => {
    return roles.find(r => r.id === roleId)?.name || 'Unknown';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'suspended':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-600">Loading users...</div>
      </div>
    );
  }

  if (!users.length) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-600">No users found</div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-gray-200 bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-gray-900">Name</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-900">Email</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-900">Role</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-900">Status</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-900">Joined</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-900">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {users.map((user) => (
            <tr key={user.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-900">{user.name || 'N/A'}</td>
              <td className="px-4 py-3 text-gray-900">{user.email}</td>
              <td className="px-4 py-3 text-gray-900">{getRoleName(user.role_id)}</td>
              <td className="px-4 py-3">
                <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${getStatusColor(user.status)}`}>
                  {user.status}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-600 text-xs">
                {new Date(user.created_at).toLocaleDateString()}
              </td>
              <td className="px-4 py-3 text-gray-600 text-xs space-x-2">
                {onEdit && (
                  <button
                    onClick={() => onEdit(user)}
                    className="text-blue-600 hover:underline"
                  >
                    Edit
                  </button>
                )}
                {user.status === 'active' && onSuspend && (
                  <button
                    onClick={() => onSuspend(user.id)}
                    className="text-yellow-600 hover:underline"
                  >
                    Suspend
                  </button>
                )}
                {user.status === 'suspended' && onRestore && (
                  <button
                    onClick={() => onRestore(user.id)}
                    className="text-green-600 hover:underline"
                  >
                    Restore
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={() => onDelete(user.id)}
                    className="text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
