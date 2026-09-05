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
        return 'success';
      case 'suspended':
        return 'danger';
      case 'pending':
        return 'warning';
      default:
        return '';
    }
  };

  if (isLoading) {
    return (
      <div className="gs-row">
        <div className="gs-text-subtle">Loading users...</div>
      </div>
    );
  }

  if (!users.length) {
    return (
      <div className="gs-row">
        <div className="gs-text-subtle">No users found</div>
      </div>
    );
  }

  return (
    <div>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Joined</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} >
              <td>{user.name || 'N/A'}</td>
              <td>{user.email}</td>
              <td>{getRoleName(user.role_id)}</td>
              <td>
                <span className={`gs-badge ${getStatusColor(user.status)}`}>
                  {user.status}
                </span>
              </td>
              <td className="gs-cell-meta">
                {new Date(user.created_at).toLocaleDateString()}
              </td>
              <td className="gs-cell-meta">
                {onEdit && (
                  <button
                    onClick={() => onEdit(user)}
                    className="gs-link-button"
                  >
                    Edit
                  </button>
                )}
                {user.status === 'active' && onSuspend && (
                  <button
                    onClick={() => onSuspend(user.id)}
                    className="gs-link-button"
                  >
                    Suspend
                  </button>
                )}
                {user.status === 'suspended' && onRestore && (
                  <button
                    onClick={() => onRestore(user.id)}
                    className="gs-link-button"
                  >
                    Restore
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={() => onDelete(user.id)}
                    className="gs-link-button gs-link-button--danger"
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
