import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { SiteProvider } from '@/components/site-context';
import DashboardSidebar from '@/components/dashboard-sidebar';

export const dynamic = 'force-dynamic';

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
        <main className="flex-1 overflow-y-auto relative flex flex-col justify-between">
          <div className="flex-1">
            {children}
          </div>
          <footer className="w-full border-t border-neutral-900 bg-neutral-950/80 backdrop-blur-md py-4 px-6 md:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-neutral-500 gap-2 shrink-0">
            <div>
              &copy; {new Date().getFullYear()} Lumino. Privacy-friendly real-time web analytics.
            </div>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                All systems operational
              </span>
              <span>v1.0.0</span>
            </div>
          </footer>
        </main>
      </div>
    </SiteProvider>
  );
}
