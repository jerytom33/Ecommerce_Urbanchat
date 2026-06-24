import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Storefront - E-commerce Platform',
  description: 'Customer-facing storefront with fast, streaming server-side rendering',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#6366f1',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-text font-sans antialiased">
        {/* Above-the-fold header renders immediately (no Suspense) */}
        <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto flex h-16 items-center justify-between px-4">
            <span className="text-xl font-bold text-primary">Store</span>
            <nav className="hidden md:flex items-center gap-6" aria-label="Main navigation">
              {/* Nav items added in subsequent tasks */}
            </nav>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          {children}
        </main>

        <footer className="border-t border-border bg-surface mt-auto">
          <div className="container mx-auto px-4 py-8">
            <p className="text-sm text-muted">&copy; 2024 E-commerce Platform. All rights reserved.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
