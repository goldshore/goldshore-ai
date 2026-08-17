import React from 'react';

interface AdminUser {
  id: string;
  email: string;
  name?: string;
  role_id: string;
  role_name: string;
  status: 'active' | 'suspended' | 'revoked';
  last_login?: string;
  created_at: string;
}

interface UserAccessTableProps {
  users: AdminUser[];
  onEdit: (user: AdminUser) => void;
  onDelete: (userId: string) => void;
  onSuspend: (userId: string) => void;
  onRestore: (userId: string) => void;
}

export default function UserAccessTable({
  users,
  onEdit,
  onDelete,
  onSuspend,
  onRestore,
}: UserAccessTableProps) {
  if (!users.length) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 text-sm">No team members yet</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-gray-200 bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-gray-900">Email</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-900">Name</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-900">Role</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-900">Status</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-900">Last Login</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-900">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {users.map((user) => (
            <tr key={user.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-900 font-medium">{user.email}</td>
              <td className="px-4 py-3 text-gray-900">{user.name || '-'}</td>
              <td className="px-4 py-3 text-gray-900">{user.role_name}</td>
              <td className="px-4 py-3">
                <span
                  className={`inline-block px-2 py-1 text-xs font-medium rounded ${
                    user.status === 'active'
                      ? 'bg-green-100 text-green-800'
                      : user.status === 'suspended'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                  }`}
                >
                  {user.status}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-600 text-xs">
                {user.last_login
                  ? new Date(user.last_login).toLocaleDateString()
                  : 'Never'}
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  <button
                    onClick={() => onEdit(user)}
                    className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                  >
                    Edit
                  </button>
                  {user.status === 'active' ? (
                    <button
                      onClick={() => onSuspend(user.id)}
                      className="text-yellow-600 hover:text-yellow-700 text-xs font-medium"
                    >
                      Suspend
                    </button>
                  ) : user.status === 'suspended' ? (
                    <button
                      onClick={() => onRestore(user.id)}
                      className="text-green-600 hover:text-green-700 text-xs font-medium"
                    >
                      Restore
                    </button>
                  ) : null}
                  <button
                    onClick={() => onDelete(user.id)}
                    className="text-red-600 hover:text-red-700 text-xs font-medium"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
