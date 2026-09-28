import type { Metadata } from 'next';
import Shell from '@/components/layout/Shell';
import './globals.css';

export const metadata: Metadata = {
  title: 'Workshop',
  description: 'Workshop trainee portal',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className="dark h-full antialiased">
      <body className="min-h-full bg-slate-950 font-sans text-slate-100">
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
