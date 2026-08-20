import React, { useState, useEffect } from 'react';
import RoleCard from './RoleCard';
import PermissionSelector from './PermissionSelector';
import UserAccessTable from './UserAccessTable';
import { listRoles, createRole, updateRole, deleteRole, listUsers, inviteUser, updateUser, suspendUser, restoreUser, deleteUser, listPermissions } from '@lib/api/access-control';

interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
  is_default?: boolean;
}

interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
}

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

export default function AccessControlClient() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissionIds: [] as string[],
    reason: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [rolesRes, usersRes, permsRes] = await Promise.all([
        listRoles(0, 100),
        listUsers(0, 100),
        listPermissions(),
      ]);

      setRoles(rolesRes.roles || []);
      setUsers(usersRes.users || []);

      if (rolesRes.roles && rolesRes.roles.length > 0) {
        setSelectedRoleId(rolesRes.roles[0].id);
      }

      const allPerms: Permission[] = [];
      if (permsRes.categories) {
        permsRes.categories.forEach((cat: any) => {
          cat.permissions.forEach((perm: any) => {
            allPerms.push({
              id: perm.id,
              name: perm.name,
              description: perm.description,
              category: cat.category,
            });
          });
        });
      }
      setPermissions(allPerms);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectRole = (roleId: string) => {
    setSelectedRoleId(roleId);
    const role = roles.find(r => r.id === roleId);
    if (role) {
      setFormData({
        name: role.name,
        description: role.description || '',
        permissionIds: Array.isArray(role.permissions) ? role.permissions : JSON.parse(role.permissions || '[]'),
        reason: '',
      });
      setShowCreateForm(false);
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setError(null);

      if (!formData.name.trim()) {
        setError('Role name is required');
        return;
      }

      await createRole({
        name: formData.name,
        description: formData.description,
        permission_ids: formData.permissionIds,
        reason: formData.reason,
      });

      setFormData({ name: '', description: '', permissionIds: [], reason: '' });
      setShowCreateForm(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create role');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoleId) return;

    try {
      setIsSubmitting(true);
      setError(null);

      const selectedRole = roles.find(r => r.id === selectedRoleId);
      if (selectedRole?.is_default) {
        setError('Cannot modify default roles');
        return;
      }

      await updateRole(selectedRoleId, {
        description: formData.description,
        permission_ids: formData.permissionIds,
        reason: formData.reason,
      });

      setFormData({ name: '', description: '', permissionIds: [], reason: '' });
      setSelectedRoleId(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!confirm('Delete this role? Users assigned to this role will be unaffected.')) return;

    try {
      setError(null);
      await deleteRole(roleId);
      await loadData();
      if (selectedRoleId === roleId) {
        setSelectedRoleId(roles[0]?.id || null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete role');
    }
  };

  const handleEditUser = async (user: AdminUser) => {
    const newRole = prompt('Enter new role ID:');
    if (!newRole) return;

    try {
      setError(null);
      await updateUser(user.id, { roleId: newRole });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
    }
  };

  const handleSuspendUser = async (userId: string) => {
    try {
      setError(null);
      await suspendUser(userId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to suspend user');
    }
  };

  const handleRestoreUser = async (userId: string) => {
    try {
      setError(null);
      await restoreUser(userId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore user');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      setError(null);
      await deleteUser(userId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    }
  };

  if (isLoading) {
    return <div className="text-center py-12 text-gray-600">Loading access control data...</div>;
  }

  return (
    <div className="grid grid-cols-3 gap-8">
      <div className="col-span-1">
        <div className="bg-white rounded-lg border border-gray-200 p-6 sticky top-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Roles</h2>

          <button
            onClick={() => {
              setShowCreateForm(!showCreateForm);
              setSelectedRoleId(null);
              setFormData({ name: '', description: '', permissionIds: [], reason: '' });
            }}
            className="w-full mb-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded"
          >
            + Create Role
          </button>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {roles.map((role) => (
              <button
                key={role.id}
                onClick={() => handleSelectRole(role.id)}
                className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                  selectedRoleId === role.id
                    ? 'bg-blue-100 text-blue-900 border border-blue-300'
                    : 'hover:bg-gray-100 text-gray-900'
                }`}
              >
                <div className="font-medium">{role.name}</div>
                <div className="text-xs text-gray-600">
                  {Array.isArray(role.permissions) ? role.permissions.length : JSON.parse(role.permissions || '[]').length} perms
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="col-span-2 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {showCreateForm ? 'Create New Role' : selectedRoleId ? 'Edit Role' : 'Select a Role'}
          </h2>

          {(showCreateForm || selectedRoleId) && (
            <form onSubmit={showCreateForm ? handleCreateRole : handleUpdateRole} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Role Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Content Editor"
                  disabled={!showCreateForm && selectedRoleId && roles.find(r => r.id === selectedRoleId)?.is_default}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="What is this role for?"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm h-20"
                />
              </div>

              <PermissionSelector
                permissions={permissions}
                selectedIds={formData.permissionIds}
                onChange={(permIds) => setFormData({ ...formData, permissionIds: permIds })}
                disabled={!showCreateForm && selectedRoleId && roles.find(r => r.id === selectedRoleId)?.is_default}
              />

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Reason (optional)
                </label>
                <input
                  type="text"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="Why are you making this change?"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : showCreateForm ? 'Create Role' : 'Update Role'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setSelectedRoleId(null);
                    setFormData({ name: '', description: '', permissionIds: [], reason: '' });
                  }}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 text-sm font-medium rounded"
                >
                  Cancel
                </button>
                {selectedRoleId && !showCreateForm && !roles.find(r => r.id === selectedRoleId)?.is_default && (
                  <button
                    type="button"
                    onClick={() => handleDeleteRole(selectedRoleId)}
                    className="ml-auto px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded"
                  >
                    Delete Role
                  </button>
                )}
              </div>
            </form>
          )}

          {!showCreateForm && !selectedRoleId && (
            <p className="text-gray-600 text-sm">Select a role from the sidebar to edit it, or create a new one.</p>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Team Members</h2>
          <UserAccessTable
            users={users}
            onEdit={handleEditUser}
            onDelete={handleDeleteUser}
            onSuspend={handleSuspendUser}
            onRestore={handleRestoreUser}
          />
        </div>
      </div>
    </div>
  );
}
