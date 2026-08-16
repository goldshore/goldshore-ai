import React, { useState } from 'react';
import { Users, Plus, Trash2, Lock } from 'lucide-react';
import { DataTable } from './DataTable';
import { Modal } from './Modal';
import { FormField } from './FormField';

interface User {
  id: string;
  email: string;
  role: 'admin' | 'moderator' | 'viewer';
  status: 'active' | 'inactive' | 'suspended';
  created_at: string;
}

export function UsersManager() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ email: '', role: 'viewer' });
  const [isSaving, setIsSaving] = useState(false);

  const handleAddUser = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (response.ok) {
        setFormData({ email: '', role: 'viewer' });
        setIsModalOpen(false);
        window.location.reload();
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
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Users size={32} /> User Management
        </h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          <Plus size={20} /> Add User
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
              <Lock size={18} />
            </button>
            <button className="text-red-500 hover:text-red-700" title="Remove user">
              <Trash2 size={18} />
            </button>
          </div>
        )}
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add User"
        onSubmit={handleAddUser}
        isLoading={isSaving}
      >
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
