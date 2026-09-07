import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import { ToastProvider } from '@/components/toast-provider';
import './globals.css';

const geist = Geist({
  variable: '--font-sans-app',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Collab Docs',
  description: 'Collaborative workspace with real-time CRDT editing',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geist.variable} antialiased`}>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
