/**
 * Authentication Middleware
 */

export interface AuthContext {
  user?: { id: string; email: string; roles: string[] };
  authenticated: boolean;
  token?: string;
}

export async function verifyAuth(request: Request, env: any): Promise<AuthContext> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { authenticated: false };
  }

  const token = authHeader.slice(7);
  
  try {
    const verified = await verifyJWT(token, env.JWT_SECRET);
    return {
      authenticated: true,
      token,
      user: {
        id: verified.sub,
        email: verified.email,
        roles: verified.roles || [],
      },
    };
  } catch {
    return { authenticated: false };
  }
}

function verifyJWT(token: string, secret: string): Promise<any> {
  // Stub: Implement JWT verification with @cloudflare/workers-jwt or similar
  return Promise.resolve({ sub: 'user-id', email: 'user@example.com', roles: [] });
}

export function requireAuth(handler: Function) {
  return async (req: Request, env: any) => {
    const auth = await verifyAuth(req, env);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return handler(req, env, auth);
  };
}
