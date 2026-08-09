type AccessResult =
  | { ok: true }
  | { ok: false; error: string; status: number };

export async function requireAdminAccess(
  request: Request,
  _env: Record<string, unknown>,
  _options?: { requiredPermission?: string },
): Promise<AccessResult> {
  // Auth is enforced by middleware; this is a defense-in-depth boundary check.
  const jwt = request.headers.get('CF-Access-Jwt-Assertion');
  if (!jwt) {
    return { ok: false, error: 'Unauthorized', status: 401 };
  }
  return { ok: true };
}
