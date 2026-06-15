'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Spin } from 'antd';
import { useAuthStore } from '@/store/auth';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, checkAuth, fetchUser, user } = useAuthStore();

  useEffect(() => {
    const hasToken = checkAuth();
    if (!hasToken) {
      router.replace('/login');
      return;
    } else if (!user) {
      fetchUser().catch(() => {
        router.replace('/login');
      });
    }
  }, [router, pathname]);

  if (!isAuthenticated || !user) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  return <>{children}</>;
}
