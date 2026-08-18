export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
  is_default?: boolean;
}

export interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  role_id: string;
  status: 'active' | 'suspended' | 'pending';
  created_at: string;
}

export async function listRoles(): Promise<Role[]> {
  const response = await fetch('/api/admin/roles', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) throw new Error('Failed to list roles');
  return response.json();
}

export async function createRole(role: Omit<Role, 'id'>): Promise<Role> {
  const response = await fetch('/api/admin/roles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(role),
  });
  if (!response.ok) throw new Error('Failed to create role');
  return response.json();
}

export async function updateRole(id: string, role: Partial<Role>): Promise<Role> {
  const response = await fetch(`/api/admin/roles/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(role),
  });
  if (!response.ok) throw new Error('Failed to update role');
  return response.json();
}

export async function deleteRole(id: string): Promise<void> {
  const response = await fetch(`/api/admin/roles/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete role');
}

export async function listUsers(): Promise<User[]> {
  const response = await fetch('/api/admin/users', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) throw new Error('Failed to list users');
  return response.json();
}

export async function inviteUser(email: string, roleId: string): Promise<User> {
  const response = await fetch('/api/admin/users/invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, role_id: roleId }),
  });
  if (!response.ok) throw new Error('Failed to invite user');
  return response.json();
}

export async function updateUser(id: string, updates: Partial<User>): Promise<User> {
  const response = await fetch(`/api/admin/users/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!response.ok) throw new Error('Failed to update user');
  return response.json();
}

export async function suspendUser(id: string): Promise<User> {
  return updateUser(id, { status: 'suspended' });
}

export async function restoreUser(id: string): Promise<User> {
  return updateUser(id, { status: 'active' });
}

export async function deleteUser(id: string): Promise<void> {
  const response = await fetch(`/api/admin/users/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete user');
}

export async function listPermissions(): Promise<Permission[]> {
  const response = await fetch('/api/admin/permissions', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) throw new Error('Failed to list permissions');
  return response.json();
}
