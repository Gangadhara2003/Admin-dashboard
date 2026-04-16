import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'VCNITI Admin Dashboard',
  description: 'Admin management dashboard for VCNITI',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans bg-dark text-white min-h-screen">{children}</body>
    </html>
  );
}
