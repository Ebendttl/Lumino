import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { SiteProvider } from '@/components/site-context';
import DashboardSidebar from '@/components/dashboard-sidebar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Route guard: force login if no valid session
  if (!session?.user) {
    redirect('/login');
  }

  return (
    <SiteProvider>
      <div className="flex h-screen bg-neutral-950 text-neutral-100 overflow-hidden">
        <DashboardSidebar user={session.user} />
        <main className="flex-1 overflow-y-auto relative">
          {children}
        </main>
      </div>
    </SiteProvider>
  );
}
