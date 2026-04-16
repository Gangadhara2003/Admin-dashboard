import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'NEXUS | Admin Command',
  description: 'Admin management dashboard — NEXUS Command Center',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans bg-dark text-white min-h-screen">{children}</body>
    </html>
  );
}
