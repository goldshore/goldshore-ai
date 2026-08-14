import React, { useState } from 'react';
import { Table } from './Table';
import { Pagination } from './Pagination';
import { Form } from './Form';
import { Modal } from './Modal';

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  created_at: string;
  invited_at?: string;
  accepted_at?: string;
  last_login?: string;
}

interface UsersManagerProps {
  jwtToken: string;
  initialUsers: {
    items: AdminUser[];
    total: number;
    offset: number;
    limit: number;
    error?: string | null;
  };
}

export default function UsersManager({ jwtToken, initialUsers }: UsersManagerProps) {
  const [users, setUsers] = useState<AdminUser[]>(initialUsers.items || []);
  const [total, setTotal] = useState(initialUsers.total || 0);
  const [offset, setOffset] = useState(initialUsers.offset || 0);
  const [limit, setLimit] = useState(initialUsers.limit || 25);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const fetchUsers = async (newOffset: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        offset: String(newOffset),
        limit: String(limit),
      });

      const response = await fetch(`https://api.goldshore.ai/admin/users?${params}`, {
        headers: {
          'CF-Authorization': jwtToken,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.items || []);
        setTotal(data.total || 0);
        setOffset(newOffset);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (data: Record<string, any>) => {
    try {
      const response = await fetch(`https://api.goldshore.ai/admin/users`, {
        method: 'POST',
        headers: {
          'CF-Authorization': jwtToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: data.email,
          name: data.name,
          role: data.role || 'moderator',
        }),
      });

      if (response.ok) {
        setShowAddModal(false);
        setAddError(null);
        await fetchUsers(offset);
      } else {
        const error = await response.json();
        setAddError(error.error || 'Failed to create user');
      }
    } catch (error) {
      setAddError(error instanceof Error ? error.message : 'An error occurred');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this user?')) return;

    try {
      const response = await fetch(`https://api.goldshore.ai/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'CF-Authorization': jwtToken,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        await fetchUsers(offset);
        setSelectedUser(null);
      }
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  };

  const handleResendInvite = async (userId: string) => {
    try {
      const response = await fetch(`https://api.goldshore.ai/admin/users/${userId}/resend-invite`, {
        method: 'POST',
        headers: {
          'CF-Authorization': jwtToken,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        await fetchUsers(offset);
      }
    } catch (error) {
      console.error('Error resending invite:', error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Users ({total})</h3>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
        >
          + Add User
        </button>
      </div>

      <Table<AdminUser>
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'email', label: 'Email' },
          {
            key: 'role',
            label: 'Role',
            render: (role) => <span className="capitalize font-semibold">{role}</span>,
          },
          {
            key: 'status',
            label: 'Status',
            render: (status) => (
              <span
                className={`px-2 py-1 text-xs font-semibold rounded ${
                  status === 'active'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}
              >
                {status}
              </span>
            ),
          },
        ]}
        data={users}
        loading={loading}
        onRowClick={setSelectedUser}
        emptyMessage="No users found"
      />

      <Pagination
        total={total}
        offset={offset}
        limit={limit}
        onOffsetChange={fetchUsers}
      />

      {selectedUser && (
        <div className="gs-card space-y-4">
          <h3 className="text-lg font-semibold">User Details</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div>
                <p className="text-sm gs-text-subtle">Name</p>
                <p className="font-semibold">{selectedUser.name}</p>
              </div>
              <div>
                <p className="text-sm gs-text-subtle">Email</p>
                <p className="font-mono text-sm">{selectedUser.email}</p>
              </div>
              <div>
                <p className="text-sm gs-text-subtle">Role</p>
                <p className="font-semibold capitalize">{selectedUser.role}</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-sm gs-text-subtle">Status</p>
                <p className="font-semibold capitalize">{selectedUser.status}</p>
              </div>
              <div>
                <p className="text-sm gs-text-subtle">Created</p>
                <p>{new Date(selectedUser.created_at).toLocaleString()}</p>
              </div>
              {selectedUser.invited_at && (
                <div>
                  <p className="text-sm gs-text-subtle">Invited</p>
                  <p>{new Date(selectedUser.invited_at).toLocaleString()}</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {selectedUser.status !== 'active' && (
              <button
                onClick={() => handleResendInvite(selectedUser.id)}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded hover:bg-green-700"
              >
                Resend Invite
              </button>
            )}
            <button
              onClick={() => handleDeleteUser(selectedUser.id)}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700"
            >
              Remove User
            </button>
            <button
              onClick={() => setSelectedUser(null)}
              className="px-4 py-2 text-sm font-medium border rounded gs-text-subtle hover:bg-opacity-50"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <Modal isOpen={showAddModal} title="Add New User" onClose={() => setShowAddModal(false)}>
        <Form
          fields={[
            {
              name: 'email',
              label: 'Email',
              type: 'email',
              required: true,
              placeholder: 'user@example.com',
            },
            {
              name: 'name',
              label: 'Name',
              type: 'text',
              required: true,
              placeholder: 'John Doe',
            },
            {
              name: 'role',
              label: 'Role',
              type: 'select',
              required: true,
              options: [
                { label: 'Admin', value: 'admin' },
                { label: 'Moderator', value: 'moderator' },
                { label: 'Viewer', value: 'viewer' },
              ],
            },
          ]}
          onSubmit={handleAddUser}
          submitLabel="Create User"
          error={addError || undefined}
        />
      </Modal>
    </div>
  );
}
