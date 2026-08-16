import React, { useState } from 'react';
import DataTable from './DataTable';
import Modal from './Modal';
import FormField from './FormField';
import AuthGuard from './AuthGuard';
import { useAuthToken } from '../../utils/auth';

interface User {
  id: string;
  email: string;
  role: 'admin' | 'moderator' | 'viewer';
  status: 'active' | 'inactive' | 'suspended';
  created_at: string;
}

interface Props {
  jwtToken?: string;
  initialUsers?: User[];
}

function UsersManagerContent({ jwtToken: _jwtToken }: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ email: '', role: 'viewer' });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { token } = useAuthToken();

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleAddUser = async () => {
    setError(null);
    setSuccess(null);

    if (!formData.email.trim()) {
      setError('Email address is required');
      return;
    }

    if (!validateEmail(formData.email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsSaving(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch('/api/admin/users', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(formData),
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        setFormData({ email: '', role: 'viewer' });
        setSuccess('User added successfully');
        setTimeout(() => {
          setIsModalOpen(false);
          window.location.reload();
        }, 1000);
      } else if (response.status === 401) {
        setError('Authentication expired. Please refresh the page.');
      } else if (response.status === 409) {
        setError('This email address is already registered');
      } else if (response.status === 400) {
        const err = await response.json().catch(() => ({}));
        setError(err.message || 'Invalid user data');
      } else {
        setError(`Failed to add user (HTTP ${response.status})`);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Request timed out. Please try again.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to add user');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'moderator':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">User Management</h2>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          + Add User
        </button>
      </div>

      <DataTable<User>
        columns={[
          { key: 'email', label: 'Email' },
          {
            key: 'role',
            label: 'Role',
            render: (v) => (
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRoleColor(v)}`}>
                {v}
              </span>
            ),
          },
          {
            key: 'status',
            label: 'Status',
            render: (v) => (
              <span className={`px-3 py-1 rounded text-sm font-medium ${v === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                {v}
              </span>
            ),
          },
          { key: 'created_at', label: 'Joined', render: (v) => new Date(v).toLocaleDateString() },
        ]}
        endpoint="/api/admin/users"
        title="Admin Users"
        actions={(row) => (
          <div className="flex gap-2">
            <button className="text-blue-500 hover:text-blue-700" title="Change permissions">
              Permissions
            </button>
            <button className="text-red-500 hover:text-red-700" title="Remove user">
              Remove
            </button>
          </div>
        )}
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setError(null);
          setSuccess(null);
        }}
        title="Add User"
        onSubmit={handleAddUser}
        isLoading={isSaving}
      >
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
            {success}
          </div>
        )}
        <FormField
          label="Email Address"
          name="email"
          type="email"
          value={formData.email}
          onChange={(v) => setFormData({ ...formData, email: String(v) })}
          placeholder="user@example.com"
          required
        />
        <FormField
          label="Role"
          name="role"
          type="select"
          value={formData.role}
          onChange={(v) => setFormData({ ...formData, role: String(v) })}
          options={[
            { value: 'viewer', label: 'Viewer (read-only)' },
            { value: 'moderator', label: 'Moderator (limited write)' },
            { value: 'admin', label: 'Admin (full access)' },
          ]}
          required
        />
      </Modal>
    </div>
  );
}

export default function UsersManager(props: Props) {
  return (
    <AuthGuard>
      <UsersManagerContent {...props} />
    </AuthGuard>
  );
}
