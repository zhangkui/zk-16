import ProtectedRoute from '@/components/ProtectedRoute';
import MainLayout from '@/components/MainLayout';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <MainLayout>{children}</MainLayout>
    </ProtectedRoute>
  );
}
