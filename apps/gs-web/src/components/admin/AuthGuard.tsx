import React, { useEffect, useState } from 'react';
import { useAuthToken, getTokenExpiresIn } from '../../utils/auth';

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function AuthGuard({ children, fallback }: AuthGuardProps) {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { token, isValid } = useAuthToken();

  useEffect(() => {
    setIsLoading(true);
    const authorized = !!token && isValid;
    setIsAuthorized(authorized);
    setIsLoading(false);

    if (authorized) {
      const expiresIn = getTokenExpiresIn(token);
      if (expiresIn && expiresIn > 0) {
        const timeout = setTimeout(() => {
          window.location.reload();
        }, expiresIn * 1000 - 60000);

        return () => clearTimeout(timeout);
      }
    }
  }, [token, isValid]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-gray-500">Checking authentication...</div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      fallback || (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-6 rounded-lg text-center">
          <h3 className="font-semibold mb-2">Authentication Required</h3>
          <p className="text-sm mb-4">Your session is not authenticated. Please log in again.</p>
          <a href="/" className="text-yellow-700 hover:text-yellow-900 underline">
            Return to home
          </a>
        </div>
      )
    );
  }

  return <>{children}</>;
}
