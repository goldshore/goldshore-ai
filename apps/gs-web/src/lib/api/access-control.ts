const API_BASE = '/api/admin/rbac';

export async function listRoles(offset = 0, limit = 50) {
  const res = await fetch(`${API_BASE}/roles?offset=${offset}&limit=${limit}`);
  if (!res.ok) throw new Error(`Failed to list roles: ${res.statusText}`);
  return res.json();
}

export async function getRoleById(roleId: string) {
  const res = await fetch(`${API_BASE}/roles/${roleId}`);
  if (!res.ok) throw new Error(`Failed to get role: ${res.statusText}`);
  return res.json();
}

export async function createRole(data: {
  name: string;
  description?: string;
  permission_ids: string[];
  reason?: string;
}) {
  const res = await fetch(`${API_BASE}/roles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to create role: ${res.statusText}`);
  return res.json();
}

export async function updateRole(
  roleId: string,
  data: {
    description?: string;
    permission_ids?: string[];
    reason?: string;
  }
) {
  const res = await fetch(`${API_BASE}/roles/${roleId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to update role: ${res.statusText}`);
  return res.json();
}

export async function deleteRole(roleId: string, reason?: string) {
  const params = new URLSearchParams();
  if (reason) params.set('reason', reason);

  const res = await fetch(`${API_BASE}/roles/${roleId}?${params}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Failed to delete role: ${res.statusText}`);
  return res.json();
}

export async function listUsers(offset = 0, limit = 50, filters?: { status?: string; roleId?: string }) {
  const params = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
  });
  if (filters?.status) params.set('status', filters.status);
  if (filters?.roleId) params.set('roleId', filters.roleId);

  const res = await fetch(`${API_BASE}/users?${params}`);
  if (!res.ok) throw new Error(`Failed to list users: ${res.statusText}`);
  return res.json();
}

export async function getUserById(userId: string) {
  const res = await fetch(`${API_BASE}/users/${userId}`);
  if (!res.ok) throw new Error(`Failed to get user: ${res.statusText}`);
  return res.json();
}

export async function inviteUser(data: {
  email: string;
  name?: string;
  roleId: string;
  reason?: string;
}) {
  const res = await fetch(`${API_BASE}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to invite user: ${res.statusText}`);
  return res.json();
}

export async function updateUser(
  userId: string,
  data: {
    name?: string;
    roleId?: string;
    status?: 'active' | 'suspended' | 'revoked';
    reason?: string;
  }
) {
  const res = await fetch(`${API_BASE}/users/${userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to update user: ${res.statusText}`);
  return res.json();
}

export async function suspendUser(userId: string, reason?: string) {
  const res = await fetch(`${API_BASE}/users/${userId}/suspend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) throw new Error(`Failed to suspend user: ${res.statusText}`);
  return res.json();
}

export async function restoreUser(userId: string) {
  const res = await fetch(`${API_BASE}/users/${userId}/restore`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Failed to restore user: ${res.statusText}`);
  return res.json();
}

export async function deleteUser(userId: string, reason?: string) {
  const params = new URLSearchParams();
  if (reason) params.set('reason', reason);

  const res = await fetch(`${API_BASE}/users/${userId}?${params}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Failed to delete user: ${res.statusText}`);
  return res.json();
}

export async function listPermissions() {
  const res = await fetch(`${API_BASE}/permissions`);
  if (!res.ok) throw new Error(`Failed to list permissions: ${res.statusText}`);
  return res.json();
}

export async function getPermissionById(permId: string) {
  const res = await fetch(`${API_BASE}/permissions/${permId}`);
  if (!res.ok) throw new Error(`Failed to get permission: ${res.statusText}`);
  return res.json();
}
