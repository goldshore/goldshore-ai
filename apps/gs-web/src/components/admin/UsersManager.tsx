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
        return 'danger';
      case 'moderator':
        return 'warning';
      default:
        return 'info';
    }
  };

  return (
    <div className="gs-stack">
      <div className="gs-row gs-row--between">
        <h2>User Management</h2>
        <button
          onClick={() => setIsModalOpen(true)}
          className="gs-button">
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
              <span className={`gs-badge ${getRoleColor(v)}`}>
                {v}
              </span>
            ),
          },
          {
            key: 'status',
            label: 'Status',
            render: (v) => (
              <span className={`gs-badge ${v === 'active' ? 'success' : ''}`}>
                {v}
              </span>
            ),
          },
          { key: 'created_at', label: 'Joined', render: (v) => new Date(v).toLocaleDateString() },
        ]}
        endpoint="/api/admin/users"
        title="Admin Users"
        actions={(row) => (
          <div className="gs-row">
            <button className="gs-link-button" title="Change permissions">
              Permissions
            </button>
            <button className="gs-link-button gs-link-button--danger" title="Remove user">
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
        isLoading={isSaving}>
        {error && (
          <div className="gs-alert gs-alert--error">
            {error}
          </div>
        )}
        {success && (
          <div className="gs-alert gs-alert--success">
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
