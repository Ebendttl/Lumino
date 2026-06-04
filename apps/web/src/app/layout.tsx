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
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect x='5' y='5' width='90' height='90' rx='30' fill='%23635bff' /><rect x='23' y='23' width='22' height='22' rx='4' fill='none' stroke='%23ffffff' stroke-width='6' /><rect x='55' y='23' width='22' height='22' rx='4' fill='none' stroke='%23ffffff' stroke-width='6' /><rect x='23' y='55' width='22' height='22' rx='4' fill='none' stroke='%23ffffff' stroke-width='6' /><rect x='55' y='55' width='22' height='22' rx='4' fill='none' stroke='%23ffffff' stroke-width='6' /></svg>" />
      </head>
      <body className="antialiased min-h-screen bg-neutral-950 text-neutral-50">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
