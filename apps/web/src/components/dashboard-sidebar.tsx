'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { Activity, BarChart3, GitMerge, LayoutGrid, LogOut, User } from 'lucide-react';

interface SidebarProps {
  user: {
    name?: string | null;
    email?: string | null;
  };
}

export default function DashboardSidebar({ user }: SidebarProps) {
  const pathname = usePathname();

  const navItems = [
    { name: 'Overview', href: '/dashboard', icon: BarChart3 },
    { name: 'Funnels', href: '/dashboard/funnels', icon: GitMerge },
    { name: 'Real-time', href: '/dashboard/realtime', icon: Activity },
  ];

  return (
    <aside className="w-64 border-r border-neutral-900 bg-neutral-950 flex flex-col h-screen shrink-0">
      {/* Brand logo header */}
      <div className="h-16 flex items-center px-6 border-b border-neutral-900 gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-primary to-indigo-600 shadow-md shadow-primary/20">
          <LayoutGrid className="h-4.5 w-4.5 text-white" />
        </div>
        <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-neutral-50 to-neutral-200 bg-clip-text text-transparent">
          Lumino
        </span>
      </div>

      {/* Navigation list */}
      <nav className="flex-1 py-6 px-4 space-y-1.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition duration-200 ${
                isActive
                  ? 'bg-neutral-900 text-neutral-50 border border-neutral-800/60 shadow-inner'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/40'
              }`}
            >
              <Icon className={`h-4.5 w-4.5 ${isActive ? 'text-primary' : 'text-neutral-400'}`} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer user profile section */}
      <div className="p-4 border-t border-neutral-900 space-y-4">
        <div className="flex items-center gap-3 px-2">
          <div className="h-9 w-9 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-400">
            <User className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-neutral-300 truncate">{user.name || 'Tenant'}</p>
            <p className="text-[10px] text-neutral-500 truncate">{user.email || 'tenant@company.com'}</p>
          </div>
        </div>

        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-900 hover:border-neutral-800 hover:bg-neutral-900/60 text-xs font-medium text-neutral-400 hover:text-neutral-200 transition duration-150"
        >
          <LogOut className="h-3.5 w-3.5 text-neutral-500" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
