import { verifyAccess, type Env as AuthEnv } from '@goldshore/auth';

/**
 * Verifies that the request is authenticated via Cloudflare Access.
 * Delegates to the shared @goldshore/auth package.
 *
 * @param req The incoming request
 * @param env The environment bindings (should contain CF Access Audience/Domain)
 * @returns boolean indicating if the request is authenticated
 */
export async function checkAuth(req: Request, env: AuthEnv) {
  return verifyAccess(req, env);
}
