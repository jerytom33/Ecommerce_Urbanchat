import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from './components/Sidebar';

export const metadata: Metadata = {
  title: 'Admin Panel - E-commerce Platform',
  description: 'Merchant administration dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-text font-sans antialiased">
        <div className="flex min-h-screen">
          <Sidebar />
          {/* Main content area */}
          <main className="flex-1 flex flex-col min-w-0 lg:ml-0">
            <header className="h-16 border-b border-border bg-background flex items-center px-6 shrink-0">
              {/* Spacer for mobile hamburger button */}
              <div className="lg:hidden w-10" />
              <h1 className="text-lg font-semibold text-text">Admin Panel</h1>
            </header>
            <div className="flex-1 p-4 sm:p-6 overflow-auto">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
