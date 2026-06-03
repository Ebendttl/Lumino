import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: 'Lumino Analytics | Privacy-Friendly Web Analytics',
  description: 'Lightweight, cookie-free, and real-time alternative to Google Analytics.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>✨</text></svg>" />
      </head>
      <body className="antialiased min-h-screen bg-neutral-950 text-neutral-50">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
