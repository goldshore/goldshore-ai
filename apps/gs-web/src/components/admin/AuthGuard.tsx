import React from 'react';

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

// This used to gate `children` on a client-side JWT read from a cookie named
// "CF-Authorization". Two things made that check impossible to ever pass:
// Cloudflare Access's real session cookie is "CF_Authorization" (underscore,
// not hyphen), and Access sets it HttpOnly regardless of name — client-side
// JS can never read it, by design. Every component wrapped in AuthGuard
// (EmailManager, UsersManager, EntriesManager, TokensManager, ...) has been
// permanently stuck on "Authentication Required" as a result, independent of
// whether the operator was actually logged in.
//
// The real auth boundary for this app is server-side: Cloudflare Access at
// the edge (nothing renders without a valid session), gs-web's own
// middleware (authorizeAdminRequest), and gs-api's Access verification on
// every proxied call. A component reaching the browser at all means that
// chain already passed — there is nothing left for a client-side gate to
// usefully check, so this just renders its children.
export default function AuthGuard({ children }: AuthGuardProps) {
  return <>{children}</>;
}
