import React, { useEffect, useState } from 'react';

export default function DashboardClient() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOnline) {
    return (
      <div className="fixed bottom-4 right-4 p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
        You are currently offline. Some features may not work.
      </div>
    );
  }

  return null;
}
