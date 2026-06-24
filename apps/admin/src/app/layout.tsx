import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Admin Panel - E-commerce Platform',
  description: 'Merchant administration dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-text font-sans antialiased">
        <div className="flex min-h-screen">
          {/* Sidebar placeholder for admin navigation */}
          <aside className="hidden lg:flex lg:w-64 lg:flex-col border-r border-border bg-surface">
            <div className="flex h-16 items-center px-6 border-b border-border">
              <span className="text-lg font-semibold text-primary">Admin</span>
            </div>
            <nav className="flex-1 px-4 py-4" aria-label="Main navigation">
              {/* Navigation items will be added in subsequent tasks */}
            </nav>
          </aside>
          {/* Main content area */}
          <main className="flex-1 flex flex-col">
            <header className="h-16 border-b border-border bg-background flex items-center px-6">
              {/* Top bar content will be added in subsequent tasks */}
            </header>
            <div className="flex-1 p-6">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
